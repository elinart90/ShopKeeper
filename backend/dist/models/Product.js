"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Product = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const productSchema = new mongoose_1.default.Schema({
    shop_id: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Shop', required: true },
    category_id: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Category' },
    name: { type: String, required: true },
    description: String,
    barcode: String,
    sku: String,
    unit: { type: String, default: 'piece' },
    cost_price: { type: Number, required: true, default: 0 },
    selling_price: { type: Number, required: true, default: 0 },
    stock_quantity: { type: Number, required: true, default: 0 },
    min_stock_level: { type: Number, default: 0 },
    max_stock_level: Number,
    image_url: String,
    is_active: { type: Boolean, default: true },
    expiry_date: Date,
}, { timestamps: true });
productSchema.index({ shop_id: 1, barcode: 1 });
productSchema.set('toJSON', {
    virtuals: true,
    transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
    },
});
exports.Product = mongoose_1.default.model('Product', productSchema);
//# sourceMappingURL=Product.js.map