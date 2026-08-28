import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';
import { query } from '../config/db.js';

/**
 * Authentication Middleware
 * Extracts token from HTTP-only cookie or Authorization Bearer header
 */
export const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check HTTP-only cookie
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // 2. Check Authorization Header
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw ApiError.unauthorized('Authentication required. Please login.');
    }

    // 3. Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw ApiError.unauthorized('Authentication token expired. Please refresh or login again.');
      }
      throw ApiError.unauthorized('Invalid authentication token.');
    }

    // 4. Validate user in database
    const userResult = await query(
      `SELECT id, email, first_name, last_name, role, institution_domain, is_verified 
       FROM users 
       WHERE id = $1`,
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      throw ApiError.unauthorized('User account associated with this token no longer exists.');
    }

    const user = userResult.rows[0];
    if (!user.is_verified) {
      throw ApiError.forbidden('User account is not verified.');
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
