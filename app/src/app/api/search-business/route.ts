// app/api/search-business/route.ts
// Search restaurants by zip code (or legacy name+city combo)
import { NextRequest, NextResponse } from 'next/server';

interface SearchBusinessRequest {
  businessName?: string;
  city?: string;
  zipCode?: string;
  cuisine?: string;
}

// Lightweight diagnostics: GET /api/search-business -> reports env wiring without exposing secrets
export async function GET() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  return NextResponse.json(
    {
      ok: true,
      hasApiKey: !!apiKey,
      keyPrefix: apiKey ? apiKey.substring(0, 8) + '…' : null,
      keyLength: apiKey?.length ?? 0,
      nodeEnv: process.env.NODE_ENV,
    },
    { headers: { 'cache-control': 'no-store' } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchBusinessRequest = await request.json();
    const { businessName, city, zipCode, cuisine } = body;

    // Support both new (zipCode only) and legacy (businessName + city) modes
    const searchZip = zipCode || city;

    if (!searchZip && !businessName) {
      return NextResponse.json(
        {
          success: false,
          message: 'Zip code is required'
        },
        { status: 400 }
      );
    }

    console.log('🔍 Searching restaurants in zip:', searchZip, businessName ? `name: ${businessName}` : '(all)');

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.error('❌ Google Maps API key not found');
      return NextResponse.json(
        {
          success: false,
          message: 'Google Maps API key not configured',
        },
        { status: 500 }
      );
    }

    // Build search query with optional cuisine filter
    const cuisineLabel = cuisine ? `${cuisine} ` : '';
    const searchQuery = businessName
      ? `${businessName} ${cuisineLabel}restaurant ${searchZip}`
      : `${cuisineLabel}restaurants in ${searchZip}`;

    const placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&type=restaurant&key=${apiKey}`;

    console.log('🌐 Google Places API call, query:', searchQuery);

    const placesResponse = await fetch(placesUrl);
    const placesData = await placesResponse.json();

    console.log('📊 API Response Status:', placesData.status, '| Results:', placesData.results?.length || 0);

    if (placesData.status !== 'OK') {
      console.error('❌ Google Places API error:', placesData.status, placesData.error_message);

      return NextResponse.json(
        {
          success: false,
          message: `Google Places API error: ${placesData.status}`,
          api_error: placesData.status,
          error_details: placesData.error_message || 'No additional error details',
        },
        { status: 500 }
      );
    }

    if (!placesData.results || placesData.results.length === 0) {
      console.log('📍 No restaurants found for query:', searchQuery);
      return NextResponse.json({
        success: true,
        places: [],
        total_results: 0,
        message: 'No restaurants found in this area'
      });
    }

    // For zip-code-only search: show all results that contain the zip in their address
    // For name+zip search: filter by name match too
    const filteredResults = placesData.results.filter((place: any) => {
      // Always filter by zip code in address
      const addressContainsZip = searchZip
        ? place.formatted_address && place.formatted_address.includes(searchZip)
        : true;

      // If businessName provided, also filter by name
      if (businessName) {
        const nameMatches = place.name.toLowerCase().includes(businessName.toLowerCase());
        return nameMatches && addressContainsZip;
      }

      return addressContainsZip;
    });

    console.log(`✅ Found ${filteredResults.length} matching restaurants`);

    // Get detailed info (including phone) for each result
    // Limit to 20 to show more restaurants per zip code
    const resultsToFetch = filteredResults.slice(0, 20);
    const transformedResults = [];

    for (const place of resultsToFetch) {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,rating,user_ratings_total,business_status,price_level,formatted_phone_number,international_phone_number&key=${apiKey}`;

      try {
        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();

        if (detailsData.status === 'OK' && detailsData.result) {
          const details = detailsData.result;
          transformedResults.push({
            place_id: place.place_id,
            name: details.name || place.name,
            formatted_address: details.formatted_address || place.formatted_address,
            rating: details.rating || place.rating || 0,
            user_ratings_total: details.user_ratings_total || place.user_ratings_total || 0,
            business_status: details.business_status || place.business_status || 'OPERATIONAL',
            price_level: details.price_level || place.price_level || 0,
            formatted_phone_number: details.formatted_phone_number || null,
            international_phone_number: details.international_phone_number || null,
          });
        } else {
          transformedResults.push({
            place_id: place.place_id,
            name: place.name,
            formatted_address: place.formatted_address,
            rating: place.rating || 0,
            user_ratings_total: place.user_ratings_total || 0,
            business_status: place.business_status || 'OPERATIONAL',
            price_level: place.price_level || 0,
            formatted_phone_number: null,
            international_phone_number: null,
          });
        }
      } catch (error) {
        console.error('Error fetching place details:', error);
        transformedResults.push({
          place_id: place.place_id,
          name: place.name,
          formatted_address: place.formatted_address,
          rating: place.rating || 0,
          user_ratings_total: place.user_ratings_total || 0,
          business_status: place.business_status || 'OPERATIONAL',
          price_level: place.price_level || 0,
          formatted_phone_number: null,
          international_phone_number: null,
        });
      }
    }

    return NextResponse.json({
      success: true,
      places: transformedResults,
      total_results: transformedResults.length,
      real_data: true,
      message: transformedResults.length > 0 ? 'Restaurants found successfully' : 'No matching restaurants found'
    });

  } catch (error) {
    console.error('❌ Business search error:', error);

    return NextResponse.json({
      success: false,
      message: 'Business search failed. Please try again.'
    }, { status: 500 });
  }
}
