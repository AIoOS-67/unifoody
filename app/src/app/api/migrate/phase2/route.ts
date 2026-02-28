// app/api/migrate/phase2/route.ts
// Phase 2 (Tap to Pay) database migration
// Creates fiat_payments table and adds payment columns to orders table
// Run once: POST /api/migrate/phase2

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const runtime = 'nodejs';

export async function POST() {
  const results: string[] = [];

  try {
    // ============================================================
    // 1. Create fiat_payments table
    // ============================================================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fiat_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id UUID NOT NULL,
        stripe_payment_intent_id VARCHAR(255) UNIQUE,
        stripe_charge_id VARCHAR(255),
        amount_usd NUMERIC(10,2) NOT NULL,
        platform_fee_usd NUMERIC(10,2) DEFAULT 0,
        restaurant_payout_usd NUMERIC(10,2) DEFAULT 0,
        payment_method VARCHAR(50) DEFAULT 'pending',
        status VARCHAR(20) DEFAULT 'pending'
          CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'disputed')),
        customer_email VARCHAR(255),
        customer_wallet VARCHAR(42),
        foody_reward_amount NUMERIC(20,2) DEFAULT 0,
        foody_reward_status VARCHAR(20) DEFAULT 'none'
          CHECK (foody_reward_status IN ('none', 'pending', 'granted', 'claimed')),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    results.push('✅ Created fiat_payments table');

    // Indexes for fiat_payments
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_fiat_payments_restaurant
        ON fiat_payments(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_fiat_payments_status
        ON fiat_payments(status);
      CREATE INDEX IF NOT EXISTS idx_fiat_payments_created
        ON fiat_payments(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_fiat_payments_pi
        ON fiat_payments(stripe_payment_intent_id);
    `);
    results.push('✅ Created fiat_payments indexes');

    // ============================================================
    // 2. Add payment columns to orders table
    // ============================================================
    // payment_method column
    const colCheck1 = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'payment_method'
    `);
    if (colCheck1.rows.length === 0) {
      await pool.query(`
        ALTER TABLE orders ADD COLUMN payment_method VARCHAR(50) DEFAULT 'FOODY';
      `);
      results.push('✅ Added orders.payment_method column');
    } else {
      results.push('⏭️ orders.payment_method already exists');
    }

    // stripe_payment_intent_id column
    const colCheck2 = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'stripe_payment_intent_id'
    `);
    if (colCheck2.rows.length === 0) {
      await pool.query(`
        ALTER TABLE orders ADD COLUMN stripe_payment_intent_id VARCHAR(255);
      `);
      results.push('✅ Added orders.stripe_payment_intent_id column');
    } else {
      results.push('⏭️ orders.stripe_payment_intent_id already exists');
    }

    // stripe_charge_id column
    const colCheck3 = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'stripe_charge_id'
    `);
    if (colCheck3.rows.length === 0) {
      await pool.query(`
        ALTER TABLE orders ADD COLUMN stripe_charge_id VARCHAR(255);
      `);
      results.push('✅ Added orders.stripe_charge_id column');
    } else {
      results.push('⏭️ orders.stripe_charge_id already exists');
    }

    // ============================================================
    // 3. Verify migration
    // ============================================================
    const tableCheck = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'fiat_payments'
    `);

    const colsCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'orders'
      AND column_name IN ('payment_method', 'stripe_payment_intent_id', 'stripe_charge_id')
      ORDER BY column_name
    `);

    results.push(`\n📊 Verification:`);
    results.push(`  fiat_payments table: ${tableCheck.rows.length > 0 ? '✅ EXISTS' : '❌ MISSING'}`);
    results.push(`  orders new columns: ${colsCheck.rows.map((r: any) => r.column_name).join(', ')}`);

    return NextResponse.json({
      success: true,
      message: 'Phase 2 migration completed',
      results,
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Migration failed',
        results,
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check migration status
export async function GET() {
  try {
    const tableCheck = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'fiat_payments'
    `);

    const colsCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'orders'
      AND column_name IN ('payment_method', 'stripe_payment_intent_id', 'stripe_charge_id')
      ORDER BY column_name
    `);

    const fiatCount = tableCheck.rows.length > 0
      ? (await pool.query('SELECT COUNT(*) FROM fiat_payments')).rows[0].count
      : 0;

    return NextResponse.json({
      migrated: tableCheck.rows.length > 0,
      fiat_payments_table: tableCheck.rows.length > 0,
      orders_columns: colsCheck.rows.map((r: any) => r.column_name),
      fiat_payments_count: parseInt(fiatCount),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
