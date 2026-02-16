import mongoose from 'mongoose';

const expenseCategorySchema = new mongoose.Schema(
  {
    shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    name: { type: String, required: true },
    description: String,
  },
  { timestamps: true }
);

export const ExpenseCategory = mongoose.model('ExpenseCategory', expenseCategorySchema);
