import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Search, ShoppingBag, Activity, Shield, Cpu, AlertOctagon, Sliders, Server,
  BarChart2, Code, Sun, Moon, ArrowRight, CornerDownLeft, X, ShoppingCart
} from 'lucide-react';

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { toggleDevMode, devMode, toggleDarkMode, darkMode } = useAuth();

  const navigationCommands = [
    { id: 'overview', title: 'Commerce Overview', category: 'Pages', icon: Activity, path: '/products' },
    { id: 'catalog', title: 'Product Catalog', category: 'Pages', icon: ShoppingBag, path: '/products' },
    { id: 'cart', title: 'Shopping Cart', category: 'Pages', icon: ShoppingCart, path: '/cart' },
    { id: 'orders', title: 'My Orders & Live Timeline', category: 'Pages', icon: Activity, path: '/orders' },
    { id: 'admin-overview', title: 'Operations Overview', category: 'Admin', icon: Shield, path: '/admin?tab=metrics' },
    { id: 'admin-health', title: 'System Health', category: 'Admin', icon: Server, path: '/admin?tab=health' },
    { id: 'admin-event-flow', title: 'Kafka Event Flow Visualizer', category: 'Admin', icon: Cpu, path: '/admin?tab=flow' },
    { id: 'admin-failure-lab', title: 'Failure Lab (Chaos Simulation)', category: 'Admin', icon: Sliders, path: '/admin?tab=simulation' },
    { id: 'admin-dlq', title: 'Dead Letter Queue (DLQ) Inspector', category: 'Admin', icon: AlertOctagon, path: '/admin?tab=dlq' },
    { id: 'admin-observability', title: 'Observability & Metrics', category: 'Developer', icon: BarChart2, path: '/admin?tab=observability' },
    { id: 'admin-architecture', title: 'System Architecture', category: 'Developer', icon: Code, path: '/admin?tab=architecture' },
  ];

  const actionCommands = [
    {
      id: 'toggle-devmode',
      title: `Toggle Developer Mode (${devMode ? 'Currently Active' : 'Off'})`,
      category: 'Actions',
      icon: Code,
      action: () => { toggleDevMode(); onClose(); }
    },
    {
      id: 'toggle-theme',
      title: `Switch Theme (${darkMode ? 'Currently Dark' : 'Currently Light'})`,
      category: 'Actions',
      icon: darkMode ? Sun : Moon,
      action: () => { toggleDarkMode(); onClose(); }
    }
  ];

  const filteredCommands = [...navigationCommands, ...actionCommands].filter((cmd) =>
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else window.dispatchEvent(new CustomEvent('open-command-palette'));
      }
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          const item = filteredCommands[selectedIndex];
          if (item.action) {
            item.action();
          } else if (item.path) {
            navigate(item.path);
            onClose();
          }
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center px-4 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 mr-3 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search products, pages, orders, system health (Cmd + K)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full py-4 bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 space-y-1 divide-y divide-slate-100 dark:divide-slate-800/50">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No matching commands or pages found.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => {
                    if (cmd.action) cmd.action();
                    else if (cmd.path) { navigate(cmd.path); onClose(); }
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-brand-100 dark:bg-brand-900/60 text-brand-600 dark:text-brand-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span>{cmd.title}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase">
                      {cmd.category}
                    </span>
                    {isSelected && <CornerDownLeft className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center space-x-3">
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">↑↓</kbd> navigate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">↵</kbd> select</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">esc</kbd> close</span>
          </div>
          <span>ScaleFlow Command Palette</span>
        </div>

      </div>
    </div>
  );
}
