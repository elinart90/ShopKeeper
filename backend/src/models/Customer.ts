import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    name: { type: String, required: true },
    phone: String,
    email: String,
    address: String,
    credit_limit: { type: Number, default: 0 },
    credit_balance: { type: Number, default: 0 },
    notes: String,
  },
  { timestamps: true }
);

customerSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

export const Customer = mongoose.model('Customer', customerSchema);
