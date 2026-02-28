// components/inputs/PhoneInput.tsx

'use client';

import { useRef } from 'react';

interface PhoneInputProps {
  area: string;
  prefix: string;
  line: string;
  setArea: (v: string) => void;
  setPrefix: (v: string) => void;
  setLine: (v: string) => void;
}

export default function PhoneInput({ area, prefix, line, setArea, setPrefix, setLine }: PhoneInputProps) {
  const areaRef = useRef<HTMLInputElement>(null);
  const prefixRef = useRef<HTMLInputElement>(null);
  const lineRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex gap-2">
      <div className="flex items-center gap-1"><span className="font-bold">1</span><span>+</span></div>
      <input
        maxLength={3}
        ref={areaRef}
        value={area}
        onChange={(e) => {
          setArea(e.target.value);
          if (e.target.value.length === 3) prefixRef.current?.focus();
        }}
        className="input-base w-1/3"
      />
      <input
        maxLength={3}
        ref={prefixRef}
        value={prefix}
        onChange={(e) => {
          setPrefix(e.target.value);
          if (e.target.value.length === 3) lineRef.current?.focus();
        }}
        className="input-base w-1/3"
      />
      <input
        maxLength={4}
        ref={lineRef}
        value={line}
        onChange={(e) => setLine(e.target.value)}
        className="input-base w-1/3"
      />
    </div>
  );
}
