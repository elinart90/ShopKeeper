import mongoose from 'mongoose';

const shopMemberSchema = new mongoose.Schema(
  {
    shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    user_id: { type: String, required: true },
    role: { type: String, required: true, enum: ['owner', 'manager', 'cashier', 'staff'], default: 'staff' },
    permissions: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

shopMemberSchema.index({ shop_id: 1, user_id: 1 }, { unique: true });

export const ShopMember = mongoose.model('ShopMember', shopMemberSchema);
