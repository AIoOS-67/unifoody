// app/test-real-token/page.tsx
// 测试真实FOODY代币发放

'use client';

import { useState } from 'react';

export default function TestRealTokenPage() {
  const [testResult, setTestResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [testWallet, setTestWallet] = useState('0x958a16ada1b69db030e905aaa3f637c7bd4344a7');

  const testRealTokenDistribution = async () => {
    setLoading(true);
    setTestResult('');
    
    try {
      const response = await fetch('/api/test-real-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: testWallet,
          amount: 100 // 测试发放100 FOODY
        }),
      });

      const data = await response.json();
      setTestResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setTestResult(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const checkMainWalletBalance = async () => {
    setLoading(true);
    setTestResult('');
    
    try {
      const response = await fetch('/api/test-real-token?action=balance');
      const data = await response.json();
      setTestResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setTestResult(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-yellow-400 mb-8">
          🔧 Real FOODY Token Distribution Test
        </h1>

        <div className="bg-zinc-900 rounded-xl p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Test Wallet Address</h2>
            <input
              type="text"
              value={testWallet}
              onChange={(e) => setTestWallet(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2 text-white"
              placeholder="Enter wallet address to test"
            />
          </div>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={checkMainWalletBalance}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-3 rounded-lg font-medium"
            >
              {loading ? 'Checking...' : 'Check Main Wallet Balance'}
            </button>

            <button
              onClick={testRealTokenDistribution}
              disabled={loading || !testWallet}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-6 py-3 rounded-lg font-medium"
            >
              {loading ? 'Testing...' : 'Test Real Token Transfer (100 FOODY)'}
            </button>
          </div>

          {testResult && (
            <div className="bg-zinc-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Test Result:</h3>
              <pre className="text-sm text-green-400 whitespace-pre-wrap overflow-x-auto">
                {testResult}
              </pre>
            </div>
          )}

          <div className="border-t border-zinc-700 pt-6">
            <h3 className="text-lg font-semibold mb-2">Instructions:</h3>
            <ol className="list-decimal list-inside space-y-2 text-zinc-300">
              <li>First check the main wallet balance to ensure it has enough FOODY tokens</li>
              <li>Enter a test wallet address (default is ken2's wallet)</li>
              <li>Click "Test Real Token Transfer" to send 100 FOODY tokens</li>
              <li>Check the result for transaction hash or error messages</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
