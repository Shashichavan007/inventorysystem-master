import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CommandPalette from './CommandPalette';
import NotificationsDrawer from './NotificationsDrawer';
import DeveloperConsoleDock from './DeveloperConsoleDock';
import {
  Cpu, ShoppingBag, Activity, Shield, Server, Sliders, AlertOctagon, BarChart2,
  Code, ShoppingCart, Search, Bell, Sun, Moon, LogOut, ChevronRight, User, Menu, X, Check, Terminal
} from 'lucide-react';

export default function Shell({ children }) {
  const { user, cart, devMode, toggleDevMode, darkMode, toggleDarkMode, logout, unreadCount } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    const handleOpenCmd = () => setIsCommandPaletteOpen(true);
    window.addEventListener('open-command-palette', handleOpenCmd);
    return () => window.removeEventListener('open-command-palette', handleOpenCmd);
  }, []);

  const navCommerce = [
    { title: 'Overview', path: '/overview', icon: Activity, shortcut: 'O' },
    { title: 'Products', path: '/products', icon: ShoppingBag, shortcut: 'P' },
    { title: 'Cart', path: '/cart', icon: ShoppingCart, count: totalCartCount },
    { title: 'My Orders', path: '/orders', icon: Activity },
  ];

  const navOperations = [
    { title: 'Operations Overview', path: '/admin?tab=metrics', icon: Shield },
    { title: 'System Health', path: '/admin?tab=health', icon: Server },
    { title: 'Event Flow', path: '/admin?tab=flow', icon: Cpu },
    { title: 'Failure Lab', path: '/admin?tab=simulation', icon: Sliders },
    { title: 'DLQ Inspector', path: '/admin?tab=dlq', icon: AlertOctagon },
    { title: 'Observability', path: '/admin?tab=observability', icon: BarChart2 },
    { title: 'Architecture', path: '/admin?tab=architecture', icon: Code },
  ];

  const currentTab = new URLSearchParams(location.search).get('tab');

  const isActive = (path) => {
    if (path.includes('?tab=')) {
      const tabName = path.split('?tab=')[1];
      return location.pathname === '/admin' && currentTab === tabName;
    }
    return location.pathname === path;
  };

  const getBreadcrumbs = () => {
    if (location.pathname === '/products') return ['Commerce', 'Product Catalog'];
    if (location.pathname === '/overview') return ['Commerce', 'Overview'];
    if (location.pathname === '/cart') return ['Commerce', 'Shopping Cart'];
    if (location.pathname === '/orders') return ['Commerce', 'My Orders'];
    if (location.pathname === '/admin') {
      const tabLabels = {
        metrics: 'Operations Overview',
        health: 'System Health',
        flow: 'Kafka Event Flow Visualizer',
        simulation: 'Failure Lab',
        dlq: 'DLQ Inspector',
        observability: 'Observability & Metrics',
        architecture: 'System Architecture',
      };
      return ['Operations', tabLabels[currentTab] || 'Overview'];
    }
    return ['ScaleFlow'];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 selection:bg-brand-500 selection:text-white transition-colors duration-200">
      
      {/* Sidebar Overlay for Mobile */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        ></div>
      )}

      {/* LEFT SIDEBAR */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-transform duration-300 md:translate-x-0 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          
          {/* Logo Header */}
          <div className="h-16 px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <Link to="/overview" className="flex items-center space-x-3 group">
              <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                  ScaleFlow
                </span>
                <div className="flex items-center space-x-1.5 text-[10px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>ONLINE</span>
                </div>
              </div>
            </Link>
            <button className="md:hidden p-1 text-slate-400" onClick={() => setIsMobileSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="p-4 space-y-6 flex-1">
            
            {/* Commerce Group */}
            <div className="space-y-1">
              <div className="px-3 text-[11px] font-bold font-mono text-slate-400 uppercase tracking-wider mb-2">
                Commerce
              </div>
              {navCommerce.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileSidebarOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      active
                        ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className={`w-4 h-4 ${active ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`} />
                      <span>{item.title}</span>
                    </div>
                    {item.count > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-brand-600 text-white text-xs font-bold font-mono">
                        {item.count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Operations Group (Admin or DevMode only) */}
            {(user?.role === 'ADMIN' || devMode) && (
              <div className="space-y-1">
                <div className="px-3 text-[11px] font-bold font-mono text-slate-400 uppercase tracking-wider mb-2">
                  Operations & Admin
                </div>
                {navOperations.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileSidebarOpen(false)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        active
                          ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Icon className={`w-4 h-4 ${active ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`} />
                        <span>{item.title}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

          </div>

          {/* Footer controls inside Sidebar */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
            
            {/* Developer Mode Toggle */}
            <button
              onClick={toggleDevMode}
              className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                devMode
                  ? 'bg-indigo-950 text-indigo-200 border-indigo-700 shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span>Developer Mode</span>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${devMode ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                {devMode ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Environment Badge */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
              <span>Environment:</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">Development</span>
            </div>

            {/* User Profile */}
            {user ? (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2.5 truncate">
                  <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 flex items-center justify-center font-bold text-xs">
                    {user.full_name?.charAt(0) || user.email?.charAt(0)}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{user.full_name || user.email}</div>
                    <div className="text-[10px] font-mono text-slate-400 uppercase">{user.role}</div>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 pt-1">
                <Link
                  to="/login"
                  className="w-full text-center py-2 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-xl transition-colors"
                >
                  Sign In
                </Link>
              </div>
            )}

          </div>

        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">
        
        {/* TOP HEADER */}
        <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between">
          
          {/* Left: Mobile Menu Trigger & Breadcrumbs */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumbs */}
            <div className="flex items-center space-x-2 text-xs font-medium text-slate-500">
              <span>{breadcrumbs[0]}</span>
              {breadcrumbs[1] && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-900 dark:text-slate-100 font-bold">{breadcrumbs[1]}</span>
                </>
              )}
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center space-x-3">
            
            {/* Command Palette Trigger */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-500 dark:text-slate-400 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 transition-all"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Search...</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 text-[10px] font-mono text-slate-500 font-bold border border-slate-200 dark:border-slate-800 shadow-2xs">
                ⌘K
              </kbd>
            </button>

            {/* Notifications Button */}
            <button
              onClick={() => setIsNotificationsOpen(true)}
              className="relative p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-brand-600 ring-2 ring-white dark:ring-slate-900"></span>
              )}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title="Toggle Light/Dark Theme"
            >
              {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>

          </div>

        </header>

        {/* DEVELOPER MODE METADATA BANNER (If enabled) */}
        {devMode && (
          <div className="bg-indigo-950 text-indigo-200 px-6 py-2 border-b border-indigo-800 text-xs font-mono flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span><strong>DEVELOPER MODE ACTIVE</strong> &bull; Showing Kafka topics, correlation IDs & service execution timing</span>
            </div>
            <button onClick={toggleDevMode} className="text-indigo-400 hover:underline">Disable</button>
          </div>
        )}

        {/* PAGE CONTENT */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-8">
          {children}
        </main>

      </div>

      {/* Global Command Palette, Notifications Drawer & Developer Telemetry Dock */}
      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />
      <NotificationsDrawer isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
      <DeveloperConsoleDock />

    </div>
  );
}
