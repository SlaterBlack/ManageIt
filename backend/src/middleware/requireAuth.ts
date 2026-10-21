import { Request, Response } from 'express';
import {
  findClockedInUser,
  getUserIdFromToken,
} from '../services/clockedinAuth.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export const requireAuth = asyncHandler(
  async (req: Request, _res: Response, next) => {
    const authorization = req.headers.authorization?.split(' ');
    if (
      !authorization ||
      authorization.length !== 2 ||
      authorization[0].toLowerCase() !== 'bearer' ||
      !authorization[1]
    ) {
      throw new ApiError(401, 'A valid login session is required.');
    }

    const userId = getUserIdFromToken(authorization[1]);
    const user = await findClockedInUser(userId);
    if (!user) throw new ApiError(401, 'Your session has expired. Please log in again.');
    req.user = user;
    next();
  },
);
