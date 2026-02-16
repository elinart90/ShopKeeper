import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    name: { type: String, required: true },
    description: String,
    parent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  },
  { timestamps: true }
);

categorySchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

export const Category = mongoose.model('Category', categorySchema);
