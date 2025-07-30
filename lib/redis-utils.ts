// lib/redis-utils.ts - Utility functions for Redis management
import redis from './redis';

// Monitoring and health check functions
export async function getRedisHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  memory: string;
  connectedClients: number;
  totalKeys: number;
}> {
  try {
    const info = await redis.info('memory');
    const clients = await redis.info('clients');
    const dbsize = await redis.dbsize();

    // Parse memory info
    const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
    const memory = memoryMatch ? memoryMatch[1] : 'unknown';

    // Parse connected clients
    const clientsMatch = clients.match(/connected_clients:(\d+)/);
    const connectedClients = clientsMatch ? parseInt(clientsMatch[1]) : 0;

    return {
      status: 'healthy',
      memory,
      connectedClients,
      totalKeys: dbsize,
    };
  } catch (error) {
    console.error('Redis health check failed:', error);
    return {
      status: 'unhealthy',
      memory: 'unknown',
      connectedClients: 0,
      totalKeys: 0,
    };
  }
}

// Get all keys with pattern
export async function getKeysByPattern(pattern: string): Promise<string[]> {
  try {
    return await redis.keys(pattern);
  } catch (error) {
    console.error('Error getting keys by pattern:', error);
    return [];
  }
}

// Clean up expired tokens manually (Redis handles TTL automatically, but this is for manual cleanup)
export async function cleanupExpiredTokens(): Promise<number> {
  try {
    const tokenKeys = await redis.keys('user_token:*');
    let cleaned = 0;

    for (const key of tokenKeys) {
      const ttl = await redis.ttl(key);
      if (ttl === -1) {
        // Key exists but has no TTL set, this shouldn't happen with our implementation
        console.warn(`Token key ${key} has no TTL, removing...`);
        await redis.del(key);
        cleaned++;
      }
    }

    return cleaned;
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
    return 0;
  }
}

// Clean up expired challenges
export async function cleanupExpiredChallenges(): Promise<number> {
  try {
    const challengeKeys = await redis.keys('challenge:*');
    let cleaned = 0;

    for (const key of challengeKeys) {
      const ttl = await redis.ttl(key);
      if (ttl === -1) {
        console.warn(`Challenge key ${key} has no TTL, removing...`);
        await redis.del(key);
        cleaned++;
      }
    }

    return cleaned;
  } catch (error) {
    console.error('Error cleaning up expired challenges:', error);
    return 0;
  }
}

// Get user statistics
export async function getUserStats(): Promise<{
  totalUsers: number;
  activeTokens: number;
  pendingChallenges: number;
}> {
  try {
    const [credentialKeys, tokenKeys, challengeKeys] = await Promise.all([
      redis.keys('credentials:*'),
      redis.keys('user_token:*'),
      redis.keys('challenge:*'),
    ]);

    return {
      totalUsers: credentialKeys.length,
      activeTokens: tokenKeys.length,
      pendingChallenges: challengeKeys.length,
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    return {
      totalUsers: 0,
      activeTokens: 0,
      pendingChallenges: 0,
    };
  }
}

// Emergency cleanup - remove all data (use with caution!)
export async function emergencyCleanup(): Promise<boolean> {
  try {
    const patterns = ['user_token:*', 'challenge:*', 'credentials:*'];

    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }

    console.log('Emergency cleanup completed');
    return true;
  } catch (error) {
    console.error('Emergency cleanup failed:', error);
    return false;
  }
}

// Backup user data (for migration purposes)
export async function backupUserData(userId: string): Promise<{
  credentials: string[];
  hasToken: boolean;
} | null> {
  try {
    const [credentials, tokenExists] = await Promise.all([
      redis.lrange(`credentials:${userId}`, 0, -1),
      redis.exists(`user_token:${userId}`),
    ]);

    return {
      credentials,
      hasToken: tokenExists === 1,
    };
  } catch (error) {
    console.error('Error backing up user data:', error);
    return null;
  }
}
