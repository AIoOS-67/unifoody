'use client';

import { useRouter } from 'next/navigation';

export default function RegisterFailedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
      <div className="bg-zinc-900 rounded-xl p-6 text-center shadow-xl space-y-4">
        <h1 className="text-2xl font-bold text-yellow-400">⚠️ Registration Incomplete</h1>
        <p className="text-zinc-300">It seems your registration was not completed.</p>
        <p className="text-sm text-zinc-500">Please return to the registration page to try again.</p>
        <button
          onClick={() => router.push('/register')}
          className="mt-4 bg-[#4F46E5] hover:bg-[#4338CA] px-4 py-2 rounded text-white font-semibold"
        >
          Go Back to Register
        </button>
      </div>
    </div>
  );
}
