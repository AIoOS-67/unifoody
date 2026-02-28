// app/api/verify-business/route.ts
// Comprehensive business verification API that combines all verification layers
// and returns a consolidated verification score.

import { NextRequest, NextResponse } from 'next/server';
import {
  calculateVerificationScore,
  GooglePlacesData,
  VerificationResult,
} from '@/lib/businessVerification';
import pool from '@/lib/db';

export const runtime = 'nodejs';

interface VerifyBusinessRequest {
  // Google Places data (from client after business search)
  googlePlacesData?: GooglePlacesData;
  // Verification flags (checked from DB or passed from client)
  phoneVerified?: boolean;
  squareMerchantId?: string;
  // Restaurant identifier
  walletAddress?: string;
  restaurantId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: VerifyBusinessRequest = await request.json();
    const { googlePlacesData, phoneVerified, squareMerchantId, walletAddress, restaurantId } = body;

    // Square is verified if we have a merchant ID (OAuth was completed)
    const squareVerified = !!squareMerchantId;

    // Validate Google Places business_status
    let googleVerified = false;
    if (googlePlacesData) {
      const status = googlePlacesData.business_status;
      if (!status || status === 'OPERATIONAL') {
        googleVerified = true;
      }
    }

    // Calculate the verification score
    const result: VerificationResult = calculateVerificationScore({
      googlePlacesData: googleVerified ? googlePlacesData : undefined,
      phoneVerified: !!phoneVerified,
      squareVerified,
    });

    // Persist score to database if we have a way to identify the restaurant
    if (walletAddress || restaurantId) {
      try {
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let idx = 1;

        updateFields.push(`verification_score = $${idx++}`);
        updateValues.push(result.score);

        if (googleVerified && googlePlacesData) {
          updateFields.push(`business_verified = $${idx++}`);
          updateValues.push(true);
          updateFields.push(`google_place_id = $${idx++}`);
          updateValues.push(googlePlacesData.place_id);
          updateFields.push(`business_status = $${idx++}`);
          updateValues.push(googlePlacesData.business_status || 'OPERATIONAL');
          updateFields.push(`rating = $${idx++}`);
          updateValues.push(googlePlacesData.rating || 0);
          updateFields.push(`user_ratings_total = $${idx++}`);
          updateValues.push(googlePlacesData.user_ratings_total || 0);
        }

        if (phoneVerified) {
          updateFields.push(`phone_verified = $${idx++}`);
          updateValues.push(true);
        }

        updateFields.push(`updated_at = NOW()`);

        let whereClause: string;
        if (restaurantId) {
          whereClause = `id = $${idx++}`;
          updateValues.push(restaurantId);
        } else {
          whereClause = `wallet_address = $${idx++}`;
          updateValues.push(walletAddress);
        }

        const query = `UPDATE restaurants SET ${updateFields.join(', ')} WHERE ${whereClause}`;
        await pool.query(query, updateValues);
      } catch (dbError) {
        console.warn('Failed to persist verification score:', dbError);
        // Non-fatal: still return the score to the client
      }
    }

    return NextResponse.json({
      success: true,
      verification: result,
      googlePlacesStatus: googlePlacesData?.business_status || 'UNKNOWN',
      squareVerified,
    });
  } catch (error: any) {
    console.error('Verify business error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Verification failed',
      },
      { status: 500 },
    );
  }
}

/**
 * GET: Retrieve the current verification score for a restaurant
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'wallet query parameter is required' },
        { status: 400 },
      );
    }

    const result = await pool.query(
      `SELECT id, name, google_place_id, rating, user_ratings_total, business_status,
              business_verified, phone_verified, square_merchant_id, square_status, verification_score
       FROM restaurants WHERE wallet_address = $1`,
      [walletAddress],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Restaurant not found' },
        { status: 404 },
      );
    }

    const restaurant = result.rows[0];

    // Recalculate score based on current DB state
    const verification = calculateVerificationScore({
      googlePlacesData: restaurant.google_place_id
        ? {
            place_id: restaurant.google_place_id,
            name: restaurant.name,
            formatted_address: '',
            rating: parseFloat(restaurant.rating) || 0,
            user_ratings_total: restaurant.user_ratings_total || 0,
            business_status: restaurant.business_status || 'OPERATIONAL',
          }
        : undefined,
      phoneVerified: restaurant.phone_verified,
      squareVerified: !!restaurant.square_merchant_id,
    });

    return NextResponse.json({
      success: true,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        business_verified: restaurant.business_verified,
        phone_verified: restaurant.phone_verified,
        verification_score: verification.score,
      },
      verification,
    });
  } catch (error: any) {
    console.error('Get verification error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve verification' },
      { status: 500 },
    );
  }
}
