import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShoppingBag, ShoppingCart, Activity, Shield, LogOut, User, Cpu } from 'lucide-react';

export default function Navbar() {
  const { user, cart, logout, devMode } = useAuth();
  const navigate = useNavigate();

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <nav className="sticky top-0 z-50 glass-panel border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-extrabold bg-gradient-to-r from-white via-slate-200 to-sky-400 bg-clip-text text-transparent tracking-tight">
                ScaleFlow
              </span>
              <div className="flex items-center space-x-1.5 text-[10px] font-mono text-sky-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>EVENT-DRIVEN KAFKA</span>
              </div>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/products" className="flex items-center space-x-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
              <ShoppingBag className="w-4 h-4 text-sky-400" />
              <span>Catalog</span>
            </Link>

            {user && (
              <Link to="/orders" className="flex items-center space-x-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
                <Activity className="w-4 h-4 text-indigo-400" />
                <span>My Orders</span>
              </Link>
            )}

            {(user?.role === 'ADMIN' || devMode) && (
              <Link to="/admin" className="flex items-center space-x-2 text-sm font-medium text-slate-300 hover:text-sky-400 transition-colors">
                <Shield className="w-4 h-4 text-amber-400" />
                <span>Admin & Observability</span>
              </Link>
            )}
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-4">
            {/* Cart Button */}
            <Link
              to="/cart"
              className="relative p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:border-slate-700 transition-all"
            >
              <ShoppingCart className="w-5 h-5" />
              {totalCartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-sky-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950">
                  {totalCartCount}
                </span>
              )}
            </Link>

            {/* Auth Dropdown / Buttons */}
            {user ? (
              <div className="flex items-center space-x-3 pl-3 border-l border-slate-800">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-white">{user.full_name || user.email}</div>
                  <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{user.role}</div>
                </div>
                <button
                  onClick={logout}
                  className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-all"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-600 rounded-xl hover:shadow-lg hover:shadow-sky-500/25 transition-all"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}
