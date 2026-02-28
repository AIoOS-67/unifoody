'use client';

import { useState, useEffect } from 'react';

interface MenuItem {
  menu_item_id: string;
  name: string;
  name_zh?: string;
  price_usd: number;
  category: string;
  description?: string;
}

interface VisualMenuProps {
  restaurantId: string;
  agentUrl: string;
  sessionId: string;
  onAddItem: (item: MenuItem) => void;
  onClose: () => void;
}

export function VisualMenu({ restaurantId, agentUrl, sessionId, onAddItem, onClose }: VisualMenuProps) {
  const [categories, setCategories] = useState<Record<string, MenuItem[]>>({});
  const [activeCategory, setActiveCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (restaurantId) loadMenu();
  }, [restaurantId]);

  const loadMenu = async () => {
    setLoading(true);
    setError('');
    try {
      // Use the dedicated menu endpoint (no agent round-trip)
      const resp = await fetch(
        `/api/agent/menu?restaurantId=${encodeURIComponent(restaurantId)}`
      );

      if (resp.ok) {
        const data = await resp.json();
        if (data.categories && Object.keys(data.categories).length > 0) {
          setCategories(data.categories);
          const cats = Object.keys(data.categories);
          if (cats.length > 0) setActiveCategory(cats[0]);
        } else {
          setError('No menu items available.');
        }
      } else {
        // Fallback: try the chat endpoint with a menu request
        const chatResp = await fetch('/api/agent/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Show me the full menu please',
            restaurant_id: restaurantId,
            session_id: sessionId,
          }),
        });

        if (chatResp.ok) {
          setError('Menu loaded via chat. Check the chat for menu details.');
        } else {
          setError('Could not load menu. Ask the agent to show the menu!');
        }
      }
    } catch (err) {
      console.error('[VisualMenu] Failed to load menu:', err);
      setError('Failed to load menu. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const categoryList = Object.keys(categories);

  return (
    <div className="w-80 border-l border-gray-800 bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h3 className="font-semibold text-white text-sm">
          Menu {categoryList.length > 0 && (
            <span className="text-gray-500 font-normal">
              ({Object.values(categories).flat().length} items)
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={loadMenu}
            className="text-gray-400 hover:text-orange-400 transition-colors"
            title="Refresh menu"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full" />
            <p className="text-xs text-gray-500">Loading menu...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm px-4 text-center">
          <div>
            <p className="mb-3">{error}</p>
            <button
              onClick={loadMenu}
              className="text-orange-400 hover:text-orange-300 text-xs underline"
            >
              Try again
            </button>
          </div>
        </div>
      ) : categoryList.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm px-4 text-center">
          <p>Ask the agent to show the menu, or just tell them what you&apos;d like to order!</p>
        </div>
      ) : (
        <>
          {/* Category Tabs */}
          <div className="flex overflow-x-auto gap-1 px-3 py-2 border-b border-gray-800 scrollbar-hide">
            {categoryList.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeCategory === cat
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {cat}
                <span className="ml-1 opacity-60">
                  ({(categories[cat] || []).length})
                </span>
              </button>
            ))}
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {(categories[activeCategory] || []).map((item) => (
              <div
                key={item.menu_item_id}
                className="bg-gray-800 rounded-xl p-3 hover:bg-gray-750 transition-colors group"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white text-sm truncate">{item.name}</h4>
                    {item.name_zh && (
                      <p className="text-xs text-gray-400">{item.name_zh}</p>
                    )}
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                    )}
                  </div>
                  <span className="text-orange-400 font-semibold text-sm ml-2 whitespace-nowrap">
                    ${item.price_usd.toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => onAddItem(item)}
                  className="mt-2 w-full bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 text-xs font-medium py-1.5 rounded-lg transition-colors opacity-80 group-hover:opacity-100"
                >
                  + Add to Order
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
