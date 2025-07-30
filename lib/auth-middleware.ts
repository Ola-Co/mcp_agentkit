// lib/auth-middleware.ts (Updated with Redis)
import jwt from 'jsonwebtoken';
import redis from './redis';

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

// Redis-based token storage with TTL (24 hours)
const TOKEN_TTL = 24 * 60 * 60; // 24 hours in seconds

export async function storeUserToken(
  phoneNumber: string,
  token: string
): Promise<void> {
  try {
    const key = `user_token:${phoneNumber}`;
    await redis.setex(key, TOKEN_TTL, token);
    console.log(`Stored token for user: ${phoneNumber}`);
  } catch (error) {
    console.error('Error storing user token:', error);
    throw error;
  }
}

export async function getUserToken(
  phoneNumber: string
): Promise<string | null> {
  try {
    const key = `user_token:${phoneNumber}`;
    const token = await redis.get(key);
    return token;
  } catch (error) {
    console.error('Error retrieving user token:', error);
    return null;
  }
}

export async function removeUserToken(phoneNumber: string): Promise<void> {
  try {
    const key = `user_token:${phoneNumber}`;
    await redis.del(key);
    console.log(`Removed token for user: ${phoneNumber}`);
  } catch (error) {
    console.error('Error removing user token:', error);
    throw error;
  }
}

// Helper function to extend token expiry
export async function refreshUserToken(phoneNumber: string): Promise<void> {
  try {
    const key = `user_token:${phoneNumber}`;
    await redis.expire(key, TOKEN_TTL);
  } catch (error) {
    console.error('Error refreshing user token:', error);
    throw error;
  }
}
