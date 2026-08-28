import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, withTransaction } from '../../config/db.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/apiError.js';

export class AuthService {
  /**
   * Generate JWT Access and Refresh Tokens
   * @param {Object} user 
   */
  static generateTokens(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });

    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    });

    return { accessToken, refreshToken };
  }

  /**
   * Register a new user
   */
  static async registerUser(userData) {
    const { email, password, firstName, lastName, role, institutionDomain } = userData;

    // Check if user already exists
    const existing = await query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      throw ApiError.conflict('An account with this email already exists.');
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Auto-detect institution domain if not explicitly provided
    let domain = institutionDomain;
    if (!domain && email.includes('@')) {
      domain = email.split('@')[1];
    }

    const newUser = await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, institution_domain, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING id, email, first_name, last_name, role, institution_domain, is_verified, created_at`,
        [email.toLowerCase().trim(), passwordHash, firstName.trim(), lastName.trim(), role, domain]
      );

      const user = result.rows[0];

      // If user is a student, initialize their streak record
      if (role === 'STUDENT') {
        await client.query(
          `INSERT INTO student_streaks (student_id, current_streak, longest_streak, last_active_date)
           VALUES ($1, 1, 1, CURRENT_DATE)
           ON CONFLICT (student_id) DO NOTHING`,
          [user.id]
        );
      }

      return user;
    });

    const tokens = this.generateTokens(newUser);

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        role: newUser.role,
        institutionDomain: newUser.institution_domain,
      },
      ...tokens,
    };
  }

  /**
   * Login user
   */
  static async loginUser({ email, password }) {
    const result = await query(
      `SELECT id, email, password_hash, first_name, last_name, role, institution_domain, is_verified 
       FROM users 
       WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw ApiError.unauthorized('Invalid email or password.');
    }

    const tokens = this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        institutionDomain: user.institution_domain,
      },
      ...tokens,
    };
  }

  /**
   * Refresh Access Token
   */
  static async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      throw ApiError.unauthorized('Refresh token is required.');
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    } catch (err) {
      throw ApiError.unauthorized('Invalid or expired refresh token. Please login again.');
    }

    const result = await query(
      `SELECT id, email, first_name, last_name, role, institution_domain, is_verified 
       FROM users 
       WHERE id = $1`,
      [decoded.id]
    );

    if (result.rows.length === 0) {
      throw ApiError.unauthorized('User not found.');
    }

    const user = result.rows[0];
    const tokens = this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        institutionDomain: user.institution_domain,
      },
      ...tokens,
    };
  }

  /**
   * Get User Profile by ID
   */
  static async getUserProfile(userId) {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.institution_domain, u.created_at,
              COALESCE(s.current_streak, 0) AS current_streak,
              COALESCE(s.longest_streak, 0) AS longest_streak,
              s.last_active_date
       FROM users u
       LEFT JOIN student_streaks s ON u.id = s.student_id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('User profile not found.');
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      institutionDomain: row.institution_domain,
      createdAt: row.created_at,
      streaks: {
        currentStreak: parseInt(row.current_streak, 10),
        longestStreak: parseInt(row.longest_streak, 10),
        lastActiveDate: row.last_active_date,
      },
    };
  }
}
