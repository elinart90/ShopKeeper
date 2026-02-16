"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaleItem = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const saleItemSchema = new mongoose_1.default.Schema({
    sale_id: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Sale', required: true },
    product_id: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    unit_price: { type: Number, required: true },
    discount_amount: { type: Number, default: 0 },
    total_price: { type: Number, required: true },
}, { timestamps: true });
exports.SaleItem = mongoose_1.default.model('SaleItem', saleItemSchema);
//# sourceMappingURL=SaleItem.js.map