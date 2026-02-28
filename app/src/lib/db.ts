import { Pool } from 'pg'

const isProduction = process.env.NODE_ENV === 'production'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Connection pool sizing
  // Cloud Run: max 10 instances × 20 connections = 200 (Cloud SQL default limit: 100)
  // Keep per-instance max low to stay within Cloud SQL limits
  max: isProduction ? 10 : 5,
  min: isProduction ? 2 : 0,

  // Timeouts
  idleTimeoutMillis: 30_000,        // Release idle connections after 30s
  connectionTimeoutMillis: 5_000,   // Fail fast if DB unreachable (5s)

  // SSL: only enable for public IP connections (not Unix socket)
  // Cloud Run uses --add-cloudsql-instances which provides a Unix socket,
  // so SSL is not needed (and will fail if enabled)
  ...((isProduction && !process.env.DATABASE_URL?.includes('/cloudsql/')) && {
    ssl: { rejectUnauthorized: false },
  }),
})

// Log unexpected pool errors (prevents unhandled rejections crashing the process)
pool.on('error', (err) => {
  console.error('[DB Pool] Unexpected error on idle client:', err.message)
})

export default pool
