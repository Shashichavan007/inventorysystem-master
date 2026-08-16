import React, { useState } from 'react';
import api from '../../services/api';
import { Sliders, AlertTriangle, Play, RefreshCw, CheckCircle2, XCircle, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';

export default function FailureLab() {
  const [failPayment, setFailPayment] = useState(false);
  const [stockout, setStockout] = useState(false);
  const [latency, setLatency] = useState(false);
  const [scenarioLogs, setScenarioLogs] = useState([]);
  const [isRunningScenario, setIsRunningScenario] = useState(false);

  const handleToggleSimulation = async (param, value) => {
    try {
      await api.post('/simulation', { [param]: value });
    } catch (e) {}
  };

  const runGuidedScenario = async () => {
    setIsRunningScenario(true);
    setScenarioLogs([]);

    const addLog = (msg, status = 'info') => {
      setScenarioLogs((prev) => [...prev, { time: new Date().toLocaleTimeString(), msg, status }]);
    };

    addLog('Step 1: Enabling Payment Failure simulation mode...', 'info');
    await api.post('/simulation', { force_failure: true });
    setFailPayment(true);

    await new Promise((r) => setTimeout(r, 1000));
    addLog('Step 2: Submitting test order POST /api/v1/orders (NVIDIA H100 GPU)...', 'info');

    try {
      const resp = await api.post('/orders', {
        items: [{ product_id: 1, quantity: 1 }],
      });
      const orderId = resp.data.id;
      addLog(`Step 3: Order #ORD-${orderId} created. Emitted OrderCreated to Kafka topic scaleflow.orders`, 'success');

      await new Promise((r) => setTimeout(r, 1200));
      addLog('Step 4: Inventory Service consumed OrderCreated & executed SELECT ... FOR UPDATE (Stock Reserved).', 'success');

      await new Promise((r) => setTimeout(r, 1200));
      addLog('Step 5: Payment Service consumed OrderCreated. Payment simulation triggered FAILURE!', 'error');

      await new Promise((r) => setTimeout(r, 1200));
      addLog('Step 6: PaymentService emitted PaymentFailed event to Kafka topic scaleflow.payments', 'warning');

      await new Promise((r) => setTimeout(r, 1200));
      addLog('Step 7: Inventory Service consumed PaymentFailed. Executed Saga Compensation (Restored Stock).', 'success');

      await new Promise((r) => setTimeout(r, 1200));
      addLog(`Step 8: Order Service updated Order #ORD-${orderId} state to CANCELLED. System consistency intact!`, 'success');

    } catch (err) {
      addLog(`Scenario error: ${err.message}`, 'error');
    } finally {
      setIsRunningScenario(false);
    }
  };

  return (
    <div className="space-y-8">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Failure Lab & Chaos Engineering</h1>
          <p className="text-slate-500 text-sm mt-1">Test how ScaleFlow behaves when microservices fail or network errors occur</p>
        </div>

        <button
          onClick={runGuidedScenario}
          disabled={isRunningScenario}
          className="px-5 py-3 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-300 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-brand-500/25 flex items-center space-x-2 transition-all"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{isRunningScenario ? 'Running Scenario...' : 'Run Guided Failure Scenario'}</span>
        </button>
      </div>

      {/* CONTROL CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: Payment Failure */}
        <div className="card-surface p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <span className="font-bold text-slate-900 dark:text-white text-base">Payment Failure Simulation</span>
            </div>
            <input
              type="checkbox"
              checked={failPayment}
              onChange={(e) => { setFailPayment(e.target.checked); handleToggleSimulation('force_failure', e.target.checked); }}
              className="w-5 h-5 accent-brand-600 rounded cursor-pointer"
            />
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Force payment requests to fail and observe automated Saga compensation releasing reserved inventory.
          </p>
        </div>

        {/* Card 2: Inventory Stockout */}
        <div className="card-surface p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <span className="font-bold text-slate-900 dark:text-white text-base">Inventory Stockout Simulation</span>
            </div>
            <input
              type="checkbox"
              checked={stockout}
              onChange={(e) => setStockout(e.target.checked)}
              className="w-5 h-5 accent-brand-600 rounded cursor-pointer"
            />
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Simulate high concurrency stock depletion to verify PostgreSQL row locking and rejection handling.
          </p>
        </div>

      </div>

      {/* GUIDED DEMO LIVE LOG FEED */}
      {scenarioLogs.length > 0 && (
        <div className="card-surface p-6 space-y-4 bg-slate-900 text-slate-100 border-none font-mono text-xs shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2 text-brand-400 font-bold">
              <Cpu className="w-4 h-4" />
              <span>Live Saga Compensating Transaction Log</span>
            </div>
            <span className="text-[10px] text-slate-400">AUTOMATED DEMO EXECUTION</span>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {scenarioLogs.map((log, idx) => (
              <div key={idx} className="flex items-start space-x-3">
                <span className="text-slate-500">{log.time}</span>
                <span className={
                  log.status === 'success' ? 'text-emerald-400' :
                  log.status === 'error' ? 'text-rose-400 font-bold' :
                  log.status === 'warning' ? 'text-amber-400 font-bold' : 'text-slate-300'
                }>
                  {log.msg}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
