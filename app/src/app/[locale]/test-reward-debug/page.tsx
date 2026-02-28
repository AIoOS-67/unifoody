'use client';

import { useState } from 'react';

export default function TestRewardPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const setupDatabase = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/setup-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      setResult({ status: response.status, data, action: 'setup-database' });
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Unknown error', action: 'setup-database' });
    }
    setLoading(false);
  };

  const testReward = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: '0x958a16adA1b69dB030E905Aaa3f637C7Bd4344a7',
          email: 'ken2@gmail.com'
        })
      });
      
      const data = await response.json();
      setResult({ status: response.status, data });
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
    setLoading(false);
  };

  const checkExistingReward = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/diner-reward?wallet=0x958a16adA1b69dB030E905Aaa3f637C7Bd4344a7`);
      const data = await response.json();
      setResult({ status: response.status, data });
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">奖励系统测试</h1>
        
        <div className="space-y-4">
          <button
            onClick={setupDatabase}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? '设置中...' : '🔧 设置数据库表'}
          </button>
          
          <button
            onClick={testReward}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? '测试中...' : '测试创建奖励'}
          </button>
          
          <button
            onClick={checkExistingReward}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {loading ? '查询中...' : '查询现有奖励'}
          </button>
        </div>

        {result && (
          <div className="bg-zinc-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">结果:</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <div className="bg-zinc-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">测试信息:</h3>
          <p>钱包地址: 0x958a16adA1b69dB030E905Aaa3f637C7Bd4344a7</p>
          <p>邮箱: ken2@gmail.com</p>
        </div>
      </div>
    </div>
  );
}
