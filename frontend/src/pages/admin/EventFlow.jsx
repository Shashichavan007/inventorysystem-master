import React, { useState, useEffect } from 'react';
import { Cpu, ArrowRight, CheckCircle2, AlertOctagon, Terminal, Copy, Check, Radio } from 'lucide-react';

export default function EventFlow() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [wsStatus, setWsStatus] = useState('DISCONNECTED');
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/admin/events`;
    
    setWsStatus('CONNECTING');
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => setWsStatus('CONNECTED');

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        setEvents((prev) => [data, ...prev.slice(0, 49)]);
      } catch (err) {}
    };

    ws.onerror = () => setWsStatus('ERROR');
    ws.onclose = () => setWsStatus('DISCONNECTED');

    return () => ws.close();
  }, []);

  const flowNodes = [
    { name: 'API Gateway', topic: 'HTTP POST /orders', service: 'api-gateway' },
    { name: 'Order Service', topic: 'scaleflow.orders', service: 'order-service' },
    { name: 'Inventory Service', topic: 'scaleflow.inventory', service: 'inventory-service' },
    { name: 'Payment Service', topic: 'scaleflow.payments', service: 'payment-service' },
    { name: 'Notification Service', topic: 'scaleflow.notifications', service: 'notification-service' },
  ];

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="space-y-8">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Kafka Event Flow Visualizer</h1>
          <p className="text-slate-500 text-sm mt-1">Live visual event journey tracing asynchronous Kafka messages across microservices</p>
        </div>
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <Radio className={`w-3.5 h-3.5 ${wsStatus === 'CONNECTED' ? 'text-emerald-500 animate-pulse' : 'text-amber-500'}`} />
          <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">Live Stream: {wsStatus}</span>
        </div>
      </div>

      {/* HORIZONTAL EVENT JOURNEY DIAGRAM */}
      <div className="card-surface p-6 overflow-x-auto">
        <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-4">Event Routing Topology</h2>
        
        <div className="flex items-center justify-between min-w-[700px] gap-2 py-4">
          {flowNodes.map((node, i) => (
            <React.Fragment key={i}>
              <div className="flex-1 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1 text-center hover:border-brand-500 transition-colors cursor-pointer">
                <Cpu className="w-6 h-6 text-brand-600 dark:text-brand-400 mx-auto" />
                <div className="font-bold text-slate-900 dark:text-white text-xs">{node.name}</div>
                <div className="text-[10px] font-mono text-slate-400 truncate">{node.topic}</div>
              </div>
              {i < flowNodes.length - 1 && (
                <div className="flex items-center space-x-1 text-brand-500 font-mono text-xs font-bold">
                  <span className="w-8 h-0.5 bg-brand-500"></span>
                  <ArrowRight className="w-4 h-4 text-brand-500 animate-pulse" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* RECENT KAFKA MESSAGES FEED */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Live Kafka Event Log</h2>
          
          {events.length === 0 ? (
            <div className="card-surface p-12 text-center space-y-3">
              <Cpu className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto animate-spin" />
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Listening for Kafka Events...</h4>
              <p className="text-xs text-slate-500">Place an order or trigger a failure scenario to view real-time event packets.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((evt, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedEvent(evt)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedEvent === evt
                      ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-500 shadow-sm'
                      : 'card-surface card-surface-hover'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 font-mono font-bold text-xs text-slate-900 dark:text-white">
                      <span className="px-2 py-0.5 rounded bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300">
                        {evt.event_type || 'Event'}
                      </span>
                      <span>Topic: {evt.topic || 'scaleflow.events'}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(evt.timestamp || Date.now()).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="mt-2 text-xs font-mono text-slate-500 truncate">
                    Correlation ID: {evt.correlation_id || 'corr_demo_123'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* EVENT DETAILS DRAWER */}
        <div className="space-y-4">
          <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Event Payload Inspector</h2>
          
          {selectedEvent ? (
            <div className="card-surface p-6 space-y-4 bg-slate-900 text-slate-200 border-none font-mono text-xs shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="font-bold text-brand-400">{selectedEvent.event_type}</span>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(selectedEvent, null, 2))}
                  className="p-1 text-slate-400 hover:text-white"
                  title="Copy Payload"
                >
                  {copiedId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <pre className="overflow-x-auto text-[11px] leading-relaxed text-slate-300 max-h-96">
                {JSON.stringify(selectedEvent, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="card-surface p-8 text-center text-xs text-slate-400 space-y-2">
              <Terminal className="w-8 h-8 mx-auto text-slate-500" />
              <div>Click any live event packet from the feed to inspect header payload, correlation IDs, and consumer metadata.</div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
