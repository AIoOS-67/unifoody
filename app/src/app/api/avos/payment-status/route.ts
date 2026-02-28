import { NextRequest, NextResponse } from 'next/server';
import { paymentProcessor } from '@/lib/avos/payment-processor';

export async function POST(request: NextRequest) {
  try {
    const { token, status, txHash } = await request.json();

    if (!token || !status) {
      return NextResponse.json({ error: 'Token and status required' }, { status: 400 });
    }

    await paymentProcessor.updatePaymentStatus(token, status, txHash);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[AVOS] Payment status update error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
