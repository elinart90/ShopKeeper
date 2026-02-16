"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.generateSaleNumber = generateSaleNumber;
const crypto_1 = require("crypto");
function generateId() {
    return (0, crypto_1.randomUUID)();
}
function generateSaleNumber(shopId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `SALE-${timestamp}-${random}`;
}
//# sourceMappingURL=id.js.map