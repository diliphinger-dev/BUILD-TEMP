const API_BASE = '/api';

const getAuthToken = () => {
  return localStorage.getItem('ca_auth_token');
};

const makeRequest = async (url, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    localStorage.removeItem('ca_auth_token');
    window.location.reload();
    return;
  }

  return response;
};

export const api = {
  // Auth
  login: (credentials) => makeRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  }),
  
  verify: () => makeRequest('/auth/verify'),

  // Clients
  getClients: () => makeRequest('/clients'),
  getClient: (id) => makeRequest(`/clients/${id}`),
  createClient: (data) => makeRequest('/clients', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateClient: (id, data) => makeRequest(`/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteClient: (id) => makeRequest(`/clients/${id}`, {
    method: 'DELETE'
  }),

  // Staff
  getStaff: () => makeRequest('/staff'),
  getActiveStaff: () => makeRequest('/staff/active'),
  createStaff: (data) => makeRequest('/staff', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateStaff: (id, data) => makeRequest(`/staff/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteStaff: (id) => makeRequest(`/staff/${id}`, {
    method: 'DELETE'
  }),

  // Tasks
  getTasks: () => makeRequest('/tasks'),
  getTasksReadyForBilling: () => makeRequest('/tasks/ready-for-billing'),
  createTask: (data) => makeRequest('/tasks', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateTask: (id, data) => makeRequest(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteTask: (id) => makeRequest(`/tasks/${id}`, {
    method: 'DELETE'
  }),

  // Billing
  getInvoices: () => makeRequest('/billing'),
  getBillingStats: () => makeRequest('/billing/stats'),
  createInvoiceFromTask: (data) => makeRequest('/billing/create-from-task', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateInvoiceStatus: (id, data) => makeRequest(`/billing/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  // Dashboard
  getDashboardStats: () => makeRequest('/dashboard/stats'),
  getRecentActivities: () => makeRequest('/dashboard/recent-activities')
};