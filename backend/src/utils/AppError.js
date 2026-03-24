/**
 * Chatterbox — özel uygulama hata sınıfları
 * Controller / middleware içinde `throw new XxxError(...)` yapılır,
 * Express global error handler (errorHandler.middleware.js) yakalar ve
 * istemciye uygun HTTP yanıtı döner.
 */

class AppError extends Error {
  constructor(message, statusCode, errors = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true; // bilinçli fırlatılan hata
    Error.captureStackTrace(this, this.constructor);
  }
}

/** 400 Bad Request */
class BadRequestError extends AppError {
  constructor(message = 'Bad request', errors = null) {
    super(message, 400, errors);
  }
}

/** 401 Unauthorized */
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

/** 403 Forbidden */
class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

/** 404 Not Found */
class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404);
  }
}

/** 409 Conflict */
class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}

/** 422 Unprocessable Entity (validation) */
class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = null) {
    super(message, 422, errors);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
};

