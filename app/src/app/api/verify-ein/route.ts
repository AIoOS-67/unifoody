// app/api/verify-ein/route.ts
// EIN / Tax ID verification using SEC EDGAR (free) and OpenCorporates (free tier)
// Cross-references the returned business name with the Google Places restaurant name

import { NextRequest, NextResponse } from 'next/server';
import {
  searchSECEdgar,
  searchOpenCorporates,
  fuzzyMatchBusinessName,
} from '@/lib/businessVerification';

export async function POST(request: NextRequest) {
  try {
    const { ein, restaurantName } = await request.json();

    if (!restaurantName) {
      return NextResponse.json(
        { valid: false, error: 'Restaurant name is required' },
        { status: 400 },
      );
    }

    // EIN is optional -- if provided, validate format
    if (ein) {
      const formattedEin = ein.replace(/\D/g, '').slice(0, 9);
      if (formattedEin.length !== 9) {
        return NextResponse.json({
          valid: false,
          error: 'Invalid EIN format. Must be 9 digits.',
        });
      }
    }

    console.log('EIN/Business Verification Request:', { ein: ein || 'not provided', restaurantName });

    // Try SEC EDGAR first (completely free, no API key needed)
    let edgarResult = { found: false } as Awaited<ReturnType<typeof searchSECEdgar>>;
    let openCorpResult = { found: false } as Awaited<ReturnType<typeof searchOpenCorporates>>;

    // Run both lookups in parallel
    const [edgarResponse, openCorpResponse] = await Promise.allSettled([
      searchSECEdgar(restaurantName),
      searchOpenCorporates(restaurantName),
    ]);

    if (edgarResponse.status === 'fulfilled') {
      edgarResult = edgarResponse.value;
    }
    if (openCorpResponse.status === 'fulfilled') {
      openCorpResult = openCorpResponse.value;
    }

    console.log('SEC EDGAR result:', edgarResult);
    console.log('OpenCorporates result:', openCorpResult);

    // Determine the best match
    let bestMatch: {
      source: string;
      companyName: string;
      similarity: number;
      identifier?: string;
    } | null = null;

    if (edgarResult.found && edgarResult.companyName) {
      const similarity = fuzzyMatchBusinessName(restaurantName, edgarResult.companyName);
      if (similarity >= 0.4) {
        bestMatch = {
          source: 'SEC_EDGAR',
          companyName: edgarResult.companyName,
          similarity,
          identifier: edgarResult.cik,
        };
      }
    }

    if (openCorpResult.found && openCorpResult.companyName) {
      const similarity = fuzzyMatchBusinessName(restaurantName, openCorpResult.companyName);
      if (similarity >= 0.4) {
        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = {
            source: 'OPENCORPORATES',
            companyName: openCorpResult.companyName,
            similarity,
            identifier: openCorpResult.companyNumber,
          };
        }
      }
    }

    if (bestMatch && bestMatch.similarity >= 0.4) {
      return NextResponse.json({
        valid: true,
        registeredName: bestMatch.companyName,
        similarity: Math.round(bestMatch.similarity * 100),
        verificationSource: bestMatch.source,
        identifier: bestMatch.identifier,
        ein: ein || undefined,
        verificationMethod: 'PUBLIC_RECORDS',
        edgarFound: edgarResult.found,
        openCorpFound: openCorpResult.found,
      });
    }

    // Neither source found a match
    return NextResponse.json({
      valid: false,
      error:
        'Business not found in public records (SEC EDGAR / OpenCorporates). This verification is optional and does not prevent registration.',
      edgarFound: edgarResult.found,
      openCorpFound: openCorpResult.found,
      edgarName: edgarResult.companyName || null,
      openCorpName: openCorpResult.companyName || null,
      verificationMethod: 'PUBLIC_RECORDS',
    });
  } catch (error) {
    console.error('EIN verification error:', error);
    return NextResponse.json({
      valid: false,
      error: 'Verification service temporarily unavailable. This step is optional.',
      verificationMethod: 'PUBLIC_RECORDS',
    });
  }
}
