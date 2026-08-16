import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid
} from 'recharts';
import {
  Shield, Activity, Cpu, AlertOctagon, Sliders, RefreshCw, CheckCircle2, XCircle,
  Clock, DollarSign, Database, Server, Radio, Play, AlertCircle, ArrowUpRight
} from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('metrics'); // metrics, flow, dlq, simulation, architecture
  const [eventStream, setEventStream] = useState([]);
  const [simConfig, setSimConfig] = useState({
    force_failure: false,
    failure_rate: 0.0,
    artificial_delay_sec: 0.0,
    force_consumer_crash: false
  });
  const [simSaving, setSimSaving] = useState(false);
  const [simSuccessMsg, setSimSuccessMsg] = useState('');
  const queryClient = useQueryClient();

  // Fetch Business & System Metrics
  const { data: metrics = {} } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      const resp = await api.get('/analytics/dashboard');
      return resp.data;
    },
    refetchInterval: 2000
  });

  // Fetch DLQ Messages
  const { data: dlqMessages = [] } = useQuery({
    queryKey: ['dlq-messages'],
    queryFn: async () => {
      const resp = await api.get('/dlq');
      return resp.data;
    },
    refetchInterval: 3000
  });

  // Fetch Simulation Config
  useEffect(() => {
    api.get('/simulation').then((res) => setSimConfig(res.data)).catch(() => {});
  }, []);

  // WebSocket Admin Event Listener
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/admin/events`;
    
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (msg) => {
      try {
        const payload = JSON.parse(msg.data);
        if (payload.type === 'EVENT_FLOW') {
          setEventStream((prev) => [payload.data, ...prev.slice(0, 49)]); // Keep last 50
        }
      } catch (err) {}
    };
    return () => ws.close();
  }, []);

  const handleSimSave = async () => {
    setSimSaving(true);
    setSimSuccessMsg('');
    try {
      await api.post('/simulation', simConfig);
      setSimSuccessMsg('Simulation rules updated!');
      setTimeout(() => setSimSuccessMsg(''), 3000);
    } catch (err) {
      alert('Failed to update simulation config');
    } finally {
      setSimSaving(false);
    }
  };

  const chartData = [
    { name: 'Confirmed', count: metrics.confirmed_orders || 0 },
    { name: 'Failed', count: metrics.failed_orders || 0 },
    { name: 'DLQ Exhausted', count: metrics.dlq_count || 0 },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Admin & Observability Control</h1>
          </div>
          <p className="text-slate-400 text-sm mt-1">Live metrics, Kafka event stream, DLQ inspector, and failure simulation</p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center space-x-1 p-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
          {[
            { id: 'metrics', label: 'System Metrics', icon: Activity },
            { id: 'flow', label: 'Event Visualizer', icon: Cpu },
            { id: 'dlq', label: 'DLQ Inspector', icon: AlertOctagon },
            { id: 'simulation', label: 'Failure Simulator', icon: Sliders },
            { id: 'architecture', label: 'Architecture', icon: Server },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: SYSTEM METRICS */}
      {activeTab === 'metrics' && (
        <div className="space-y-8">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
                <span>TOTAL REVENUE</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-extrabold text-white">${metrics.total_revenue_usd || '0.00'}</div>
              <div className="text-[10px] text-emerald-400 font-mono">Aggregated from PostgreSQL</div>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
                <span>TOTAL ORDERS</span>
                <Activity className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-3xl font-extrabold text-white">{metrics.total_orders || 0}</div>
              <div className="text-[10px] text-sky-400 font-mono">Success Rate: {metrics.success_rate_percent || 100}%</div>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
                <span>KAFKA EVENTS PROCESSED</span>
                <Cpu className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-3xl font-extrabold text-white">{metrics.total_events_processed || 0}</div>
              <div className="text-[10px] text-indigo-400 font-mono">Kafka Authoritative Bus</div>
            </div>

            <div className="glass-card rounded-2xl p-6 border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-slate-400 text-xs font-mono">
                <span>DLQ FAILURES</span>
                <AlertOctagon className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-3xl font-extrabold text-rose-400">{metrics.dlq_count || 0}</div>
              <div className="text-[10px] text-rose-400 font-mono">Exhausted Consumer Retries</div>
            </div>

          </div>

          {/* Bar Chart */}
          <div className="glass-card rounded-3xl p-6 border border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-white">Order Pipeline Velocity & Failure Rates</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }} />
                  <Bar dataKey="count" fill="#0284c7" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: EVENT FLOW VISUALIZER */}
      {activeTab === 'flow' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
              <span>Real-Time Apache Kafka Event Stream</span>
            </h2>
            <span className="text-xs font-mono text-slate-400">Live WebSockets Broadcast ({eventStream.length} captured)</span>
          </div>

          {eventStream.length === 0 ? (
            <div className="text-center py-16 glass-card rounded-3xl space-y-3">
              <Cpu className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-slate-400 text-sm">Listening for real Kafka events... Place an order in the catalog!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {eventStream.map((evt, idx) => (
                <div key={idx} className="glass-card rounded-2xl p-5 border border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <span className="px-3 py-1 bg-sky-500/10 border border-sky-500/30 text-sky-400 font-mono text-xs font-bold rounded-lg">
                        {evt.event_type}
                      </span>
                      <span className="text-xs font-mono text-slate-400">Topic: {evt.topic}</span>
                      <span className="text-xs font-mono text-slate-500">Service: {evt.service}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Correlation ID: {evt.correlation_id}</span>
                  </div>

                  <pre className="p-3 bg-slate-950 rounded-xl border border-slate-900 font-mono text-xs text-sky-300 overflow-x-auto">
                    {JSON.stringify(evt.payload, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DLQ INSPECTOR */}
      {activeTab === 'dlq' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Dead Letter Queue (DLQ) Inspector</h2>
            <span className="text-xs font-mono text-rose-400">{dlqMessages.length} Exhausted Events</span>
          </div>

          {dlqMessages.length === 0 ? (
            <div className="text-center py-16 glass-card rounded-3xl space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <p className="text-slate-300 text-base font-bold">No DLQ Messages</p>
              <p className="text-slate-500 text-sm">Consumer retry mechanisms are executing smoothly without unhandled dead letters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dlqMessages.map((msg) => (
                <div key={msg.id} className="glass-card rounded-2xl p-6 border border-rose-500/30 bg-rose-950/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <AlertOctagon className="w-5 h-5 text-rose-400" />
                      <span className="font-bold text-white text-base">DLQ Event #{msg.id}</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-mono text-xs font-bold">
                        {msg.original_event_type}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-400">Original Event ID: {msg.original_event_id}</span>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-900 space-y-1 font-mono text-xs">
                    <div className="text-rose-400">Reason: {msg.failure_reason}</div>
                    <div className="text-slate-400">Last Error: {msg.last_error}</div>
                    <div className="text-slate-500">Retries Attempted: {msg.retry_count}</div>
                  </div>

                  <pre className="p-3 bg-slate-950/80 rounded-xl font-mono text-xs text-slate-300 overflow-x-auto">
                    {msg.payload}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: FAILURE SIMULATION */}
      {activeTab === 'simulation' && (
        <div className="glass-card rounded-3xl p-8 border border-slate-800 space-y-8 max-w-3xl mx-auto">
          <div>
            <h2 className="text-2xl font-bold text-white">Distributed Chaos & Failure Control Panel</h2>
            <p className="text-slate-400 text-sm mt-1">Simulate real payment failures, stockouts, processing delays, and consumer crashes to test Saga compensation.</p>
          </div>

          {simSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>{simSuccessMsg}</span>
            </div>
          )}

          <div className="space-y-6">
            
            {/* Toggle 1: Force Payment Failure */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div>
                <h4 className="font-bold text-white text-sm">Force 100% Payment Failures</h4>
                <p className="text-xs text-slate-400">Triggers PaymentFailed → Saga releases reserved inventory → Order CANCELLED</p>
              </div>
              <button
                onClick={() => setSimConfig({ ...simConfig, force_failure: !simConfig.force_failure })}
                className={`w-14 h-8 rounded-full transition-colors relative p-1 ${
                  simConfig.force_failure ? 'bg-rose-500' : 'bg-slate-800'
                }`}
              >
                <div className={`w-6 h-6 rounded-full bg-white transition-transform ${
                  simConfig.force_failure ? 'translate-x-6' : 'translate-x-0'
                }`}></div>
              </button>
            </div>

            {/* Slider 1: Failure Rate */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-white text-sm">Random Failure Probability</h4>
                <span className="font-mono text-sm text-sky-400 font-bold">{(simConfig.failure_rate * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={simConfig.failure_rate}
                onChange={(e) => setSimConfig({ ...simConfig, failure_rate: parseFloat(e.target.value) })}
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>

            {/* Slider 2: Artificial Delay */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-white text-sm">Artificial Consumer Latency</h4>
                <span className="font-mono text-sm text-indigo-400 font-bold">{simConfig.artificial_delay_sec} seconds</span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={simConfig.artificial_delay_sec}
                onChange={(e) => setSimConfig({ ...simConfig, artificial_delay_sec: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Toggle 2: Force Consumer Crash */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <div>
                <h4 className="font-bold text-white text-sm">Simulate Consumer Processing Crash</h4>
                <p className="text-xs text-slate-400">Forces 3 consumer retries and routes event to Dead Letter Queue (DLQ)</p>
              </div>
              <button
                onClick={() => setSimConfig({ ...simConfig, force_consumer_crash: !simConfig.force_consumer_crash })}
                className={`w-14 h-8 rounded-full transition-colors relative p-1 ${
                  simConfig.force_consumer_crash ? 'bg-amber-500' : 'bg-slate-800'
                }`}
              >
                <div className={`w-6 h-6 rounded-full bg-white transition-transform ${
                  simConfig.force_consumer_crash ? 'translate-x-6' : 'translate-x-0'
                }`}></div>
              </button>
            </div>

            <button
              onClick={handleSimSave}
              disabled={simSaving}
              className="w-full py-4 bg-sky-500 hover:bg-sky-400 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-sky-500/25 transition-all"
            >
              {simSaving ? 'Updating Rules...' : 'Apply Simulation Config'}
            </button>

          </div>
        </div>
      )}

      {/* TAB 5: SYSTEM ARCHITECTURE */}
      {activeTab === 'architecture' && (
        <div className="glass-card rounded-3xl p-8 border border-slate-800 space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-white">System Architecture & Microservice Topology</h2>
            <p className="text-slate-400 text-sm mt-1">ScaleFlow event-driven layout with Apache Kafka, Redis, PostgreSQL, and WebSockets.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center space-x-2 text-sky-400 font-bold text-sm">
                <Server className="w-5 h-5" />
                <span>API Gateway</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Reverse proxy routing, JWT token inspection, Redis sliding window rate limiting (30/100/300 req/min), X-Correlation-ID propagation.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center space-x-2 text-indigo-400 font-bold text-sm">
                <Cpu className="w-5 h-5" />
                <span>Kafka Event Bus</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Authoritative event broker handling topics `scaleflow.orders`, `scaleflow.inventory`, `scaleflow.payments`, `scaleflow.dlq`.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                <Database className="w-5 h-5" />
                <span>PostgreSQL Locking</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                High-concurrency stock reservation using `SELECT ... FOR UPDATE` row locks preventing negative stock during simultaneous checkouts.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                <Radio className="w-5 h-5" />
                <span>WebSockets & Monitoring</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Real-time status push to UI clients, Prometheus scrape metrics, and Grafana dashboard visualization.
              </p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
