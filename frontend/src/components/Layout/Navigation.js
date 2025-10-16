import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const Navigation = () => {
  const { user, logout } = useAuth();
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [selectedFirm, setSelectedFirm] = useState(null);

  useEffect(() => {
    fetchMonthlyRevenue();
    fetchSelectedFirm();
    
    // Listen for firm changes from FirmManagement component
    const handleFirmChange = (event) => {
      setSelectedFirm(event.detail);
    };
    
    window.addEventListener('firmChanged', handleFirmChange);
    
    return () => {
      window.removeEventListener('firmChanged', handleFirmChange);
    };
  }, []);

  const fetchMonthlyRevenue = async () => {
    try {
      const response = await fetch('/api/dashboard/stats');
      if (response.ok) {
        const data = await response.json();
        setMonthlyRevenue(data.stats.monthly_revenue || 0);
      }
    } catch (error) {
      console.error('Error fetching monthly revenue:', error);
      setMonthlyRevenue(125000); // Demo fallback
    }
  };

  // REPLACE entire fetchSelectedFirm function:
const fetchSelectedFirm = async () => {
  try {
    const token = localStorage.getItem('ca_auth_token') || localStorage.getItem('token');
    const response = await fetch('/api/firms/selected', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (response.ok) {
      const data = await response.json();
      setSelectedFirm(data.firm || data.data);
    }
  } catch (error) {
    console.error('Error fetching selected firm:', error);
    // REMOVED: Default firm fallback
  }
};

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  return (
    <nav style={{
      background: 'white',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      padding: '16px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid #e1e8ed',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ 
          fontSize: '24px', 
          fontWeight: '700', 
          background: 'linear-gradient(135deg, #3498db, #2c3e50)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <i className="fas fa-building"></i>
          Enhanced CA Office Pro
        </div>

        {/* NEW: Selected Firm Display - Added to existing header */}
        {selectedFirm && selectedFirm.id && (
          <div style={{
            background: 'linear-gradient(135deg, #8e44ad, #9b59b6)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginLeft: '12px',
            border: '1px solid rgba(142, 68, 173, 0.2)'
          }}>
            <i className="fas fa-star" style={{ color: '#f39c12' }}></i>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
              <span style={{ fontSize: '13px', fontWeight: '700' }}>
                {selectedFirm.name || selectedFirm.firm_name}
              </span>
              <span style={{ fontSize: '11px', opacity: '0.9' }}>
                {selectedFirm.code || selectedFirm.firm_code}
              </span>
            </div>
          </div>
        )}

        {/* Monthly Revenue Display - Only visible to admin and senior staff */}
        {user && (user.role === 'admin' || user.role === 'senior_ca') && (
          <div style={{
            background: 'linear-gradient(135deg, #27ae60, #2ecc71)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginLeft: '20px'
          }}>
            <i className="fas fa-chart-line"></i>
            Monthly Revenue: {formatCurrency(monthlyRevenue)}
          </div>
        )}
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ fontSize: '14px', color: '#666' }}>
          Welcome, <strong>{user?.name}</strong>
          {user?.role && (
            <span style={{ 
              marginLeft: '8px', 
              padding: '2px 8px', 
              background: '#f8f9fa', 
              borderRadius: '12px', 
              fontSize: '12px',
              textTransform: 'capitalize'
            }}>
              {user.role.replace('_', ' ')}
            </span>
          )}
        </div>
        <button 
          className="btn btn-danger btn-sm"
          onClick={logout}
        >
          <i className="fas fa-sign-out-alt"></i>
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navigation;