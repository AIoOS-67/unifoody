import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { wallet_address, amount_usdt, foody_amount } = await req.json()

    if (!wallet_address || amount_usdt == null || foody_amount == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await pool.query(
      `INSERT INTO foody_orders (wallet_address, amount_usdt, foody_amount, created_at)
       VALUES ($1, $2, $3, $4)`,
      [wallet_address, amount_usdt, foody_amount, new Date().toISOString()]
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Order insert failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
