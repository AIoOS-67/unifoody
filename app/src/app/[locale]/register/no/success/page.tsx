'use client';

export default function FailedPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
      <div className="bg-zinc-900 rounded-xl p-6 text-center shadow-xl space-y-4">
        <h1 className="text-2xl font-bold text-red-500">❌ Registration Failed</h1>
        <p className="text-zinc-300">Something went wrong. Please try again later.</p>
        <p className="text-sm text-zinc-500">Or contact FoodyePay support team.</p>
      </div>
    </div>
  );
}
