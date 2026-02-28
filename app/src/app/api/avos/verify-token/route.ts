import { NextRequest, NextResponse } from 'next/server';
import { AVOSPaymentProcessor } from '@/lib/avos/payment-processor';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const payload = await AVOSPaymentProcessor.verifyPaymentToken(token);

    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[AVOS] Token verification error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
