/**
 * AVOS Call History Endpoint
 * GET: Retrieve paginated call history with optional filtering
 * Query params: restaurantId (required), limit, offset, status, startDate, endDate
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { AVOSCall, mapCallFromDb, isValidUUID, CallStatus } from '@/lib/avos/types';

const VALID_STATUSES: CallStatus[] = [
  'initiated',
  'connected',
  'in_progress',
  'completed',
  'failed',
  'transferred',
];

/**
 * Validate query parameters
 */
function validateQueryParams(params: URLSearchParams): {
  valid: boolean;
  error?: string;
  data?: {
    restaurantId: string;
    limit: number;
    offset: number;
    status?: CallStatus;
    startDate?: string;
    endDate?: string;
  };
} {
  const restaurantId = params.get('restaurantId');
  const limitStr = params.get('limit') || '20';
  const offsetStr = params.get('offset') || '0';
  const status = params.get('status') as CallStatus | null;
  const startDate = params.get('startDate');
  const endDate = params.get('endDate');

  // Validate restaurantId
  if (!restaurantId || !isValidUUID(restaurantId)) {
    return { valid: false, error: 'Invalid or missing restaurantId' };
  }

  // Validate pagination
  const limit = parseInt(limitStr, 10);
  const offset = parseInt(offsetStr, 10);

  if (isNaN(limit) || limit < 1 || limit > 100) {
    return {
      valid: false,
      error: 'limit must be between 1 and 100',
    };
  }

  if (isNaN(offset) || offset < 0) {
    return { valid: false, error: 'offset must be non-negative' };
  }

  // Validate status filter
  if (status && !VALID_STATUSES.includes(status)) {
    return {
      valid: false,
      error: `status must be one of: ${VALID_STATUSES.join(', ')}`,
    };
  }

  // Validate date range
  if (startDate) {
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      return { valid: false, error: 'Invalid startDate format (use ISO 8601)' };
    }
  }

  if (endDate) {
    const end = new Date(endDate);
    if (isNaN(end.getTime())) {
      return { valid: false, error: 'Invalid endDate format (use ISO 8601)' };
    }
  }

  if (startDate && endDate) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    if (start > end) {
      return { valid: false, error: 'startDate must be before endDate' };
    }
  }

  return {
    valid: true,
    data: {
      restaurantId,
      limit,
      offset,
      status: status || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
  };
}

/**
 * GET handler - Retrieve call history
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Validate query params
    const validation = validateQueryParams(searchParams);
    if (!validation.valid) {
      console.warn(`[AVOS] Query validation failed: ${validation.error}`);
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { restaurantId, limit, offset, status, startDate, endDate } =
      validation.data!;

    console.log(
      `[AVOS] Fetching call history for restaurant: ${restaurantId}, limit: ${limit}, offset: ${offset}`
    );

    // Build query
    let query = supabaseAdmin
      .from('avos_calls')
      .select('*', { count: 'exact' })
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply status filter
    if (status) {
      query = query.eq('call_status', status);
    }

    // Apply date range filters
    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[AVOS] Failed to fetch calls:', error);
      return NextResponse.json(
        { error: 'Failed to fetch call history' },
        { status: 500 }
      );
    }

    // Map database rows to AVOSCall
    const calls: AVOSCall[] = (data || []).map(mapCallFromDb);
    const total = count || 0;
    const hasMore = offset + limit < total;

    console.log(
      `[AVOS] Found ${calls.length} calls, total: ${total}, hasMore: ${hasMore}`
    );

    return NextResponse.json(
      {
        success: true,
        calls,
        pagination: {
          limit,
          offset,
          total,
          hasMore,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[AVOS] Call history fetch error:', error);
    return NextResponse.json(
      {
        error: 'Call history fetch failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
