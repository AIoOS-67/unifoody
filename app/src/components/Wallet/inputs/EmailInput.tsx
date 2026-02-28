// components/inputs/EmailInput.tsx

'use client';

interface EmailInputProps {
  value: string;
  onChange: (v: string) => void;
}

export default function EmailInput({ value, onChange }: EmailInputProps) {
  return (
    <div className="flex w-full">
      <input
        placeholder="Gmail (no @)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-base w-7/10 rounded-r-none"
      />
      <span className="input-base bg-zinc-700 rounded-l-none flex items-center justify-center w-3/10">@gmail.com</span>
    </div>
  );
}
