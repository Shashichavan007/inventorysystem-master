import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, ShieldCheck, Cpu, Package } from 'lucide-react';

export default function Cart() {
  const { cart, updateCartQuantity, removeFromCart, clearCart, user } = useAuth();
  const navigate = useNavigate();

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (cart.length === 0) {
    return (
      <div className="card-surface p-16 max-w-xl mx-auto text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
          <ShoppingCart className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Your Cart is Empty</h2>
          <p className="text-slate-500 text-sm">Browse our high-throughput product catalog to add microservice hardware items.</p>
        </div>
        <Link
          to="/products"
          className="inline-flex items-center space-x-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-brand-500/25 transition-all"
        >
          <span>Browse Product Catalog</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Shopping Cart</h1>
          <p className="text-sm text-slate-500">{cart.length} item(s) selected for order dispatch</p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center space-x-1"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear Cart</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Cart Items List */}
        <div className="lg:col-span-2 space-y-4">
          {cart.map((item) => (
            <div
              key={item.id}
              className="card-surface p-5 flex items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">{item.name}</h3>
                <div className="text-xs font-mono text-slate-400">SKU: {item.sku}</div>
                <div className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                  ${item.price.toLocaleString('en-US', { minimumFractionDigits: 2 })} each
                </div>
              </div>

              <div className="flex items-center space-x-6">
                {/* Quantity Controls */}
                <div className="flex items-center space-x-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
                  <button
                    onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-sm font-bold text-slate-900 dark:text-white w-6 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                    className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-right w-24">
                  <div className="text-[10px] text-slate-400 font-mono font-bold">TOTAL</div>
                  <div className="text-base font-extrabold text-slate-900 dark:text-white">
                    ${(item.price * item.quantity).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <button
                  onClick={() => removeFromCart(item.id)}
                  className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary Box */}
        <div className="card-surface p-6 space-y-6 h-fit">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Summary</h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Items Subtotal</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Fulfillment Fee</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">$0.00 (Instant Async)</span>
            </div>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between text-lg font-bold text-slate-900 dark:text-white">
              <span>Total Amount</span>
              <span className="font-mono text-brand-600 dark:text-brand-400">
                ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <button
            onClick={() => navigate('/checkout')}
            className="w-full py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-brand-500/25 flex items-center justify-center space-x-2 transition-all"
          >
            <span>Proceed to Checkout</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>

    </div>
  );
}
