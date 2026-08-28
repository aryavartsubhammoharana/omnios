/**
 * Standardized API Response structure
 */
export class ApiResponse {
  /**
   * @param {number} statusCode HTTP Status Code (200, 201, etc.)
   * @param {any} data Response payload
   * @param {string} message User-friendly message
   * @param {object} meta Optional pagination or metadata
   */
  constructor(statusCode, data = null, message = 'Success', meta = null) {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    if (meta) {
      this.meta = meta;
    }
  }

  /**
   * Send JSON response via Express res object
   * @param {import('express').Response} res 
   */
  send(res) {
    return res.status(this.statusCode).json({
      success: this.success,
      statusCode: this.statusCode,
      message: this.message,
      data: this.data,
      ...(this.meta ? { meta: this.meta } : {}),
      timestamp: new Date().toISOString(),
    });
  }

  static ok(res, data = null, message = 'Success', meta = null) {
    return new ApiResponse(200, data, message, meta).send(res);
  }

  static created(res, data = null, message = 'Resource created successfully') {
    return new ApiResponse(201, data, message).send(res);
  }

  static noContent(res, message = 'Resource deleted successfully') {
    return new ApiResponse(204, null, message).send(res);
  }
}
