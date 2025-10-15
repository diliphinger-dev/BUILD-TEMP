import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate, getStatusBadgeClass } from '../../utils/helpers';

// Helper function to get auth token
const getAuthToken = (appContext) => {
  if (appContext?.token) {
    return appContext.token;
  }
  
  const token = localStorage.getItem('ca_auth_token') || 
                localStorage.getItem('token') || 
                localStorage.getItem('authToken') ||
                localStorage.getItem('auth_token');
  
  return token;
};

// Advanced Filters Component
const AdvancedFiltersModal = ({ filters, onApplyFilters, clients, onClose }) => {
  const [localFilters, setLocalFilters] = useState({
    start_date: filters.start_date || '',
    end_date: filters.end_date || '',
    status: filters.status || 'all',
    client_id: filters.client_id || 'all',
    min_amount: filters.min_amount || '',
    max_amount: filters.max_amount || '',
    overdue_only: filters.overdue_only || false,
    sort_by: filters.sort_by || 'created_at',
    sort_order: filters.sort_order || 'DESC'
  });

  const handleChange = (field, value) => {
    setLocalFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleApply = () => {
    onApplyFilters(localFilters);
    onClose();
  };

  const handleReset = () => {
    const resetFilters = {
      start_date: '',
      end_date: '',
      status: 'all',
      client_id: 'all',
      min_amount: '',
      max_amount: '',
      overdue_only: false,
      sort_by: 'created_at',
      sort_order: 'DESC'
    };
    setLocalFilters(resetFilters);
    onApplyFilters(resetFilters);
    onClose();
  };

  return (
    <div style={{ maxWidth: '600px' }}>
      <div className="modal-header">
        <h3 className="modal-title">
          <i className="fas fa-filter" style={{ marginRight: '8px' }}></i>
          Advanced Filters & Sorting
        </h3>
        <button className="btn btn-sm btn-outline" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      
      <div className="modal-body" style={{ maxHeight: '500px', overflowY: 'auto' }}>
        <div style={{ marginBottom: '20px' }}>
          <h5 style={{ marginBottom: '12px', color: '#495057' }}>
            <i className="fas fa-calendar" style={{ marginRight: '8px' }}></i>
            Date Range
          </h5>
          <div className="row">
            <div className="col-2">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-control"
                value={localFilters.start_date}
                onChange={(e) => handleChange('start_date', e.target.value)}
              />
            </div>
            <div className="col-2">
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-control"
                value={localFilters.end_date}
                onChange={(e) => handleChange('end_date', e.target.value)}
                min={localFilters.start_date}
              />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h5 style={{ marginBottom: '12px', color: '#495057' }}>
            <i className="fas fa-tag" style={{ marginRight: '8px' }}></i>
            Status & Client
          </h5>
          <div className="row">
            <div className="col-2">
              <label className="form-label">Invoice Status</label>
              <select
                className="form-control form-select"
                value={localFilters.status}
                onChange={(e) => handleChange('status', e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div className="col-2">
              <label className="form-label">Client</label>
              <select
                className="form-control form-select"
                value={localFilters.client_id}
                onChange={(e) => handleChange('client_id', e.target.value)}
              >
                <option value="all">All Clients</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name} {client.company && `(${client.company})`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h5 style={{ marginBottom: '12px', color: '#495057' }}>
            <i className="fas fa-rupee-sign" style={{ marginRight: '8px' }}></i>
            Amount Range
          </h5>
          <div className="row">
            <div className="col-2">
              <label className="form-label">Minimum Amount (₹)</label>
              <input
                type="number"
                className="form-control"
                placeholder="0"
                value={localFilters.min_amount}
                onChange={(e) => handleChange('min_amount', e.target.value)}
                min="0"
                step="100"
              />
            </div>
            <div className="col-2">
              <label className="form-label">Maximum Amount (₹)</label>
              <input
                type="number"
                className="form-control"
                placeholder="No limit"
                value={localFilters.max_amount}
                onChange={(e) => handleChange('max_amount', e.target.value)}
                min={localFilters.min_amount || "0"}
                step="100"
              />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h5 style={{ marginBottom: '12px', color: '#495057' }}>
            <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }}></i>
            Special Filters
          </h5>
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id="overdueFilter"
              checked={localFilters.overdue_only}
              onChange={(e) => handleChange('overdue_only', e.target.checked)}
            />
            <label className="form-check-label" htmlFor="overdueFilter">
              Show only overdue invoices
            </label>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h5 style={{ marginBottom: '12px', color: '#495057' }}>
            <i className="fas fa-sort" style={{ marginRight: '8px' }}></i>
            Sorting Options
          </h5>
          <div className="row">
            <div className="col-2">
              <label className="form-label">Sort By</label>
              <select
                className="form-control form-select"
                value={localFilters.sort_by}
                onChange={(e) => handleChange('sort_by', e.target.value)}
              >
                <option value="created_at">Date Created</option>
                <option value="invoice_date">Invoice Date</option>
                <option value="due_date">Due Date</option>
                <option value="total_amount">Total Amount</option>
                <option value="pending_amount">Pending Amount</option>
                <option value="client_name">Client Name</option>
                <option value="status">Status</option>
                <option value="days_overdue">Days Overdue</option>
              </select>
            </div>
            <div className="col-2">
              <label className="form-label">Sort Order</label>
              <select
                className="form-control form-select"
                value={localFilters.sort_order}
                onChange={(e) => handleChange('sort_order', e.target.value)}
              >
                <option value="DESC">Descending (High to Low)</option>
                <option value="ASC">Ascending (Low to High)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={handleReset}>
          <i className="fas fa-undo" style={{ marginRight: '6px' }}></i>
          Reset All
        </button>
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={handleApply}>
          <i className="fas fa-check" style={{ marginRight: '6px' }}></i>
          Apply Filters
        </button>
      </div>
    </div>
  );
};

// Enhanced Receipt Form with Discount Support
const ReceiptForm = ({ invoice, onSuccess, appContext }) => {
  const [formData, setFormData] = useState({
    amount: '',
    payment_method: 'cash',
    payment_reference: '',
    receipt_date: new Date().toISOString().split('T')[0],
    notes: '',
    discount_amount: 0
  });
  const [loading, setLoading] = useState(false);

  const remainingAmount = parseFloat(invoice.total_amount) - parseFloat(invoice.received_amount || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const receiptAmount = parseFloat(formData.amount) || 0;
    const discountAmount = parseFloat(formData.discount_amount) || 0;

    if (receiptAmount + discountAmount > remainingAmount) {
      alert(`Total amount cannot exceed remaining balance of ${formatCurrency(remainingAmount)}`);
      setLoading(false);
      return;
    }

    const token = getAuthToken(appContext);

    try {
      const response = await fetch(`/api/billing/invoices/${invoice.id}/receipts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          amount: receiptAmount,
          discount_amount: discountAmount
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          onSuccess();
        } else {
          alert(`Error: ${result.message || result.error || 'Unknown error'}`);
        }
      } else {
        try {
          const error = await response.json();
          alert(`Error creating receipt: ${error.message || error.error || 'Unknown error'}`);
        } catch (e) {
          alert('Error creating receipt: Invalid server response');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error creating receipt');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div>
      <div className="modal-header">
        <h3 className="modal-title">Add Payment Receipt</h3>
        <button className="btn btn-sm btn-outline" onClick={onSuccess}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="form-group" style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
            <h5 style={{ marginBottom: '12px' }}>Invoice Details</h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '14px' }}>
              <div>
                <strong>Invoice:</strong> {invoice.invoice_number}<br />
                <strong>Client:</strong> {invoice.client_name}<br />
                <strong>Total Amount:</strong> {formatCurrency(invoice.total_amount)}
              </div>
              <div>
                <strong>Received:</strong> {formatCurrency(invoice.received_amount || 0)}<br />
                <strong>Remaining:</strong> <span style={{ color: '#e74c3c', fontWeight: '600' }}>{formatCurrency(remainingAmount)}</span>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">Receipt Amount (₹) *</label>
                <input
                  type="number"
                  name="amount"
                  className="form-control"
                  value={formData.amount}
                  onChange={handleChange}
                  max={remainingAmount}
                  step="0.01"
                  required
                  placeholder="0.00"
                />
                <small className="text-muted">
                  Maximum: {formatCurrency(remainingAmount)}
                </small>
              </div>
            </div>
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">Discount Amount (₹)</label>
                <input
                  type="number"
                  name="discount_amount"
                  className="form-control"
                  value={formData.discount_amount}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
                <small className="text-muted">Optional discount adjustment</small>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">Payment Method *</label>
                <select
                  name="payment_method"
                  className="form-control form-select"
                  value={formData.payment_method}
                  onChange={handleChange}
                  required
                >
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="card">Credit/Debit Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">Receipt Date *</label>
                <input
                  type="date"
                  name="receipt_date"
                  className="form-control"
                  value={formData.receipt_date}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Payment Reference</label>
            <input
              type="text"
              name="payment_reference"
              className="form-control"
              value={formData.payment_reference}
              onChange={handleChange}
              placeholder="Cheque number, transaction ID, etc."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              name="notes"
              className="form-control"
              rows="3"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional notes about this payment"
            ></textarea>
          </div>

          {parseFloat(formData.amount || 0) + parseFloat(formData.discount_amount || 0) >= remainingAmount && (
            <div style={{ background: '#d4edda', color: '#155724', padding: '12px', borderRadius: '8px' }}>
              <i className="fas fa-check-circle" style={{ marginRight: '8px' }}></i>
              This payment will fully settle the invoice.
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onSuccess}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading || !formData.amount}>
            {loading ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </div>
  );
};

// Enhanced Invoice Form with Discount Support
const InvoiceForm = ({ task, onSuccess, appContext }) => {
  const [formData, setFormData] = useState({
    amount: task?.amount || 0,
    tax_rate: 18,
    tax_amount: 0,
    discount_amount: 0,
    discount_type: 'fixed',
    discount_reason: '',
    total_amount: 0,
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    payment_terms: 'net_30',
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const amount = parseFloat(formData.amount) || 0;
    const taxRate = parseFloat(formData.tax_rate) || 0;
    const discountAmount = parseFloat(formData.discount_amount) || 0;
    
    const taxAmount = (amount * taxRate) / 100;
    const totalAmount = amount + taxAmount - discountAmount;
    
    setFormData(prev => ({
      ...prev,
      tax_amount: taxAmount,
      total_amount: Math.max(0, totalAmount)
    }));
  }, [formData.amount, formData.tax_rate, formData.discount_amount]);

  useEffect(() => {
    if (formData.invoice_date && formData.payment_terms) {
      const invoiceDate = new Date(formData.invoice_date);
      let daysToAdd = 30;
      
      switch (formData.payment_terms) {
        case 'immediate':
          daysToAdd = 0;
          break;
        case 'net_15':
          daysToAdd = 15;
          break;
        case 'net_30':
          daysToAdd = 30;
          break;
        case 'net_60':
          daysToAdd = 60;
          break;
        default:
          daysToAdd = 30;
      }
      
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(invoiceDate.getDate() + daysToAdd);
      
      setFormData(prev => ({
        ...prev,
        due_date: dueDate.toISOString().split('T')[0]
      }));
    }
  }, [formData.invoice_date, formData.payment_terms]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const token = getAuthToken(appContext);

    try {
      const response = await fetch('/api/billing/create-from-task', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          task_id: task.id,
          ...formData
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          onSuccess();
        } else {
          alert(`Error: ${result.message || result.error || 'Unknown error'}`);
        }
      } else {
        try {
          const error = await response.json();
          alert(`Error creating invoice: ${error.message || error.error || 'Unknown error'}`);
        } catch (e) {
          alert('Error creating invoice: Invalid server response');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error creating invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div>
      <div className="modal-header">
        <h3 className="modal-title">Create Invoice</h3>
        <button className="btn btn-sm btn-outline" onClick={onSuccess}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="form-group" style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
            <h5 style={{ marginBottom: '8px' }}>Task: {task.title}</h5>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '0' }}>
              Client: {task.client_name}
            </p>
          </div>

          <div className="row">
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">Base Amount (₹) *</label>
                <input
                  type="number"
                  name="amount"
                  className="form-control"
                  value={formData.amount}
                  onChange={handleChange}
                  step="0.01"
                  required
                  min="0"
                />
              </div>
            </div>
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">Tax Rate (%)</label>
                <select
                  name="tax_rate"
                  className="form-control form-select"
                  value={formData.tax_rate}
                  onChange={handleChange}
                >
                  <option value="0">No Tax (0%)</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">Discount Amount (₹)</label>
                <input
                  type="number"
                  name="discount_amount"
                  className="form-control"
                  value={formData.discount_amount}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">Discount Reason</label>
                <input
                  type="text"
                  name="discount_reason"
                  className="form-control"
                  value={formData.discount_reason}
                  onChange={handleChange}
                  placeholder="e.g., Early payment, Loyalty"
                />
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">Tax Amount (₹)</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.tax_amount.toFixed(2)}
                  readOnly
                  style={{ background: '#f8f9fa' }}
                />
              </div>
            </div>
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">Total Amount (₹)</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.total_amount.toFixed(2)}
                  readOnly
                  style={{ fontWeight: 'bold', background: '#f8f9fa' }}
                />
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">Invoice Date *</label>
                <input
                  type="date"
                  name="invoice_date"
                  className="form-control"
                  value={formData.invoice_date}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">Payment Terms</label>
                <select
                  name="payment_terms"
                  className="form-control form-select"
                  value={formData.payment_terms}
                  onChange={handleChange}
                >
                  <option value="immediate">Due Immediately</option>
                  <option value="net_15">Net 15 Days</option>
                  <option value="net_30">Net 30 Days</option>
                  <option value="net_60">Net 60 Days</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input
              type="date"
              name="due_date"
              className="form-control"
              value={formData.due_date}
              onChange={handleChange}
            />
            <small className="text-muted">Auto-calculated based on payment terms</small>
          </div>

          <div className="form-group">
            <label className="form-label">Invoice Notes</label>
            <textarea
              name="notes"
              className="form-control"
              rows="3"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional notes or payment instructions"
            ></textarea>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onSuccess}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </form>
    </div>
  );
};

// Outstanding Invoices Tab
const OutstandingInvoicesTab = ({ invoices, onUpdateStatus, onAddReceipt, onPrintInvoice, onDeleteInvoice, userRole }) => {
  const totalOutstanding = invoices.reduce((sum, inv) => sum + parseFloat(inv.pending_amount || inv.total_amount || 0), 0);

  return (
    <div style={{ padding: '24px' }}>
      <div style={{
        background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
        color: 'white',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>
            <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }}></i>
            Outstanding Invoices
          </h4>
          <p style={{ margin: '0', opacity: '0.9', fontSize: '14px' }}>
            {invoices.length} invoices requiring attention
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '24px', fontWeight: '700' }}>
            ₹{totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', opacity: '0.9' }}>
            Total Outstanding
          </div>
        </div>
      </div>

      {invoices.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice Details</th>
                <th>Client</th>
                <th>Amount Breakdown</th>
                <th>Due Date</th>
                <th>Days Overdue</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices
                .sort((a, b) => {
                  const aDaysOverdue = a.days_overdue || 0;
                  const bDaysOverdue = b.days_overdue || 0;
                  
                  if (aDaysOverdue > 0 && bDaysOverdue <= 0) return -1;
                  if (bDaysOverdue > 0 && aDaysOverdue <= 0) return 1;
                  if (aDaysOverdue !== bDaysOverdue) return bDaysOverdue - aDaysOverdue;
                  
                  return parseFloat(b.pending_amount || b.total_amount || 0) - parseFloat(a.pending_amount || a.total_amount || 0);
                })
                .map((invoice) => {
                  const daysOverdue = invoice.days_overdue || 0;
                  const isOverdue = daysOverdue > 0;

                  return (
                    <tr key={invoice.id} style={{ 
                      background: isOverdue ? '#fff5f5' : 'white',
                      borderLeft: isOverdue ? '4px solid #e74c3c' : '4px solid transparent'
                    }}>
                      <td>
                        <div>
                          <strong>{invoice.invoice_number}</strong>
                          {invoice.task_title && (
                            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                              {invoice.task_title}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <strong>{invoice.client_name}</strong>
                      </td>
                      <td>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '600' }}>
                            Total: ₹{parseFloat(invoice.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </div>
                          {invoice.received_amount > 0 && (
                            <div style={{ fontSize: '12px', color: '#27ae60' }}>
                              Received: ₹{parseFloat(invoice.received_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </div>
                          )}
                          <div style={{ 
                            fontSize: '13px', 
                            color: isOverdue ? '#e74c3c' : '#f39c12',
                            fontWeight: '600'
                          }}>
                            Pending: ₹{parseFloat(invoice.pending_amount || invoice.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      </td>
                      <td>
                        {invoice.due_date ? (
                          <div>
                            {new Date(invoice.due_date).toLocaleDateString()}
                            {isOverdue && (
                              <div style={{ fontSize: '11px', color: '#e74c3c', fontWeight: '600' }}>
                                DUE DATE PASSED
                              </div>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>
                        {isOverdue ? (
                          <span style={{ 
                            color: '#e74c3c', 
                            fontWeight: '700',
                            background: '#ffeaea',
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '12px'
                          }}>
                            {daysOverdue} days
                          </span>
                        ) : daysOverdue < 0 ? (
                          <span style={{ color: '#27ae60', fontSize: '12px' }}>
                            Due in {Math.abs(daysOverdue)} days
                          </span>
                        ) : (
                          <span style={{ color: '#f39c12', fontSize: '12px' }}>
                            Due today
                          </span>
                        )}
                      </td>
                      <td>
                        <div>
                          <span className={`badge ${
                            invoice.status === 'partially_paid' ? 'badge-warning' : 'badge-danger'
                          }`}>
                            {invoice.status === 'partially_paid' ? 'PARTIALLY PAID' : 'PENDING'}
                          </span>
                          {invoice.status === 'partially_paid' && (
                            <div style={{ fontSize: '10px', marginTop: '2px', color: '#666' }}>
                              {Math.round((invoice.received_amount / invoice.total_amount) * 100)}% paid
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => onAddReceipt(invoice)}
                            title="Record Payment"
                            style={{ marginBottom: '4px', width: '100%' }}
                          >
                            <i className="fas fa-plus"></i>
                            Payment
                          </button>
                          <button
                            className="btn btn-sm btn-info"
                            onClick={() => onPrintInvoice(invoice.id)}
                            title="Print Invoice"
                            style={{ marginBottom: '4px', width: '100%' }}
                          >
                            <i className="fas fa-print"></i>
                            Print
                          </button>
                          {userRole === 'admin' && (
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => onDeleteInvoice(invoice)}
                              title="Delete Invoice"
                              style={{ width: '100%' }}
                            >
                              <i className="fas fa-trash"></i>
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: '#27ae60' }}>
          <i className="fas fa-check-circle" style={{ fontSize: '64px', marginBottom: '16px' }}></i>
          <h4 style={{ marginBottom: '8px' }}>All Caught Up!</h4>
          <p>No outstanding invoices at this time.</p>
        </div>
      )}
    </div>
  );
};

// All Invoices Tab
const InvoicesTab = ({ invoices, pagination, onUpdateStatus, onAddReceipt, onPrintInvoice, onDeleteInvoice, onPageChange, userRole }) => {
  return (
    <div style={{ padding: '24px' }}>
      {invoices.length > 0 ? (
        <>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Client</th>
                  <th>Task</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td><strong>{invoice.invoice_number}</strong></td>
                    <td>{invoice.client_name}</td>
                    <td>{invoice.task_title || '-'}</td>
                    <td>
                      <div>
                        <strong>{formatCurrency(invoice.total_amount)}</strong>
                        {invoice.received_amount > 0 && (
                          <div style={{ fontSize: '12px', color: '#27ae60' }}>
                            Received: {formatCurrency(invoice.received_amount)}
                          </div>
                        )}
                        {invoice.pending_amount > 0 && (
                          <div style={{ fontSize: '12px', color: '#e74c3c' }}>
                            Pending: {formatCurrency(invoice.pending_amount)}
                          </div>
                        )}
                        {invoice.discount_amount > 0 && (
                          <div style={{ fontSize: '11px', color: '#9b59b6' }}>
                            Discount: {formatCurrency(invoice.discount_amount)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(invoice.status, 'invoice')}`}>
                        {invoice.status.toUpperCase()}
                      </span>
                      {invoice.status === 'partially_paid' && (
                        <div style={{ fontSize: '11px', marginTop: '2px' }}>
                          {Math.round((invoice.received_amount / invoice.total_amount) * 100)}% paid
                        </div>
                      )}
                    </td>
                    <td>{formatDate(invoice.invoice_date)}</td>
                    <td>
                      <div className="action-buttons">
                        {invoice.status !== 'paid' && (
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => onAddReceipt(invoice)}
                            title="Add Receipt"
                          >
                            <i className="fas fa-plus"></i>
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-info"
                          onClick={() => onPrintInvoice(invoice.id)}
                          title="Print Invoice"
                        >
                          <i className="fas fa-print"></i>
                        </button>
                        {userRole === 'admin' && (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => onDeleteInvoice(invoice)}
                            title="Delete Invoice"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.total_pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '20px', gap: '12px' }}>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => onPageChange(pagination.current_page - 1)}
                disabled={pagination.current_page <= 1}
              >
                <i className="fas fa-chevron-left"></i>
                Previous
              </button>
              
              <span style={{ fontSize: '14px', color: '#666' }}>
                Page {pagination.current_page} of {pagination.total_pages} | 
                Showing {invoices.length} of {pagination.total} invoices
              </span>
              
              <button
                className="btn btn-sm btn-outline"
                onClick={() => onPageChange(pagination.current_page + 1)}
                disabled={pagination.current_page >= pagination.total_pages}
              >
                Next
                <i className="fas fa-chevron-right" style={{ marginLeft: '4px' }}></i>
              </button>
            </div>
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          <i className="fas fa-file-invoice" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
          <p>No invoices found matching current filters</p>
        </div>
      )}
    </div>
  );
};

// Payment Receipts Tab
const ReceiptsTab = ({ receipts, onPrintReceipt, onDeleteReceipt, userRole }) => {
  return (
    <div style={{ padding: '24px' }}>
      {receipts.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Amount</th>
                <th>Payment Method</th>
                <th>Date</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td><strong>{receipt.receipt_number}</strong></td>
                  <td>{receipt.invoice_number}</td>
                  <td>{receipt.client_name}</td>
                  <td>
                    <div>
                      <strong>{formatCurrency(receipt.amount)}</strong>
                      {receipt.discount_amount > 0 && (
                        <div style={{ fontSize: '11px', color: '#9b59b6' }}>
                          +Discount: {formatCurrency(receipt.discount_amount)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-info">
                      {receipt.payment_method?.toUpperCase().replace('_', ' ')}
                    </span>
                  </td>
                  <td>{formatDate(receipt.receipt_date)}</td>
                  <td>{receipt.notes || '-'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn btn-sm btn-info"
                        onClick={() => onPrintReceipt(receipt.id)}
                        title="Print Receipt"
                      >
                        <i className="fas fa-print"></i>
                      </button>
                      {userRole === 'admin' && (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => onDeleteReceipt(receipt)}
                          title="Delete Receipt"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          <i className="fas fa-receipt" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
          <p>No payment receipts found</p>
        </div>
      )}
    </div>
  );
};

// Ready for Billing Tasks Tab
const ReadyTasksTab = ({ tasks, onCreateInvoice }) => {
  return (
    <div style={{ padding: '24px' }}>
      {tasks.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Client</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td><strong>{task.title}</strong></td>
                  <td>{task.client_name}</td>
                  <td>{formatCurrency(task.amount)}</td>
                  <td>
                    <span className="badge badge-success">
                      READY FOR BILLING
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => onCreateInvoice(task)}
                    >
                      Create Invoice
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          <i className="fas fa-tasks" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
          <p>No tasks ready for billing</p>
        </div>
      )}
    </div>
  );
};

// Main Billing Management Component
const BillingManagement = () => {
  const [invoices, setInvoices] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [clients, setClients] = useState([]);
  const [readyTasks, setReadyTasks] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('outstanding');
  
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    status: 'all',
    client_id: 'all',
    min_amount: '',
    max_amount: '',
    overdue_only: false,
    sort_by: 'created_at',
    sort_order: 'DESC'
  });
  const [pagination, setPagination] = useState({
    current_page: 1,
    per_page: 20,
    total: 0,
    total_pages: 0
  });
  
  const appContext = useApp();
  const { openModal, closeModal } = appContext;
  const { user } = useAuth();

  const hasAccessToBilling = user && (user.role === 'admin' || user.role === 'senior_ca');

  useEffect(() => {
    if (hasAccessToBilling) {
      fetchData();
      fetchClients();
    } else {
      setLoading(false);
    }
  }, [hasAccessToBilling, filters, activeTab]);

  const fetchData = async () => {
    setLoading(true);
    const token = getAuthToken(appContext);
    
    if (!token) {
      console.error('No auth token available');
      setLoading(false);
      return;
    }

    try {
      const promises = [
        fetchInvoices(),
        fetchReadyTasks(),
        fetchStats(),
        fetchReceipts()
      ];

      await Promise.all(promises);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    const token = getAuthToken(appContext);
    try {
      const queryParams = new URLSearchParams({
        ...filters,
        page: pagination.current_page,
        limit: pagination.per_page
      });

      const response = await fetch(`/api/billing?${queryParams}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      } else {
        console.error('Error fetching invoices');
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  const fetchReadyTasks = async () => {
    const token = getAuthToken(appContext);
    try {
      const response = await fetch('/api/tasks/ready-for-billing', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setReadyTasks(data.tasks || []);
      }
    } catch (error) {
      console.error('Error fetching ready tasks:', error);
    }
  };

  const fetchStats = async () => {
    const token = getAuthToken(appContext);
    try {
      const response = await fetch('/api/billing/stats', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats || {});
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchReceipts = async () => {
    const token = getAuthToken(appContext);
    try {
      const queryParams = new URLSearchParams({
        start_date: filters.start_date,
        end_date: filters.end_date,
        client_id: filters.client_id,
        sort_by: 'receipt_date',
        sort_order: 'DESC'
      });

      const response = await fetch(`/api/billing/receipts?${queryParams}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setReceipts(data.receipts || []);
      }
    } catch (error) {
      console.error('Error fetching receipts:', error);
    }
  };

  const fetchClients = async () => {
    const token = getAuthToken(appContext);
    try {
      const response = await fetch('/api/clients', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, current_page: 1 }));
  };

  const handleQuickFilter = (filterType, value) => {
    const newFilters = { ...filters };
    
    switch (filterType) {
      case 'overdue':
        newFilters.overdue_only = value;
        newFilters.sort_by = 'days_overdue';
        newFilters.sort_order = 'DESC';
        break;
      case 'this_month':
        const now = new Date();
        newFilters.start_date = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        newFilters.end_date = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        break;
      case 'last_month':
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        newFilters.start_date = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).toISOString().split('T')[0];
        newFilters.end_date = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).toISOString().split('T')[0];
        break;
      case 'status':
        newFilters.status = value;
        break;
      case 'clear':
        setFilters({
          start_date: '',
          end_date: '',
          status: 'all',
          client_id: 'all',
          min_amount: '',
          max_amount: '',
          overdue_only: false,
          sort_by: 'created_at',
          sort_order: 'DESC'
        });
        return;
    }
    
    setFilters(newFilters);
  };

  const handleCreateInvoice = (task) => {
    openModal(<InvoiceForm appContext={appContext} task={task} onSuccess={() => { closeModal(); fetchData(); }} />);
  };

  const handleAddReceipt = (invoice) => {
    openModal(<ReceiptForm appContext={appContext} invoice={invoice} onSuccess={() => { closeModal(); fetchData(); }} />);
  };

  const handleUpdateInvoiceStatus = async (invoiceId, status) => {
    const token = getAuthToken(appContext);
    try {
      const response = await fetch(`/api/billing/${invoiceId}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        fetchData();
      } else {
        alert('Error updating invoice status');
      }
    } catch (error) {
      console.error('Error updating invoice:', error);
      alert('Error updating invoice status');
    }
  };

  const handlePrintInvoice = async (invoiceId) => {
    const token = getAuthToken(appContext);
    try {
      const response = await fetch(`/api/billing/invoices/${invoiceId}/print`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${invoiceId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Error generating invoice PDF');
      }
    } catch (error) {
      console.error('Error printing invoice:', error);
      alert('Error printing invoice');
    }
  };

  const handlePrintReceipt = async (receiptId) => {
    const token = getAuthToken(appContext);
    try {
      const response = await fetch(`/api/billing/receipts/${receiptId}/print`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt-${receiptId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Error generating receipt PDF');
      }
    } catch (error) {
      console.error('Error printing receipt:', error);
      alert('Error printing receipt');
    }
  };

  const handleDeleteInvoice = async (invoice) => {
    if (!window.confirm(`Are you sure you want to delete invoice ${invoice.invoice_number}? This will also delete all associated receipts. This action cannot be undone.`)) {
      return;
    }

    const token = getAuthToken(appContext);
    try {
      const response = await fetch(`/api/billing/invoices/${invoice.id}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        fetchData();
      } else {
        const error = await response.json();
        alert(error.message || 'Error deleting invoice');
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Error deleting invoice');
    }
  };

  const handleDeleteReceipt = async (receipt) => {
    if (!window.confirm(`Are you sure you want to delete receipt ${receipt.receipt_number}? This will update the invoice status. This action cannot be undone.`)) {
      return;
    }

    const token = getAuthToken(appContext);
    try {
      const response = await fetch(`/api/billing/receipts/${receipt.id}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        fetchData();
      } else {
        const error = await response.json();
        alert(error.message || 'Error deleting receipt');
      }
    } catch (error) {
      console.error('Error deleting receipt:', error);
      alert('Error deleting receipt');
    }
  };

  const openAdvancedFilters = () => {
    openModal(
      <AdvancedFiltersModal 
        filters={filters} 
        clients={clients}
        onApplyFilters={handleApplyFilters}
        onClose={closeModal}
      />
    );
  };

  if (!hasAccessToBilling) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
        <i className="fas fa-lock" style={{ fontSize: '64px', color: '#e74c3c', marginBottom: '20px' }}></i>
        <h3 style={{ color: '#e74c3c', marginBottom: '16px' }}>Access Restricted</h3>
        <p style={{ color: '#666', fontSize: '16px' }}>
          Billing and revenue information is only accessible to administrators and senior staff members.
        </p>
        <div style={{ marginTop: '20px' }}>
          <a href="/dashboard" className="btn btn-primary">
            <i className="fas fa-home"></i>
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-container" style={{ height: '400px' }}>
        <div className="loading-spinner"></div>
        <p>Loading billing data...</p>
      </div>
    );
  }

  const getFilteredSummary = () => {
    if (activeTab === 'outstanding') {
      const outstandingInvoices = invoices.filter(inv => inv.status !== 'paid');
      const totalOutstanding = outstandingInvoices.reduce((sum, inv) => {
        return sum + parseFloat(inv.pending_amount || inv.total_amount || 0);
      }, 0);
      const overdueCount = outstandingInvoices.filter(inv => inv.days_overdue > 0).length;
      
      return {
        count: outstandingInvoices.length,
        amount: totalOutstanding,
        overdue: overdueCount
      };
    }
    return {
      count: invoices.length,
      amount: invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0),
      overdue: invoices.filter(inv => inv.days_overdue > 0).length
    };
  };

  const filteredSummary = getFilteredSummary();

  return (
    <div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '24px' }}>
        <div className="stat-card" style={{ borderLeftColor: '#3498db' }}>
          <div className="stat-number">{stats.total_invoices || 0}</div>
          <div className="stat-label">Total Invoices</div>
          <i className="fas fa-file-invoice stat-icon"></i>
        </div>
        
        <div className="stat-card" style={{ borderLeftColor: '#f39c12' }}>
          <div className="stat-number">{formatCurrency(stats.pending_amount || 0)}</div>
          <div className="stat-label">Pending Amount</div>
          <i className="fas fa-clock stat-icon"></i>
        </div>
        
        <div className="stat-card" style={{ borderLeftColor: '#27ae60' }}>
          <div className="stat-number">{formatCurrency(stats.paid_amount || 0)}</div>
          <div className="stat-label">Collected Amount</div>
          <i className="fas fa-check-circle stat-icon"></i>
        </div>
        
        <div className="stat-card" style={{ borderLeftColor: '#9b59b6' }}>
          <div className="stat-number">{formatCurrency(stats.period_revenue || 0)}</div>
          <div className="stat-label">Monthly Revenue</div>
          <i className="fas fa-chart-line stat-icon"></i>
        </div>

        <div className="stat-card" style={{ borderLeftColor: '#e74c3c' }}>
          <div className="stat-number">{stats.overdue_invoices || 0}</div>
          <div className="stat-label">Overdue Invoices</div>
          <i className="fas fa-exclamation-triangle stat-icon"></i>
        </div>

        <div className="stat-card" style={{ borderLeftColor: '#1abc9c' }}>
          <div className="stat-number">{stats.collection_rate || 0}%</div>
          <div className="stat-label">Collection Rate</div>
          <i className="fas fa-percentage stat-icon"></i>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #dee2e6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className={`btn btn-sm ${filters.overdue_only ? 'btn-danger' : 'btn-outline-danger'}`}
                onClick={() => handleQuickFilter('overdue', !filters.overdue_only)}
              >
                <i className="fas fa-exclamation-triangle" style={{ marginRight: '4px' }}></i>
                Overdue Only
              </button>
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => handleQuickFilter('this_month', true)}
              >
                <i className="fas fa-calendar" style={{ marginRight: '4px' }}></i>
                This Month
              </button>
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => handleQuickFilter('last_month', true)}
              >
                <i className="fas fa-calendar-minus" style={{ marginRight: '4px' }}></i>
                Last Month
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => handleQuickFilter('clear', true)}
              >
                <i className="fas fa-times" style={{ marginRight: '4px' }}></i>
                Clear All
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#666' }}>
                Showing {filteredSummary.count} invoices | {formatCurrency(filteredSummary.amount)} total
                {filteredSummary.overdue > 0 && (
                  <span style={{ color: '#e74c3c', marginLeft: '8px' }}>
                    | {filteredSummary.overdue} overdue
                  </span>
                )}
              </span>
              <button
                className="btn btn-sm btn-primary"
                onClick={openAdvancedFilters}
              >
                <i className="fas fa-filter" style={{ marginRight: '6px' }}></i>
                Advanced Filters
              </button>
            </div>
          </div>
        </div>

        {(filters.start_date || filters.end_date || filters.status !== 'all' || filters.client_id !== 'all' || filters.min_amount || filters.max_amount) && (
          <div style={{ padding: '12px 16px', background: '#f8f9fa', fontSize: '13px' }}>
            <strong>Active Filters:</strong>
            {filters.start_date && <span className="badge badge-info" style={{ marginLeft: '6px' }}>From: {filters.start_date}</span>}
            {filters.end_date && <span className="badge badge-info" style={{ marginLeft: '6px' }}>To: {filters.end_date}</span>}
            {filters.status !== 'all' && <span className="badge badge-info" style={{ marginLeft: '6px' }}>Status: {filters.status.replace('_', ' ').toUpperCase()}</span>}
            {filters.client_id !== 'all' && (
              <span className="badge badge-info" style={{ marginLeft: '6px' }}>
                Client: {clients.find(c => c.id == filters.client_id)?.name || 'Selected'}
              </span>
            )}
            {filters.min_amount && <span className="badge badge-info" style={{ marginLeft: '6px' }}>Min: ₹{filters.min_amount}</span>}
            {filters.max_amount && <span className="badge badge-info" style={{ marginLeft: '6px' }}>Max: ₹{filters.max_amount}</span>}
            <span className="badge badge-secondary" style={{ marginLeft: '6px' }}>
              Sort: {filters.sort_by.replace('_', ' ')} ({filters.sort_order})
            </span>
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ borderBottom: '1px solid #dee2e6', padding: '0 24px' }}>
          <div style={{ display: 'flex', gap: '0' }}>
            <button
              onClick={() => setActiveTab('outstanding')}
              style={{
                padding: '12px 24px',
                border: 'none',
                background: 'none',
                fontSize: '14px',
                fontWeight: '600',
                color: activeTab === 'outstanding' ? '#3498db' : '#666',
                borderBottom: activeTab === 'outstanding' ? '2px solid #3498db' : '2px solid transparent',
                cursor: 'pointer'
              }}
            >
              <i className="fas fa-exclamation-circle" style={{ marginRight: '8px' }}></i>
              Outstanding ({invoices.filter(inv => inv.status !== 'paid').length})
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              style={{
                padding: '12px 24px',
                border: 'none',
                background: 'none',
                fontSize: '14px',
                fontWeight: '600',
                color: activeTab === 'invoices' ? '#3498db' : '#666',
                borderBottom: activeTab === 'invoices' ? '2px solid #3498db' : '2px solid transparent',
                cursor: 'pointer'
              }}
            >
              <i className="fas fa-file-invoice" style={{ marginRight: '8px' }}></i>
              All Invoices ({pagination.total || invoices.length})
            </button>
            <button
              onClick={() => setActiveTab('receipts')}
              style={{
                padding: '12px 24px',
                border: 'none',
                background: 'none',
                fontSize: '14px',
                fontWeight: '600',
                color: activeTab === 'receipts' ? '#3498db' : '#666',
                borderBottom: activeTab === 'receipts' ? '2px solid #3498db' : '2px solid transparent',
                cursor: 'pointer'
              }}
            >
              <i className="fas fa-receipt" style={{ marginRight: '8px' }}></i>
              Payment Receipts ({receipts.length})
            </button>
            <button
              onClick={() => setActiveTab('ready')}
              style={{
                padding: '12px 24px',
                border: 'none',
                background: 'none',
                fontSize: '14px',
                fontWeight: '600',
                color: activeTab === 'ready' ? '#3498db' : '#666',
                borderBottom: activeTab === 'ready' ? '2px solid #3498db' : '2px solid transparent',
                cursor: 'pointer'
              }}
            >
              <i className="fas fa-plus-circle" style={{ marginRight: '8px' }}></i>
              Ready for Billing ({readyTasks.length})
            </button>
          </div>
        </div>

        {activeTab === 'outstanding' && (
          <OutstandingInvoicesTab 
            invoices={invoices.filter(inv => inv.status !== 'paid')} 
            onUpdateStatus={handleUpdateInvoiceStatus}
            onAddReceipt={handleAddReceipt}
            onPrintInvoice={handlePrintInvoice}
            onDeleteInvoice={handleDeleteInvoice}
            userRole={user?.role}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoicesTab 
            invoices={invoices} 
            pagination={pagination}
            onUpdateStatus={handleUpdateInvoiceStatus}
            onAddReceipt={handleAddReceipt}
            onPrintInvoice={handlePrintInvoice}
            onDeleteInvoice={handleDeleteInvoice}
            onPageChange={(page) => setPagination(prev => ({ ...prev, current_page: page }))}
            userRole={user?.role}
          />
        )}
        
        {activeTab === 'receipts' && (
          <ReceiptsTab 
            receipts={receipts} 
            onPrintReceipt={handlePrintReceipt}
            onDeleteReceipt={handleDeleteReceipt}
            userRole={user?.role}
          />
        )}
        
        {activeTab === 'ready' && (
          <ReadyTasksTab tasks={readyTasks} onCreateInvoice={handleCreateInvoice} />
        )}
      </div>
    </div>
  );
};

export default BillingManagement;