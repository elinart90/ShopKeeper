"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Customer = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const customerSchema = new mongoose_1.default.Schema({
    shop_id: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Shop', required: true },
    name: { type: String, required: true },
    phone: String,
    email: String,
    address: String,
    credit_limit: { type: Number, default: 0 },
    credit_balance: { type: Number, default: 0 },
    notes: String,
}, { timestamps: true });
customerSchema.set('toJSON', {
    virtuals: true,
    transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
    },
});
exports.Customer = mongoose_1.default.model('Customer', customerSchema);
//# sourceMappingURL=Customer.js.map