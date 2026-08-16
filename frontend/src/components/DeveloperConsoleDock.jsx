import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Terminal, Cpu, Shield, AlertOctagon, Activity, RefreshCw, X, ChevronUp, ChevronDown,
  Zap, Database, Server, Radio, Play, CheckCircle2, Sliders, Layers
} from 'lucide-react';

export default function DeveloperConsoleDock() {
  const { devMode, toggleDevMode } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEventLog, setShowEventLog] = useState(false);
  const [eventStream, setEventStream] = useState([]);
  const [simConfig, setSimConfig] = useState({
    force_failure: false,
    failure_rate: 0.0,
    artificial_delay_sec: 0.0,
    force_consumer_crash: false
  });
  const [simSaving, setSimSaving] = useState(false);
  const [simToast, setSimToast] = useState('');

  // Fetch telemetry metrics when devMode is active
  const { data: metrics = {} } = useQuery({
    queryKey: ['dev-dock-metrics'],
    queryFn: async () => {
      const resp = await api.get('/analytics/dashboard');
      return resp.data;
    },
    enabled: devMode,
    refetchInterval: 3000
  });

  // Fetch DLQ count
  const { data: dlqMessages = [] } = useQuery({
    queryKey: ['dev-dock-dlq'],
    queryFn: async () => {
      const resp = await api.get('/dlq');
      return resp.data;
    },
    enabled: devMode,
    refetchInterval: 3000
  });

  // Fetch current simulation settings
  useEffect(() => {
    if (devMode) {
      api.get('/simulation').then((res) => setSimConfig(res.data)).catch(() => {});
    }
  }, [devMode]);

  // WebSocket Live Admin Event Stream
  useEffect(() => {
    if (!devMode) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/admin/events`;
    
    let ws;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (msg) => {
        try {
          const payload = JSON.parse(msg.data);
          if (payload.type === 'EVENT_FLOW') {
            setEventStream((prev) => [payload.data, ...prev.slice(0, 49)]);
          }
        } catch (err) {}
      };
    } catch (err) {}

    return () => ws && ws.close();
  }, [devMode]);

  if (!devMode) return null;

  const toggleSimOption = async (key) => {
    setSimSaving(true);
    const updated = { ...simConfig, [key]: !simConfig[key] };
    setSimConfig(updated);
    try {
      await api.post('/simulation', updated);
      setSimToast(`Simulation '${key}' set to ${updated[key] ? 'ENABLED' : 'DISABLED'}`);
      setTimeout(() => setSimToast(''), 3000);
    } catch (err) {
      alert('Failed to update simulation config');
    } finally {
      setSimSaving(false);
    }
  };

  const services = [
    { name: 'Gateway', port: 8000, status: 'ONLINE' },
    { name: 'Auth', port: 8001, status: 'ONLINE' },
    { name: 'Order', port: 8002, status: 'ONLINE' },
    { name: 'Inventory', port: 8003, status: 'ONLINE' },
    { name: 'Payment', port: 8004, status: 'ONLINE' },
    { name: 'Notification', port: 8005, status: 'ONLINE' },
    { name: 'Analytics', port: 8006, status: 'ONLINE' },
  ];

  return (
    <>
      {/* FLOATING DEVELOPER DOCK BAR */}
      <div className="fixed bottom-4 right-4 z-50 max-w-xl w-full sm:w-auto font-mono text-xs">
        
        {/* COLLAPSED PILL DOCK */}
        {!isExpanded && (
          <div className="card-surface p-2.5 bg-slate-950/95 dark:bg-slate-950/95 border-2 border-indigo-500/50 shadow-2xl text-slate-100 rounded-2xl flex items-center justify-between gap-3 backdrop-blur-xl animate-fade-in">
            <div className="flex items-center space-x-2.5 pl-1">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></div>
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span className="font-extrabold text-indigo-300">DEV TELEMETRY</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-300 font-semibold hidden sm:inline">7 Microservices Active</span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowEventLog(true)}
                className="px-2.5 py-1 bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 border border-indigo-700/60 rounded-xl font-bold flex items-center space-x-1 transition-all"
                title="View Kafka Event Log"
              >
                <Radio className="w-3.5 h-3.5 text-emerald-400" />
                <span>Events ({eventStream.length})</span>
              </button>

              <button
                onClick={() => setIsExpanded(true)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
                title="Expand Developer HUD"
              >
                <ChevronUp className="w-4 h-4" />
              </button>

              <button
                onClick={toggleDevMode}
                className="p-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/40 rounded-xl transition-all"
                title="Turn Off Developer Mode"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* EXPANDED CONTROL PANEL */}
        {isExpanded && (
          <div className="card-surface p-5 bg-slate-950/95 dark:bg-slate-950/95 border-2 border-indigo-500/60 shadow-2xl text-slate-100 rounded-3xl space-y-4 backdrop-blur-xl animate-scale-in max-h-[85vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Terminal className="w-5 h-5 text-indigo-400" />
                <h3 className="font-extrabold text-sm text-white">Developer Telemetry & Control HUD</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {simToast && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{simToast}</span>
              </div>
            )}

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400">KAFKA EVENTS</div>
                <div className="text-base font-extrabold text-sky-400">{metrics.total_events_processed || 0}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400">DLQ COUNT</div>
                <div className="text-base font-extrabold text-rose-400">{dlqMessages.length}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400">ROW LOCKING</div>
                <div className="text-base font-extrabold text-emerald-400">FOR UPDATE</div>
              </div>
            </div>

            {/* Service Health Matrix */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Microservice Mesh Ports</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {services.map((s) => (
                  <div key={s.name} className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-300">{s.name}</span>
                    <span className="text-slate-500">:{s.port}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chaos Engineering Quick Toggles */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center space-x-1">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>Chaos & Failure Simulation Quick Controls</span>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => toggleSimOption('force_failure')}
                  disabled={simSaving}
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                    simConfig.force_failure
                      ? 'bg-rose-950/80 border-rose-600 text-rose-200 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-[11px]">100% Payment Failures (Saga Compensation)</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${simConfig.force_failure ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                    {simConfig.force_failure ? 'ACTIVE' : 'OFF'}
                  </span>
                </button>

                <button
                  onClick={() => toggleSimOption('force_consumer_crash')}
                  disabled={simSaving}
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                    simConfig.force_consumer_crash
                      ? 'bg-amber-950/80 border-amber-600 text-amber-200 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-[11px]">Consumer Crashes (Route to DLQ)</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${simConfig.force_consumer_crash ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                    {simConfig.force_consumer_crash ? 'ACTIVE' : 'OFF'}
                  </span>
                </button>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                onClick={() => setShowEventLog(true)}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-indigo-600/25"
              >
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>Open Live Event Stream</span>
              </button>

              <button
                onClick={toggleDevMode}
                className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition-all border border-slate-800"
              >
                Turn Off
              </button>
            </div>

          </div>
        )}

      </div>

      {/* LIVE EVENT LOG INSPECTOR MODAL */}
      {showEventLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 font-mono text-xs animate-fade-in">
          <div className="card-surface bg-slate-950 border-2 border-indigo-500/60 rounded-3xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center space-x-3">
                <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
                <div>
                  <h3 className="font-extrabold text-base text-white">Apache Kafka Live Event Stream</h3>
                  <p className="text-[11px] text-slate-400">Broadcasting live microservice events over WebSockets</p>
                </div>
              </div>
              <button
                onClick={() => setShowEventLog(false)}
                className="p-2 text-slate-400 hover:text-white bg-slate-800/80 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {eventStream.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <Cpu className="w-12 h-12 text-slate-700 mx-auto" />
                  <p className="text-slate-400 font-semibold">Listening for live Kafka events...</p>
                  <p className="text-slate-500 text-[11px]">Place an order or navigate pages to capture live telemetry.</p>
                </div>
              ) : (
                eventStream.map((evt, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">
                          {evt.event_type}
                        </span>
                        <span className="text-slate-400 text-[11px]">Topic: {evt.topic}</span>
                        <span className="text-slate-500 text-[11px]">Service: {evt.service}</span>
                      </div>
                      <span className="text-slate-500 text-[10px]">Corr ID: {evt.correlation_id}</span>
                    </div>

                    <pre className="p-3 bg-slate-950 rounded-xl border border-slate-900 text-sky-300 overflow-x-auto text-[11px]">
                      {JSON.stringify(evt.payload, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between text-[11px] text-slate-400">
              <span>Captured: {eventStream.length} event(s)</span>
              <button
                onClick={() => setEventStream([])}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold"
              >
                Clear Log
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
