'use client';

interface CartItem {
  menu_item_id: string;
  item_name: string;
  price_usd: number;
  quantity: number;
  modifications?: string[];
}

interface KioskCartProps {
  items: CartItem[];
  onCheckout: () => void;
}

/**
 * KioskCart — Large-format, touch-friendly cart display for kiosk mode.
 *
 * Unlike CartSidebar, this is always visible (not toggleable),
 * uses larger fonts for readability from a distance, and has
 * animated item additions.
 */
export function KioskCart({ items, onCheckout }: KioskCartProps) {
  const subtotal = items.reduce((sum, item) => sum + item.price_usd * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="h-full flex flex-col bg-gray-900/80 backdrop-blur-sm rounded-2xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-3">
          <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
          Your Order
        </h2>
        {itemCount > 0 && (
          <span className="bg-orange-500 text-white text-sm font-bold px-3 py-1 rounded-full">
            {itemCount}
          </span>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <svg className="w-16 h-16 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            <p className="text-lg">Your cart is empty</p>
            <p className="text-sm mt-2 text-gray-600">
              Tell Foody what you&apos;d like to order!
            </p>
          </div>
        ) : (
          items.map((item, idx) => (
            <div
              key={`${item.item_name}_${idx}`}
              className="bg-gray-800/80 rounded-xl p-4 animate-slide-in"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-lg">{item.item_name}</h3>
                  {item.modifications && item.modifications.length > 0 && (
                    <p className="text-sm text-orange-400 mt-1">
                      {item.modifications.join(', ')}
                    </p>
                  )}
                </div>
                <div className="text-right ml-4">
                  <span className="text-orange-400 font-bold text-lg">
                    ${(item.price_usd * item.quantity).toFixed(2)}
                  </span>
                  <p className="text-sm text-gray-400">x{item.quantity}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {items.length > 0 && (
        <div className="border-t border-gray-800 p-5 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-lg">Subtotal</span>
            <span className="text-white font-bold text-2xl">
              ${subtotal.toFixed(2)}
            </span>
          </div>
          <p className="text-sm text-gray-500">Tax calculated at checkout</p>
          <button
            onClick={onCheckout}
            className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white py-4 rounded-xl font-bold text-xl transition-all shadow-lg shadow-orange-600/20 active:scale-[0.98]"
          >
            Checkout &mdash; ${subtotal.toFixed(2)}
          </button>
        </div>
      )}
    </div>
  );
}
