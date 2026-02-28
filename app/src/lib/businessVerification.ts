// lib/businessVerification.ts
// Core business verification logic: score calculation, multi-layer checks

export interface VerificationResult {
  score: number;
  maxScore: number;
  level: 'verified' | 'partially_verified' | 'unverified';
  breakdown: VerificationBreakdown;
  passesMinimum: boolean;
  minimumScore: number;
}

export interface VerificationBreakdown {
  googlePlacesFound: boolean;
  googlePlacesOperational: boolean;
  googlePlacesScore: number; // +30 for found + operational
  ratingScore: number; // +10 if rating >= 4.0
  reviewsScore: number; // +10 if reviews >= 50
  phoneVerified: boolean;
  phoneScore: number; // +25 for phone verified
  squareVerified: boolean;
  squareScore: number; // +10 for Square OAuth verified
}

export const SCORE_THRESHOLDS = {
  GOOGLE_PLACES_OPERATIONAL: 30,
  RATING_HIGH: 10,
  REVIEWS_HIGH: 10,
  PHONE_VERIFIED: 25,
  SQUARE_VERIFIED: 10,
  MAX_POSSIBLE: 85,
  MINIMUM_TO_REGISTER: 30,
} as const;

export interface GooglePlacesData {
  place_id: string;
  name: string;
  formatted_address: string;
  rating: number;
  user_ratings_total: number;
  business_status?: string;
  formatted_phone_number?: string | null;
  international_phone_number?: string | null;
}

/**
 * Calculate the verification score from individual verification results.
 */
export function calculateVerificationScore(params: {
  googlePlacesData?: GooglePlacesData | null;
  phoneVerified?: boolean;
  squareVerified?: boolean;
}): VerificationResult {
  const { googlePlacesData, phoneVerified, squareVerified } = params;

  const breakdown: VerificationBreakdown = {
    googlePlacesFound: false,
    googlePlacesOperational: false,
    googlePlacesScore: 0,
    ratingScore: 0,
    reviewsScore: 0,
    phoneVerified: !!phoneVerified,
    phoneScore: 0,
    squareVerified: !!squareVerified,
    squareScore: 0,
  };

  // Layer 1: Google Places
  if (googlePlacesData) {
    breakdown.googlePlacesFound = true;
    const isOperational =
      !googlePlacesData.business_status ||
      googlePlacesData.business_status === 'OPERATIONAL';

    if (isOperational) {
      breakdown.googlePlacesOperational = true;
      breakdown.googlePlacesScore = SCORE_THRESHOLDS.GOOGLE_PLACES_OPERATIONAL;
    }

    // Rating bonus
    if ((googlePlacesData.rating ?? 0) >= 4.0) {
      breakdown.ratingScore = SCORE_THRESHOLDS.RATING_HIGH;
    }

    // Reviews bonus
    if ((googlePlacesData.user_ratings_total ?? 0) >= 50) {
      breakdown.reviewsScore = SCORE_THRESHOLDS.REVIEWS_HIGH;
    }
  }

  // Layer 2: Phone verification
  if (phoneVerified) {
    breakdown.phoneScore = SCORE_THRESHOLDS.PHONE_VERIFIED;
  }

  // Layer 3: Square OAuth
  if (squareVerified) {
    breakdown.squareScore = SCORE_THRESHOLDS.SQUARE_VERIFIED;
  }

  const score =
    breakdown.googlePlacesScore +
    breakdown.ratingScore +
    breakdown.reviewsScore +
    breakdown.phoneScore +
    breakdown.squareScore;

  const passesMinimum = score >= SCORE_THRESHOLDS.MINIMUM_TO_REGISTER;

  let level: VerificationResult['level'] = 'unverified';
  if (score >= 80) {
    level = 'verified';
  } else if (score >= SCORE_THRESHOLDS.MINIMUM_TO_REGISTER) {
    level = 'partially_verified';
  }

  return {
    score,
    maxScore: SCORE_THRESHOLDS.MAX_POSSIBLE,
    level,
    breakdown,
    passesMinimum,
    minimumScore: SCORE_THRESHOLDS.MINIMUM_TO_REGISTER,
  };
}

/**
 * Fuzzy match two business names after normalization.
 * Returns a similarity ratio between 0 and 1.
 */
export function fuzzyMatchBusinessName(nameA: string, nameB: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(
        /\b(inc|llc|corp|corporation|ltd|limited|co|company|restaurant|restaurants|bar|grill|cafe|diner|pizzeria|pizza|group|holdings)\b/g,
        '',
      )
      .replace(/\s+/g, ' ')
      .trim();

  const a = normalize(nameA);
  const b = normalize(nameB);

  if (a === b) return 1;

  // Check if one is a substring of the other
  if (a.includes(b) || b.includes(a)) return 0.85;

  // Word overlap
  const wordsA = new Set(a.split(' '));
  const wordsB = new Set(b.split(' '));
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  if (union.size === 0) return 0;
  const jaccard = intersection.size / union.size;

  // First word match is strong signal
  const firstA = a.split(' ')[0];
  const firstB = b.split(' ')[0];
  const firstWordBonus = firstA === firstB ? 0.2 : 0;

  return Math.min(1, jaccard + firstWordBonus);
}

/**
 * Generate a 6-digit verification code.
 */
export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
