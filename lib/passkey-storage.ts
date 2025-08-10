// lib/passkey-storage.ts
import redis from './redis';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/types';

export interface StoredCredential {
  id: Uint8Array;
  publicKey: Uint8Array;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
}

// Serialization helpers for Uint8Array
function serializeCredential(credential: StoredCredential): string {
  return JSON.stringify({
    id: Array.from(credential.id),
    publicKey: Array.from(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports || [],
  });
}

function deserializeCredential(data: string): StoredCredential {
  const parsed = JSON.parse(data);
  return {
    id: new Uint8Array(parsed.id),
    publicKey: new Uint8Array(parsed.publicKey),
    counter: parsed.counter,
    transports: parsed.transports,
  };
}

// Challenge storage with TTL (5 minutes)
const CHALLENGE_TTL = 5 * 60; // 5 minutes in seconds

export async function storeChallenge(
  userId: string,
  challenge: string
): Promise<void> {
  try {
    const key = `challenge:${userId}`;
    await redis.setex(key, CHALLENGE_TTL, challenge);
    console.log(`Stored challenge for user: ${userId}`);
  } catch (error) {
    console.error('Error storing challenge:', error);
    throw error;
  }
}

export async function getChallenge(userId: string): Promise<string | null> {
  try {
    const key = `challenge:${userId}`;
    const challenge = await redis.get(key);
    return challenge;
  } catch (error) {
    console.error('Error retrieving challenge:', error);
    return null;
  }
}

export async function removeChallenge(userId: string): Promise<void> {
  try {
    const key = `challenge:${userId}`;
    await redis.del(key);
    console.log(`Removed challenge for user: ${userId}`);
  } catch (error) {
    console.error('Error removing challenge:', error);
    throw error;
  }
}

// User credentials storage
export async function storeUserCredentials(
  userId: string,
  credentials: StoredCredential[]
): Promise<void> {
  try {
    const key = `credentials:${userId}`;
    const serializedCredentials = credentials.map(serializeCredential);

    // Use Redis list to store multiple credentials
    await redis.del(key); // Clear existing credentials
    if (serializedCredentials.length > 0) {
      await redis.lpush(key, ...serializedCredentials);
      // Set expiry for credentials (optional, remove if you want permanent storage)
      await redis.expire(key, 30 * 24 * 60 * 60); // 30 days
    }

    console.log(`Stored ${credentials.length} credentials for user: ${userId}`);
  } catch (error) {
    console.error('Error storing user credentials:', error);
    throw error;
  }
}

export async function getUserCredentials(
  userId: string
): Promise<StoredCredential[]> {
  try {
    const key = `credentials:${userId}`;
    const serializedCredentials = await redis.lrange(key, 0, -1);

    if (serializedCredentials.length === 0) {
      return [];
    }

    const credentials = serializedCredentials.map(deserializeCredential);
    console.log(
      `Retrieved ${credentials.length} credentials for user: ${userId}`
    );
    return credentials;
  } catch (error) {
    console.error('Error retrieving user credentials:', error);
    return [];
  }
}

export async function addUserCredential(
  userId: string,
  credential: StoredCredential
): Promise<void> {
  try {
    const key = `credentials:${userId}`;
    const serializedCredential = serializeCredential(credential);

    await redis.lpush(key, serializedCredential);
    await redis.expire(key, 30 * 24 * 60 * 60); // 30 days

    console.log(`Added new credential for user: ${userId}`);
  } catch (error) {
    console.error('Error adding user credential:', error);
    throw error;
  }
}

export async function updateCredentialCounter(
  userId: string,
  credentialId: Uint8Array,
  newCounter: number
): Promise<void> {
  try {
    const credentials = await getUserCredentials(userId);
    const credentialIndex = credentials.findIndex(
      cred =>
        Buffer.compare(Buffer.from(cred.id), Buffer.from(credentialId)) === 0
    );

    if (credentialIndex !== -1) {
      credentials[credentialIndex].counter = newCounter;
      await storeUserCredentials(userId, credentials);
      console.log(`Updated counter for credential in user: ${userId}`);
    }
  } catch (error) {
    console.error('Error updating credential counter:', error);
    throw error;
  }
}

// Utility function to clean up expired data
export async function cleanupExpiredData(): Promise<void> {
  try {
    // Redis automatically handles TTL, but you can add custom cleanup logic here
    console.log('Cleanup completed - Redis handles TTL automatically');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}
