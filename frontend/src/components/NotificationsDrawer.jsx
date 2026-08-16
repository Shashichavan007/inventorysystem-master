import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell, X, CheckCircle2, Clock, AlertTriangle, AlertOctagon, Info } from 'lucide-react';

export default function NotificationsDrawer({ isOpen, onClose }) {
  const { notifications, unreadCount, devMode } = useAuth();

  if (!isOpen) return null;

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'OrderConfirmed':
      case 'PaymentSucceeded':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />;
      case 'PaymentFailed':
      case 'InventoryRejected':
        return <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />;
      case 'DLQEvent':
        return <AlertOctagon className="w-5 h-5 text-rose-500 flex-shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-brand-500 flex-shrink-0" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          className="w-screen max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Notifications</h2>
                <p className="text-xs text-slate-500">Real-time Kafka event notifications</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {notifications.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <Bell className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">You're all caught up</h4>
                <p className="text-xs text-slate-500">New order & event updates will appear here automatically.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-2 hover:border-slate-300 transition-all"
                >
                  <div className="flex items-start space-x-3">
                    {getNotificationIcon(n.type)}
                    <div className="space-y-1 flex-1">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                        <span>{n.title}</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{n.message}</p>
                    </div>
                  </div>

                  {devMode && (
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex justify-between text-[10px] font-mono text-slate-400">
                      <span>Event: {n.type}</span>
                      <span>Order #{n.order_id}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-center text-xs font-mono text-slate-400">
            Powered by ScaleFlow Notification Service & Kafka
          </div>
        </div>
      </div>
    </div>
  );
}
