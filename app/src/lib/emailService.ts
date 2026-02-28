// lib/emailService.ts

// 发送验证码邮件
export async function sendVerificationCodeEmail(
  email: string,
  code: string,
  walletAddress: string
): Promise<{ echoedCode?: string; echoMode?: boolean }> {
  const res = await fetch('/api/email/send-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, walletAddress }),
  });

  if (!res.ok) {
    throw new Error('❌ Failed to send verification code email');
  }

  const data = await res.json();
  return { echoedCode: data.echoedCode, echoMode: data.echoMode };
}

// 发送欢迎邮件
export async function sendWelcomeEmail(email: string, walletAddress: string): Promise<void> {
  const res = await fetch('/api/email/welcome', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, walletAddress }),
  });

  if (!res.ok) {
    throw new Error('❌ Failed to send welcome email');
  }
}



