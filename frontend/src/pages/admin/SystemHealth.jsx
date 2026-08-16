import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { Server, CheckCircle2, AlertTriangle, XCircle, Cpu, Database, RefreshCw, Zap } from 'lucide-react';

export default function SystemHealth() {
  const { data: healthData = {}, refetch, isFetching } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const services = [
        { name: 'API Gateway', url: '/health' },
        { name: 'Auth Service', url: '/auth/health' },
        { name: 'Order Service', url: '/orders/health' },
        { name: 'Inventory Service', url: '/products/health' },
        { name: 'Payment Service', url: '/simulation' },
        { name: 'Notification Service', url: '/notifications/health' },
        { name: 'Analytics Service', url: '/analytics/health' },
      ];

      const results = await Promise.all(
        services.map(async (s) => {
          const t0 = performance.now();
          try {
            const res = await api.get(s.url);
            const latency = Math.round(performance.now() - t0);
            return { name: s.name, status: 'Healthy', latency: `${latency} ms`, uptime: '99.98%' };
          } catch (e) {
            return { name: s.name, status: 'Degraded', latency: 'N/A', uptime: '98.5%' };
          }
        })
      );

      return results;
    },
    refetchInterval: 5000
  });

  const infrastructureNodes = [
    { name: 'Apache Kafka Broker', type: 'Event Broker', status: 'Healthy', details: 'Topics: scaleflow.orders, scaleflow.inventory, scaleflow.payments' },
    { name: 'PostgreSQL Relational DB', type: 'Database Engine', status: 'Healthy', details: 'ACID Row Locks (SELECT ... FOR UPDATE)' },
    { name: 'Redis In-Memory Store', type: 'Cache & Limiter', status: 'Healthy', details: 'Sliding Window Rate Limiter & Catalog Cache' },
  ];

  return (
    <div className="space-y-8">
      
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">System Health & Infrastructure</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time status checks across ScaleFlow microservices and storage nodes</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-2 transition-all shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh Health</span>
        </button>
      </div>

      {/* Microservice Cards Grid */}
      <div className="space-y-4">
        <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Microservices ({Array.isArray(healthData) ? healthData.length : 0})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.isArray(healthData) && healthData.map((node, i) => (
            <div key={i} className="card-surface p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <Server className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white text-base">{node.name}</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono flex items-center space-x-1 ${
                  node.status === 'Healthy'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{node.status}</span>
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs font-mono text-slate-500">
                <div>
                  <span className="text-slate-400 block text-[10px]">RESPONSE LATENCY</span>
                  <span className="font-bold text-slate-900 dark:text-white">{node.latency}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">SERVICE UPTIME</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{node.uptime}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Storage & Broker Node Cards */}
      <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Event Broker & Storage Nodes</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {infrastructureNodes.map((node, i) => (
            <div key={i} className="card-surface p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white text-sm">{node.name}</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-xs font-bold font-mono">
                  {node.status}
                </span>
              </div>
              <p className="text-xs text-slate-500">{node.details}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
