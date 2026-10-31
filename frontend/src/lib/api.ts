import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

const ACCESS_TOKEN_KEY = 'brightloop.access_token';
const REFRESH_TOKEN_KEY = 'brightloop.refresh_token';

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  setAccess: (token: string) => localStorage.setItem(ACCESS_TOKEN_KEY, token),
  getRefresh: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setRefresh: (token: string) => localStorage.setItem(REFRESH_TOKEN_KEY, token),
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

// Request Interceptor: Attach JWT Access Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStorage.getAccess();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: Auto-refresh on 401
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  for (const prom of failedQueue) {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  }
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = tokenStorage.getRefresh();

      if (!refreshToken) {
        tokenStorage.clear();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
          refresh: refreshToken,
        });

        const newAccessToken = data.access;
        tokenStorage.setAccess(newAccessToken);
        if (data.refresh) {
          tokenStorage.setRefresh(data.refresh);
        }

        processQueue(null, newAccessToken);
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        tokenStorage.clear();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

/* =========================================================
   Typed API Service Modules matching docs/API.md
   ========================================================= */

export const authApi = {
  register: (payload: { name: string; email: string; password: string; company?: string }) =>
    apiClient.post('/auth/register/', payload),
  login: (payload: { email: string; password: string }) => apiClient.post('/auth/login/', payload),
  refresh: (refresh: string) => apiClient.post('/auth/refresh/', { refresh }),
  logout: () => apiClient.post('/auth/logout/'),
  getMe: () => apiClient.get('/auth/me/'),
  requestPasswordReset: (email: string) => apiClient.post('/auth/password-reset/', { email }),
  confirmPasswordReset: (payload: { token: string; password: string }) =>
    apiClient.post('/auth/password-reset/confirm/', payload),
};

export const customersApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/customers/', { params }),
  get: (id: string) => apiClient.get(`/customers/${id}/`),
  create: (payload: Record<string, unknown>) => apiClient.post('/customers/', payload),
  update: (id: string, payload: Record<string, unknown>) =>
    apiClient.patch(`/customers/${id}/`, payload),
};

export const staffApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/staff/', { params }),
  get: (id: string) => apiClient.get(`/staff/${id}/`),
  create: (payload: Record<string, unknown>) => apiClient.post('/staff/', payload),
  update: (id: string, payload: Record<string, unknown>) =>
    apiClient.patch(`/staff/${id}/`, payload),
};

export const productsApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/products/', { params }),
  get: (id: string) => apiClient.get(`/products/${id}/`),
  create: (payload: Record<string, unknown>) => apiClient.post('/products/', payload),
  update: (id: string, payload: Record<string, unknown>) =>
    apiClient.patch(`/products/${id}/`, payload),
  addVariant: (productId: string, payload: Record<string, unknown>) =>
    apiClient.post(`/products/${productId}/variants/`, payload),
  updateVariant: (productId: string, variantId: string, payload: Record<string, unknown>) =>
    apiClient.patch(`/products/${productId}/variants/${variantId}/`, payload),
};

export const plansApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/plans/', { params }),
  get: (id: string) => apiClient.get(`/plans/${id}/`),
  create: (payload: Record<string, unknown>) => apiClient.post('/plans/', payload),
  update: (id: string, payload: Record<string, unknown>) =>
    apiClient.patch(`/plans/${id}/`, payload),
};

export const quotationsApi = {
  listTemplates: () => apiClient.get('/quotation-templates/'),
  createTemplate: (payload: Record<string, unknown>) =>
    apiClient.post('/quotation-templates/', payload),
  getTemplate: (id: string) => apiClient.get(`/quotation-templates/${id}/`),
  updateTemplate: (id: string, payload: Record<string, unknown>) =>
    apiClient.patch(`/quotation-templates/${id}/`, payload),
  list: (params?: Record<string, unknown>) => apiClient.get('/quotations/', { params }),
  get: (id: string) => apiClient.get(`/quotations/${id}/`),
  create: (payload: Record<string, unknown>) => apiClient.post('/quotations/', payload),
  update: (id: string, payload: Record<string, unknown>) =>
    apiClient.patch(`/quotations/${id}/`, payload),
  send: (id: string) => apiClient.post(`/quotations/${id}/send/`),
  confirm: (id: string) => apiClient.post(`/quotations/${id}/confirm/`),
  cancel: (id: string, reason?: string) => apiClient.post(`/quotations/${id}/cancel/`, { reason }),
};

export const subscriptionsApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/subscriptions/', { params }),
  get: (id: string) => apiClient.get(`/subscriptions/${id}/`),
  create: (payload: Record<string, unknown>) => apiClient.post('/subscriptions/', payload),
  update: (id: string, payload: Record<string, unknown>) =>
    apiClient.patch(`/subscriptions/${id}/`, payload),
  pause: (id: string) => apiClient.post(`/subscriptions/${id}/pause/`),
  resume: (id: string) => apiClient.post(`/subscriptions/${id}/resume/`),
  renew: (id: string, payload?: Record<string, unknown>) =>
    apiClient.post(`/subscriptions/${id}/renew/`, payload),
  close: (id: string, reason?: string) => apiClient.post(`/subscriptions/${id}/close/`, { reason }),
  billingHistory: (id: string) => apiClient.get(`/subscriptions/${id}/billing-history/`),
};

export const invoicesApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/invoices/', { params }),
  get: (id: string) => apiClient.get(`/invoices/${id}/`),
  confirm: (id: string) => apiClient.post(`/invoices/${id}/confirm/`),
  cancel: (id: string, reason?: string) => apiClient.post(`/invoices/${id}/cancel/`, { reason }),
  send: (id: string) => apiClient.post(`/invoices/${id}/send/`),
  downloadPdf: (id: string) => apiClient.get(`/invoices/${id}/pdf/`, { responseType: 'blob' }),
};

export const taxesApi = {
  list: () => apiClient.get('/taxes/'),
  create: (payload: Record<string, unknown>) => apiClient.post('/taxes/', payload),
  update: (id: string, payload: Record<string, unknown>) =>
    apiClient.patch(`/taxes/${id}/`, payload),
};

export const discountsApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/discounts/', { params }),
  create: (payload: Record<string, unknown>) => apiClient.post('/discounts/', payload),
  update: (id: string, payload: Record<string, unknown>) =>
    apiClient.patch(`/discounts/${id}/`, payload),
  deactivate: (id: string) => apiClient.post(`/discounts/${id}/deactivate/`),
};

export const paymentsApi = {
  list: (params?: Record<string, unknown>) => apiClient.get('/payments/', { params }),
  get: (id: string) => apiClient.get(`/payments/${id}/`),
  create: (payload: Record<string, unknown>) => apiClient.post('/payments/', payload),
  reverse: (id: string, reason?: string) => apiClient.post(`/payments/${id}/reverse/`, { reason }),
};

export const reportsApi = {
  dashboard: () => apiClient.get('/reports/dashboard/'),
  revenue: (params?: Record<string, unknown>) => apiClient.get('/reports/revenue/', { params }),
  subscriptions: (params?: Record<string, unknown>) =>
    apiClient.get('/reports/subscriptions/', { params }),
  invoices: (params?: Record<string, unknown>) => apiClient.get('/reports/invoices/', { params }),
};
