import { Router } from 'express';
import { AuthController } from './auth.controller';
import { requireAuth } from '../../middleware/requireAuth';

const router = Router();
const controller = new AuthController();

router.post('/register', (req, res, next) => controller.register(req, res, next));
router.post('/login', (req, res, next) => controller.login(req, res, next));
router.post('/forgot-password-request', (req, res, next) => controller.forgotPasswordRequest(req, res, next));
router.post('/verify-forgot-password-pin', (req, res, next) => controller.verifyForgotPasswordPin(req, res, next));
router.post('/forgot-password-reset', (req, res, next) => controller.forgotPasswordReset(req, res, next));
router.get('/me', requireAuth, (req, res, next) => controller.me(req, res, next));
router.patch('/me', requireAuth, (req, res, next) => controller.updateProfile(req, res, next));
router.post('/change-password', requireAuth, (req, res, next) => controller.changePassword(req, res, next));

export default router;

