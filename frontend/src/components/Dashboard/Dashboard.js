import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';

const Dashboard = () => {
  const [stats, setStats] = useState({
    total_clients: 0,
    total_staff: 0,
    active_tasks: 0,
    completed_tasks: 0,
    pending_invoices: 0,
    monthly_revenue: 0
  });
  const [dashboardName, setDashboardName] = useState('Enhanced CA Office Pro');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { openModal, closeModal } = useApp();

  useEffect(() => {
    fetchDashboardData();
    fetchDashboardSettings();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Pass user role and ID for filtering
      const params = new URLSearchParams();
      if (user?.role) params.append('role', user.role);
      if (user?.id) params.append('userId', user.id);

      const response = await fetch(`/api/dashboard/stats?${params}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Use sample data for demo
      setStats({
        total_clients: 25,
        total_staff: 8,
        active_tasks: 15,
        completed_tasks: 45,
        pending_invoices: 8,
        monthly_revenue: 125000
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardSettings = async () => {
    try {
      const response = await fetch('/api/dashboard/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.settings.dashboard_name) {
          setDashboardName(data.settings.dashboard_name);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard settings:', error);
    }
  };

  const handleEditName = () => {
    setTempName(dashboardName);
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    try {
      const response = await fetch('/api/dashboard/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboard_name: tempName })
      });

      if (response.ok) {
        setDashboardName(tempName);
        setIsEditingName(false);
      } else {
        alert('Error updating dashboard name');
      }
    } catch (error) {
      console.error('Error saving dashboard name:', error);
      alert('Error updating dashboard name');
    }
  };

  const handleCancelEdit = () => {
    setTempName('');
    setIsEditingName(false);
  };

  const handleTrialDataCleanup = () => {
    openModal(<TrialDataCleanupModal onSuccess={closeModal} />);
  };

  if (loading) {
    return (
      <div className="loading-container" style={{ height: '400px' }}>
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Editable Dashboard Header */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
        color: 'white',
        textAlign: 'center',
        marginBottom: '32px',
        padding: '32px'
      }}>
        {isEditingName ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              style={{
                fontSize: '24px',
                fontWeight: '700',
                background: 'rgba(255,255,255,0.1)',
                border: '2px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                color: 'white',
                padding: '8px 16px',
                textAlign: 'center',
                maxWidth: '400px'
              }}
              placeholder="Enter dashboard name"
              onKeyPress={(e) => e.key === 'Enter' && handleSaveName()}
            />
            <button 
              onClick={handleSaveName}
              style={{
                background: '#27ae60',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                padding: '8px 12px',
                cursor: 'pointer'
              }}
            >
              <i className="fas fa-check"></i>
            </button>
            <button 
              onClick={handleCancelEdit}
              style={{
                background: '#e74c3c',
                border: 'none',
                borderRadius: '6px',
                color: 'white',
                padding: '8px 12px',
                cursor: 'pointer'
              }}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <h1 style={{ fontSize: '28px', fontWeight: '700', margin: '0' }}>
                {dashboardName}
              </h1>
              {user?.role === 'admin' && (
                <button 
                  onClick={handleEditName}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '6px',
                    color: 'white',
                    padding: '6px 10px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                  title="Edit dashboard name"
                >
                  <i className="fas fa-edit"></i>
                </button>
              )}
            </div>
            <p style={{ fontSize: '16px', opacity: '0.9', margin: '8px 0 0 0' }}>
              Complete professional practice management system
            </p>
          </div>
        )}
      </div>

      {/* Stats Grid - Role-based display */}
      <div className="stats-grid" style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div className="stat-card" style={{ 
          borderLeftColor: '#3498db',
          padding: '16px',
          minHeight: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#2c3e50', marginBottom: '4px' }}>
                {stats.active_tasks}
              </div>
              <div style={{ fontSize: '13px', color: '#7f8c8d', fontWeight: '500' }}>
                {user?.role && !['admin', 'senior_ca'].includes(user.role) ? 'Your Active Tasks' : 'Active Tasks'}
              </div>
            </div>
            <i className="fas fa-tasks" style={{ fontSize: '20px', color: '#f39c12', opacity: '0.7' }}></i>
          </div>
        </div>
        
        <div className="stat-card" style={{ 
          borderLeftColor: '#27ae60',
          padding: '16px',
          minHeight: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#2c3e50', marginBottom: '4px' }}>
                {stats.completed_tasks}
              </div>
              <div style={{ fontSize: '13px', color: '#7f8c8d', fontWeight: '500' }}>
                {user?.role && !['admin', 'senior_ca'].includes(user.role) ? 'Your Completed Tasks' : 'Completed Tasks'}
              </div>
            </div>
            <i className="fas fa-check-circle" style={{ fontSize: '20px', color: '#27ae60', opacity: '0.7' }}></i>
          </div>
        </div>
        
        {(user?.role === 'admin' || user?.role === 'senior_ca') && (
          <div className="stat-card" style={{ 
            borderLeftColor: '#e74c3c',
            padding: '16px',
            minHeight: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#2c3e50', marginBottom: '4px' }}>
                  {stats.pending_invoices}
                </div>
                <div style={{ fontSize: '13px', color: '#7f8c8d', fontWeight: '500' }}>
                  Pending Invoices
                </div>
              </div>
              <i className="fas fa-file-invoice" style={{ fontSize: '20px', color: '#e74c3c', opacity: '0.7' }}></i>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions Section */}
      <div className="row" style={{ gap: '20px' }}>
        <div className="col-2">
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-rocket" style={{ color: '#3498db' }}></i>
                Quick Actions
              </h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {user?.role !== 'staff' && (
                <a href="/clients" className="btn btn-primary btn-sm" style={{ padding: '8px 12px', fontSize: '13px' }}>
                  <i className="fas fa-user-plus" style={{ marginRight: '6px' }}></i>
                  Add New Client
                </a>
              )}
              <a href="/tasks" className="btn btn-success btn-sm" style={{ padding: '8px 12px', fontSize: '13px' }}>
                <i className="fas fa-plus-circle" style={{ marginRight: '6px' }}></i>
                Create Task
              </a>
              {user?.role === 'admin' && (
                <>
                  <a href="/staff" className="btn btn-info btn-sm" style={{ padding: '8px 12px', fontSize: '13px' }}>
                    <i className="fas fa-user-tie" style={{ marginRight: '6px' }}></i>
                    Manage Staff
                  </a>
                  <button 
                    onClick={handleTrialDataCleanup}
                    className="btn btn-warning btn-sm" 
                    style={{ padding: '8px 12px', fontSize: '13px' }}
                  >
                    <i className="fas fa-broom" style={{ marginRight: '6px' }}></i>
                    Clear Trial Data
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="col-2">
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fas fa-user-circle" style={{ color: '#9b59b6' }}></i>
                Welcome, {user?.name}
              </h3>
            </div>
            
            <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.5' }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>Role:</strong> {user?.role?.replace('_', ' ').toUpperCase()}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Status:</strong> <span style={{ color: '#27ae60' }}>Active</span>
              </div>
              {user?.role && !['admin', 'senior_ca'].includes(user.role) && (
                <div style={{ 
                  background: '#e3f2fd', 
                  color: '#1565c0', 
                  padding: '8px', 
                  borderRadius: '6px', 
                  fontSize: '12px',
                  marginTop: '12px'
                }}>
                  <i className="fas fa-info-circle" style={{ marginRight: '4px' }}></i>
                  You can only see tasks assigned to you
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Trial Data Cleanup Modal Component
const TrialDataCleanupModal = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [trialData, setTrialData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    fetchTrialData();
  }, []);

  const fetchTrialData = async () => {
    try {
      const response = await fetch('/api/admin/trial-data?role=admin');
      if (response.ok) {
        const data = await response.json();
        setTrialData(data);
      }
    } catch (error) {
      console.error('Error fetching trial data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleCleanup = async () => {
    if (!window.confirm('Are you sure you want to delete all trial/demo data? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/trial-data?role=admin', {
        method: 'DELETE'
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        onSuccess();
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error cleaning trial data:', error);
      alert('Error cleaning trial data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="modal-header">
        <h3 className="modal-title">
          <i className="fas fa-exclamation-triangle" style={{ color: '#f39c12', marginRight: '8px' }}></i>
          Clean Trial Data
        </h3>
        <button className="btn btn-sm btn-outline" onClick={onSuccess}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      
      <div className="modal-body">
        {loadingData ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div className="loading-spinner" style={{ width: '30px', height: '30px', marginBottom: '10px' }}></div>
            <p>Loading trial data information...</p>
          </div>
        ) : (
          <div>
            <div style={{ 
              background: '#fff3cd', 
              color: '#856404', 
              padding: '16px', 
              borderRadius: '8px', 
              marginBottom: '20px',
              border: '1px solid #ffeaa7'
            }}>
              <h5 style={{ marginBottom: '8px' }}>
                <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }}></i>
                Warning
              </h5>
              <p style={{ fontSize: '14px', lineHeight: '1.4', marginBottom: '0' }}>
                This will permanently delete all demo/trial data from your system. 
                This includes sample clients, staff, tasks, invoices, and receipts. 
                This action cannot be undone.
              </p>
            </div>

            {trialData && trialData.total_records > 0 ? (
              <div>
                <h5 style={{ marginBottom: '12px' }}>Trial Data Summary:</h5>
                <div style={{ 
                  background: '#f8f9fa', 
                  padding: '16px', 
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                    {trialData.summary.map(item => (
                      <div key={item.table_name} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ textTransform: 'capitalize' }}>{item.table_name}:</span>
                        <strong>{item.count} records</strong>
                      </div>
                    ))}
                  </div>
                  <div style={{ 
                    borderTop: '1px solid #dee2e6', 
                    marginTop: '12px', 
                    paddingTop: '12px',
                    display: 'flex', 
                    justifyContent: 'space-between',
                    fontSize: '15px',
                    fontWeight: '600'
                  }}>
                    <span>Total Records:</span>
                    <span>{trialData.total_records}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                <i className="fas fa-check-circle" style={{ fontSize: '48px', color: '#27ae60', marginBottom: '16px' }}></i>
                <p>No trial data found in the system.</p>
              </div>
            )}

            <div style={{ 
              background: '#d4edda', 
              color: '#155724', 
              padding: '12px', 
              borderRadius: '8px',
              fontSize: '14px'
            }}>
              <i className="fas fa-lightbulb" style={{ marginRight: '8px' }}></i>
              <strong>Recommendation:</strong> Clean trial data before starting regular office operations 
              to ensure your reports and analytics reflect actual business data.
            </div>
          </div>
        )}
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onSuccess}>
          Cancel
        </button>
        {trialData && trialData.total_records > 0 && (
          <button 
            type="button" 
            className="btn btn-danger" 
            onClick={handleCleanup}
            disabled={loading || loadingData}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                Cleaning...
              </>
            ) : (
              <>
                <i className="fas fa-trash" style={{ marginRight: '8px' }}></i>
                Delete All Trial Data
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
  
export default Dashboard;