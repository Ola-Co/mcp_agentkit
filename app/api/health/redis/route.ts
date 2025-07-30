// app/api/health/redis/route.ts - Health check endpoint for Redis
import { NextResponse } from 'next/server';
import { getRedisHealth, getUserStats } from '../../../../lib/redis-utils';

export async function GET() {
  try {
    const [health, stats] = await Promise.all([
      getRedisHealth(),
      getUserStats(),
    ]);

    return NextResponse.json({
      redis: health,
      userStats: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      {
        redis: { status: 'unhealthy' },
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
