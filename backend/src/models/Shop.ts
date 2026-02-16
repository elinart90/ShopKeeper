import mongoose from 'mongoose';

const shopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    address: String,
    phone: String,
    email: String,
    owner_id: { type: String, required: true },
    currency: { type: String, default: 'USD' },
    timezone: { type: String, default: 'UTC' },
    logo_url: String,
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

shopSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

export const Shop = mongoose.model('Shop', shopSchema);
