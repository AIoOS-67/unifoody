// lib/verificationCode.ts

const codeStore: Record<string, string> = {};

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
}

export function saveVerificationCode(email: string, code: string): void {
  codeStore[email] = code;
}

export function validateVerificationCode(email: string, inputCode: string): boolean {
  return codeStore[email] === inputCode;
}
