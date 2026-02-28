// src/app/api/v1/menu/route.ts
// GET /api/v1/menu — Browse restaurant menu from Cloud SQL
// Source: menu_items table via Supabase-compatible query builder

import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import {
  apiSuccess,
  apiError,
  handleOptions,
  applyRateLimit,
  getClientIp,
  DEFAULT_RESTAURANT_ID,
} from '../_lib/response'

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // Rate limit: 60 req/min for GET
  const rlResp = applyRateLimit(getClientIp(request), 60, startTime)
  if (rlResp) return rlResp

  try {
    const { searchParams } = new URL(request.url)
    const restaurantId = searchParams.get('restaurant_id') || DEFAULT_RESTAURANT_ID
    const category = searchParams.get('category')

    // Get restaurant name
    const { data: restaurant, error: restErr } = await supabase
      .from('restaurants')
      .select('id, name')
      .eq('id', restaurantId)
      .maybeSingle()

    if (restErr) {
      console.error('[API v1/menu] Restaurant lookup error:', restErr.message)
    }

    // Fetch menu items
    let query = supabase
      .from('menu_items')
      .select('id, name, description, price, category, is_available')
      .eq('restaurant_id', restaurantId)
      .eq('is_available', true)
      .order('category')
      .order('name')

    if (category) {
      query = query.eq('category', category)
    }

    const { data: items, error } = await query

    if (error) {
      console.error('[API v1/menu] DB error:', error.message)
      return apiError('Failed to fetch menu: ' + error.message, 500, startTime)
    }

    // Group by category
    const categories: Record<string, any[]> = {}
    for (const item of (items || [])) {
      const cat = item.category || 'Other'
      if (!categories[cat]) categories[cat] = []
      categories[cat].push({
        id: item.id,
        name: item.name,
        description: item.description,
        price: parseFloat(item.price),
        category: cat,
      })
    }

    return apiSuccess({
      restaurant: {
        id: restaurantId,
        name: restaurant?.name || 'Foody Restaurant',
      },
      categories,
      total_items: (items || []).length,
      category_count: Object.keys(categories).length,
    }, startTime)

  } catch (err: any) {
    console.error('[API v1/menu] Unexpected error:', err)
    return apiError('Internal server error', 500, startTime)
  }
}

export async function OPTIONS() {
  return handleOptions()
}
