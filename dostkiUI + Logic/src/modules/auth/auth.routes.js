import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { registerSchema, loginSchema, refreshTokenSchema } from './auth.validation.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

// Stricter rate limiter for authentication routes to prevent brute-force / credential stuffing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 authentication attempts per 15 minutes
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authLimiter, validate(registerSchema), AuthController.register);
router.post('/login', authLimiter, validate(loginSchema), AuthController.login);
router.post('/logout', AuthController.logout);
router.post('/refresh-token', authLimiter, validate(refreshTokenSchema), AuthController.refreshToken);
router.get('/me', authenticate, AuthController.getMe);

export default router;
