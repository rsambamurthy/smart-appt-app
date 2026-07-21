import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import logger from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const requestId = req.headers['x-request-id'] as string;

  if (err instanceof AppError) {
    res.status(err.status).json({
      type: `https://smartappt.app/errors/${err.code.toLowerCase()}`,
      title: err.message,
      status: err.status,
      detail: err.detail,
      instance: req.path,
      request_id: requestId,
    });
    return;
  }

  // Unexpected errors
  const errorId = crypto.randomUUID();
  logger.error('Unhandled error', {
    error_id: errorId,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    request_id: requestId,
  });

  res.status(500).json({
    type: 'https://smartappt.app/errors/internal_error',
    title: 'Internal Server Error',
    status: 500,
    detail: 'An unexpected error occurred. Please contact support with the error_id.',
    error_id: errorId,
    request_id: requestId,
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    type: 'https://smartappt.app/errors/not_found',
    title: 'Not Found',
    status: 404,
    detail: `Route ${req.method} ${req.path} not found`,
    instance: req.path,
  });
};
