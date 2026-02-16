"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const logger_1 = require("../utils/logger");
function errorHandler(err, req, res, next) {
    logger_1.logger.error('Error:', err);
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';
    res.status(statusCode).json({
        success: false,
        error: {
            message,
            code: err.code,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
        },
    });
}
//# sourceMappingURL=errorHandler.js.map