import mongoose from 'mongoose';

const saleSchema = new mongoose.Schema(
  {
    shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    sale_number: { type: String, required: true },
    total_amount: { type: Number, required: true, default: 0 },
    discount_amount: { type: Number, default: 0 },
    tax_amount: { type: Number, default: 0 },
    final_amount: { type: Number, required: true, default: 0 },
    payment_method: { type: String, required: true, enum: ['cash', 'mobile_money', 'bank_transfer', 'card', 'credit'], default: 'cash' },
    status: { type: String, required: true, enum: ['pending', 'completed', 'cancelled', 'refunded'], default: 'completed' },
    notes: String,
    receipt_url: String,
    created_by: { type: String, required: true },
  },
  { timestamps: true }
);

saleSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

export const Sale = mongoose.model('Sale', saleSchema);
