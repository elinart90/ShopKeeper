import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema(
  {
    sale_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    unit_price: { type: Number, required: true },
    discount_amount: { type: Number, default: 0 },
    total_price: { type: Number, required: true },
  },
  { timestamps: true }
);

export const SaleItem = mongoose.model('SaleItem', saleItemSchema);
