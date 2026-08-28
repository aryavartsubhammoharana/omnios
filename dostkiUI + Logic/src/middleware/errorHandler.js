import { ApiError } from '../utils/apiError.js';
import { env } from '../config/env.js';
import multer from 'multer';

/**
 * Global centralized error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  let error = err;

  // Handle Multer upload errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      error = ApiError.badRequest(`File size exceeds allowed limit of ${env.MAX_FILE_SIZE_MB}MB.`);
    } else {
      error = ApiError.badRequest(`File upload error: ${err.message}`);
    }
  }

  // Handle PostgreSQL Database specific error codes
  if (err.code) {
    switch (err.code) {
      case '23505': // Unique constraint violation
        error = ApiError.conflict(`Duplicate value entered: ${err.detail || 'Resource already exists.'}`);
        break;
      case '23503': // Foreign key violation
        error = ApiError.badRequest(`Referenced resource not found: ${err.detail || 'Foreign key constraint failed.'}`);
        break;
      case '22P02': // Invalid text representation (e.g. invalid UUID)
        error = ApiError.badRequest('Invalid ID format or data type.');
        break;
      case '42P01': // Undefined table
        error = ApiError.internal(`Database table not found. Please run migrations.`);
        break;
    }
  }

  // If not already an ApiError instance, wrap it
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, [], err.stack);
  }

  const responsePayload = {
    success: false,
    statusCode: error.statusCode,
    message: error.message,
    ...(error.errors && error.errors.length > 0 ? { errors: error.errors } : {}),
    ...(env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
    timestamp: new Date().toISOString(),
  };

  // Log unexpected internal errors in development / production
  if (error.statusCode >= 500) {
    console.error('🔥 [Unhandled Server Error]:', err);
  }

  return res.status(error.statusCode).json(responsePayload);
};
