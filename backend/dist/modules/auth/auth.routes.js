"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const requireAuth_1 = require("../../middleware/requireAuth");
const router = (0, express_1.Router)();
const controller = new auth_controller_1.AuthController();
router.post('/register', (req, res, next) => controller.register(req, res, next));
router.post('/login', (req, res, next) => controller.login(req, res, next));
router.post('/forgot-password-request', (req, res, next) => controller.forgotPasswordRequest(req, res, next));
router.post('/verify-forgot-password-pin', (req, res, next) => controller.verifyForgotPasswordPin(req, res, next));
router.post('/forgot-password-reset', (req, res, next) => controller.forgotPasswordReset(req, res, next));
router.get('/me', requireAuth_1.requireAuth, (req, res, next) => controller.me(req, res, next));
router.patch('/me', requireAuth_1.requireAuth, (req, res, next) => controller.updateProfile(req, res, next));
router.post('/change-password', requireAuth_1.requireAuth, (req, res, next) => controller.changePassword(req, res, next));
exports.default = router;
//# sourceMappingURL=auth.routes.js.map