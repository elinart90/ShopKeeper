"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockMovement = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const stockMovementSchema = new mongoose_1.default.Schema({
    shop_id: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Shop', required: true },
    product_id: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Product', required: true },
    action: { type: String, required: true, enum: ['sale', 'purchase', 'adjustment', 'transfer', 'damaged', 'expired'] },
    quantity: { type: Number, required: true },
    previous_quantity: { type: Number, required: true },
    new_quantity: { type: Number, required: true },
    reference_id: mongoose_1.default.Schema.Types.ObjectId,
    notes: String,
    created_by: { type: String, required: true },
}, { timestamps: true });
exports.StockMovement = mongoose_1.default.model('StockMovement', stockMovementSchema);
//# sourceMappingURL=StockMovement.js.map