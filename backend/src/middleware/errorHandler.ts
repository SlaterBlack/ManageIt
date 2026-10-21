import { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { UniqueConstraintError, ValidationError } from 'sequelize';
import { ApiError } from '../utils/ApiError';

export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export const errorHandler: ErrorRequestHandler = (
  error: Error,
  _req,
  res: Response,
  _next,
): void => {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (error instanceof UniqueConstraintError) {
    const message = error.fields && 'project_code' in error.fields
      ? 'Project code is already in use.'
      : 'These tasks are already linked.';
    res.status(409).json({ error: message });
    return;
  }

  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }

  console.error(error);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
};
