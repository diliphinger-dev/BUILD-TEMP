import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { useNavigate } from 'react-router-dom';
import ChangePasswordModal from '../Profile/ChangePasswordModal';

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
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
    fetchDashboardSettings();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
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
            <h1 style={{ 
              fontSize: '36px', 
              fontWeight: '700', 
              marginBottom: '16px',
              textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
              cursor: 'pointer'
            }} onClick={handleEditName}>
              {dashboardName}
              <i className="fas fa-edit" style={{ 
                fontSize: '18px', 
                marginLeft: '16px',
                opacity: '0.7'
              }}></i>
            </h1>
            <p style={{ 
              fontSize: '18px', 
              opacity: '0.9',
              fontWeight: '300'
            }}>
              Complete Practice Management System
            </p>
          </div>
        )}
      </div>

      {/* Dashboard Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {/* Clients Card */}
        <div className="card" style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
          color: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(52, 152, 219, 0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '14px', opacity: '0.9', marginBottom: '8px' }}>Total Clients</p>
              <h3 style={{ fontSize: '36px', fontWeight: '700', margin: '0' }}>{stats.total_clients}</h3>
            </div>
            <i className="fas fa-users" style={{ fontSize: '48px', opacity: '0.3' }}></i>
          </div>
        </div>

        {/* Staff Card */}
        <div className="card" style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)',
          color: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(155, 89, 182, 0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '14px', opacity: '0.9', marginBottom: '8px' }}>Total Staff</p>
              <h3 style={{ fontSize: '36px', fontWeight: '700', margin: '0' }}>{stats.total_staff}</h3>
            </div>
            <i className="fas fa-user-tie" style={{ fontSize: '48px', opacity: '0.3' }}></i>
          </div>
        </div>

        {/* Active Tasks Card */}
        <div className="card" style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
          color: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(243, 156, 18, 0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '14px', opacity: '0.9', marginBottom: '8px' }}>Active Tasks</p>
              <h3 style={{ fontSize: '36px', fontWeight: '700', margin: '0' }}>{stats.active_tasks}</h3>
            </div>
            <i className="fas fa-tasks" style={{ fontSize: '48px', opacity: '0.3' }}></i>
          </div>
        </div>

        {/* Completed Tasks Card */}
        <div className="card" style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
          color: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(39, 174, 96, 0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '14px', opacity: '0.9', marginBottom: '8px' }}>Completed Tasks</p>
              <h3 style={{ fontSize: '36px', fontWeight: '700', margin: '0' }}>{stats.completed_tasks}</h3>
            </div>
            <i className="fas fa-check-circle" style={{ fontSize: '48px', opacity: '0.3' }}></i>
          </div>
        </div>

        {/* Pending Invoices Card */}
        <div className="card" style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
          color: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(231, 76, 60, 0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '14px', opacity: '0.9', marginBottom: '8px' }}>Pending Invoices</p>
              <h3 style={{ fontSize: '36px', fontWeight: '700', margin: '0' }}>{stats.pending_invoices}</h3>
            </div>
            <i className="fas fa-file-invoice-dollar" style={{ fontSize: '48px', opacity: '0.3' }}></i>
          </div>
        </div>

        {/* Monthly Revenue Card */}
        <div className="card" style={{
          padding: '24px',
          background: 'linear-gradient(135deg, #1abc9c 0%, #16a085 100%)',
          color: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(26, 188, 156, 0.3)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '14px', opacity: '0.9', marginBottom: '8px' }}>Monthly Revenue</p>
              <h3 style={{ fontSize: '28px', fontWeight: '700', margin: '0' }}>₹{stats.monthly_revenue.toLocaleString()}</h3>
            </div>
            <i className="fas fa-chart-line" style={{ fontSize: '48px', opacity: '0.3' }}></i>
          </div>
        </div>
      </div>

      {/* Quick Actions Section - FIXED: Added onClick handlers */}
      <div className="card" style={{ padding: '32px' }}>
        <h2 style={{ 
          fontSize: '24px', 
          fontWeight: '600', 
          color: '#2c3e50',
          marginBottom: '24px',
          borderBottom: '3px solid #3498db',
          paddingBottom: '12px'
        }}>
          <i className="fas fa-bolt" style={{ marginRight: '12px', color: '#f39c12' }}></i>
          Quick Actions
        </h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px'
        }}>
          <button 
            className="btn btn-primary btn-lg" 
            onClick={() => navigate('/clients')}
            style={{ padding: '16px', fontSize: '16px' }}
          >
            <i className="fas fa-plus" style={{ marginRight: '8px' }}></i>
            Add New Client
          </button>
          
          <button 
            className="btn btn-success btn-lg" 
            onClick={() => navigate('/tasks')}
            style={{ padding: '16px', fontSize: '16px' }}
          >
            <i className="fas fa-tasks" style={{ marginRight: '8px' }}></i>
            Create Task
          </button>
          
          <button 
            className="btn btn-warning btn-lg" 
            onClick={() => navigate('/billing')}
            style={{ padding: '16px', fontSize: '16px' }}
          >
            <i className="fas fa-file-invoice" style={{ marginRight: '8px' }}></i>
            Generate Invoice
          </button>
          
          <button 
            className="btn btn-info btn-lg" 
            onClick={() => navigate('/reports')}
            style={{ padding: '16px', fontSize: '16px' }}
          >
            <i className="fas fa-chart-bar" style={{ marginRight: '8px' }}></i>
            View Reports
          </button>

          {user?.role === 'admin' && (
            <button 
              onClick={handleTrialDataCleanup}
              className="btn btn-outline-danger btn-lg" 
              style={{ padding: '16px', fontSize: '16px' }}
            >
              <i className="fas fa-broom" style={{ marginRight: '8px' }}></i>
              Cleanup Trial Data
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Trial Data Cleanup Modal Component
const TrialDataCleanupModal = ({ onSuccess }) => {
  const [loading, setLoading] = useState(false);

  const handleCleanup = async () => {
    if (!window.confirm('Are you sure you want to clean up trial data? This will remove sample data and cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/system/cleanup-trial-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        alert('Trial data cleaned up successfully!');
        onSuccess();
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error cleaning up trial data:', error);
      alert('Error cleaning up trial data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px' }}>
      <div className="modal-header">
        <h3 className="modal-title">
          <i className="fas fa-broom" style={{ marginRight: '8px', color: '#e74c3c' }}></i>
          Cleanup Trial Data
        </h3>
        <button className="btn btn-sm btn-outline" onClick={onSuccess}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="modal-body">
        <div style={{ 
          background: '#fff3cd', 
          color: '#856404',
          padding: '16px', 
          borderRadius: '8px',
          fontSize: '14px',
          marginBottom: '20px'
        }}>
          <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }}></i>
          <strong>Warning:</strong> This will permanently remove all trial/sample data including:
          <ul style={{ margin: '8px 0 0 20px' }}>
            <li>Sample clients and tasks</li>
            <li>Test invoices and billing data</li>
            <li>Demo attendance records</li>
            <li>Sample staff members (except admin)</li>
          </ul>
        </div>

        <p>This action cannot be undone. Are you sure you want to proceed?</p>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onSuccess}>
          Cancel
        </button>
        <button 
          type="button" 
          className="btn btn-danger" 
          onClick={handleCleanup}
          disabled={loading}
        >
          {loading ? (
            <>
              <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
              Cleaning...
            </>
          ) : (
            <>
              <i className="fas fa-broom" style={{ marginRight: '8px' }}></i>
              Cleanup Trial Data
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Dashboard;