import React, { useState } from 'react';
import { Cpu, Server, Database, Layers, ArrowDown, Shield, Radio, Code } from 'lucide-react';

export default function Architecture() {
  const [selectedNode, setSelectedNode] = useState(null);

  const architectureNodes = [
    {
      id: 'frontend',
      name: 'React 18 + Vite Frontend',
      layer: 'Presentation Layer',
      tech: 'React 18, Vite, Tailwind CSS, TanStack Query',
      desc: 'SaaS user interface providing light-first e-commerce checkout, real-time WebSocket timelines, and Developer Mode telemetry.',
    },
    {
      id: 'gateway',
      name: 'API Gateway (FastAPI)',
      layer: 'Gateway & Security Layer',
      tech: 'FastAPI Proxy, Redis Sliding-Window Limiter, X-Correlation-ID',
      desc: 'Performs rate limiting (30/100/300 req/min), correlation ID injection, JWT verification, and reverse proxy routing to microservices.',
    },
    {
      id: 'auth-service',
      name: 'Auth Service (Port 8001)',
      layer: 'Microservices Layer',
      tech: 'FastAPI, bcrypt, PyJWT, SQLAlchemy',
      desc: 'Handles user registration, login authentication, password hashing, and role-based access tokens (CUSTOMER / ADMIN).',
    },
    {
      id: 'order-service',
      name: 'Order Service (Port 8002)',
      layer: 'Microservices Layer',
      tech: 'FastAPI, WebSockets, aiokafka, Order State Machine',
      desc: 'Manages order state machine (CREATED -> CONFIRMED / CANCELLED) and streams live timeline updates over WebSockets.',
    },
    {
      id: 'inventory-service',
      name: 'Inventory Service (Port 8003)',
      layer: 'Microservices Layer',
      tech: 'FastAPI, PostgreSQL Row Locking, Redis Cache',
      desc: 'Executes `SELECT stock FROM products WHERE id = :id FOR UPDATE` for atomic stock allocation and listens for Kafka Saga compensating events.',
    },
    {
      id: 'payment-service',
      name: 'Payment Service (Port 8004)',
      layer: 'Microservices Layer',
      tech: 'FastAPI, aiokafka, Idempotency DB Check',
      desc: 'Simulates payment processing, checks `events_processed` for duplicate suppression, retries 3x with backoff, and routes failed events to DLQ.',
    },
    {
      id: 'kafka',
      name: 'Apache Kafka Event Broker',
      layer: 'Event Streaming Backbone',
      tech: 'Apache Kafka + Zookeeper (or KRaft)',
      desc: 'Authoritative event bus publishing and consuming typed JSON events across scaleflow.orders, scaleflow.inventory, and scaleflow.payments topics.',
    },
    {
      id: 'postgres',
      name: 'PostgreSQL Relational Storage',
      layer: 'Persistence Layer',
      tech: 'PostgreSQL 16 / SQLite fallback',
      desc: 'Stores users, products, categories, orders, order items, inventory reservations, payments, notifications, and DLQ records.',
    },
  ];

  return (
    <div className="space-y-8">
      
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">How ScaleFlow Works — System Architecture</h1>
        <p className="text-slate-500 text-sm mt-1">Interactive component topology of ScaleFlow's event-driven microservices architecture</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Architecture Topology List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">System Layer Diagram</h2>
          
          <div className="space-y-3">
            {architectureNodes.map((node) => (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                  selectedNode?.id === node.id
                    ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-500 shadow-md'
                    : 'card-surface card-surface-hover'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-xl bg-brand-100 dark:bg-brand-900/60 text-brand-600 dark:text-brand-300">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-base">{node.name}</h3>
                      <span className="text-xs text-slate-500">{node.layer}</span>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {node.tech.split(',')[0]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Node Details Drawer */}
        <div className="space-y-4">
          <h2 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Component Deep Dive</h2>
          
          {selectedNode ? (
            <div className="card-surface p-6 space-y-4 bg-slate-900 text-white border-none shadow-xl">
              <div className="flex items-center space-x-2 text-brand-400 font-bold text-sm">
                <Code className="w-4 h-4" />
                <span>{selectedNode.name}</span>
              </div>

              <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                <div><strong className="text-slate-400 font-mono">Layer:</strong> {selectedNode.layer}</div>
                <div><strong className="text-slate-400 font-mono">Stack:</strong> {selectedNode.tech}</div>
                <div className="pt-2 border-t border-slate-800 text-slate-300">{selectedNode.desc}</div>
              </div>
            </div>
          ) : (
            <div className="card-surface p-8 text-center text-xs text-slate-400 space-y-2">
              <Layers className="w-8 h-8 mx-auto text-slate-500" />
              <div>Click any architectural component to view tech stack details, responsibilities, and data flow.</div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
