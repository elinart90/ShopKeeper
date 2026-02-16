"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Category = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const categorySchema = new mongoose_1.default.Schema({
    shop_id: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Shop', required: true },
    name: { type: String, required: true },
    description: String,
    parent_id: { type: mongoose_1.default.Schema.Types.ObjectId, ref: 'Category' },
}, { timestamps: true });
categorySchema.set('toJSON', {
    virtuals: true,
    transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
    },
});
exports.Category = mongoose_1.default.model('Category', categorySchema);
//# sourceMappingURL=Category.js.map