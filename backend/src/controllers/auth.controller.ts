import { Request, Response } from 'express';
import { loginWithClockedIn } from '../services/clockedinAuth.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as {
    email?: unknown;
    password?: unknown;
  };
  if (
    typeof email !== 'string' ||
    !email.trim() ||
    typeof password !== 'string' ||
    !password
  ) {
    throw new ApiError(400, 'Email and password are required.');
  }

  const auth = await loginWithClockedIn(email.trim(), password);
  res.json(auth);
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication is required.');
  }
  res.json({ user: req.user });
});
