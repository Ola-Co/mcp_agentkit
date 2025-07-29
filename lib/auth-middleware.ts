// lib/auth-middleware.ts
import jwt from 'jsonwebtoken';

export interface AuthenticatedUser {
  userId: string;
  phoneNumber: string;
}

export function verifyAuthToken(token: string): AuthenticatedUser | null {
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as AuthenticatedUser;
    return decoded;
  } catch (error) {
    console.log(error);
    return null;
  }
}

// In-memory token storage (use Redis in production)
const userTokens = new Map<string, string>();

export function storeUserToken(phoneNumber: string, token: string) {
  userTokens.set(phoneNumber, token);
}

export function getUserToken(phoneNumber: string): string | null {
  return userTokens.get(phoneNumber) || null;
}

export function removeUserToken(phoneNumber: string) {
  userTokens.delete(phoneNumber);
}
