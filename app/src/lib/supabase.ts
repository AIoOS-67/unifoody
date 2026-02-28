// Supabase-compatible query builder
// Server-side: executes via pg Pool directly
// Client-side: proxies through /api/db route

const isServer = typeof window === 'undefined';

let _pool: any = null;
function getPool() {
  if (!isServer) return null;
  if (!_pool) {
    const { Pool } = require('pg');
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

type QueryResult = { data: any; error: any; count?: number };

class QueryBuilder {
  private table: string;
  private operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private selectColumns = '*';
  private conditions: { col: string; op: string; val: any }[] = [];
  private orConditions: string[] = [];
  private orderClauses: { col: string; ascending: boolean }[] = [];
  private limitVal: number | null = null;
  private offsetVal: number | null = null;
  private insertData: any = null;
  private updateData: any = null;
  private upsertConflictCol: string | null = null;
  private isSingle = false;
  private isMaybeSingle = false;
  private countMode: 'exact' | null = null;

  constructor(table: string) {
    this.table = table;
  }

  select(columns?: string, options?: { count?: 'exact' | 'planned' | 'estimated' }): this {
    if (options?.count) this.countMode = 'exact';
    this.operation = 'select';
    if (columns) {
      const cleaned = columns.split(',').map(c => c.trim())
        .filter(c => !c.includes('('))
        .map(c => (c.includes(':') && !c.includes('::')) ? c.split(':')[1].trim() : c)
        .filter(c => c.length > 0);
      this.selectColumns = cleaned.length > 0 ? cleaned.join(', ') : '*';
    } else {
      this.selectColumns = '*';
    }
    return this;
  }

  insert(data: any): this {
    this.operation = 'insert';
    this.insertData = Array.isArray(data) ? data[0] : data;
    return this;
  }

  update(data: any): this {
    this.operation = 'update';
    this.updateData = data;
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  upsert(data: any, options?: { onConflict?: string }): this {
    this.operation = 'upsert';
    this.insertData = Array.isArray(data) ? data[0] : data;
    this.upsertConflictCol = options?.onConflict || 'id';
    return this;
  }

  eq(col: string, val: any): this { this.conditions.push({ col, op: '=', val }); return this; }
  neq(col: string, val: any): this { this.conditions.push({ col, op: '!=', val }); return this; }
  gt(col: string, val: any): this { this.conditions.push({ col, op: '>', val }); return this; }
  gte(col: string, val: any): this { this.conditions.push({ col, op: '>=', val }); return this; }
  lt(col: string, val: any): this { this.conditions.push({ col, op: '<', val }); return this; }
  lte(col: string, val: any): this { this.conditions.push({ col, op: '<=', val }); return this; }
  like(col: string, val: any): this { this.conditions.push({ col, op: 'LIKE', val }); return this; }
  ilike(col: string, val: any): this { this.conditions.push({ col, op: 'ILIKE', val }); return this; }
  in(col: string, vals: any[]): this { this.conditions.push({ col, op: 'IN', val: vals }); return this; }

  is(col: string, val: any): this {
    if (val === null) {
      this.conditions.push({ col, op: 'IS NULL', val: null });
    } else {
      this.conditions.push({ col, op: '=', val });
    }
    return this;
  }

  or(filter: string): this { this.orConditions.push(filter); return this; }

  order(col: string, options?: { ascending?: boolean }): this {
    this.orderClauses.push({ col, ascending: options?.ascending ?? true });
    return this;
  }

  limit(n: number): this { this.limitVal = n; return this; }

  range(from: number, to: number): this {
    this.offsetVal = from;
    this.limitVal = to - from + 1;
    return this;
  }

  single(): Promise<QueryResult> {
    this.isSingle = true;
    this.limitVal = 1;
    return this.execute();
  }

  maybeSingle(): Promise<QueryResult> {
    this.isMaybeSingle = true;
    this.limitVal = 1;
    return this.execute();
  }

  then(resolve: (value: QueryResult) => any, reject?: (reason: any) => any): Promise<any> {
    return this.execute().then(resolve, reject);
  }

  async execute(): Promise<QueryResult> {
    if (!isServer) {
      return this.executeViaApi();
    }
    return this.executeViaPg();
  }

  // Client-side: proxy through /api/db
  private async executeViaApi(): Promise<QueryResult> {
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: this.table,
          operation: this.operation,
          selectColumns: this.selectColumns,
          conditions: this.conditions,
          orConditions: this.orConditions,
          orderClauses: this.orderClauses,
          limitVal: this.limitVal,
          offsetVal: this.offsetVal,
          insertData: this.insertData,
          updateData: this.updateData,
          upsertConflictCol: this.upsertConflictCol,
          isSingle: this.isSingle,
          isMaybeSingle: this.isMaybeSingle,
          countMode: this.countMode,
        }),
      });
      return await res.json();
    } catch (err: any) {
      console.error(`[Supabase Client] API error on "${this.table}":`, err.message);
      return { data: null, error: { message: err.message } };
    }
  }

  // Server-side: execute directly via pg Pool
  private async executeViaPg(): Promise<QueryResult> {
    try {
      const params: any[] = [];

      if (this.operation === 'select') {
        const { sql: where } = this.buildWhere(params);
        const query = `SELECT ${this.selectColumns} FROM "${this.table}"${where}${this.buildOrderBy()}${this.buildLimit()}`;
        const result = await getPool().query(query, params);

        let count: number | undefined;
        if (this.countMode === 'exact') {
          const countParams: any[] = [];
          const { sql: countWhere } = this.buildWhere(countParams);
          const countResult = await getPool().query(`SELECT COUNT(*) FROM "${this.table}"${countWhere}`, countParams);
          count = parseInt(countResult.rows[0]?.count || '0', 10);
        }

        if (this.isSingle) {
          return result.rows.length === 0
            ? { data: null, error: { message: 'No rows found', code: 'PGRST116' }, count }
            : { data: result.rows[0], error: null, count };
        }
        if (this.isMaybeSingle) {
          return { data: result.rows[0] || null, error: null, count };
        }
        return { data: result.rows, error: null, count: count ?? result.rowCount ?? 0 };
      }

      if (this.operation === 'insert') {
        const keys = Object.keys(this.insertData);
        const values = Object.values(this.insertData);
        const placeholders = keys.map((_, i) => `$${i + 1}`);
        const query = `INSERT INTO "${this.table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
        const result = await getPool().query(query, values);
        return { data: (this.isSingle || this.selectColumns !== '*') ? (result.rows[0] || null) : result.rows, error: null };
      }

      if (this.operation === 'update') {
        const keys = Object.keys(this.updateData);
        const values = Object.values(this.updateData);
        const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`);
        let idx = keys.length + 1;
        const whereParts: string[] = [];
        for (const cond of this.conditions) {
          if (cond.op === 'IS NULL') {
            whereParts.push(`"${cond.col}" IS NULL`);
          } else {
            whereParts.push(`"${cond.col}" ${cond.op} $${idx++}`);
            values.push(cond.val);
          }
        }
        const where = whereParts.length > 0 ? ` WHERE ${whereParts.join(' AND ')}` : '';
        const result = await getPool().query(`UPDATE "${this.table}" SET ${setClauses.join(', ')}${where} RETURNING *`, values);
        return { data: result.rows, error: null };
      }

      if (this.operation === 'delete') {
        const { sql: where } = this.buildWhere(params);
        const result = await getPool().query(`DELETE FROM "${this.table}"${where} RETURNING *`, params);
        return { data: result.rows, error: null };
      }

      if (this.operation === 'upsert') {
        const keys = Object.keys(this.insertData);
        const values = Object.values(this.insertData);
        const placeholders = keys.map((_, i) => `$${i + 1}`);
        const conflictCol = this.upsertConflictCol || 'id';
        const updateClauses = keys.filter(k => k !== conflictCol).map(k => `"${k}" = EXCLUDED."${k}"`);
        const query = `INSERT INTO "${this.table}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT ("${conflictCol}") DO UPDATE SET ${updateClauses.join(', ')} RETURNING *`;
        const result = await getPool().query(query, values);
        return { data: result.rows[0] || null, error: null };
      }

      return { data: null, error: { message: `Unknown operation: ${this.operation}` } };
    } catch (err: any) {
      console.error(`[CloudSQL] Query error on "${this.table}":`, err.message);
      return { data: null, error: { message: err.message, code: err.code } };
    }
  }

  private buildWhere(params: any[], startIdx = 1): { sql: string; nextIdx: number } {
    if (this.conditions.length === 0 && this.orConditions.length === 0) {
      return { sql: '', nextIdx: startIdx };
    }
    const parts: string[] = [];
    let idx = startIdx;
    for (const cond of this.conditions) {
      if (cond.op === 'IS NULL') {
        parts.push(`"${cond.col}" IS NULL`);
      } else if (cond.op === 'IN') {
        const placeholders = (cond.val as any[]).map(() => `$${idx++}`);
        parts.push(`"${cond.col}" IN (${placeholders.join(', ')})`);
        params.push(...cond.val);
      } else {
        parts.push(`"${cond.col}" ${cond.op} $${idx++}`);
        params.push(cond.val);
      }
    }
    for (const orFilter of this.orConditions) {
      orFilter.split(',').forEach(f => {
        const match = f.trim().match(/^(\w+)\.(\w+)\.(.+)$/);
        if (match) {
          const [, col, op, val] = match;
          if (op === 'eq') { parts.push(`"${col}" = $${idx++}`); params.push(val); }
        }
      });
    }
    return { sql: parts.length > 0 ? ` WHERE ${parts.join(' AND ')}` : '', nextIdx: idx };
  }

  private buildOrderBy(): string {
    if (this.orderClauses.length === 0) return '';
    return ` ORDER BY ${this.orderClauses.map(o => `"${o.col}" ${o.ascending ? 'ASC' : 'DESC'}`).join(', ')}`;
  }

  private buildLimit(): string {
    let sql = '';
    if (this.limitVal !== null) sql += ` LIMIT ${this.limitVal}`;
    if (this.offsetVal !== null) sql += ` OFFSET ${this.offsetVal}`;
    return sql;
  }
}

class SupabaseCompatClient {
  from(table: string): QueryBuilder {
    return new QueryBuilder(table);
  }
}

export const supabase = new SupabaseCompatClient();
export const supabaseAdmin = new SupabaseCompatClient();
