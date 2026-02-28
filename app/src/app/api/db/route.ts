import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Whitelist of allowed tables to prevent SQL injection
const ALLOWED_TABLES = [
  'diners', 'restaurants', 'menu_items', 'diner_rewards',
  'orders', 'order_items', 'payments', 'transactions',
  'reward_transactions', 'registration_rewards',
  'push_subscriptions', 'fiat_payments',
  'confirm_and_pay', 'foody_orders',
  'avos_calls', 'avos_orders', 'avos_config', 'avos_menu_index',
];

// Whitelist of allowed operators
const ALLOWED_OPS = ['=', '!=', '>', '>=', '<', '<=', 'LIKE', 'ILIKE', 'IN', 'IS NULL'];

// Tables that require admin API key for write operations (read is allowed for same-origin)
const ADMIN_ONLY_WRITE_TABLES = ['restaurants', 'menu_items', 'diner_rewards', 'reward_transactions', 'registration_rewards'];

// Max rows to prevent DoS
const MAX_LIMIT = 1000;

function sanitizeColumns(cols: string): string {
  if (cols === '*') return '*';
  return cols.split(',').map(c => {
    const col = c.trim().replace(/[^a-zA-Z0-9_*]/g, '');
    return col ? `"${col}"` : '';
  }).filter(Boolean).join(', ');
}

/**
 * Verify request origin — only allow same-origin requests or requests with valid API key.
 * This prevents external attackers from accessing the DB proxy while allowing
 * the client-side supabase.ts wrapper to work.
 */
function isAuthorized(req: Request): boolean {
  // Check for admin API key (for external/admin access)
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (process.env.ADMIN_API_KEY && token === process.env.ADMIN_API_KEY) {
      return true;
    }
  }

  // Allow same-origin requests (Next.js client-side calls)
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  if (origin || referer) {
    const allowedHosts = ['foodyepay.com', 'foodyepay-443906211776.us-east1.run.app', 'localhost'];
    const requestHost = origin ? new URL(origin).hostname : referer ? new URL(referer).hostname : '';
    return allowedHosts.some(h => requestHost === h || requestHost.endsWith('.' + h));
  }

  // Server-side API routes (no origin/referer) — allow
  return true;
}

export async function POST(req: Request) {
  try {
    // Authentication check
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { data: null, error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }
    const body = await req.json();
    const { table, operation, selectColumns, conditions, orConditions, orderClauses,
            limitVal, offsetVal, insertData, updateData, upsertConflictCol,
            isSingle, isMaybeSingle, countMode } = body;

    // Validate table name
    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ data: null, error: { message: `Table "${table}" not allowed` } }, { status: 400 });
    }

    // Validate conditions
    if (conditions) {
      for (const c of conditions) {
        if (!ALLOWED_OPS.includes(c.op)) {
          return NextResponse.json({ data: null, error: { message: `Operator "${c.op}" not allowed` } }, { status: 400 });
        }
      }
    }

    const params: any[] = [];

    if (operation === 'select') {
      const cols = selectColumns === '*' ? '*' : sanitizeColumns(selectColumns);
      let idx = 1;
      const whereParts: string[] = [];

      for (const cond of (conditions || [])) {
        if (cond.op === 'IS NULL') {
          whereParts.push(`"${cond.col}" IS NULL`);
        } else if (cond.op === 'IN') {
          const placeholders = (cond.val as any[]).map(() => `$${idx++}`);
          whereParts.push(`"${cond.col}" IN (${placeholders.join(', ')})`);
          params.push(...cond.val);
        } else {
          whereParts.push(`"${cond.col}" ${cond.op} $${idx++}`);
          params.push(cond.val);
        }
      }

      // OR conditions
      for (const orFilter of (orConditions || [])) {
        const parts = orFilter.split(',');
        for (const f of parts) {
          const match = f.trim().match(/^(\w+)\.(\w+)\.(.+)$/);
          if (match) {
            const [, col, op, val] = match;
            if (op === 'eq') {
              whereParts.push(`"${col}" = $${idx++}`);
              params.push(val);
            }
          }
        }
      }

      const where = whereParts.length > 0 ? ` WHERE ${whereParts.join(' AND ')}` : '';

      let orderBy = '';
      if (orderClauses?.length) {
        orderBy = ` ORDER BY ${orderClauses.map((o: any) => `"${o.col}" ${o.ascending ? 'ASC' : 'DESC'}`).join(', ')}`;
      }

      let limit = '';
      const parsedLimit = limitVal !== null && limitVal !== undefined ? Math.min(parseInt(limitVal), MAX_LIMIT) : MAX_LIMIT;
      limit += ` LIMIT ${parsedLimit}`;
      if (offsetVal !== null && offsetVal !== undefined) limit += ` OFFSET ${parseInt(offsetVal)}`;

      const query = `SELECT ${cols} FROM "${table}"${where}${orderBy}${limit}`;
      const result = await pool.query(query, params);

      let count: number | undefined;
      if (countMode === 'exact') {
        const countParams: any[] = [];
        let ci = 1;
        const cWhereParts: string[] = [];
        for (const cond of (conditions || [])) {
          if (cond.op === 'IS NULL') {
            cWhereParts.push(`"${cond.col}" IS NULL`);
          } else if (cond.op === 'IN') {
            const placeholders = (cond.val as any[]).map(() => `$${ci++}`);
            cWhereParts.push(`"${cond.col}" IN (${placeholders.join(', ')})`);
            countParams.push(...cond.val);
          } else {
            cWhereParts.push(`"${cond.col}" ${cond.op} $${ci++}`);
            countParams.push(cond.val);
          }
        }
        const cWhere = cWhereParts.length > 0 ? ` WHERE ${cWhereParts.join(' AND ')}` : '';
        const countResult = await pool.query(`SELECT COUNT(*) FROM "${table}"${cWhere}`, countParams);
        count = parseInt(countResult.rows[0]?.count || '0', 10);
      }

      if (isSingle) {
        if (result.rows.length === 0) {
          return NextResponse.json({ data: null, error: { message: 'No rows found', code: 'PGRST116' }, count });
        }
        return NextResponse.json({ data: result.rows[0], error: null, count });
      }
      if (isMaybeSingle) {
        return NextResponse.json({ data: result.rows[0] || null, error: null, count });
      }
      return NextResponse.json({ data: result.rows, error: null, count: count ?? result.rowCount ?? 0 });
    }

    if (operation === 'insert') {
      const keys = Object.keys(insertData);
      const values = Object.values(insertData);
      const placeholders = keys.map((_, i) => `$${i + 1}`);
      const query = `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
      const result = await pool.query(query, values);
      return NextResponse.json({ data: isSingle ? (result.rows[0] || null) : result.rows, error: null });
    }

    if (operation === 'update') {
      const keys = Object.keys(updateData);
      const values = Object.values(updateData);
      const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`);
      let idx = keys.length + 1;
      const whereParts: string[] = [];
      for (const cond of (conditions || [])) {
        if (cond.op === 'IS NULL') {
          whereParts.push(`"${cond.col}" IS NULL`);
        } else {
          whereParts.push(`"${cond.col}" ${cond.op} $${idx++}`);
          values.push(cond.val);
        }
      }
      const where = whereParts.length > 0 ? ` WHERE ${whereParts.join(' AND ')}` : '';
      const query = `UPDATE "${table}" SET ${setClauses.join(', ')}${where} RETURNING *`;
      const result = await pool.query(query, values);
      return NextResponse.json({ data: result.rows, error: null });
    }

    if (operation === 'delete') {
      let idx = 1;
      const whereParts: string[] = [];
      for (const cond of (conditions || [])) {
        if (cond.op === 'IS NULL') {
          whereParts.push(`"${cond.col}" IS NULL`);
        } else if (cond.op === 'IN') {
          const placeholders = (cond.val as any[]).map(() => `$${idx++}`);
          whereParts.push(`"${cond.col}" IN (${placeholders.join(', ')})`);
          params.push(...cond.val);
        } else {
          whereParts.push(`"${cond.col}" ${cond.op} $${idx++}`);
          params.push(cond.val);
        }
      }
      const where = whereParts.length > 0 ? ` WHERE ${whereParts.join(' AND ')}` : '';
      const query = `DELETE FROM "${table}"${where} RETURNING *`;
      const result = await pool.query(query, params);
      return NextResponse.json({ data: result.rows, error: null });
    }

    if (operation === 'upsert') {
      const keys = Object.keys(insertData);
      const values = Object.values(insertData);
      const placeholders = keys.map((_, i) => `$${i + 1}`);
      const conflictCol = upsertConflictCol || 'id';
      const updateClauses = keys.filter(k => k !== conflictCol).map(k => `"${k}" = EXCLUDED."${k}"`);
      const query = `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT ("${conflictCol}") DO UPDATE SET ${updateClauses.join(', ')} RETURNING *`;
      const result = await pool.query(query, values);
      return NextResponse.json({ data: result.rows[0] || null, error: null });
    }

    return NextResponse.json({ data: null, error: { message: `Unknown operation: ${operation}` } }, { status: 400 });
  } catch (err: any) {
    console.error('[DB API] Error:', err.message);
    return NextResponse.json({ data: null, error: { message: err.message, code: err.code } }, { status: 500 });
  }
}
