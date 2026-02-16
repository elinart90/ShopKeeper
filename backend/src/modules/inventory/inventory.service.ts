import { supabase } from '../../config/supabase';
import { productSchema, productUpdateSchema } from '../../domain/validators';
import { logger } from '../../utils/logger';

export class InventoryService {
  async createProduct(shopId: string, userId: string, data: any) {
    const validated = productSchema.parse(data);

    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        ...validated,
        shop_id: shopId,
      })
      .select()
      .single();

    if (productError) {
      logger.error('Error creating product:', productError);
      throw new Error('Failed to create product');
    }

    if (validated.stock_quantity > 0) {
      await this.logStockMovement(
        shopId,
        product.id,
        userId,
        'purchase',
        validated.stock_quantity,
        0,
        validated.stock_quantity,
        'Initial stock'
      );
    }

    return product;
  }

  async checkDuplicate(shopId: string, barcode?: string, name?: string) {
    const result: { existingByBarcode: any; possibleByName: any[] } = {
      existingByBarcode: null,
      possibleByName: [],
    };
    if (barcode?.trim()) {
      const byBarcode = await this.getProductByBarcode(shopId, barcode.trim());
      result.existingByBarcode = byBarcode ? { id: byBarcode.id, name: byBarcode.name } : null;
    }
    if (name?.trim()) {
      const list = await this.getProducts(shopId, { search: name.trim() });
      result.possibleByName = (list || []).slice(0, 5).map((p: any) => ({ id: p.id, name: p.name, barcode: p.barcode }));
    }
    return result;
  }

  async receiveStock(shopId: string, productId: string, userId: string, quantity: number, note?: string) {
    const product = await this.getProductById(productId);
    if (product.shop_id !== shopId) throw new Error('Product not found');
    const prev = Number(product.stock_quantity);
    const newQty = prev + quantity;
    if (newQty < 0) throw new Error('Stock cannot be negative');
    const { error } = await supabase
      .from('products')
      .update({ stock_quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', productId);
    if (error) throw new Error('Failed to update stock');
    await this.logStockMovement(shopId, productId, userId, 'purchase', quantity, prev, newQty, note || 'Receive stock');
    return this.getProductById(productId);
  }

  async getProducts(shopId: string, filters?: {
    category_id?: string;
    search?: string;
    low_stock?: boolean;
    is_active?: boolean;
  }) {
    let query = supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false });

    if (filters?.category_id) query = query.eq('category_id', filters.category_id);
    if (filters?.is_active !== undefined) query = query.eq('is_active', filters.is_active);
    if (filters?.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,barcode.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`
      );
    }

    const { data: list, error } = await query;

    if (error) {
      logger.error('Error fetching products:', error);
      throw new Error('Failed to fetch products');
    }

    let result = (list || []).map((p: any) => ({
      ...p,
      category: p.category,
      category_id: p.category_id,
    }));

    if (filters?.low_stock) {
      result = result.filter((p: any) => p.stock_quantity <= (p.min_stock_level || 0));
    }

    return result;
  }

  async getProductById(productId: string) {
    const { data: product, error } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('id', productId)
      .single();

    if (error) {
      logger.error('Error fetching product:', error);
      throw new Error('Product not found');
    }
    return { ...product, category: (product as any).category };
  }

  async getProductByBarcode(shopId: string, barcode: string) {
    const { data: product, error } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('shop_id', shopId)
      .eq('barcode', barcode)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !product) return null;
    return { ...product, category: (product as any).category };
  }

  async updateProduct(productId: string, shopId: string, userId: string, data: any) {
    const existing = await this.getProductById(productId);
    if (existing.shop_id !== shopId) {
      throw new Error('Product does not belong to this shop');
    }

    const validated = productUpdateSchema.parse(data);
    const previousQuantity = existing.stock_quantity;
    const newQuantity = validated.stock_quantity ?? previousQuantity;

    const { data: product, error } = await supabase
      .from('products')
      .update({ ...validated, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating product:', error);
      throw new Error('Failed to update product');
    }

    if (validated.stock_quantity !== undefined && validated.stock_quantity !== previousQuantity) {
      const quantityDiff = validated.stock_quantity - previousQuantity;
      await this.logStockMovement(
        shopId,
        productId,
        userId,
        'adjustment',
        Math.abs(quantityDiff),
        previousQuantity,
        validated.stock_quantity,
        `Stock adjustment: ${quantityDiff > 0 ? '+' : ''}${quantityDiff}`
      );
    }

    return product;
  }

  async deleteProduct(productId: string, shopId: string) {
    await supabase
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', productId)
      .eq('shop_id', shopId);
    return { success: true };
  }

  async getLowStockProducts(shopId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('shop_id', shopId)
      .eq('is_active', true);

    if (error) throw new Error('Failed to fetch products');
    return (data || []).filter(
      (p: any) => Number(p.stock_quantity) <= Number(p.min_stock_level || 0)
    );
  }

  async logStockMovement(
    shopId: string,
    productId: string,
    userId: string,
    action: string,
    quantity: number,
    previousQuantity: number,
    newQuantity: number,
    notes?: string
  ) {
    await supabase.from('stock_movements').insert({
      shop_id: shopId,
      product_id: productId,
      action,
      quantity,
      previous_quantity: previousQuantity,
      new_quantity: newQuantity,
      notes,
      created_by: userId,
    });
  }

  async getStockHistory(productId: string, limit: number = 50) {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error('Failed to fetch stock history');
    return data || [];
  }

  async createCategory(shopId: string, data: { name: string; description?: string; parent_id?: string }) {
    const { data: category, error } = await supabase
      .from('categories')
      .insert({ shop_id: shopId, ...data })
      .select()
      .single();

    if (error) {
      logger.error('Error creating category:', error);
      throw new Error('Failed to create category');
    }
    return category;
  }

  async getCategories(shopId: string) {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('shop_id', shopId)
      .order('name');

    if (error) throw new Error('Failed to fetch categories');
    return data || [];
  }
}
