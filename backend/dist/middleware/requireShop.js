"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireShop = requireShop;
const supabase_1 = require("../config/supabase");
const errorHandler_1 = require("./errorHandler");
async function requireShop(req, res, next) {
    try {
        const shopId = req.headers['x-shop-id'];
        if (!shopId) {
            throw new errorHandler_1.AppError('Shop ID is required', 400);
        }
        if (!req.userId) {
            throw new errorHandler_1.AppError('User ID is required', 401);
        }
        const { data: shop } = await supabase_1.supabase.from('shops').select('id, owner_id').eq('id', shopId).single();
        if (!shop) {
            throw new errorHandler_1.AppError('Shop not found', 404);
        }
        const isOwner = shop.owner_id === req.userId;
        const { data: member } = await supabase_1.supabase
            .from('shop_members')
            .select('role')
            .eq('shop_id', shopId)
            .eq('user_id', req.userId)
            .maybeSingle();
        if (!member && !isOwner) {
            throw new errorHandler_1.AppError('You do not have access to this shop', 403);
        }
        req.shopId = shopId;
        req.userRole = member?.role || (isOwner ? 'owner' : 'staff');
        next();
    }
    catch (error) {
        (0, errorHandler_1.errorHandler)(error, req, res, next);
    }
}
//# sourceMappingURL=requireShop.js.map