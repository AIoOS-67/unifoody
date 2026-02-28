// components/InfoTooltip.tsx
'use client';

import { useState } from 'react';

interface InfoTooltipProps {
  text: string;
  className?: string;
}

export default function InfoTooltip({ text, className }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={`relative inline-flex items-center ${className || ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-zinc-700 text-[10px] text-gray-200 select-none">i</span>
      {open && (
        <span className="absolute z-20 left-1/2 -translate-x-1/2 top-6 whitespace-nowrap bg-zinc-800 text-gray-200 text-xs px-2 py-1 rounded border border-zinc-700 shadow">
          {text}
        </span>
      )}
    </span>
  );
}
