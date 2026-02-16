import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema(
  {
    shop_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    action: { type: String, required: true, enum: ['sale', 'purchase', 'adjustment', 'transfer', 'damaged', 'expired'] },
    quantity: { type: Number, required: true },
    previous_quantity: { type: Number, required: true },
    new_quantity: { type: Number, required: true },
    reference_id: mongoose.Schema.Types.ObjectId,
    notes: String,
    created_by: { type: String, required: true },
  },
  { timestamps: true }
);

export const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
