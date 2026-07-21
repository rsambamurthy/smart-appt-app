export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly detail: string;

  constructor(status: number, code: string, message: string, detail?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.detail = detail ?? message;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(detail: string) {
    super(400, 'VALIDATION_ERROR', 'Validation failed', detail);
  }
}

export class UnauthorizedError extends AppError {
  constructor(detail = 'Missing or expired authentication token') {
    super(401, 'UNAUTHORIZED', 'Unauthorized', detail);
  }
}

export class ForbiddenError extends AppError {
  constructor(detail = 'Insufficient permissions') {
    super(403, 'FORBIDDEN', 'Forbidden', detail);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} not found`, `The requested ${resource} does not exist or has been deleted.`);
  }
}

export class ConflictError extends AppError {
  constructor(detail: string) {
    super(409, 'CONFLICT', 'Conflict', detail);
  }
}

export class UnprocessableError extends AppError {
  constructor(detail: string) {
    super(422, 'UNPROCESSABLE', 'Unprocessable Entity', detail);
  }
}

export class RateLimitError extends AppError {
  constructor(detail = 'Too many requests') {
    super(429, 'RATE_LIMITED', 'Too Many Requests', detail);
  }
}

export class GatewayError extends AppError {
  constructor(service: string) {
    super(502, 'GATEWAY_ERROR', `${service} unavailable`, `The upstream service ${service} is currently unavailable.`);
  }
}
