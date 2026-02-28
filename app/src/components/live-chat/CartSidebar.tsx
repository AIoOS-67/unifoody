'use client';

interface CartItem {
  menu_item_id: string;
  item_name: string;
  price_usd: number;
  quantity: number;
  modifications?: string[];
}

interface CartSidebarProps {
  restaurantId: string;
  items: CartItem[];
  onCheckout: () => void;
  onClose: () => void;
}

export function CartSidebar({ restaurantId, items, onCheckout, onClose }: CartSidebarProps) {
  const subtotal = items.reduce((sum, item) => sum + item.price_usd * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="w-80 border-l border-gray-800 bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h3 className="font-semibold text-white text-sm">
          Your Order {itemCount > 0 && `(${itemCount})`}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            <p className="text-sm">Your cart is empty</p>
            <p className="text-xs mt-1">Tell the agent what you&apos;d like to order!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={`${item.menu_item_id}_${idx}`} className="bg-gray-800 rounded-xl p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white text-sm">{item.item_name}</h4>
                    {item.modifications && item.modifications.length > 0 && (
                      <p className="text-xs text-orange-400 mt-0.5">
                        {item.modifications.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-2">
                    <span className="text-orange-400 font-semibold text-sm">
                      ${(item.price_usd * item.quantity).toFixed(2)}
                    </span>
                    <p className="text-xs text-gray-500">x{item.quantity}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {items.length > 0 && (
        <div className="border-t border-gray-800 p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Subtotal</span>
            <span className="text-white font-semibold">${subtotal.toFixed(2)}</span>
          </div>
          <p className="text-xs text-gray-500">Tax calculated at checkout</p>
          <button
            onClick={onCheckout}
            className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-orange-600/20"
          >
            Checkout — ${subtotal.toFixed(2)}
          </button>
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <span>Apple Pay</span>
            <span>·</span>
            <span>Google Pay</span>
            <span>·</span>
            <span className="text-orange-400">FOODY</span>
          </div>
        </div>
      )}
    </div>
  );
}
