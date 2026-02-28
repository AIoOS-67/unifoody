/**
 * AVOS Menu Synchronization Endpoint
 * POST: Rebuild avos_menu_index for a restaurant
 * Generates phonetic variations for all menu items and updates search index
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getPhoneticVariations } from '@/lib/avos/phonetic-utils';
import { isValidUUID } from '@/lib/avos/types';

interface MenuItemRecord {
  id: string;
  restaurant_id: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  is_available: boolean;
}

/**
 * Generate menu index entries from menu items
 */
function generateMenuIndexEntries(
  items: MenuItemRecord[],
  restaurantId: string
): any[] {
  const entries: any[] = [];

  for (const item of items) {
    const phonetics = getPhoneticVariations(item.name);

    const entry = {
      id: `${item.id}-index-${Date.now()}`,
      restaurant_id: restaurantId,
      menu_item_id: item.id,
      item_name: item.name,
      item_name_zh: null,
      item_name_yue: null,
      item_name_es: null,
      aliases: phonetics, // Phonetic variations as aliases
      phonetic_en: phonetics.length > 0 ? phonetics[0] : null,
      phonetic_zh: null,
      phonetic_yue: null,
      category: item.category || 'Uncategorized',
      price_usd: item.price,
      is_available: item.is_available,
      created_at: new Date().toISOString(),
    };

    entries.push(entry);
  }

  return entries;
}

/**
 * POST handler - Rebuild menu index
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { restaurantId } = body;

    if (!restaurantId || !isValidUUID(restaurantId)) {
      console.warn('[AVOS] Menu sync validation failed: invalid restaurantId');
      return NextResponse.json(
        { error: 'Invalid restaurantId' },
        { status: 400 }
      );
    }

    console.log(`[AVOS] Starting menu sync for restaurant: ${restaurantId}`);

    // 1. Fetch all menu items for restaurant
    const { data: menuItems, error: fetchError } = await supabaseAdmin
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId);

    if (fetchError) {
      console.error('[AVOS] Failed to fetch menu items:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch menu items' },
        { status: 500 }
      );
    }

    if (!menuItems || menuItems.length === 0) {
      console.log(`[AVOS] No menu items found for restaurant ${restaurantId}`);
      return NextResponse.json(
        {
          success: true,
          synced: 0,
          restaurantId,
          message: 'No menu items to sync',
        },
        { status: 200 }
      );
    }

    console.log(`[AVOS] Found ${menuItems.length} menu items to index`);

    // 2. Generate index entries with phonetic variations
    const indexEntries = generateMenuIndexEntries(menuItems, restaurantId);

    // 3. Delete old index entries for this restaurant
    console.log('[AVOS] Deleting old index entries');

    const { error: deleteError } = await supabaseAdmin
      .from('avos_menu_index')
      .delete()
      .eq('restaurant_id', restaurantId);

    if (deleteError) {
      console.error('[AVOS] Failed to delete old index:', deleteError);
      return NextResponse.json(
        { error: 'Failed to clear old index' },
        { status: 500 }
      );
    }

    // 4. Insert new index entries in batches (to avoid payload size limits)
    const batchSize = 50;
    let totalInserted = 0;

    for (let i = 0; i < indexEntries.length; i += batchSize) {
      const batch = indexEntries.slice(i, i + batchSize);

      console.log(
        `[AVOS] Inserting batch ${Math.floor(i / batchSize) + 1} (${batch.length} items)`
      );

      const { error: insertError } = await supabaseAdmin
        .from('avos_menu_index')
        .insert(batch);

      if (insertError) {
        console.error(
          `[AVOS] Failed to insert batch at index ${i}:`,
          insertError
        );
        // Continue with next batch on error
      } else {
        totalInserted += batch.length;
      }
    }

    console.log(
      `[AVOS] Menu sync complete: ${totalInserted} items indexed`
    );

    return NextResponse.json(
      {
        success: true,
        synced: totalInserted,
        restaurantId,
        total: menuItems.length,
        message:
          totalInserted === menuItems.length
            ? 'Menu sync completed successfully'
            : `Partial sync: ${totalInserted}/${menuItems.length} items indexed`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[AVOS] Menu sync error:', error);
    return NextResponse.json(
      {
        error: 'Menu sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET for health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'AVOS menu synchronization',
  });
}
