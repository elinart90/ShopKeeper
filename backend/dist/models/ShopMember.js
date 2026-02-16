"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShopMember = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const shopMemberSchema = new mongoose_1.default.Schema({
    shop_id: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Shop', required: true },
    user_id: { type: String, required: true },
    role: { type: String, required: true, enum: ['owner', 'manager', 'cashier', 'staff'], default: 'staff' },
    permissions: { type: mongoose_1.default.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
shopMemberSchema.index({ shop_id: 1, user_id: 1 }, { unique: true });
exports.ShopMember = mongoose_1.default.model('ShopMember', shopMemberSchema);
//# sourceMappingURL=ShopMember.js.map