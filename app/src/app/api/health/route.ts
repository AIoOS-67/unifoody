import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * Health check endpoint for Cloud Run startup/liveness probes.
 * Returns 200 if the service and database are healthy.
 */
export async function GET() {
  const start = Date.now();

  try {
    // Verify database connectivity
    const dbResult = await pool.query('SELECT 1 AS ok');
    const dbOk = dbResult.rows[0]?.ok === 1;

    return NextResponse.json({
      status: 'ok',
      db: dbOk ? 'connected' : 'error',
      latency_ms: Date.now() - start,
      timestamp: new Date().toISOString(),
      version: process.env.BUILD_ID || 'local',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'degraded',
        db: 'disconnected',
        error: error.message,
        latency_ms: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
