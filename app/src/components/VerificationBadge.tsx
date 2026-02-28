// components/VerificationBadge.tsx
'use client';

interface VerificationBadgeProps {
  score: number;
  maxScore?: number;
  level?: 'verified' | 'partially_verified' | 'unverified';
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function VerificationBadge({
  score,
  maxScore = 100,
  level,
  showScore = true,
  size = 'md',
}: VerificationBadgeProps) {
  // Derive level from score if not provided
  const derivedLevel =
    level || (score >= 80 ? 'verified' : score >= 55 ? 'partially_verified' : 'unverified');

  const config = {
    verified: {
      label: 'Verified',
      icon: '\u2713', // checkmark
      bgColor: 'bg-green-900/60',
      borderColor: 'border-green-500',
      textColor: 'text-green-300',
      iconBg: 'bg-green-600',
    },
    partially_verified: {
      label: 'Partially Verified',
      icon: '~',
      bgColor: 'bg-yellow-900/40',
      borderColor: 'border-yellow-500',
      textColor: 'text-yellow-300',
      iconBg: 'bg-yellow-600',
    },
    unverified: {
      label: 'Unverified',
      icon: '!',
      bgColor: 'bg-red-900/40',
      borderColor: 'border-red-500',
      textColor: 'text-red-300',
      iconBg: 'bg-red-600',
    },
  };

  const c = config[derivedLevel];

  const sizeClasses = {
    sm: {
      container: 'px-2 py-1 text-xs',
      icon: 'w-4 h-4 text-[10px]',
    },
    md: {
      container: 'px-3 py-1.5 text-sm',
      icon: 'w-5 h-5 text-xs',
    },
    lg: {
      container: 'px-4 py-2 text-base',
      icon: 'w-6 h-6 text-sm',
    },
  };

  const s = sizeClasses[size];

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border ${c.bgColor} ${c.borderColor} ${s.container}`}
    >
      <span
        className={`inline-flex items-center justify-center rounded-full ${c.iconBg} text-white font-bold ${s.icon}`}
      >
        {c.icon}
      </span>
      <span className={`font-medium ${c.textColor}`}>{c.label}</span>
      {showScore && (
        <span className={`${c.textColor} opacity-70`}>
          {score}/{maxScore}
        </span>
      )}
    </div>
  );
}

/**
 * A small inline badge suitable for table rows or lists.
 */
export function VerificationBadgeInline({
  score,
  level,
}: {
  score: number;
  level?: 'verified' | 'partially_verified' | 'unverified';
}) {
  return <VerificationBadge score={score} level={level} showScore={false} size="sm" />;
}
