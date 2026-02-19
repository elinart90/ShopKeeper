export declare class InventoryService {
    createProduct(shopId: string, userId: string, data: any): Promise<any>;
    checkDuplicate(shopId: string, barcode?: string, name?: string): Promise<{
        existingByBarcode: any;
        possibleByName: any[];
    }>;
    receiveStock(shopId: string, productId: string, userId: string, quantity: number, note?: string, unitCost?: number): Promise<any>;
    getProducts(shopId: string, filters?: {
        category_id?: string;
        search?: string;
        low_stock?: boolean;
        is_active?: boolean;
    }): Promise<any[]>;
    getProductById(productId: string): Promise<any>;
    getProductByBarcode(shopId: string, barcode: string): Promise<any>;
    updateProduct(productId: string, shopId: string, userId: string, data: any): Promise<any>;
    deleteProduct(productId: string, shopId: string): Promise<{
        success: boolean;
    }>;
    getLowStockProducts(shopId: string): Promise<any[]>;
    logStockMovement(shopId: string, productId: string, userId: string, action: string, quantity: number, previousQuantity: number, newQuantity: number, notes?: string): Promise<void>;
    addCostLayer(shopId: string, productId: string, userId: string, quantity: number, unitCost: number, sourceType: string, sourceId?: string): Promise<void>;
    getStockHistory(productId: string, limit?: number): Promise<any[]>;
    createCategory(shopId: string, data: {
        name: string;
        description?: string;
        parent_id?: string;
    }): Promise<any>;
    getCategories(shopId: string): Promise<any[]>;
}
//# sourceMappingURL=inventory.service.d.ts.map