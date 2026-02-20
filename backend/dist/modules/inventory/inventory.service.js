"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const supabase_1 = require("../../config/supabase");
const validators_1 = require("../../domain/validators");
const logger_1 = require("../../utils/logger");
class InventoryService {
    async createProduct(shopId, userId, data) {
        const validated = validators_1.productSchema.parse(data);
        const normalizedBarcode = String(validated.barcode || '').trim();
        if (normalizedBarcode) {
            const { data: existingByBarcode, error: barcodeErr } = await supabase_1.supabase
                .from('products')
                .select('id,name')
                .eq('shop_id', shopId)
                .eq('barcode', normalizedBarcode)
                .eq('is_active', true)
                .maybeSingle();
            if (barcodeErr) {
                logger_1.logger.error('Error checking duplicate barcode:', barcodeErr);
                throw new Error('Failed to validate barcode uniqueness');
            }
            if (existingByBarcode?.id) {
                throw new Error(`Barcode already exists on product "${existingByBarcode.name}". Open that product and update stock instead.`);
            }
        }
        const { data: product, error: productError } = await supabase_1.supabase
            .from('products')
            .insert({
            ...validated,
            barcode: normalizedBarcode || undefined,
            shop_id: shopId,
        })
            .select()
            .single();
        if (productError) {
            logger_1.logger.error('Error creating product:', productError);
            throw new Error('Failed to create product');
        }
        if (validated.stock_quantity > 0) {
            await this.addCostLayer(shopId, product.id, userId, Number(validated.stock_quantity), Number(validated.cost_price || 0), 'initial_stock', product.id);
            await this.logStockMovement(shopId, product.id, userId, 'purchase', validated.stock_quantity, 0, validated.stock_quantity, 'Initial stock');
        }
        return product;
    }
    async checkDuplicate(shopId, barcode, name) {
        const result = {
            existingByBarcode: null,
            possibleByName: [],
        };
        if (barcode?.trim()) {
            const byBarcode = await this.getProductByBarcode(shopId, barcode.trim());
            result.existingByBarcode = byBarcode ? { id: byBarcode.id, name: byBarcode.name } : null;
        }
        if (name?.trim()) {
            const list = await this.getProducts(shopId, { search: name.trim() });
            result.possibleByName = (list || []).slice(0, 5).map((p) => ({ id: p.id, name: p.name, barcode: p.barcode }));
        }
        return result;
    }
    async receiveStock(shopId, productId, userId, quantity, note, unitCost) {
        const product = await this.getProductById(productId);
        if (product.shop_id !== shopId)
            throw new Error('Product not found');
        const prev = Number(product.stock_quantity);
        const newQty = prev + quantity;
        if (newQty < 0)
            throw new Error('Stock cannot be negative');
        const appliedUnitCost = Number.isFinite(unitCost)
            ? Number(unitCost)
            : Number(product.cost_price || 0);
        const { error } = await supabase_1.supabase
            .from('products')
            .update({
            stock_quantity: newQty,
            cost_price: appliedUnitCost,
            updated_at: new Date().toISOString(),
        })
            .eq('id', productId);
        if (error)
            throw new Error('Failed to update stock');
        await this.addCostLayer(shopId, productId, userId, Number(quantity), appliedUnitCost, 'purchase', productId);
        await this.logStockMovement(shopId, productId, userId, 'purchase', quantity, prev, newQty, note || 'Receive stock');
        return this.getProductById(productId);
    }
    async getProducts(shopId, filters) {
        const includeActiveOnly = filters?.is_active === undefined ? true : filters.is_active;
        let query = supabase_1.supabase
            .from('products')
            .select('*, category:categories(*)')
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false });
        if (filters?.category_id)
            query = query.eq('category_id', filters.category_id);
        query = query.eq('is_active', includeActiveOnly);
        if (filters?.search) {
            query = query.or(`name.ilike.%${filters.search}%,barcode.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`);
        }
        const { data: list, error } = await query;
        if (error) {
            logger_1.logger.error('Error fetching products:', error);
            throw new Error('Failed to fetch products');
        }
        let result = (list || []).map((p) => ({
            ...p,
            category: p.category,
            category_id: p.category_id,
        }));
        if (filters?.low_stock) {
            result = result.filter((p) => p.stock_quantity <= (p.min_stock_level || 0));
        }
        return result;
    }
    async getProductById(productId) {
        const { data: product, error } = await supabase_1.supabase
            .from('products')
            .select('*, category:categories(*)')
            .eq('id', productId)
            .single();
        if (error) {
            logger_1.logger.error('Error fetching product:', error);
            throw new Error('Product not found');
        }
        return { ...product, category: product.category };
    }
    async getProductByBarcode(shopId, barcode) {
        const { data: product, error } = await supabase_1.supabase
            .from('products')
            .select('*, category:categories(*)')
            .eq('shop_id', shopId)
            .eq('barcode', barcode)
            .eq('is_active', true)
            .maybeSingle();
        if (error || !product)
            return null;
        return { ...product, category: product.category };
    }
    async updateProduct(productId, shopId, userId, data) {
        const existing = await this.getProductById(productId);
        if (existing.shop_id !== shopId) {
            throw new Error('Product does not belong to this shop');
        }
        const validated = validators_1.productUpdateSchema.parse(data);
        const normalizedBarcode = validated.barcode !== undefined ? String(validated.barcode || '').trim() : undefined;
        if (normalizedBarcode) {
            const { data: dup, error: dupErr } = await supabase_1.supabase
                .from('products')
                .select('id,name')
                .eq('shop_id', shopId)
                .eq('barcode', normalizedBarcode)
                .eq('is_active', true)
                .neq('id', productId)
                .maybeSingle();
            if (dupErr) {
                logger_1.logger.error('Error checking duplicate barcode on update:', dupErr);
                throw new Error('Failed to validate barcode uniqueness');
            }
            if (dup?.id) {
                throw new Error(`Barcode already exists on product "${dup.name}".`);
            }
        }
        const previousQuantity = existing.stock_quantity;
        const newQuantity = validated.stock_quantity ?? previousQuantity;
        const { data: product, error } = await supabase_1.supabase
            .from('products')
            .update({
            ...validated,
            ...(normalizedBarcode !== undefined ? { barcode: normalizedBarcode || null } : {}),
            updated_at: new Date().toISOString(),
        })
            .eq('id', productId)
            .select()
            .single();
        if (error) {
            logger_1.logger.error('Error updating product:', error);
            throw new Error('Failed to update product');
        }
        if (validated.stock_quantity !== undefined && validated.stock_quantity !== previousQuantity) {
            const quantityDiff = validated.stock_quantity - previousQuantity;
            await this.logStockMovement(shopId, productId, userId, 'adjustment', Math.abs(quantityDiff), previousQuantity, validated.stock_quantity, `Stock adjustment: ${quantityDiff > 0 ? '+' : ''}${quantityDiff}`);
        }
        return product;
    }
    async deleteProduct(productId, shopId) {
        await supabase_1.supabase
            .from('products')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', productId)
            .eq('shop_id', shopId);
        return { success: true };
    }
    async getLowStockProducts(shopId) {
        const { data, error } = await supabase_1.supabase
            .from('products')
            .select('*')
            .eq('shop_id', shopId)
            .eq('is_active', true);
        if (error)
            throw new Error('Failed to fetch products');
        return (data || []).filter((p) => Number(p.stock_quantity) <= Number(p.min_stock_level || 0));
    }
    async logStockMovement(shopId, productId, userId, action, quantity, previousQuantity, newQuantity, notes) {
        await supabase_1.supabase.from('stock_movements').insert({
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
    async addCostLayer(shopId, productId, userId, quantity, unitCost, sourceType, sourceId) {
        if (!Number.isFinite(quantity) || quantity <= 0)
            return;
        const safeCost = Number.isFinite(unitCost) ? Number(unitCost) : 0;
        await supabase_1.supabase.from('stock_cost_layers').insert({
            shop_id: shopId,
            product_id: productId,
            source_type: sourceType,
            source_id: sourceId || null,
            unit_cost: safeCost,
            initial_quantity: Number(quantity),
            remaining_quantity: Number(quantity),
            created_by: userId,
        });
    }
    async getStockHistory(productId, limit = 50) {
        const { data, error } = await supabase_1.supabase
            .from('stock_movements')
            .select('*')
            .eq('product_id', productId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error)
            throw new Error('Failed to fetch stock history');
        return data || [];
    }
    async createCategory(shopId, data) {
        const { data: category, error } = await supabase_1.supabase
            .from('categories')
            .insert({ shop_id: shopId, ...data })
            .select()
            .single();
        if (error) {
            logger_1.logger.error('Error creating category:', error);
            throw new Error('Failed to create category');
        }
        return category;
    }
    async getCategories(shopId) {
        const { data, error } = await supabase_1.supabase
            .from('categories')
            .select('*')
            .eq('shop_id', shopId)
            .order('name');
        if (error)
            throw new Error('Failed to fetch categories');
        return data || [];
    }
}
exports.InventoryService = InventoryService;
//# sourceMappingURL=inventory.service.js.map