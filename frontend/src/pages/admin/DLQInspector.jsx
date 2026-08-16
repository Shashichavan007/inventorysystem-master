import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { AlertOctagon, RefreshCw, Trash2, CheckCircle2, Terminal } from 'lucide-react';

export default function DLQInspector() {
  const [selectedMsg, setSelectedMsg] = useState(null);
  const queryClient = useQueryClient();

  const { data: dlqMessages = [], isLoading } = useQuery({
    queryKey: ['dlq-messages'],
    queryFn: async () => {
      const resp = await api.get('/dlq');
      return resp.data;
    },
    refetchInterval: 3000
  });

  const handleRetry = async (msgId) => {
    if (!window.confirm('Are you sure you want to retry processing this DLQ event?')) return;
    try {
      await api.post(`/dlq/${msgId}/retry`);
      queryClient.invalidateQueries(['dlq-messages']);
      setSelectedMsg(null);
    } catch (e) {}
  };

  const handleDiscard = async (msgId) => {
    if (!window.confirm('Are you sure you want to discard this event from DLQ?')) return;
    try {
      await api.delete(`/dlq/${msgId}`);
      queryClient.invalidateQueries(['dlq-messages']);
      setSelectedMsg(null);
    } catch (e) {}
  };

  return (
    <div className="space-y-8">
      
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Dead Letter Queue (DLQ) Inspector</h1>
          <p className="text-slate-500 text-sm mt-1">Inspect, retry, or discard unparseable or failed Kafka events from `scaleflow.dlq`</p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-mono text-xs font-bold flex items-center space-x-2">
            <AlertOctagon className="w-4 h-4" />
            <span>DLQ Depth: {dlqMessages.length} Messages</span>
          </div>
        </div>
      </div>

      {dlqMessages.length === 0 ? (
        <div className="card-surface p-16 text-center space-y-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">All Systems Clear. No Failed DLQ Events</h3>
          <p className="text-xs text-slate-500">Every Kafka message was successfully processed across consumers without unhandled exceptions.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 card-surface p-6 space-y-4">
            <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Poison Pill & Failed Messages</h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-400 uppercase">
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">Event Type</th>
                    <th className="py-3 px-4">Error Reason</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {dlqMessages.map((msg) => (
                    <tr
                      key={msg.id}
                      onClick={() => setSelectedMsg(msg)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">#{msg.id}</td>
                      <td className="py-3 px-4 font-mono text-brand-600 dark:text-brand-400">{msg.event_type}</td>
                      <td className="py-3 px-4 text-rose-600 dark:text-rose-400 text-xs max-w-xs truncate">{msg.error_reason}</td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRetry(msg.id); }}
                          className="px-2.5 py-1 text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                        >
                          Retry
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDiscard(msg.id); }}
                          className="px-2.5 py-1 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                        >
                          Discard
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Details Column */}
          <div className="space-y-4">
            <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Payload Details</h2>
            {selectedMsg ? (
              <div className="card-surface p-6 space-y-4 bg-slate-900 text-slate-200 border-none font-mono text-xs shadow-xl">
                <div className="font-bold text-rose-400">DLQ Message #{selectedMsg.id}</div>
                <pre className="overflow-x-auto text-[11px] leading-relaxed text-slate-300">
                  {JSON.stringify(selectedMsg, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="card-surface p-8 text-center text-xs text-slate-400 space-y-2">
                <Terminal className="w-8 h-8 mx-auto text-slate-500" />
                <div>Select any DLQ message row to inspect payload and error stack trace.</div>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
