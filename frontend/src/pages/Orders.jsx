import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { TableSkeleton } from '../components/SkeletonLoaders';
import {
  Activity, CheckCircle2, Clock, AlertTriangle, XCircle, ArrowUpRight, Cpu, Radio, ChevronDown, ChevronUp, Copy, Check
} from 'lucide-react';

export default function Orders() {
  const [searchParams] = useSearchParams();
  const highlightOrderId = searchParams.get('order_id');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [wsStatus, setWsStatus] = useState('DISCONNECTED');
  const [realtimeEvents, setRealtimeEvents] = useState([]);
  const [copiedId, setCopiedId] = useState(false);
  const { devMode } = useAuth();
  const queryClient = useQueryClient();

  // Fetch Orders from API Gateway
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const resp = await api.get('/orders');
      return resp.data;
    },
    refetchInterval: 3000
  });

  // Automatically select highlighted order on load
  useEffect(() => {
    if (highlightOrderId && orders.length > 0) {
      const found = orders.find(o => o.id === parseInt(highlightOrderId));
      if (found) setSelectedOrder(found);
    } else if (orders.length > 0 && !selectedOrder) {
      setSelectedOrder(orders[0]);
    }
  }, [highlightOrderId, orders]);

  // WebSocket Connection for Selected Order
  useEffect(() => {
    if (!selectedOrder) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/orders/${selectedOrder.id}`;
    
    setWsStatus('CONNECTING');
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setWsStatus('CONNECTED');

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        setRealtimeEvents((prev) => [data, ...prev]);
        setSelectedOrder((prev) => prev ? { ...prev, status: data.status } : prev);
        queryClient.invalidateQueries(['orders']);
      } catch (err) {}
    };

    ws.onerror = () => setWsStatus('ERROR');
    ws.onclose = () => setWsStatus('DISCONNECTED');

    return () => ws.close();
  }, [selectedOrder?.id]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const timelineSteps = [
    { key: 'CREATED', label: 'Order Created', service: 'Order Service', duration: '45 ms' },
    { key: 'INVENTORY_RESERVED', label: 'Inventory Reserved', service: 'Inventory Service (Row Lock)', duration: '112 ms' },
    { key: 'CONFIRMED', label: 'Payment & Order Confirmed', service: 'Payment Service', duration: '204 ms' },
  ];

  const getStepStatus = (stepKey) => {
    if (!selectedOrder) return 'pending';
    const statusOrder = ['CREATED', 'INVENTORY_RESERVED', 'CONFIRMED'];
    const currentIdx = statusOrder.indexOf(selectedOrder.status);
    const stepIdx = statusOrder.indexOf(stepKey);

    if (selectedOrder.status === 'CANCELLED' || selectedOrder.status.includes('FAIL')) {
      return 'failed';
    }
    if (currentIdx > stepIdx) return 'completed';
    if (currentIdx === stepIdx) return 'active';
    return 'pending';
  };

  return (
    <div className="space-y-8">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">My Orders & Live Timeline</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time status progression delivered over WebSockets and Apache Kafka</p>
        </div>

        {selectedOrder && (
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <Radio className={`w-3.5 h-3.5 ${wsStatus === 'CONNECTED' ? 'text-emerald-500 animate-pulse' : 'text-amber-500'}`} />
            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">WebSocket: {wsStatus}</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : orders.length === 0 ? (
        <div className="card-surface p-16 text-center space-y-4">
          <Activity className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No orders placed yet</h3>
          <p className="text-xs text-slate-500">Place an order from the product catalog to test the real-time event pipeline.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Order Selector Column */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Your Placed Orders</h3>
            <div className="space-y-3">
              {orders.map((o) => (
                <div
                  key={o.id}
                  onClick={() => { setSelectedOrder(o); setRealtimeEvents([]); }}
                  className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                    selectedOrder?.id === o.id
                      ? 'bg-brand-50/60 dark:bg-brand-950/40 border-brand-500 shadow-sm'
                      : 'card-surface card-surface-hover'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">Order #ORD-{o.id}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                      o.status === 'CONFIRMED'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : o.status.includes('FAIL') || o.status === 'CANCELLED'
                        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                    }`}>
                      {o.status}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-500">
                    <span className="font-bold text-slate-900 dark:text-slate-100">${o.total_amount.toFixed(2)}</span>
                    <span>{new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  {devMode && (
                    <div className="mt-2 text-[10px] font-mono text-slate-400 truncate">
                      Corr: {o.correlation_id}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Real-time Visual Timeline & Order Details */}
          {selectedOrder && (
            <div className="lg:col-span-2 space-y-6">
              
              <div className="card-surface p-6 space-y-6">
                
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Order #ORD-{selectedOrder.id}</h2>
                    <div className="text-xs text-slate-500 mt-1 flex items-center space-x-2">
                      <span>Date: {new Date(selectedOrder.created_at).toLocaleDateString()}</span>
                      <span>&bull;</span>
                      <span>Total: ${selectedOrder.total_amount.toFixed(2)}</span>
                    </div>
                  </div>

                  {devMode && (
                    <button
                      onClick={() => copyToClipboard(selectedOrder.correlation_id)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-mono text-xs rounded-lg border border-slate-200 dark:border-slate-700 flex items-center space-x-1.5 transition-colors"
                    >
                      {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      <span>{copiedId ? 'Copied' : selectedOrder.correlation_id}</span>
                    </button>
                  )}
                </div>

                {/* SIGNATURE LIVE ORDER TIMELINE */}
                <div className="space-y-4">
                  <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Live Event Progression Timeline</h3>
                  
                  <div className="space-y-6 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                    {timelineSteps.map((step, idx) => {
                      const state = getStepStatus(step.key);
                      return (
                        <div key={idx} className="relative flex items-start space-x-4">
                          
                          {/* Dot Icon */}
                          <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs ring-4 ring-white dark:ring-slate-900 ${
                            state === 'completed'
                              ? 'bg-emerald-500 text-white'
                              : state === 'active'
                              ? 'bg-brand-600 text-white animate-pulse'
                              : state === 'failed'
                              ? 'bg-rose-500 text-white'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                          }`}>
                            {state === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                          </div>

                          <div className="flex-1 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-bold text-slate-900 dark:text-white">{step.label}</span>
                              <span className="text-xs font-mono text-slate-400">{step.duration}</span>
                            </div>
                            <div className="text-xs text-slate-500 flex items-center justify-between">
                              <span>Service: {step.service}</span>
                              <span className="font-mono text-[10px] uppercase font-bold text-slate-400">{state}</span>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Items Breakdown */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Ordered Items</h3>
                  <div className="space-y-2">
                    {selectedOrder.items?.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-sm">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{it.product_name}</span>
                        <div className="font-mono text-slate-500 space-x-4">
                          <span>Qty: {it.quantity}</span>
                          <span className="text-slate-900 dark:text-white font-bold">${(it.unit_price * it.quantity).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Developer Mode Payload Inspector */}
                {devMode && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="p-4 rounded-2xl bg-slate-950 border-2 border-indigo-500/40 text-indigo-200 text-xs font-mono space-y-3">
                      <div className="flex items-center justify-between border-b border-indigo-900/60 pb-2">
                        <span className="font-bold text-indigo-300 flex items-center space-x-2">
                          <Cpu className="w-4 h-4 text-indigo-400" />
                          <span>KAFKA EVENT PAYLOAD INSPECTOR</span>
                        </span>
                        <span className="text-[10px] text-slate-400">Topic: scaleflow.orders</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="p-2 rounded bg-indigo-950/80 border border-indigo-900/40">
                          <span className="text-slate-400 block text-[10px]">CORRELATION ID</span>
                          <span className="text-sky-300 font-bold truncate block">{selectedOrder.correlation_id}</span>
                        </div>
                        <div className="p-2 rounded bg-indigo-950/80 border border-indigo-900/40">
                          <span className="text-slate-400 block text-[10px]">WEBSOCKET CHANNEL</span>
                          <span className="text-emerald-400 font-bold font-mono">/ws/orders/{selectedOrder.id}</span>
                        </div>
                      </div>

                      <details className="text-[11px] group">
                        <summary className="cursor-pointer font-bold text-indigo-300 hover:text-white flex items-center justify-between">
                          <span>Raw Order JSON Schema</span>
                          <span className="text-[10px] text-slate-400 group-open:hidden">[Expand]</span>
                        </summary>
                        <pre className="mt-2 p-3 bg-slate-900 rounded-xl border border-slate-800 text-sky-300 overflow-x-auto text-[10px]">
                          {JSON.stringify(selectedOrder, null, 2)}
                        </pre>
                      </details>
                    </div>
                  </div>
                )}

              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
