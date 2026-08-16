import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ShoppingCart, ArrowLeft, CheckCircle2, ShieldCheck, Cpu, Plus, Minus, Zap, Truck, Clock } from 'lucide-react';

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, devMode } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [toastMsg, setToastMsg] = useState('');

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const resp = await api.get(`/products/${id}`);
      return resp.data;
    }
  });

  if (isLoading) {
    return (
      <div className="card-surface p-8 max-w-4xl mx-auto animate-pulse space-y-6">
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="card-surface p-12 text-center max-w-xl mx-auto space-y-4">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Product Not Found</h2>
        <p className="text-xs text-slate-500">The requested product ID does not exist or has been removed.</p>
        <Link to="/products" className="inline-flex items-center space-x-2 text-xs font-bold text-brand-600">
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Catalog</span>
        </Link>
      </div>
    );
  }

  const handleAdd = () => {
    addToCart(product, quantity);
    setToastMsg(`Added ${quantity} x '${product.name}' to Cart!`);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const handleBuyNow = () => {
    addToCart(product, quantity);
    navigate('/cart');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-emerald-900 text-white rounded-2xl shadow-2xl flex items-center space-x-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="text-sm font-bold">{toastMsg}</span>
        </div>
      )}

      {/* Back to Catalog Link */}
      <Link to="/products" className="inline-flex items-center space-x-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Product Catalog</span>
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Column: Visual Card */}
        <div className="card-surface p-8 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800/60 min-h-[350px]">
          <Cpu className="w-32 h-32 text-brand-600 dark:text-brand-400 animate-pulse" />
          <div className="mt-6 text-xs font-mono text-slate-400 bg-white dark:bg-slate-900 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-800">
            SKU: {product.sku}
          </div>
        </div>

        {/* Right Column: Product Details */}
        <div className="space-y-6">
          
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="px-2.5 py-0.5 rounded-md bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 text-xs font-mono font-bold">
                Category #{product.category_id}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${
                product.stock > 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-50 text-rose-700'
              }`}>
                {product.stock > 0 ? `${product.stock} Units Available` : 'Out of Stock'}
              </span>
            </div>

            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {product.name}
            </h1>
            
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-3">
              ${product.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {product.description || 'High-performance microservice infrastructure component engineered for event-driven throughput.'}
          </p>

          {/* Quantity Controls */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold text-slate-500 uppercase">Quantity Selector</label>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-mono text-sm font-bold text-slate-900 dark:text-white w-8 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <span className="text-xs text-slate-400 font-mono">Total: ${(product.price * quantity).toFixed(2)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={handleAdd}
              disabled={product.stock <= 0}
              className="py-3 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-sm rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center space-x-2 transition-all"
            >
              <ShoppingCart className="w-4 h-4 text-brand-600" />
              <span>Add to Cart</span>
            </button>

            <button
              onClick={handleBuyNow}
              disabled={product.stock <= 0}
              className="py-3 px-4 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl shadow-lg shadow-brand-500/25 flex items-center justify-center space-x-2 transition-all"
            >
              <span>Buy Now</span>
            </button>
          </div>

          {/* Info Highlights */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-500">
            <div className="flex items-center space-x-2">
              <Truck className="w-4 h-4 text-emerald-500" />
              <span>Instant Kafka event processing upon checkout</span>
            </div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-brand-500" />
              <span>Atomic stock reservation locked with PostgreSQL `SELECT FOR UPDATE`</span>
            </div>
          </div>

          {devMode && (
            <div className="p-4 rounded-xl bg-indigo-950 text-indigo-200 text-xs font-mono space-y-1">
              <div className="font-bold text-indigo-300">Developer Telemetry</div>
              <div>Product ID: {product.id}</div>
              <div>SKU: {product.sku}</div>
              <div>Category ID: {product.category_id}</div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
