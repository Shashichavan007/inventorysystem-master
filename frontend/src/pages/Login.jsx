import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/products');
    } catch (err) {
      console.error('Login submit error:', err);
      const msg = err.response?.data?.detail || err.message || 'Login failed. Check credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (role) => {
    setLoading(true);
    setError('');
    const demoEmail = role === 'ADMIN' ? 'admin@scaleflow.io' : 'customer@scaleflow.io';
    const demoPass = 'password123';
    const fullName = role === 'ADMIN' ? 'ScaleFlow Admin' : 'Demo Customer';

    try {
      await login(demoEmail, demoPass);
      navigate(role === 'ADMIN' ? '/admin' : '/products');
    } catch (err) {
      // If demo user login fails, try registering the user
      try {
        await register(demoEmail, demoPass, fullName, role);
        navigate(role === 'ADMIN' ? '/admin' : '/products');
      } catch (regErr) {
        console.error('Demo registration fallback error:', regErr);
        setError(regErr.response?.data?.detail || 'Demo login failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md p-8 glass-card rounded-2xl border border-slate-800 shadow-2xl space-y-6">
        
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 mb-2">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Sign In to ScaleFlow</h2>
          <p className="text-sm text-slate-400">Access your microservice order portal</p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center space-x-3 text-rose-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-sm transition-all"
                placeholder="user@scaleflow.io"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-sm transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-sky-500/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>

        {/* Quick Demo Logins */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="text-center text-xs text-slate-400 font-mono">QUICK DEMO ACCESS</div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleDemoLogin('CUSTOMER')}
              disabled={loading}
              className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-sky-400 rounded-xl transition-all text-center disabled:opacity-50"
            >
              Customer Demo
            </button>
            <button
              onClick={() => handleDemoLogin('ADMIN')}
              disabled={loading}
              className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-amber-400 rounded-xl transition-all text-center disabled:opacity-50"
            >
              Admin Demo
            </button>
          </div>
        </div>

        <div className="text-center text-sm text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="text-sky-400 hover:underline font-medium">
            Register here
          </Link>
        </div>

      </div>
    </div>
  );
}
