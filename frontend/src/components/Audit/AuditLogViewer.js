import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../utils/helpers';

// PHASE 3: Audit Logs Management Component
const AuditLogs = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [staff, setStaff] = useState([]);
  const [stats, setStats] = useState({});
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('logs');
  const [filters, setFilters] = useState({
    user_id: 'all',
    action: 'all',
    entity_type: 'all',
    start_date: '',
    end_date: '',
    severity: 'all',
    search_term: '',
    page: 1,
    limit: 50
  });
  const [pagination, setPagination] = useState({
    current_page: 1,
    per_page: 50,
    total: 0,
    total_pages: 0
  });

  const { user } = useAuth();

  // Check if user has admin access
  const hasAdminAccess = user && user.role === 'admin';

  useEffect(() => {
    if (hasAdminAccess) {
      fetchStaff();
      fetchStats();
      fetchSecurityAlerts();
      if (activeTab === 'logs') {
        fetchAuditLogs();
      }
    } else {
      setLoading(false);
    }
  }, [hasAdminAccess, filters, activeTab]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams(filters);
      const response = await fetch(`/api/admin/audit-logs?${queryParams}`);
      
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.audit_logs || []);
        setPagination(data.pagination || {});
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await fetch('/api/staff');
      if (response.ok) {
        const data = await response.json();
        setStaff(data.staff || []);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/audit/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats || {});
      }
    } catch (error) {
      console.error('Error fetching audit stats:', error);
    }
  };

  const fetchSecurityAlerts = async () => {
    try {
      const response = await fetch('/api/admin/security-alerts');
      if (response.ok) {
        const data = await response.json();
        setSecurityAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Error fetching security alerts:', error);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value, page: 1 }));
  };

  const handleExportLogs = async (format = 'csv') => {
    try {
      const queryParams = new URLSearchParams({
        format,
        start_date: filters.start_date,
        end_date: filters.end_date,
        user_id: filters.user_id,
        action: filters.action,
        entity_type: filters.entity_type
      });

      const response = await fetch(`/api/admin/audit-logs/export?${queryParams}`);
      
      if (response.ok) {
        if (format === 'csv') {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          const data = await response.json();
          console.log('Export data:', data);
        }
      }
    } catch (error) {
      console.error('Error exporting logs:', error);
      alert('Error exporting audit logs');
    }
  };

  const clearFilters = () => {
    setFilters({
      user_id: 'all',
      action: 'all',
      entity_type: 'all',
      start_date: '',
      end_date: '',
      severity: 'all',
      search_term: '',
      page: 1,
      limit: 50
    });
  };

  if (!hasAdminAccess) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
        <i className="fas fa-lock" style={{ fontSize: '64px', color: '#e74c3c', marginBottom: '20px' }}></i>
        <h3 style={{ color: '#e74c3c', marginBottom: '16px' }}>Admin Access Required</h3>
        <p style={{ color: '#666', fontSize: '16px' }}>
          Audit logs and system monitoring are only accessible to system administrators.
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

  return (
    <div>
      {/* Security Alerts Banner */}
      {securityAlerts.length > 0 && securityAlerts.filter(a => a.severity === 'high').length > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
          <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }}></i>
          <strong>Security Alert:</strong> {securityAlerts.filter(a => a.severity === 'high').length} high-priority security events require attention.
          <button 
            className="btn btn-sm btn-outline-danger" 
            style={{ marginLeft: '12px' }}
            onClick={() => setActiveTab('security')}
          >
            View Alerts
          </button>
        </div>
      )}

      {/* Statistics Cards */}
      {stats.overall && (
        <div className="stats-grid" style={{ marginBottom: '24px' }}>
          <div className="stat-card" style={{ borderLeftColor: '#3498db' }}>
            <div className="stat-number">{stats.overall.total_events}</div>
            <div className="stat-label">Total Events (30d)</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#27ae60' }}>
            <div className="stat-number">{stats.overall.active_users}</div>
            <div className="stat-label">Active Users</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#f39c12' }}>
            <div className="stat-number">{stats.by_action?.length || 0}</div>
            <div className="stat-label">Action Types</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#e74c3c' }}>
            <div className="stat-number">{securityAlerts.filter(a => a.action_required).length}</div>
            <div className="stat-label">Security Alerts</div>
          </div>
        </div>
      )}

      {/* Main Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <i className="fas fa-shield-alt"></i>
            System Audit & Security
          </h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn btn-success btn-sm"
              onClick={() => handleExportLogs('csv')}
            >
              <i className="fas fa-download"></i>
              Export CSV
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ borderBottom: '1px solid #dee2e6' }}>
          <div style={{ display: 'flex', gap: '0', padding: '0 24px' }}>
            {[
              { key: 'logs', label: 'Audit Logs', icon: 'fas fa-list' },
              { key: 'security', label: 'Security Alerts', icon: 'fas fa-exclamation-triangle' },
              { key: 'analytics', label: 'Analytics', icon: 'fas fa-chart-line' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '16px 24px',
                  border: 'none',
                  background: 'none',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: activeTab === tab.key ? '#3498db' : '#666',
                  borderBottom: activeTab === tab.key ? '3px solid #3498db' : '3px solid transparent',
                  cursor: 'pointer'
                }}
              >
                <i className={tab.icon} style={{ marginRight: '8px' }}></i>
                {tab.label}
                {tab.key === 'security' && securityAlerts.filter(a => a.severity === 'high').length > 0 && (
                  <span className="badge badge-danger" style={{ marginLeft: '6px', fontSize: '10px' }}>
                    {securityAlerts.filter(a => a.severity === 'high').length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'logs' && (
          <AuditLogsTab 
            auditLogs={auditLogs}
            staff={staff}
            filters={filters}
            pagination={pagination}
            loading={loading}
            onFilterChange={handleFilterChange}
            onClearFilters={clearFilters}
            onPageChange={(page) => setFilters(prev => ({ ...prev, page }))}
          />
        )}

        {activeTab === 'security' && (
          <SecurityAlertsTab 
            alerts={securityAlerts}
            onRefresh={fetchSecurityAlerts}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab 
            stats={stats}
          />
        )}
      </div>
    </div>
  );
};

// PHASE 3: Audit Logs Tab Component
const AuditLogsTab = ({ auditLogs, staff, filters, pagination, loading, onFilterChange, onClearFilters, onPageChange }) => {
  return (
    <div style={{ padding: '24px' }}>
      {/* Filters */}
      <div className="row mb-3">
        <div className="col-2">
          <label className="form-label">User</label>
          <select
            className="form-control form-select"
            value={filters.user_id}
            onChange={(e) => onFilterChange('user_id', e.target.value)}
          >
            <option value="all">All Users</option>
            {staff.map(member => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-2">
          <label className="form-label">Action</label>
          <select
            className="form-control form-select"
            value={filters.action}
            onChange={(e) => onFilterChange('action', e.target.value)}
          >
            <option value="all">All Actions</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="LOGIN">Login</option>
            <option value="LOGIN_FAILED">Login Failed</option>
            <option value="EXPORT">Export</option>
            <option value="BULK_IMPORT">Bulk Import</option>
          </select>
        </div>
        <div className="col-2">
          <label className="form-label">Entity Type</label>
          <select
            className="form-control form-select"
            value={filters.entity_type}
            onChange={(e) => onFilterChange('entity_type', e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="task">Tasks</option>
            <option value="client">Clients</option>
            <option value="staff">Staff</option>
            <option value="invoice">Invoices</option>
            <option value="attendance">Attendance</option>
            <option value="system">System</option>
          </select>
        </div>
        <div className="col-2">
          <label className="form-label">Start Date</label>
          <input
            type="date"
            className="form-control"
            value={filters.start_date}
            onChange={(e) => onFilterChange('start_date', e.target.value)}
          />
        </div>
        <div className="col-2">
          <label className="form-label">End Date</label>
          <input
            type="date"
            className="form-control"
            value={filters.end_date}
            onChange={(e) => onFilterChange('end_date', e.target.value)}
          />
        </div>
        <div className="col-2" style={{ display: 'flex', alignItems: 'end', gap: '8px' }}>
          <button className="btn btn-outline-secondary" onClick={onClearFilters}>
            <i className="fas fa-times"></i>
            Clear
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="row mb-3">
        <div className="col-4">
          <input
            type="text"
            className="form-control"
            placeholder="Search by user, action, IP address..."
            value={filters.search_term}
            onChange={(e) => onFilterChange('search_term', e.target.value)}
          />
        </div>
        <div className="col-2">
          <select
            className="form-control form-select"
            value={filters.severity}
            onChange={(e) => onFilterChange('severity', e.target.value)}
          >
            <option value="all">All Severity</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="loading-spinner"></div>
          <p>Loading audit logs...</p>
        </div>
      ) : auditLogs.length > 0 ? (
        <>
          <div className="table-container">
            <table className="table" style={{ fontSize: '13px' }}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>IP Address</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} style={{ 
                    background: getActionColor(log.action),
                    borderLeft: `4px solid ${getActionBorderColor(log.action)}`
                  }}>
                    <td>
                      <div style={{ fontSize: '12px' }}>
                        {formatDate(log.created_at)}
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong>{log.user_name || 'System'}</strong>
                        {log.user_email && (
                          <div style={{ fontSize: '11px', color: '#666' }}>
                            {log.user_email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${getActionBadgeClass(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <div>
                        <strong>{log.entity_type}</strong>
                        {log.entity_name && (
                          <div style={{ fontSize: '11px', color: '#666' }}>
                            {log.entity_name}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{log.ip_address || '-'}</td>
                    <td>
                      {log.new_values && (
                        <details style={{ fontSize: '11px' }}>
                          <summary style={{ cursor: 'pointer', color: '#007bff' }}>
                            View Changes
                          </summary>
                          <pre style={{ 
                            background: '#f8f9fa', 
                            padding: '8px', 
                            borderRadius: '4px',
                            marginTop: '4px',
                            maxHeight: '150px',
                            overflow: 'auto',
                            fontSize: '10px'
                          }}>
                            {JSON.stringify(JSON.parse(log.new_values), null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
                Showing {auditLogs.length} of {pagination.total} logs
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
          <i className="fas fa-search" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
          <p>No audit logs found matching current filters</p>
        </div>
      )}
    </div>
  );
};

// PHASE 3: Security Alerts Tab Component
const SecurityAlertsTab = ({ alerts, onRefresh }) => {
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h5 style={{ margin: 0 }}>Security Alerts & Monitoring</h5>
        <button className="btn btn-primary btn-sm" onClick={onRefresh}>
          <i className="fas fa-sync-alt"></i>
          Refresh
        </button>
      </div>

      {alerts.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {alerts.map((alert, index) => (
            <div 
              key={index}
              className="alert"
              style={{
                background: getAlertBackground(alert.severity),
                border: `1px solid ${getAlertBorder(alert.severity)}`,
                borderRadius: '8px',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <i className={getAlertIcon(alert.type, alert.severity)} style={{ 
                      marginRight: '8px', 
                      color: getAlertColor(alert.severity),
                      fontSize: '16px'
                    }}></i>
                    <strong style={{ color: getAlertColor(alert.severity) }}>
                      {alert.title}
                    </strong>
                    <span className={`badge badge-${alert.severity === 'high' ? 'danger' : alert.severity === 'medium' ? 'warning' : 'info'}`} 
                          style={{ marginLeft: '8px', fontSize: '10px' }}>
                      {alert.severity.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
                    {alert.message}
                  </p>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    <i className="fas fa-clock" style={{ marginRight: '4px' }}></i>
                    {formatDate(alert.timestamp)}
                  </div>
                </div>
                {alert.action_required && (
                  <div>
                    <span className="badge badge-warning">
                      Action Required
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: '#27ae60' }}>
          <i className="fas fa-shield-alt" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
          <h4>All Systems Secure</h4>
          <p>No security alerts at this time.</p>
        </div>
      )}
    </div>
  );
};

// PHASE 3: Analytics Tab Component
const AnalyticsTab = ({ stats }) => {
  return (
    <div style={{ padding: '24px' }}>
      <h5 style={{ marginBottom: '20px' }}>System Activity Analytics</h5>

      {/* Top Actions */}
      {stats.by_action && stats.by_action.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h6>Most Frequent Actions</h6>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Count</th>
                  <th>Unique Users</th>
                </tr>
              </thead>
              <tbody>
                {stats.by_action.slice(0, 10).map((action, index) => (
                  <tr key={index}>
                    <td>
                      <span className={`badge badge-${getActionBadgeClass(action.action)}`}>
                        {action.action}
                      </span>
                    </td>
                    <td>{action.count}</td>
                    <td>{action.unique_users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Users */}
      {stats.top_users && stats.top_users.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h6>Most Active Users</h6>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Activity Count</th>
                  <th>Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {stats.top_users.slice(0, 10).map((user, index) => (
                  <tr key={index}>
                    <td><strong>{user.name}</strong></td>
                    <td>{user.email}</td>
                    <td>{user.activity_count}</td>
                    <td>{formatDate(user.last_activity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily Activity Trend */}
      {stats.daily_trend && stats.daily_trend.length > 0 && (
        <div>
          <h6>Daily Activity Trend (Last 7 Days)</h6>
          <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px' }}>
            {stats.daily_trend.map((day, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>{formatDate(day.activity_date)}</span>
                <div>
                  <span style={{ marginRight: '16px' }}>{day.event_count} events</span>
                  <span style={{ color: '#666' }}>{day.unique_users} users</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper functions
const getActionColor = (action) => {
  switch (action) {
    case 'DELETE': return '#fff5f5';
    case 'LOGIN_FAILED': return '#fff5f5';
    case 'CREATE': return '#f0fff4';
    case 'UPDATE': return '#fff8dc';
    default: return 'white';
  }
};

const getActionBorderColor = (action) => {
  switch (action) {
    case 'DELETE': return '#e74c3c';
    case 'LOGIN_FAILED': return '#e74c3c';
    case 'CREATE': return '#27ae60';
    case 'UPDATE': return '#f39c12';
    default: return '#dee2e6';
  }
};

const getActionBadgeClass = (action) => {
  switch (action) {
    case 'CREATE': return 'success';
    case 'UPDATE': return 'warning';
    case 'DELETE': return 'danger';
    case 'LOGIN': return 'info';
    case 'LOGIN_FAILED': return 'danger';
    case 'EXPORT': return 'primary';
    default: return 'secondary';
  }
};

const getAlertBackground = (severity) => {
  switch (severity) {
    case 'high': return '#fff5f5';
    case 'medium': return '#fff8e1';
    case 'low': return '#f3f4f6';
    default: return '#f8f9fa';
  }
};

const getAlertBorder = (severity) => {
  switch (severity) {
    case 'high': return '#fee2e2';
    case 'medium': return '#fef3c7';
    case 'low': return '#e5e7eb';
    default: return '#e1e8ed';
  }
};

const getAlertColor = (severity) => {
  switch (severity) {
    case 'high': return '#dc2626';
    case 'medium': return '#d97706';
    case 'low': return '#6b7280';
    default: return '#374151';
  }
};

const getAlertIcon = (type, severity) => {
  if (type === 'security') {
    return severity === 'high' ? 'fas fa-exclamation-triangle' : 'fas fa-shield-alt';
  }
  return 'fas fa-info-circle';
};

export default AuditLogs;