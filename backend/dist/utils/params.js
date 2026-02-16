"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getParam = getParam;
/** Normalize req.params[key] to string (Express may type it as string | string[]). */
function getParam(req, key) {
    const v = req.params[key];
    return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}
//# sourceMappingURL=params.js.map