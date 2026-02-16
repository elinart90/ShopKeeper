"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpenseCategory = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const expenseCategorySchema = new mongoose_1.default.Schema({
    shop_id: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Shop', required: true },
    name: { type: String, required: true },
    description: String,
}, { timestamps: true });
exports.ExpenseCategory = mongoose_1.default.model('ExpenseCategory', expenseCategorySchema);
//# sourceMappingURL=ExpenseCategory.js.map