export const formatCurrency = (amount, currency = 'INR') => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

export const formatDate = (dateString, options = {}) => {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  
  // Fix: Ensure proper year formatting
  if (isNaN(date.getTime())) return '-';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short', 
    day: 'numeric'
  };
  
  return date.toLocaleDateString('en-IN', { ...defaultOptions, ...options });
};

export const getStatusBadgeClass = (status, type = 'default') => {
  const statusClasses = {
    default: {
      active: 'badge-success',
      inactive: 'badge-danger',
      pending: 'badge-warning',
      completed: 'badge-success',
      in_progress: 'badge-info',
      cancelled: 'badge-secondary',
      paid: 'badge-success'
    },
    task: {
      pending: 'badge-warning',
      in_progress: 'badge-info',
      completed: 'badge-success',
      cancelled: 'badge-secondary'
    },
    invoice: {
      pending: 'badge-warning',
      paid: 'badge-success'
    }
  };
  
  return statusClasses[type]?.[status] || statusClasses.default[status] || 'badge-secondary';
};

export const getPriorityBadgeClass = (priority) => {
  const priorities = {
    low: 'badge-info',
    medium: 'badge-warning',
    high: 'badge-danger'
  };
  
  return priorities[priority] || 'badge-secondary';
};