import axios from 'axios';
import { initialProducts, initialCategories } from './mockData';

// Determine API base URL (Vite proxy locally vs direct localhost / fallback on static hosts)
const isGithubPages = window.location.hostname.includes('github.io');
const baseURL = isGithubPages ? 'http://localhost:8000/api/v1' : '/api/v1';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 3000, // Fast 3s timeout for local API before triggering static fallback
});

// Helper to manage mock state in localStorage for static hosting
const getMockData = () => {
  let products;
  try {
    products = JSON.parse(localStorage.getItem('scaleflow_mock_products')) || initialProducts;
  } catch (e) {
    products = initialProducts;
  }

  let orders;
  try {
    orders = JSON.parse(localStorage.getItem('scaleflow_mock_orders')) || [
      {
        id: 101,
        customer_id: 1,
        status: 'CONFIRMED',
        total_amount: 4999.99,
        correlation_id: 'corr_demo_982a',
        created_at: new Date().toISOString(),
        items: [
          { product_id: 1, product_name: 'ScaleFlow Quantum Node X9000', quantity: 1, unit_price: 4999.99 }
        ]
      }
    ];
  } catch (e) {
    orders = [];
  }

  return { products, orders };
};

const handleMockFallback = (config) => {
  const url = config.url || '';
  const method = (config.method || 'get').toLowerCase();

  // Auth login
  if (url.includes('/auth/login') && method === 'post') {
    let data = {};
    try { data = JSON.parse(config.data || '{}'); } catch (e) {}
    const isAdmin = data.email?.includes('admin');
    return Promise.resolve({
      status: 200,
      data: {
        access_token: 'mock_demo_jwt_token_' + Date.now(),
        user_id: isAdmin ? 1 : 2,
        role: isAdmin ? 'ADMIN' : 'CUSTOMER',
        full_name: isAdmin ? 'ScaleFlow Admin' : 'Demo Customer'
      }
    });
  }

  // Auth register
  if (url.includes('/auth/register') && method === 'post') {
    let data = {};
    try { data = JSON.parse(config.data || '{}'); } catch (e) {}
    return Promise.resolve({
      status: 200,
      data: {
        access_token: 'mock_demo_jwt_token_' + Date.now(),
        user_id: Math.floor(Math.random() * 1000) + 10,
        role: data.role || 'CUSTOMER',
        full_name: data.full_name || 'Registered Customer'
      }
    });
  }

  // Categories
  if (url.includes('/categories')) {
    return Promise.resolve({ status: 200, data: initialCategories });
  }

  // Single Product
  if (url.match(/\/products\/\d+/)) {
    const parts = url.split('/products/');
    const productId = parseInt(parts[1]);
    const { products } = getMockData();
    const found = products.find(p => p.id === productId) || products[0];
    return Promise.resolve({ status: 200, data: found });
  }

  // Products List
  if (url.includes('/products')) {
    const { products } = getMockData();
    return Promise.resolve({ status: 200, data: products });
  }

  // Create Order
  if (url.includes('/orders') && method === 'post') {
    let reqData = {};
    try { reqData = JSON.parse(config.data || '{}'); } catch (e) {}
    const { products, orders } = getMockData();
    const newOrderId = orders.length > 0 ? Math.max(...orders.map(o => o.id)) + 1 : 100;
    
    let total_amount = 0;
    const order_items = (reqData.items || []).map(item => {
      const prod = products.find(p => p.id === item.product_id);
      const price = prod ? prod.price : 100;
      total_amount += price * item.quantity;
      return {
        product_id: item.product_id,
        product_name: prod ? prod.name : `Product #${item.product_id}`,
        quantity: item.quantity,
        unit_price: price
      };
    });

    const newOrder = {
      id: newOrderId,
      customer_id: 1,
      status: 'CONFIRMED',
      total_amount: Math.round(total_amount * 100) / 100,
      correlation_id: `corr_demo_${Math.random().toString(36).substring(2, 8)}`,
      created_at: new Date().toISOString(),
      items: order_items
    };

    const updatedOrders = [newOrder, ...orders];
    try { localStorage.setItem('scaleflow_mock_orders', JSON.stringify(updatedOrders)); } catch (e) {}

    return Promise.resolve({ status: 201, data: newOrder });
  }

  // List Orders
  if (url.includes('/orders') && method === 'get') {
    const { orders } = getMockData();
    return Promise.resolve({ status: 200, data: orders });
  }

  // Analytics Dashboard
  if (url.includes('/analytics/dashboard')) {
    const { orders } = getMockData();
    const totalRev = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    return Promise.resolve({
      status: 200,
      data: {
        total_revenue_usd: Math.round(totalRev * 100) / 100,
        total_orders: orders.length,
        success_rate_percent: 100,
        confirmed_orders: orders.length,
        failed_orders: 0,
        dlq_count: 0,
        total_events_processed: orders.length * 4
      }
    });
  }

  // DLQ
  if (url.includes('/dlq')) {
    return Promise.resolve({ status: 200, data: [] });
  }

  // Notifications
  if (url.includes('/notifications')) {
    return Promise.resolve({
      status: 200,
      data: [
        { id: 1, title: 'Welcome to ScaleFlow', message: 'Platform event pipeline active.', read: false, created_at: new Date().toISOString() }
      ]
    });
  }

  // Simulation
  if (url.includes('/simulation')) {
    return Promise.resolve({
      status: 200,
      data: { force_failure: false, failure_rate: 0.0, artificial_delay_sec: 0.0, force_consumer_crash: false }
    });
  }

  return Promise.resolve({ status: 200, data: {} });
};

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('scaleflow_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (!config.headers['X-Correlation-ID']) {
      config.headers['X-Correlation-ID'] = `corr_ui_${Math.random().toString(36).substring(2, 10)}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If backend server is offline or unreachable (e.g. static hosting on GitHub Pages), trigger seamless mock fallback
    if (!error.response || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || error.response.status === 404) {
      return handleMockFallback(error.config);
    }

    if (error.response && error.response.status === 401) {
      localStorage.removeItem('scaleflow_token');
      localStorage.removeItem('scaleflow_user');
    }
    return Promise.reject(error);
  }
);

export default api;
