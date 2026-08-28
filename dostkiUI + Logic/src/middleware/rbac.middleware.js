import { ApiError } from '../utils/apiError.js';

/**
 * Role-Based Access Control (RBAC) Middleware
 * Restricts route access to specified roles
 * @param  {...string} allowedRoles ('FREE_USER', 'TEACHER', 'STUDENT', 'ADMIN')
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    // Admins have super-user privileges across endpoints
    if (req.user.role === 'ADMIN' || allowedRoles.includes(req.user.role)) {
      return next();
    }

    return next(
      ApiError.forbidden(
        `Role [${req.user.role}] is not authorized to access this resource. Allowed roles: [${allowedRoles.join(', ')}]`
      )
    );
  };
};
