import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Check, ArrowRight, ShieldCheck, AlertCircle, CreditCard, Cpu, Lock } from 'lucide-react';

export default function Checkout() {
  const { cart, clearCart, user, devMode } = useAuth();
  const [step, setStep] = useState(2); // Step 2: Details, Step 3: Demo Payment
  const [simFailPayment, setSimFailPayment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Address details state
  const [address, setAddress] = useState({
    name: user?.full_name || 'Demo Customer',
    email: user?.email || 'customer@scaleflow.io',
    street: '100 ScaleFlow Way, Tech Park',
    city: 'San Francisco',
    state: 'CA',
    zip: '94105'
  });

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    setError('');

    // If user clicked Simulate Payment Failure, update backend simulation config
    if (simFailPayment) {
      try {
        await api.post('/simulation', { force_failure: true });
      } catch (e) {}
    } else {
      try {
        await api.post('/simulation', { force_failure: false });
      } catch (e) {}
    }

    const payload = {
      items: cart.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
      })),
    };

    try {
      const resp = await api.post('/orders', payload);
      const newOrder = resp.data;
      clearCart();
      navigate(`/orders?order_id=${newOrder.id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Order placement failed. Inventory may be out of stock.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      {/* STEPPER HEADER */}
      <div className="card-surface p-6">
        <div className="flex items-center justify-between">
          
          {/* Step 1: Cart */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
              <Check className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">1. Cart</span>
          </div>

          <div className="flex-1 h-0.5 bg-slate-200 dark:bg-slate-800 mx-4"></div>

          {/* Step 2: Details */}
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
              step >= 2 ? 'bg-brand-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
            }`}>
              2
            </div>
            <span className={`text-xs font-bold ${step >= 2 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
              2. Shipping Details
            </span>
          </div>

          <div className="flex-1 h-0.5 bg-slate-200 dark:bg-slate-800 mx-4"></div>

          {/* Step 3: Payment */}
          <div className="flex items-center space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
              step >= 3 ? 'bg-brand-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
            }`}>
              3
            </div>
            <span className={`text-xs font-bold ${step >= 3 ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
              3. Demo Payment
            </span>
          </div>

        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center space-x-3 text-rose-600 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 2: SHIPPING DETAILS */}
      {step === 2 && (
        <div className="card-surface p-8 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Shipping & Fulfillment Address</h2>
            <p className="text-xs text-slate-500 mt-1">Specify destination for order notification and delivery tracking</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-bold text-slate-500 uppercase mb-2">Recipient Name</label>
              <input
                type="text"
                value={address.name}
                onChange={(e) => setAddress({ ...address, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold text-slate-500 uppercase mb-2">Notification Email</label>
              <input
                type="email"
                value={address.email}
                onChange={(e) => setAddress({ ...address, email: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-mono font-bold text-slate-500 uppercase mb-2">Street Address</label>
              <input
                type="text"
                value={address.street}
                onChange={(e) => setAddress({ ...address, street: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <button
            onClick={() => setStep(3)}
            className="w-full py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-brand-500/25 flex items-center justify-center space-x-2 transition-all"
          >
            <span>Continue to Demo Payment</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STEP 3: DEMO PAYMENT */}
      {step === 3 && (
        <div className="card-surface p-8 space-y-6">
          <div>
            <div className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-brand-600" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Demo Payment Simulation</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">ScaleFlow processes payments asynchronously via Payment Service Kafka worker.</p>
          </div>

          {/* SIMULATION MODE CHOOSER */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase">Select Payment Outcome for Demo:</label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSimFailPayment(false)}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  !simFailPayment
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold shadow-sm'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-bold">Simulate Successful Payment</span>
                </div>
                <div className="text-xs font-normal text-slate-500 mt-1">Emits `PaymentSucceeded` & confirms order</div>
              </button>

              <button
                type="button"
                onClick={() => setSimFailPayment(true)}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  simFailPayment
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-200 font-bold shadow-sm'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span className="text-sm font-bold">Simulate Payment Failure</span>
                </div>
                <div className="text-xs font-normal text-slate-500 mt-1">Triggers Saga compensation releasing stock</div>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 text-slate-300 text-xs font-mono space-y-1">
            <div className="flex items-center space-x-2 text-brand-400 font-bold">
              <Cpu className="w-4 h-4" />
              <span>Kafka Event Chain Payload</span>
            </div>
            <div>Order Total: ${subtotal.toFixed(2)}</div>
            <div>Target Service: Payment Service (Kafka group `group_payment_service`)</div>
          </div>

          <button
            onClick={handlePlaceOrder}
            disabled={submitting}
            className="w-full py-4 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-300 text-white font-extrabold text-sm rounded-xl shadow-xl shadow-brand-500/25 flex items-center justify-center space-x-2 transition-all"
          >
            <span>{submitting ? 'Dispatching Kafka Event...' : `Confirm & Submit Order ($${subtotal.toFixed(2)})`}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

        </div>
      )}

    </div>
  );
}
