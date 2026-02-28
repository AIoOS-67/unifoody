// app/api/check-phone-verification/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface CheckVerificationRequest {
  phoneNumber: string;
  code: string;
}

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, code }: CheckVerificationRequest = await request.json();

    if (!phoneNumber || !code) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Phone number and verification code are required' 
        },
        { status: 400 }
      );
    }

    console.log('🔍 Verifying code for phone:', phoneNumber);

    // Handle test phone numbers
    const isTestNumber = phoneNumber.includes('5550000000') || phoneNumber.includes('+15550000000');
    const isMyNumber = phoneNumber.includes('2016736206') || phoneNumber.includes('+12016736206');
    
    if (isTestNumber) {
      console.log('🧪 Using test number verification');
      if (code === '123456') {
        return NextResponse.json({ 
          success: true, 
          verified: true,
          message: 'Test verification successful!',
          isTest: true
        });
      } else {
        return NextResponse.json({ 
          success: false, 
          verified: false,
          message: 'Invalid test code. Use: 123456'
        }, { status: 400 });
      }
    }

    if (isMyNumber) {
      console.log('🧪 Using your number verification - test mode');
      if (code === '654321') {
        return NextResponse.json({ 
          success: true, 
          verified: true,
          message: 'Your number verification successful!',
          isTest: true
        });
      } else {
        return NextResponse.json({ 
          success: false, 
          verified: false,
          message: 'Invalid code for your number. Use: 654321'
        }, { status: 400 });
      }
    }

    // For all other numbers, use generic test code
    if (code === '999888') {
      return NextResponse.json({ 
        success: true, 
        verified: true,
        message: 'Generic test verification successful!',
        isTest: true
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        verified: false,
        message: 'Invalid code. Use: 999888'
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('❌ Phone verification check error:', error);
    return NextResponse.json({
      success: false,
      verified: false,
      message: 'Verification failed, please try again later'
    }, { status: 500 });
  }
}
