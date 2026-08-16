import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Search, ShoppingCart, CheckCircle, Package, Zap, Filter } from 'lucide-react';

export default function Catalog() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [addedToast, setAddedToast] = useState(null);
  const { addToCart } = useAuth();

  // Fetch Categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const resp = await api.get('/categories');
      return resp.data;
    }
  });

  // Fetch Products
  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ['products', search, selectedCategory],
    queryFn: async () => {
      let url = '/products?limit=50';
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (selectedCategory) url += `&category_id=${selectedCategory}`;
      const resp = await api.get(url);
      return resp.data;
    }
  });

  const handleAddToCart = (product) => {
    addToCart(product, 1);
    setAddedToast(product.name);
    setTimeout(() => setAddedToast(null), 2500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Toast Notification */}
      {addedToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 glass-panel bg-emerald-950/90 border border-emerald-500/30 rounded-2xl shadow-2xl flex items-center space-x-3 text-emerald-400 animate-bounce">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-semibold">Added '{addedToast}' to Cart!</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl p-8 bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950 border border-slate-800 shadow-2xl">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-mono">
            <Zap className="w-3.5 h-3.5" />
            <span>REAL-TIME INVENTORY LOCKED VIA POSTGRES FOR UPDATE</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight sm:text-5xl">
            Distributed Product Catalog
          </h1>
          <p className="text-slate-400 text-base">
            High-concurrency e-commerce inventory back-end backed by Redis caching & row-level locking.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-500" />
          <input
            type="text"
            placeholder="Search high-scale products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-sm transition-all"
          />
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === null
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

      </div>

      {/* Product Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-72 glass-card rounded-2xl animate-pulse bg-slate-900/50"></div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 glass-card rounded-3xl space-y-4">
          <Package className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-semibold text-slate-300">No products found</h3>
          <p className="text-slate-500 text-sm">Try adjusting your search or category filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="group glass-card rounded-2xl p-5 border border-slate-800/80 hover:border-sky-500/50 transition-all duration-300 flex flex-col justify-between hover:shadow-xl hover:shadow-sky-500/10"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800">
                    SKU: {product.sku}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      product.stock > 10
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : product.stock > 0
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                    }`}
                  >
                    {product.stock > 0 ? `${product.stock} in stock` : 'Out of Stock'}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-sky-400 transition-colors line-clamp-1">
                    {product.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {product.description || 'Enterprise-grade microservice component.'}
                  </p>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-slate-800/60 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block font-mono">PRICE</span>
                  <span className="text-xl font-extrabold text-white">${product.price.toFixed(2)}</span>
                </div>

                <button
                  onClick={() => handleAddToCart(product)}
                  disabled={product.stock <= 0}
                  className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-md shadow-sky-500/20 disabled:shadow-none"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Add to Cart</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
