"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireActiveSubscription = requireActiveSubscription;
const errorHandler_1 = require("./errorHandler");
const subscriptions_service_1 = require("../modules/subscriptions/subscriptions.service");
const supabase_1 = require("../config/supabase");
const subscriptionsService = new subscriptions_service_1.SubscriptionsService();
function createHttpError(message, statusCode, code) {
    const err = new Error(message);
    err.statusCode = statusCode;
    err.code = code;
    return err;
}
async function requireActiveSubscription(req, res, next) {
    try {
        if (!req.userId)
            throw createHttpError('Unauthorized', 401);
        // Platform admins should never be blocked by tenant subscription checks.
        const { data: platformAdmin } = await supabase_1.supabase
            .from('platform_admins')
            .select('user_id')
            .eq('user_id', req.userId)
            .eq('is_active', true)
            .maybeSingle();
        if (platformAdmin?.user_id) {
            return next();
        }
        const shopIdHeader = req.headers['x-shop-id'];
        const shopId = typeof shopIdHeader === 'string' ? shopIdHeader : undefined;
        let subscriptionUserId = req.userId;
        // If user is a member (not owner) in the selected shop, validate owner's subscription instead.
        if (shopId) {
            const { data: shop } = await supabase_1.supabase.from('shops').select('id, owner_id').eq('id', shopId).maybeSingle();
            const ownerId = String(shop?.owner_id || '');
            if (ownerId && ownerId !== req.userId) {
                const { data: member } = await supabase_1.supabase.from('shop_members').select('id').eq('shop_id', shopId).eq('user_id', req.userId).maybeSingle();
                if (member) {
                    subscriptionUserId = ownerId;
                }
            }
        }
        const status = await subscriptionsService.getStatus(subscriptionUserId);
        req.subscription = status;
        req.subscriptionUserId = subscriptionUserId;
        if (!status.isActive) {
            throw createHttpError(subscriptionUserId === req.userId
                ? 'Active monthly subscription is required to use this app'
                : 'Active owner subscription is required to use this shop', 402, 'SUBSCRIPTION_REQUIRED');
        }
        next();
    }
    catch (error) {
        (0, errorHandler_1.errorHandler)(error, req, res, next);
    }
}
//# sourceMappingURL=requireActiveSubscription.js.map