import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const ReportsManagement = () => {
  const { user } = useAuth();
  const [activeReport, setActiveReport] = useState('tasks');
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    format: 'excel'
  });
  const [loading, setLoading] = useState(false);

  const hasAccess = user && ['admin', 'senior_ca'].includes(user.role);

  const handleExportReport = async (reportType) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        format: filters.format,
        start_date: filters.start_date,
        end_date: filters.end_date
      });

      const response = await fetch(`/api/reports/${reportType}?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ca_auth_token')}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = filters.format === 'pdf' ? 'pdf' : 'xlsx';
        a.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.${ext}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Error generating report');
      }
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('Error exporting report');
    } finally {
      setLoading(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
        <i className="fas fa-lock" style={{ fontSize: '64px', color: '#e74c3c', marginBottom: '20px' }}></i>
        <h3 style={{ color: '#e74c3c', marginBottom: '16px' }}>Access Restricted</h3>
        <p style={{ color: '#666', fontSize: '16px' }}>
          Reports & Analytics are only accessible to administrators and senior CAs.
        </p>
      </div>
    );
  }

  const reports = [
    { 
      key: 'tasks', 
      label: 'Tasks Report', 
      icon: 'fas fa-tasks', 
      color: '#f39c12',
      description: 'Export all task data with status, assignments, and completion details'
    },
    { 
      key: 'billing', 
      label: 'Billing Report', 
      icon: 'fas fa-file-invoice-dollar', 
      color: '#e74c3c',
      description: 'Export invoices, receipts, and payment information'
    },
    { 
      key: 'attendance', 
      label: 'Attendance Report', 
      icon: 'fas fa-user-clock', 
      color: '#17a2b8',
      description: 'Export staff attendance records and statistics'
    },
    { 
      key: 'clients', 
      label: 'Clients Report', 
      icon: 'fas fa-users', 
      color: '#27ae60',
      description: 'Export client information and transaction history'
    }
  ];

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <i className="fas fa-chart-bar"></i>
            Business Reports & Analytics
          </h3>
        </div>

        <div style={{ padding: '24px' }}>
          {/* Date Range Filters */}
          <div className="row mb-4">
            <div className="col-3">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-control"
                value={filters.start_date}
                onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            <div className="col-3">
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-control"
                value={filters.end_date}
                onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
            <div className="col-3">
              <label className="form-label">Export Format</label>
              <select
                className="form-control form-select"
                value={filters.format}
                onChange={(e) => setFilters(prev => ({ ...prev, format: e.target.value }))}
              >
                <option value="excel">Excel (.xlsx)</option>
                <option value="pdf">PDF (.pdf)</option>
              </select>
            </div>
          </div>

          {/* Report Cards Grid */}
          <div className="row">
            {reports.map((report) => (
              <div key={report.key} className="col-6 mb-4">
                <div 
                  className="card" 
                  style={{ 
                    border: `2px solid ${report.color}20`,
                    borderLeft: `4px solid ${report.color}`,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
                      <div 
                        style={{ 
                          width: '48px', 
                          height: '48px', 
                          borderRadius: '8px',
                          background: `${report.color}20`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: '16px'
                        }}
                      >
                        <i className={report.icon} style={{ fontSize: '24px', color: report.color }}></i>
                      </div>
                      <div>
                        <h5 style={{ margin: 0, color: '#2c3e50' }}>{report.label}</h5>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#666' }}>
                          {report.description}
                        </p>
                      </div>
                    </div>

                    <button
                      className="btn btn-primary"
                      style={{ background: report.color, borderColor: report.color, width: '100%' }}
                      onClick={() => handleExportReport(report.key)}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i>
                          Generating...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-download"></i>
                          Export {filters.format === 'pdf' ? 'PDF' : 'Excel'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Info Box */}
          <div className="alert alert-info" style={{ marginTop: '24px' }}>
            <i className="fas fa-info-circle" style={{ marginRight: '8px' }}></i>
            <strong>Tip:</strong> Select a date range to filter reports, or leave blank to export all data. 
            Reports include detailed information and statistics for the selected period.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsManagement;