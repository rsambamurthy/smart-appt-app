import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

const privateKey = Buffer.from(process.env.JWT_PRIVATE_KEY_BASE64!, 'base64').toString('utf8');
const publicKey = Buffer.from(process.env.JWT_PUBLIC_KEY_BASE64!, 'base64').toString('utf8');

export const signAccessToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (jwt.sign as any)(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  });

export const signRefreshToken = (payload: Omit<JwtPayload, 'iat' | 'exp'>): string =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (jwt.sign as any)(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  });

export const verifyToken = (token: string): JwtPayload =>
  jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as JwtPayload;
