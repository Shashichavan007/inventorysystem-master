import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, ShieldCheck, Cpu, AlertCircle } from 'lucide-react';

export default function Cart() {
  const { cart, updateCartQuantity, removeFromCart, clearCart, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (cart.length === 0) return;

    setSubmitting(true);
    setError('');

    const payload = {
      items: cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
      })),
    };

    try {
      const resp = await api.post('/orders', payload);
      const newOrder = resp.data;
      clearCart();
      navigate(`/orders?order_id=${newOrder.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to place order. Inventory may be out of stock.');
    } finally {
      setSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
          <ShoppingCart className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Your Cart is Empty</h2>
          <p className="text-slate-400 text-sm">Add products from our high-throughput catalog to test Kafka event flow.</p>
        </div>
        <Link
          to="/products"
          className="inline-flex items-center space-x-2 px-6 py-3 bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm rounded-xl shadow-lg shadow-sky-500/20 transition-all"
        >
          <span>Browse Product Catalog</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Shopping Cart</h1>
          <p className="text-sm text-slate-400">Review items before triggering Kafka `OrderCreated` pipeline</p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center space-x-1"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear Cart</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center space-x-3 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Cart Items List */}
        <div className="lg:col-span-2 space-y-4">
          {cart.map((item) => (
            <div
              key={item.id}
              className="glass-card rounded-2xl p-5 border border-slate-800 flex items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <h3 className="font-bold text-white text-base">{item.name}</h3>
                <div className="text-xs font-mono text-slate-400">SKU: {item.sku}</div>
                <div className="text-sm font-semibold text-sky-400">${item.price.toFixed(2)} each</div>
              </div>

              <div className="flex items-center space-x-6">
                {/* Quantity Controls */}
                <div className="flex items-center space-x-3 bg-slate-900 border border-slate-800 rounded-xl p-1">
                  <button
                    onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                    className="p-1.5 text-slate-400 hover:text-white transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-sm font-bold text-white w-6 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                    className="p-1.5 text-slate-400 hover:text-white transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-right w-24">
                  <div className="text-xs text-slate-500 font-mono">TOTAL</div>
                  <div className="text-base font-extrabold text-white">
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>

                <button
                  onClick={() => removeFromCart(item.id)}
                  className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary Box */}
        <div className="glass-card rounded-2xl p-6 border border-slate-800 h-fit space-y-6">
          <h2 className="text-xl font-bold text-white">Order Summary</h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Items Subtotal</span>
              <span className="font-mono text-white">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Event Broker Fee</span>
              <span className="font-mono text-emerald-400">$0.00 (Async Kafka)</span>
            </div>
            <div className="pt-3 border-t border-slate-800 flex justify-between text-lg font-bold text-white">
              <span>Total Amount</span>
              <span className="font-mono text-sky-400">${subtotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 space-y-1.5">
            <div className="flex items-center space-x-1.5 font-semibold text-sky-400">
              <Cpu className="w-4 h-4" />
              <span>Event Pipeline Execution</span>
            </div>
            <p>Submitting this order fires `OrderCreated` → Kafka → Inventory Reservation → Payment Service.</p>
          </div>

          <button
            onClick={handleCheckout}
            disabled={submitting}
            className="w-full py-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-extrabold rounded-xl shadow-xl shadow-sky-500/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
          >
            <span>{submitting ? 'Dispatching Kafka Event...' : 'Place Order & Track Live'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

      </div>

    </div>
  );
}
