"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Shop = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const shopSchema = new mongoose_1.default.Schema({
    name: { type: String, required: true },
    description: String,
    address: String,
    phone: String,
    email: String,
    owner_id: { type: String, required: true },
    currency: { type: String, default: 'USD' },
    timezone: { type: String, default: 'UTC' },
    logo_url: String,
    is_active: { type: Boolean, default: true },
}, { timestamps: true });
shopSchema.set('toJSON', {
    virtuals: true,
    transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
    },
});
exports.Shop = mongoose_1.default.model('Shop', shopSchema);
//# sourceMappingURL=Shop.js.map