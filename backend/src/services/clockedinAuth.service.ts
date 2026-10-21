import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ConnectionError, QueryTypes } from 'sequelize';
import { clockedinAccountsDatabase } from '../config/database';
import { env } from '../config/env';
import { AuthenticatedUser } from '../types/express';
import { ApiError } from '../utils/ApiError';

interface ClockedInAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
}

interface PublicClockedInAccount {
  id: string;
  name: string;
  email: string;
}

interface ManageItAuthResponse {
  token: string;
  user: AuthenticatedUser;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function queryAccounts<T>(
  query: () => Promise<T>,
): Promise<T> {
  try {
    return await query();
  } catch (error: unknown) {
    if (error instanceof ConnectionError) {
      throw new ApiError(503, 'The ClockedIn accounts database is unavailable.');
    }
    throw error;
  }
}

async function findAccountByEmail(email: string): Promise<ClockedInAccount | null> {
  const accounts = await queryAccounts(() =>
    clockedinAccountsDatabase.query<ClockedInAccount>(
      `SELECT id::text AS id, name, email, password_hash AS "passwordHash"
       FROM users
       WHERE email = :email
       LIMIT 1`,
      {
        replacements: { email: normalizeEmail(email) },
        type: QueryTypes.SELECT,
      },
    ),
  );
  return accounts[0] ?? null;
}

export async function findClockedInUser(
  id: string,
): Promise<AuthenticatedUser | null> {
  const accounts = await queryAccounts(() =>
    clockedinAccountsDatabase.query<PublicClockedInAccount>(
      `SELECT id::text AS id, name, email
       FROM users
       WHERE id = :id
       LIMIT 1`,
      {
        replacements: { id },
        type: QueryTypes.SELECT,
      },
    ),
  );
  return accounts[0] ?? null;
}

function issueManageItToken(user: AuthenticatedUser): string {
  return jwt.sign({ sub: user.id }, env.manageitJwtSecret, {
    algorithm: 'HS256',
    expiresIn: '1d',
    issuer: 'manageit',
  });
}

export function getUserIdFromToken(token: string): string {
  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.manageitJwtSecret, {
      algorithms: ['HS256'],
      issuer: 'manageit',
    });
  } catch (error: unknown) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(401, 'Your session has expired. Please log in again.');
    }
    throw error;
  }

  if (typeof payload === 'string' || typeof payload.sub !== 'string') {
    throw new ApiError(401, 'A valid login session is required.');
  }
  return payload.sub;
}

export async function loginWithClockedIn(
  email: string,
  password: string,
): Promise<ManageItAuthResponse> {
  const account = await findAccountByEmail(email);
  if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const user = { id: account.id, name: account.name, email: account.email };
  return { token: issueManageItToken(user), user };
}
