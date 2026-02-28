// components/VerificationProgress.tsx
'use client';

import { SCORE_THRESHOLDS } from '@/lib/businessVerification';

interface VerificationStep {
  label: string;
  description: string;
  points: number;
  completed: boolean;
  optional?: boolean;
}

interface VerificationProgressProps {
  googlePlacesVerified: boolean;
  googleRating: number;
  googleReviews: number;
  phoneVerified: boolean;
  squareVerified: boolean;
  currentScore: number;
}

export function VerificationProgress({
  googlePlacesVerified,
  googleRating,
  googleReviews,
  phoneVerified,
  squareVerified,
  currentScore,
}: VerificationProgressProps) {
  const steps: VerificationStep[] = [
    {
      label: 'Google Places Verified',
      description: 'Restaurant found on Google Maps and status is OPERATIONAL',
      points: SCORE_THRESHOLDS.GOOGLE_PLACES_OPERATIONAL,
      completed: googlePlacesVerified,
    },
    {
      label: 'High Rating',
      description: 'Google rating of 4.0 or higher',
      points: SCORE_THRESHOLDS.RATING_HIGH,
      completed: googleRating >= 4.0,
      optional: true,
    },
    {
      label: 'Established Business',
      description: '50 or more Google reviews',
      points: SCORE_THRESHOLDS.REVIEWS_HIGH,
      completed: googleReviews >= 50,
      optional: true,
    },
    {
      label: 'Phone Verified',
      description: 'Verified access to the restaurant\'s listed phone via call',
      points: SCORE_THRESHOLDS.PHONE_VERIFIED,
      completed: phoneVerified,
    },
    {
      label: 'Square Login',
      description: 'Verified via Square OAuth merchant login',
      points: SCORE_THRESHOLDS.SQUARE_VERIFIED,
      completed: squareVerified,
    },
  ];

  const minimumScore = SCORE_THRESHOLDS.MINIMUM_TO_REGISTER;
  const maxScore = SCORE_THRESHOLDS.MAX_POSSIBLE;
  const meetsMinimum = currentScore >= minimumScore;
  const percentage = Math.min(100, Math.round((currentScore / maxScore) * 100));

  return (
    <div className="space-y-4">
      {/* Score Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-400 font-medium">Verification Score</span>
          <span
            className={`font-bold ${
              meetsMinimum ? 'text-green-400' : 'text-yellow-400'
            }`}
          >
            {currentScore} / {maxScore}
          </span>
        </div>

        <div className="relative w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
          {/* Minimum threshold marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/40 z-10"
            style={{ left: `${(minimumScore / maxScore) * 100}%` }}
          />

          {/* Score fill */}
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              meetsMinimum
                ? 'bg-gradient-to-r from-green-600 to-green-400'
                : 'bg-gradient-to-r from-yellow-600 to-yellow-400'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-gray-500">
          <span>0</span>
          <span
            className={`${meetsMinimum ? 'text-green-500' : 'text-yellow-500'}`}
          >
            Min: {minimumScore}
          </span>
          <span>{maxScore}</span>
        </div>

        {!meetsMinimum && (
          <p className="text-xs text-yellow-400">
            You need {minimumScore - currentScore} more points to register.
            Complete Google Places verification + Phone verification OR Square
            login to meet the minimum.
          </p>
        )}
        {meetsMinimum && (
          <p className="text-xs text-green-400">
            You meet the minimum verification requirement. You can proceed with registration.
          </p>
        )}
      </div>

      {/* Step List */}
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
              step.completed
                ? 'bg-green-900/20 border-green-700/50'
                : 'bg-zinc-800/50 border-zinc-700/50'
            }`}
          >
            {/* Status icon */}
            <div
              className={`flex-shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step.completed
                  ? 'bg-green-600 text-white'
                  : 'bg-zinc-700 text-gray-400'
              }`}
            >
              {step.completed ? '\u2713' : i + 1}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${
                    step.completed ? 'text-green-300' : 'text-gray-300'
                  }`}
                >
                  {step.label}
                </span>
                {step.optional && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-gray-400">
                    Optional
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
            </div>

            {/* Points */}
            <div className="flex-shrink-0">
              <span
                className={`text-sm font-bold ${
                  step.completed ? 'text-green-400' : 'text-gray-500'
                }`}
              >
                +{step.points}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
