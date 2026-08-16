import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { Activity, CheckCircle2, Clock, AlertTriangle, XCircle, ArrowUpRight, Cpu, Radio } from 'lucide-react';

export default function Orders() {
  const [searchParams] = useSearchParams();
  const highlightOrderId = searchParams.get('order_id');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [wsStatus, setWsStatus] = useState('DISCONNECTED');
  const [realtimeEvents, setRealtimeEvents] = useState([]);
  const queryClient = useQueryClient();

  // Fetch Orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const resp = await api.get('/orders');
      return resp.data;
    },
    refetchInterval: 3000 // Poll every 3s as fallback
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

    ws.onopen = () => {
      setWsStatus('CONNECTED');
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        setRealtimeEvents((prev) => [data, ...prev]);
        
        // Update selected order status dynamically
        setSelectedOrder((prev) => prev ? { ...prev, status: data.status } : prev);
        
        // Invalidate queries so order list updates
        queryClient.invalidateQueries(['orders']);
      } catch (err) {
        console.error('WS Parse Error', err);
      }
    };

    ws.onerror = () => setWsStatus('ERROR');
    ws.onclose = () => setWsStatus('DISCONNECTED');

    return () => {
      ws.close();
    };
  }, [selectedOrder?.id]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs rounded-full flex items-center space-x-1.5"><CheckCircle2 className="w-3.5 h-3.5" /><span>CONFIRMED</span></span>;
      case 'INVENTORY_RESERVED':
        return <span className="px-3 py-1 bg-sky-500/10 border border-sky-500/30 text-sky-400 font-bold text-xs rounded-full flex items-center space-x-1.5"><Clock className="w-3.5 h-3.5" /><span>INVENTORY RESERVED</span></span>;
      case 'CREATED':
        return <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold text-xs rounded-full flex items-center space-x-1.5"><Activity className="w-3.5 h-3.5 animate-pulse" /><span>CREATED</span></span>;
      case 'CANCELLED':
      case 'PAYMENT_FAILED':
      case 'INVENTORY_FAILED':
        return <span className="px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold text-xs rounded-full flex items-center space-x-1.5"><XCircle className="w-3.5 h-3.5" /><span>{status}</span></span>;
      default:
        return <span className="px-3 py-1 bg-slate-800 text-slate-300 font-bold text-xs rounded-full">{status}</span>;
    }
  };

  const isStepCompleted = (currentStatus, step) => {
    const orderFlow = ['CREATED', 'INVENTORY_RESERVED', 'CONFIRMED'];
    if (currentStatus === 'CANCELLED' || currentStatus === 'PAYMENT_FAILED' || currentStatus === 'INVENTORY_FAILED') return false;
    const currentIndex = orderFlow.indexOf(currentStatus);
    const stepIndex = orderFlow.indexOf(step);
    return currentIndex >= stepIndex;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Order Lifecycle & Real-Time Events</h1>
        <p className="text-slate-400 text-sm">Monitor order pipeline progression via WebSockets & Kafka Event Broker</p>
      </div>

      {isLoading ? (
        <div className="h-64 glass-card rounded-2xl animate-pulse bg-slate-900"></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 glass-card rounded-3xl space-y-4">
          <Activity className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-semibold text-slate-300">No orders placed yet</h3>
          <p className="text-slate-500 text-sm">Place an order from the Catalog to observe distributed event handling.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Order List Selector */}
          <div className="space-y-4">
            <h2 className="text-xs font-mono font-semibold uppercase text-slate-400 tracking-wider">Your Placed Orders</h2>
            <div className="space-y-3">
              {orders.map((o) => (
                <div
                  key={o.id}
                  onClick={() => { setSelectedOrder(o); setRealtimeEvents([]); }}
                  className={`cursor-pointer p-4 rounded-2xl border transition-all duration-200 ${
                    selectedOrder?.id === o.id
                      ? 'bg-sky-950/40 border-sky-500/60 shadow-lg shadow-sky-500/10'
                      : 'glass-card border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-base">Order #{o.id}</span>
                    {getStatusBadge(o.status)}
                  </div>
                  
                  <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>${o.total_amount.toFixed(2)}</span>
                    <span>{new Date(o.created_at).toLocaleTimeString()}</span>
                  </div>

                  <div className="mt-2 text-[10px] font-mono text-slate-500 truncate">
                    Corr: {o.correlation_id}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Real-time Order Details & Timeline */}
          {selectedOrder && (
            <div className="lg:col-span-2 space-y-6">
              
              <div className="glass-card rounded-3xl p-6 border border-slate-800 space-y-6">
                
                {/* Header Info */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center space-x-3">
                      <h2 className="text-2xl font-extrabold text-white">Order #{selectedOrder.id}</h2>
                      {getStatusBadge(selectedOrder.status)}
                    </div>
                    <div className="text-xs font-mono text-slate-400 mt-1">
                      Correlation ID: <span className="text-sky-400">{selectedOrder.correlation_id}</span>
                    </div>
                  </div>

                  {/* WebSocket Live Pill */}
                  <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800">
                    <Radio className={`w-3.5 h-3.5 ${wsStatus === 'CONNECTED' ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
                    <span className="text-xs font-mono font-bold text-slate-300">WS: {wsStatus}</span>
                  </div>
                </div>

                {/* VISUAL ORDER TIMELINE */}
                <div className="space-y-3">
                  <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider">Distributed Processing Timeline</h3>
                  
                  <div className="grid grid-cols-3 gap-4">
                    
                    {/* Step 1 */}
                    <div className={`p-4 rounded-2xl border transition-all ${
                      isStepCompleted(selectedOrder.status, 'CREATED')
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900/50 border-slate-800 text-slate-500'
                    }`}>
                      <div className="text-[10px] font-mono uppercase">1. Order Service</div>
                      <div className="text-sm font-bold text-white mt-1">Order Created</div>
                      <div className="text-[10px] text-slate-400 mt-1">Published to Kafka</div>
                    </div>

                    {/* Step 2 */}
                    <div className={`p-4 rounded-2xl border transition-all ${
                      isStepCompleted(selectedOrder.status, 'INVENTORY_RESERVED')
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900/50 border-slate-800 text-slate-500'
                    }`}>
                      <div className="text-[10px] font-mono uppercase">2. Inventory Service</div>
                      <div className="text-sm font-bold text-white mt-1">Row Lock Reserved</div>
                      <div className="text-[10px] text-slate-400 mt-1">SELECT ... FOR UPDATE</div>
                    </div>

                    {/* Step 3 */}
                    <div className={`p-4 rounded-2xl border transition-all ${
                      selectedOrder.status === 'CONFIRMED'
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                        : selectedOrder.status.includes('FAILED') || selectedOrder.status === 'CANCELLED'
                        ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                        : 'bg-slate-900/50 border-slate-800 text-slate-500'
                    }`}>
                      <div className="text-[10px] font-mono uppercase">3. Payment & Confirm</div>
                      <div className="text-sm font-bold text-white mt-1">
                        {selectedOrder.status === 'CONFIRMED' ? 'Confirmed & Paid' : selectedOrder.status}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">Saga Pipeline Completed</div>
                    </div>

                  </div>
                </div>

                {/* Items Breakdown */}
                <div className="space-y-3 pt-4 border-t border-slate-800">
                  <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider">Ordered Items</h3>
                  <div className="space-y-2">
                    {selectedOrder.items?.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-sm">
                        <span className="font-semibold text-slate-200">{it.product_name}</span>
                        <div className="font-mono text-slate-400 space-x-4">
                          <span>Qty: {it.quantity}</span>
                          <span className="text-white font-bold">${(it.unit_price * it.quantity).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live WebSocket Event Stream Log */}
                {realtimeEvents.length > 0 && (
                  <div className="space-y-2 pt-4 border-t border-slate-800">
                    <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                      <Cpu className="w-4 h-4 text-sky-400" />
                      <span>Live WebSocket Events Received ({realtimeEvents.length})</span>
                    </h3>
                    <div className="max-h-40 overflow-y-auto space-y-2 font-mono text-xs p-3 rounded-xl bg-slate-950 border border-slate-800">
                      {realtimeEvents.map((evt, i) => (
                        <div key={i} className="text-sky-300">
                          <span className="text-slate-500">[{new Date().toLocaleTimeString()}]</span> Status changed to: <span className="font-bold text-white">{evt.status}</span>
                        </div>
                      ))}
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
