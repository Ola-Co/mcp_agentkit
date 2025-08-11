// lib/auth-middleware.ts (Updated with Redis and Passkey PIN)
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import redis from './redis';

export interface AuthenticatedUser {
  userId: string;
  phoneNumber: string;
  credentialId: string;
  publicKey: string;
  passkeyPin: string;
}

export interface StoredUserData {
  token: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  passkeyPin: string;
  authenticatedAt: number;
}

// Generate a deterministic PIN from the user's passkey credential
export function generatePasskeyPin(
  credentialId: string,
  publicKey: string
): string {
  // Combine credentialId and publicKey for more entropy
  const combined = credentialId + publicKey;

  // Create a SHA-256 hash
  const hash = crypto.createHash('sha256').update(combined).digest('hex');

  // Take first 12 characters and convert to a numeric PIN
  const hexSubset = hash.substring(0, 12);
  const numericPin = parseInt(hexSubset, 16).toString().substring(0, 8);

  // Ensure PIN is always 8 digits (pad with leading zeros if needed)
  return numericPin.padStart(8, '0');
}

export function verifyAuthToken(token: string): AuthenticatedUser | null {
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as AuthenticatedUser;

    return {
      userId: decoded.userId,
      phoneNumber: decoded.phoneNumber,
      credentialId: decoded.credentialId,
      publicKey: decoded.publicKey,
      passkeyPin: decoded.passkeyPin,
    };
  } catch (error) {
    console.log('Token verification error:', error);
    return null;
  }
}

export function createAuthToken(
  userId: string,
  phoneNumber: string,
  credentialId: string,
  publicKey: string,
  passkeyPin: string
): string {
  const payload = {
    userId,
    phoneNumber,
    credentialId,
    publicKey,
    passkeyPin,
    authenticatedAt: Date.now(),
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '24h',
    algorithm: 'HS256',
  });
}

// Redis-based token storage with TTL (24 hours)
const TOKEN_TTL = 24 * 60 * 60; // 24 hours in seconds

export async function storeUserToken(
  phoneNumber: string,
  token: string,
  credentialId: string,
  publicKey: string,
  userId: string
): Promise<void> {
  try {
    const passkeyPin = generatePasskeyPin(credentialId, publicKey);

    const userData: StoredUserData = {
      token,
      userId,
      credentialId,
      publicKey,
      passkeyPin,
      authenticatedAt: Date.now(),
    };

    const key = `user_token:${phoneNumber}`;
    await redis.setex(key, TOKEN_TTL, JSON.stringify(userData));
    console.log(
      `Stored enhanced user data for: ${phoneNumber} with passkey PIN: ${passkeyPin}`
    );
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
    const userDataStr = await redis.get(key);
    if (userDataStr) {
      const userData: StoredUserData = JSON.parse(userDataStr);
      return userData.token;
    }
    return null;
  } catch (error) {
    console.error('Error retrieving user token:', error);
    return null;
  }
}

export async function getUserData(
  phoneNumber: string
): Promise<StoredUserData | null> {
  try {
    const key = `user_token:${phoneNumber}`;
    const userDataStr = await redis.get(key);
    if (userDataStr) {
      return JSON.parse(userDataStr);
    }
    return null;
  } catch (error) {
    console.error('Error retrieving user data:', error);
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
