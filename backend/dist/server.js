"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const logger_1 = require("./utils/logger");
const PORT = env_1.env.port;
app_1.default.listen(PORT, () => {
    logger_1.logger.info(`Server running on port ${PORT}`);
    logger_1.logger.info(`Environment: ${env_1.env.nodeEnv}`);
});
//# sourceMappingURL=server.js.map