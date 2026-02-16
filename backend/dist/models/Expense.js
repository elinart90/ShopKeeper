"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Expense = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const expenseSchema = new mongoose_1.default.Schema({
    shop_id: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Shop', required: true },
    category_id: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'ExpenseCategory' },
    amount: { type: Number, required: true },
    description: { type: String, required: true },
    receipt_url: String,
    expense_date: { type: Date, required: true, default: Date.now },
    payment_method: String,
    created_by: { type: String, required: true },
}, { timestamps: true });
expenseSchema.set('toJSON', {
    virtuals: true,
    transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
    },
});
exports.Expense = mongoose_1.default.model('Expense', expenseSchema);
//# sourceMappingURL=Expense.js.map