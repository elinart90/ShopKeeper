import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ExpenseCategory' },
    amount: { type: Number, required: true },
    description: { type: String, required: true },
    receipt_url: String,
    expense_date: { type: Date, required: true, default: Date.now },
    payment_method: String,
    created_by: { type: String, required: true },
  },
  { timestamps: true }
);

expenseSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

export const Expense = mongoose.model('Expense', expenseSchema);
