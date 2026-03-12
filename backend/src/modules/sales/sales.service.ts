import { supabase } from '../../config/supabase';
import { saleSchema } from '../../domain/validators';
import { generateSaleNumber } from '../../utils/id';
import { logger } from '../../utils/logger';
import { InventoryService } from '../inventory/inventory.service';

const inventoryService = new InventoryService();

export class SalesService {
  private async consumeFifoCost(
    shopId: string,
    productId: string,
    requiredQty: number
  ): Promise<{ costTotal: number; avgCost: number; basis: Array<{ quantity: number; unitCost: number }> }> {
    const qtyNeeded = Number(requiredQty || 0);
    if (!Number.isFinite(qtyNeeded) || qtyNeeded <= 0) {
      return { costTotal: 0, avgCost: 0, basis: [] };
    }

    const { data: layers, error } = await supabase
      .from('stock_cost_layers')
      .select('*')
      .eq('shop_id', shopId)
      .eq('product_id', productId)
      .gt('remaining_quantity', 0)
      .order('received_at', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      const product = await inventoryService.getProductById(productId);
      const fallbackCost = Number(product.cost_price || 0);
      return {
        costTotal: Number((fallbackCost * qtyNeeded).toFixed(2)),
        avgCost: fallbackCost,
        basis: [{ quantity: qtyNeeded, unitCost: fallbackCost }],
      };
    }

    let remaining = qtyNeeded;
    const basis: Array<{ quantity: number; unitCost: number }> = [];
    for (const layer of layers || []) {
      if (remaining <= 0) break;
      const layerRemaining = Number(layer.remaining_quantity || 0);
      if (layerRemaining <= 0) continue;
      const takeQty = Math.min(remaining, layerRemaining);
      remaining -= takeQty;
      const nextRemaining = Number((layerRemaining - takeQty).toFixed(3));
      await supabase
        .from('stock_cost_layers')
        .update({ remaining_quantity: nextRemaining })
        .eq('id', layer.id);
      basis.push({ quantity: Number(takeQty.toFixed(3)), unitCost: Number(layer.unit_cost || 0) });
    }

    if (remaining > 0.0001) {
      const product = await inventoryService.getProductById(productId);
      const fallbackCost = Number(product.cost_price || 0);
      basis.push({ quantity: Number(remaining.toFixed(3)), unitCost: fallbackCost });
    }

    const costTotal = Number(
      basis.reduce((sum, b) => sum + Number(b.quantity) * Number(b.unitCost), 0).toFixed(2)
    );
    const avgCost = qtyNeeded > 0 ? Number((costTotal / qtyNeeded).toFixed(4)) : 0;
    return { costTotal, avgCost, basis };
  }

  private async restoreCostLayerFromReturn(
    shopId: string,
    productId: string,
    userId: string,
    quantity: number,
    unitCost: number,
    sourceId: string
  ) {
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    await supabase.from('stock_cost_layers').insert({
      shop_id: shopId,
      product_id: productId,
      source_type: 'return',
      source_id: sourceId,
      unit_cost: Number.isFinite(unitCost) ? Number(unitCost) : 0,
      initial_quantity: Number(quantity),
      remaining_quantity: Number(quantity),
      created_by: userId,
    });
  }

  async createSale(shopId: string, userId: string, data: any) {
    const validated = saleSchema.parse(data);

    if (data.client_sale_id) {
      const { data: existing } = await supabase
        .from('sales')
        .select('id')
        .eq('shop_id', shopId)
        .eq('client_sale_id', data.client_sale_id)
        .maybeSingle();
  
      if (existing) {
        logger.info(`Duplicate sale blocked: client_sale_id=${data.client_sale_id}`);
        return this.getSaleById(existing.id);
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    let totalAmount = 0;
    const saleItems: Array<{
      product_id: string;
      quantity: number;
      unit_price: number;
      discount_amount: number;
      total_price: number;
      cost_total: number;
      avg_cost: number;
      cost_basis_json: Array<{ quantity: number; unitCost: number }>;
    }> = [];

    for (const item of validated.items) {
      // Soft pre-check: fast early exit for obviously wrong requests.
      // Not relied upon for correctness — the atomic RPC below is the real guard.
      const product = await inventoryService.getProductById(item.product_id);
      if (product.shop_id !== shopId) {
        throw new Error(`Product ${item.product_id} does not belong to this shop`);
      }
      if (Number(product.stock_quantity) < item.quantity) {
        throw new Error(
          `Insufficient stock for "${product.name}". Available: ${product.stock_quantity}, requested: ${item.quantity}`
        );
      }
      const itemTotal = item.unit_price * item.quantity - (item.discount_amount || 0);
      const fifo = await this.consumeFifoCost(shopId, item.product_id, Number(item.quantity || 0));
      totalAmount += itemTotal;
      saleItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount || 0,
        total_price: itemTotal,
        cost_total: fifo.costTotal,
        avg_cost: fifo.avgCost,
        cost_basis_json: fifo.basis,
      });
    }

    const finalAmount =
      totalAmount - (validated.discount_amount || 0) + (validated.tax_amount || 0);
    const saleNumber = generateSaleNumber(shopId);

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        shop_id: shopId,
        customer_id: validated.customer_id || null,
        sale_number: saleNumber,
        total_amount: totalAmount,
        discount_amount: validated.discount_amount || 0,
        tax_amount: validated.tax_amount || 0,
        final_amount: finalAmount,
        payment_method: validated.payment_method,
        status: 'completed',
        notes: validated.notes,
        created_by: userId,
        client_sale_id: data.client_sale_id || null,
      })
      .select()
      .single();

    if (saleError) {
      logger.error('Error creating sale:', saleError);
      throw new Error('Failed to create sale');
    }

    const itemsToInsert = saleItems.map((item) => ({ ...item, sale_id: sale.id }));
    const { error: itemsError } = await supabase.from('sale_items').insert(itemsToInsert);

    if (itemsError) {
      logger.error('Error creating sale items:', itemsError);
      await supabase.from('sales').delete().eq('id', sale.id);
      throw new Error('Failed to create sale items');
    }

    for (const item of validated.items) {
      // Preferred path: atomic decrement via PostgreSQL row-level lock.
      const { data: decrementResult, error: decrementError } = await supabase
        .rpc('decrement_stock_safe', {
          p_product_id: item.product_id,
          p_shop_id:    shopId,
          p_quantity:   item.quantity,
        });

      let oldQty = 0;
      let newQty = 0;

      if (decrementError) {
        // The RPC may not have been created in this Supabase project yet.
        // Fall back to a plain UPDATE so sales still complete.
        const rpcMissing = /could not find|does not exist|function.*schema/i.test(
          decrementError.message || ''
        );

        if (!rpcMissing) {
          // Real DB error (constraint, permission, etc.) — roll back.
          await supabase.from('sale_items').delete().eq('sale_id', sale.id);
          await supabase.from('sales').delete().eq('id', sale.id);
          throw new Error(`Stock update failed for product ${item.product_id}. Please try again.`);
        }

        // Fallback: read current stock and do a direct UPDATE.
        const { data: prod, error: prodErr } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.product_id)
          .eq('shop_id', shopId)
          .single();

        if (prodErr || !prod) {
          await supabase.from('sale_items').delete().eq('sale_id', sale.id);
          await supabase.from('sales').delete().eq('id', sale.id);
          throw new Error(`Product not found: ${item.product_id}`);
        }

        oldQty = Number(prod.stock_quantity);
        newQty = oldQty - item.quantity;

        if (newQty < 0) {
          await supabase.from('sale_items').delete().eq('sale_id', sale.id);
          await supabase.from('sales').delete().eq('id', sale.id);
          throw new Error(`Insufficient stock for product ${item.product_id}. Available: ${oldQty}`);
        }

        const { error: updateErr } = await supabase
          .from('products')
          .update({ stock_quantity: newQty, updated_at: new Date().toISOString() })
          .eq('id', item.product_id)
          .eq('shop_id', shopId);

        if (updateErr) {
          await supabase.from('sale_items').delete().eq('sale_id', sale.id);
          await supabase.from('sales').delete().eq('id', sale.id);
          throw new Error(`Stock update failed for product ${item.product_id}. Please try again.`);
        }

        logger.warn(`decrement_stock_safe RPC missing — used fallback UPDATE for product ${item.product_id}. Create the RPC in Supabase for concurrency safety.`);
      } else if (!decrementResult?.ok) {
        // RPC ran but returned ok:false (e.g., insufficient stock).
        await supabase.from('sale_items').delete().eq('sale_id', sale.id);
        await supabase.from('sales').delete().eq('id', sale.id);
        throw new Error(
          decrementResult?.error ||
          `Stock update failed for product ${item.product_id}. Please try again.`
        );
      } else {
        oldQty = Number(decrementResult.old_quantity);
        newQty  = Number(decrementResult.new_quantity);
      }

      await inventoryService.logStockMovement(
        shopId,
        item.product_id,
        userId,
        'sale',
        item.quantity,
        oldQty,
        newQty,
        `Sale ${saleNumber}`
      );
    }

    if (validated.payment_method === 'credit' && validated.customer_id) {
      const { error: creditError } = await supabase.rpc('increment_credit_balance', {
        p_customer_id: validated.customer_id,
        p_shop_id: shopId,
        p_amount: finalAmount,
      });
    
      if (creditError) {
        logger.error('increment_credit_balance RPC failed:', creditError);
    
        const { data: customer, error: customerFetchError } = await supabase
          .from('customers')
          .select('credit_balance')
          .eq('id', validated.customer_id)
          .eq('shop_id', shopId)
          .single();
    
        if (customerFetchError || !customer) {
          await supabase.from('sale_items').delete().eq('sale_id', sale.id);
          await supabase.from('sales').delete().eq('id', sale.id);
          throw new Error('Failed to load customer for credit update');
        }
    
        const { error: customerUpdateError } = await supabase
          .from('customers')
          .update({
            credit_balance: Number(customer.credit_balance || 0) + Number(finalAmount),
            updated_at: new Date().toISOString(),
          })
          .eq('id', validated.customer_id)
          .eq('shop_id', shopId);
    
        if (customerUpdateError) {
          logger.error('Fallback customer credit update failed:', customerUpdateError);
          await supabase.from('sale_items').delete().eq('sale_id', sale.id);
          await supabase.from('sales').delete().eq('id', sale.id);
          throw new Error('Failed to update customer credit balance');
        }
      }
    }

    return this.getSaleById(sale.id);
  }

  async getSaleById(saleId: string, shopId?: string) {
    let query = supabase
      .from('sales')
      .select(
        `
        *,
        customer:customers(*),
        items:sale_items(
          *,
          product:products(*)
        )
      `
      )
      .eq('id', saleId);

    // When called from the public API endpoint, enforce shop isolation.
    if (shopId) query = query.eq('shop_id', shopId);

    const { data: sale, error } = await query.single();

    if (error) {
      logger.error('Error fetching sale:', error);
      throw new Error('Sale not found');
    }
    return sale;
  }

  async getSales(
    shopId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      customer_id?: string;
      payment_method?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    let query = supabase
      .from('sales')
      .select(
        `
        *,
        customer:customers(*),
        items:sale_items(
          *,
          product:products(*)
        )
      `
      )
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (filters?.startDate) query = query.gte('created_at', filters.startDate);
    if (filters?.endDate) query = query.lte('created_at', filters.endDate);
    if (filters?.customer_id) query = query.eq('customer_id', filters.customer_id);
    if (filters?.payment_method) query = query.eq('payment_method', filters.payment_method);
    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.limit) query = query.limit(filters.limit);
    if (filters?.offset)
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);

    const { data, error } = await query;
    if (error) {
      logger.error('Error fetching sales:', error);
      throw new Error('Failed to fetch sales');
    }
    return data || [];
  }

  async getGoodsSoldSummary(
    shopId: string,
    startDate?: string,
    endDate?: string
  ) {
    let query = supabase
      .from('sale_items')
      .select(`
        id,
        quantity,
        returned_quantity,
        total_price,
        cost_total,
        avg_cost,
        cost_basis_json,
        product:products(id,name),
        sale:sales!inner(id,shop_id,created_at,status,sale_number,final_amount,refunded_amount,notes)
      `)
      .eq('sale.shop_id', shopId)
      .eq('sale.status', 'completed')
      .order('created_at', { ascending: false });
    if (startDate) query = query.gte('sale.created_at', startDate);
    if (endDate) query = query.lte('sale.created_at', endDate);

    const { data, error } = await query;
    if (error) {
      logger.error('Error fetching goods sold summary:', error);
      throw new Error('Failed to fetch goods sold summary');
    }

    const grouped: Record<string, any> = {};
    for (const row of data || []) {
      const productId = String((row as any).product?.id || 'unknown');
      if (!grouped[productId]) {
        grouped[productId] = {
          productId,
          productName: (row as any).product?.name || 'Unnamed product',
          grossSoldQty: 0,
          returnedQty: 0,
          netSoldQty: 0,
          revenueGross: 0,
          costTotal: 0,
          costBreakdown: [] as Array<{ quantity: number; unitCost: number }>,
        };
      }
      const qty = Number((row as any).quantity || 0);
      const returned = Number((row as any).returned_quantity || 0);
      const netQty = Math.max(0, qty - returned);
      grouped[productId].grossSoldQty += qty;
      grouped[productId].returnedQty += returned;
      grouped[productId].netSoldQty += netQty;
      grouped[productId].revenueGross += Number((row as any).total_price || 0);
      grouped[productId].costTotal += Number((row as any).cost_total || 0);
      const basis = Array.isArray((row as any).cost_basis_json) ? (row as any).cost_basis_json : [];
      for (const b of basis) {
        grouped[productId].costBreakdown.push({
          quantity: Number((b as any)?.quantity || 0),
          unitCost: Number((b as any)?.unitCost || 0),
        });
      }
    }

    const products = Object.values(grouped).map((g: any) => {
      const avgCost = g.grossSoldQty > 0 ? Number((g.costTotal / g.grossSoldQty).toFixed(4)) : 0;
      const netRevenue = Number((g.revenueGross).toFixed(2));
      const netProfit = Number((netRevenue - g.costTotal).toFixed(2));
      return {
        ...g,
        revenueGross: Number(g.revenueGross.toFixed(2)),
        costTotal: Number(g.costTotal.toFixed(2)),
        avgCost,
        netProfit,
      };
    });
    return products.sort((a: any, b: any) => b.netProfit - a.netProfit);
  }

  async getSalesSummary(shopId: string, startDate?: string, endDate?: string) {
    let query = supabase
      .from('sales')
      .select('final_amount, payment_method, created_at')
      .eq('shop_id', shopId)
      .eq('status', 'completed');

    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query;
    if (error) {
      logger.error('Error fetching sales summary:', error);
      throw new Error('Failed to fetch sales summary');
    }

    const sales = data || [];
    const totalSales = sales.reduce((sum, s) => sum + Number(s.final_amount), 0);
    const totalTransactions = sales.length;
    const paymentMethodBreakdown = sales.reduce((acc: any, s) => {
      const method = s.payment_method;
      acc[method] = (acc[method] || 0) + Number(s.final_amount);
      return acc;
    }, {});

    return {
      totalSales,
      totalTransactions,
      averageTransaction: totalTransactions > 0 ? totalSales / totalTransactions : 0,
      paymentMethodBreakdown,
    };
  }

  async cancelSale(saleId: string, shopId: string, userId: string) {
    const sale = await this.getSaleById(saleId);
    if (sale.shop_id !== shopId) throw new Error('Sale does not belong to this shop');
    if (sale.status !== 'completed') throw new Error('Only completed sales can be cancelled');

    for (const item of sale.items || []) {
      const product = await inventoryService.getProductById(item.product_id);
      const newQuantity = Number(product.stock_quantity) + item.quantity;
      await supabase
        .from('products')
        .update({
          stock_quantity: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.product_id);

      await inventoryService.logStockMovement(
        shopId,
        item.product_id,
        userId,
        'adjustment',
        item.quantity,
        Number(product.stock_quantity),
        newQuantity,
        `Sale cancellation: ${sale.sale_number}`
      );
      await this.restoreCostLayerFromReturn(
        shopId,
        item.product_id,
        userId,
        Number(item.quantity || 0),
        Number(item.avg_cost || product.cost_price || 0),
        String(saleId)
      );
    }

    if (sale.payment_method === 'credit' && sale.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('credit_balance')
        .eq('id', sale.customer_id)
        .single();
      if (customer) {
        await supabase
          .from('customers')
          .update({
            credit_balance: Math.max(0, Number(customer.credit_balance) - Number(sale.final_amount)),
            updated_at: new Date().toISOString(),
          })
          .eq('id', sale.customer_id);
      }
    }

    const { data: updatedSale, error } = await supabase
      .from('sales')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', saleId)
      .select()
      .single();

    if (error) {
      logger.error('Error cancelling sale:', error);
      throw new Error('Failed to cancel sale');
    }
    return updatedSale;
  }

  async returnSaleItem(
    saleId: string,
    shopId: string,
    userId: string,
    input: { sale_item_id: string; quantity: number; reason?: string }
  ) {
    const sale = await this.getSaleById(saleId);
    if (sale.shop_id !== shopId) throw new Error('Sale does not belong to this shop');
    if (sale.status !== 'completed') throw new Error('Only completed sales can be adjusted');

    const item = (sale.items || []).find((i: any) => String(i.id) === String(input.sale_item_id));
    if (!item) throw new Error('Sale item not found');

    const qty = Number(input.quantity || 0);
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('Valid return quantity is required');
    const alreadyReturned = Number(item.returned_quantity || 0);
    const soldQty = Number(item.quantity || 0);
    const available = soldQty - alreadyReturned;
    if (qty > available + 0.0001) throw new Error(`Return quantity exceeds available quantity (${available})`);

    const unitPrice = Number(item.unit_price || 0);
    const refundAmount = Number((qty * unitPrice).toFixed(2));
    const now = new Date().toISOString();

    await supabase
      .from('sale_items')
      .update({
        returned_quantity: Number((alreadyReturned + qty).toFixed(3)),
      })
      .eq('id', item.id);

    await supabase
      .from('sales')
      .update({
        refunded_amount: Number((Number(sale.refunded_amount || 0) + refundAmount).toFixed(2)),
        updated_at: now,
      })
      .eq('id', saleId);

    await supabase.from('sale_returns').insert({
      shop_id: shopId,
      sale_id: saleId,
      sale_item_id: item.id,
      product_id: item.product_id,
      quantity: qty,
      amount: refundAmount,
      reason: input.reason?.trim() || null,
      created_by: userId,
    });

    const product = await inventoryService.getProductById(item.product_id);
    const newQuantity = Number(product.stock_quantity || 0) + qty;
    await supabase
      .from('products')
      .update({
        stock_quantity: newQuantity,
        updated_at: now,
      })
      .eq('id', item.product_id);

    await inventoryService.logStockMovement(
      shopId,
      item.product_id,
      userId,
      'return',
      qty,
      Number(product.stock_quantity || 0),
      newQuantity,
      `Sale return: ${sale.sale_number}`
    );

    await this.restoreCostLayerFromReturn(
      shopId,
      item.product_id,
      userId,
      qty,
      Number(item.avg_cost || product.cost_price || 0),
      String(saleId)
    );

    return this.getSaleById(saleId);
  }

  async createPartialRefund(
    saleId: string,
    shopId: string,
    userId: string,
    input: { amount: number; reason?: string }
  ) {
    const sale = await this.getSaleById(saleId);
    if (sale.shop_id !== shopId) throw new Error('Sale does not belong to this shop');
    if (sale.status !== 'completed') throw new Error('Only completed sales can be adjusted');
    const amount = Number(input.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Valid refund amount is required');
    const maxAvailable = Number(sale.final_amount || 0) - Number(sale.refunded_amount || 0);
    if (amount > maxAvailable + 0.0001) {
      throw new Error(`Refund amount exceeds available net sale amount (${maxAvailable.toFixed(2)})`);
    }

    const now = new Date().toISOString();
    await supabase.from('sale_refunds').insert({
      shop_id: shopId,
      sale_id: saleId,
      amount,
      affects_stock: false,
      reason: input.reason?.trim() || null,
      created_by: userId,
    });
    await supabase
      .from('sales')
      .update({
        refunded_amount: Number((Number(sale.refunded_amount || 0) + amount).toFixed(2)),
        updated_at: now,
      })
      .eq('id', saleId);
    return this.getSaleById(saleId);
  }
}
