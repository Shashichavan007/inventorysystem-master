import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('scaleflow_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Generate correlation ID if not present
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
    if (error.response && error.response.status === 401) {
      // Clear token if unauthorized
      localStorage.removeItem('scaleflow_token');
      localStorage.removeItem('scaleflow_user');
    }
    return Promise.reject(error);
  }
);

export default api;
