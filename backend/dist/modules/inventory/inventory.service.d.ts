export declare class InventoryService {
    private normalizeSearchText;
    private sanitizeSearchTerm;
    private expandSearchTermsForTwi;
    private parseAiJson;
    private normalizeUnit;
    private buildAiPrompt;
    private callOpenAiVision;
    private callClaudeVision;
    aiOnboardFromImage(shopId: string, _userId: string, payload: {
        imageDataUrl: string;
        hints?: {
            name?: string;
            barcode?: string;
        };
    }): Promise<{
        provider: string;
        suggested: {
            name: string | null;
            barcode: string | null;
            unit: "piece" | "kg" | "liter" | "box" | "pack" | null;
            category_name: string | null;
            cost_price_hint: number | null;
            selling_price_hint: number | null;
            description_hint: string | null;
        };
        confidence: {
            name: string;
            barcode: string;
            unit: string;
            category_name: string;
            cost_price_hint: string;
            selling_price_hint: string;
        };
        notes: any;
        duplicateCheck: {
            existingByBarcode: any;
            possibleByName: any[];
        };
        recommendedAction: string;
    }>;
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
        search_mode?: 'default' | 'english_first';
    }): Promise<any[]>;
    getProductById(productId: string): Promise<any>;
    getProductByBarcode(shopId: string, barcode: string): Promise<any>;
    updateProduct(productId: string, shopId: string, userId: string, data: any): Promise<any>;
    deleteProduct(productId: string, shopId: string): Promise<{
        success: boolean;
    }>;
    restoreProduct(productId: string, shopId: string): Promise<any>;
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