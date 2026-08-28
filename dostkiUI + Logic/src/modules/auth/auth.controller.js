import { AuthService } from './auth.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { env } from '../../config/env.js';

// Cookie options for secure HTTP-only storage
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export class AuthController {
  /**
   * POST /api/v1/auth/register
   */
  static async register(req, res, next) {
    try {
      const result = await AuthService.registerUser(req.body);

      // Set HTTP-only cookies
      res.cookie('token', result.accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
      res.cookie('refreshToken', result.refreshToken, cookieOptions);

      return ApiResponse.created(res, result, 'User registered successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/login
   */
  static async login(req, res, next) {
    try {
      const result = await AuthService.loginUser(req.body);

      res.cookie('token', result.accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
      res.cookie('refreshToken', result.refreshToken, cookieOptions);

      return ApiResponse.ok(res, result, 'Logged in successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/logout
   */
  static async logout(req, res, next) {
    try {
      res.clearCookie('token', cookieOptions);
      res.clearCookie('refreshToken', cookieOptions);

      return ApiResponse.ok(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/refresh-token
   */
  static async refreshToken(req, res, next) {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
      const result = await AuthService.refreshAccessToken(refreshToken);

      res.cookie('token', result.accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
      res.cookie('refreshToken', result.refreshToken, cookieOptions);

      return ApiResponse.ok(res, result, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/me
   */
  static async getMe(req, res, next) {
    try {
      const profile = await AuthService.getUserProfile(req.user.id);
      return ApiResponse.ok(res, profile, 'User profile retrieved');
    } catch (error) {
      next(error);
    }
  }
}
