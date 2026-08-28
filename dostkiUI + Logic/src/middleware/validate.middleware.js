import { ApiError } from '../utils/apiError.js';

/**
 * Validate incoming Express request against Zod schema
 * @param {import('zod').ZodSchema} schema 
 * @param {'body' | 'query' | 'params'} [source='body']
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      const result = schema.safeParse(req[source]);
      if (!result.success) {
        const errorDetails = result.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        throw ApiError.unprocessable('Validation error', errorDetails);
      }
      req[source] = result.data;
      next();
    } catch (err) {
      next(err);
    }
  };
};
