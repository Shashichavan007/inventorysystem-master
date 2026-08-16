import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ProductSkeleton } from '../components/SkeletonLoaders';
import { Search, ShoppingCart, CheckCircle, Package, ArrowUpDown, Filter, Zap, Cpu, HardDrive, Network, Server } from 'lucide-react';

export default function Catalog() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [sortOrder, setSortOrder] = useState('newest');
  const [addedToast, setAddedToast] = useState(null);
  const { addToCart, devMode } = useAuth();

  // Fetch Categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const resp = await api.get('/categories');
      return resp.data;
    }
  });

  // Fetch Products
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', search, selectedCategory],
    queryFn: async () => {
      let url = '/products?limit=50';
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (selectedCategory) url += `&category_id=${selectedCategory}`;
      const resp = await api.get(url);
      return resp.data;
    }
  });

  const handleAddToCart = (product, e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, 1);
    setAddedToast(product.name);
    setTimeout(() => setAddedToast(null), 2500);
  };

  // Category Icon helper
  const getCategoryIcon = (id) => {
    switch (id) {
      case 1: return Cpu;
      case 2: return HardDrive;
      case 3: return Network;
      default: return Server;
    }
  };

  // Sort logic
  const sortedProducts = [...products].sort((a, b) => {
    if (sortOrder === 'price-low') return a.price - b.price;
    if (sortOrder === 'price-high') return b.price - a.price;
    return b.id - a.id;
  });

  return (
    <div className="space-y-8">
      
      {/* Toast Notification */}
      {addedToast && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-emerald-900 text-white rounded-2xl shadow-2xl flex items-center space-x-3 animate-bounce">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="text-sm font-bold">Added '{addedToast}' to Cart!</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Product Catalog</h1>
          <p className="text-slate-500 text-sm mt-1">High-concurrency hardware & cloud infrastructure backed by PostgreSQL row locking</p>
        </div>

        {devMode && (
          <div className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-mono font-bold flex items-center space-x-2">
            <Zap className="w-4 h-4 text-indigo-500" />
            <span>Redis Cache Active &bull; Invalidation On Catalog Edits</span>
          </div>
        )}
      </div>

      {/* Search, Filter & Sort Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search products by SKU or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-brand-500 transition-all shadow-2xs"
          />
        </div>

        {/* Category Pills & Sort */}
        <div className="flex items-center space-x-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === null
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="newest">Sort by Newest</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>

        </div>

      </div>

      {/* Product Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <ProductSkeleton key={i} />
          ))}
        </div>
      ) : sortedProducts.length === 0 ? (
        <div className="card-surface py-16 text-center space-y-4">
          <Package className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No products match your filters</h3>
          <p className="text-slate-500 text-xs">Try clearing your search query or selecting a different category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedProducts.map((product) => {
            const CatIcon = getCategoryIcon(product.category_id);
            return (
              <Link
                key={product.id}
                to={`/products/${product.id}`}
                className="group card-surface card-surface-hover p-5 flex flex-col justify-between space-y-4 transition-all duration-200"
              >
                <div className="space-y-3">
                  
                  {/* Category Card Header Visual */}
                  <div className="h-40 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative overflow-hidden group-hover:bg-brand-50/50 dark:group-hover:bg-brand-950/20 transition-colors">
                    <CatIcon className="w-16 h-16 text-slate-400 dark:text-slate-600 group-hover:scale-110 group-hover:text-brand-500 transition-all duration-300" />
                    
                    {/* Stock Pill Badge */}
                    <div className="absolute top-3 right-3">
                      <span
                        className={`text-[11px] font-bold font-mono px-2.5 py-1 rounded-full border shadow-2xs ${
                          product.stock > 10
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/80 dark:border-emerald-800 dark:text-emerald-300'
                            : product.stock > 0
                            ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/80 dark:border-amber-800 dark:text-amber-300'
                            : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/80 dark:border-rose-800 dark:text-rose-300'
                        }`}
                      >
                        {product.stock > 10
                          ? 'In Stock'
                          : product.stock > 0
                          ? `Low Stock — ${product.stock} left`
                          : 'Out of Stock'}
                      </span>
                    </div>

                    {devMode && (
                      <div className="absolute bottom-2 left-2 text-[10px] font-mono font-bold text-slate-500 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded">
                        SKU: {product.sku}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors line-clamp-1">
                      {product.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {product.description || 'Enterprise microservice hardware component.'}
                    </p>
                  </div>

                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono font-bold block">PRICE</span>
                    <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                      ${product.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <button
                    onClick={(e) => handleAddToCart(product, e)}
                    disabled={product.stock <= 0}
                    className="px-3.5 py-2 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 transition-all shadow-sm disabled:shadow-none"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Add to Cart</span>
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      )}

    </div>
  );
}
