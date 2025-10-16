import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import ChangePasswordModal from '../Profile/ChangePasswordModal';

const Sidebar = () => {
  const location = useLocation();
  const { user, selectedFirm } = useAuth();
  const { openModal, closeModal } = useApp();

  // Define menu items with role-based access and firm management - ADDED FIRM MANAGEMENT
  const menuItems = [
    { path: '/', icon: 'fas fa-tachometer-alt', label: 'Dashboard', color: '#3498db', roles: ['admin', 'senior_ca', 'junior_ca', 'assistant', 'intern'] },
    
    // NEW: Added Firm Management to your existing menu structure
    { path: '/firms', icon: 'fas fa-building', label: 'Firm Management', color: '#8e44ad', roles: ['admin'], isNew: true },
    
    { path: '/clients', icon: 'fas fa-users', label: 'Client Management', color: '#27ae60', roles: ['admin', 'senior_ca', 'junior_ca'] },
    { path: '/staff', icon: 'fas fa-user-tie', label: 'Staff Management', color: '#9b59b6', roles: ['admin'] },
    { path: '/tasks', icon: 'fas fa-tasks', label: 'Task Management', color: '#f39c12', roles: ['admin', 'senior_ca', 'junior_ca', 'assistant', 'intern'] },
    { path: '/billing', icon: 'fas fa-file-invoice-dollar', label: 'Billing & Invoicing', color: '#e74c3c', roles: ['admin', 'senior_ca'] },
    { path: '/attendance', icon: 'fas fa-user-clock', label: 'Attendance Management', color: '#17a2b8', roles: ['admin', 'senior_ca'] },
    { path: '/reports', icon: 'fas fa-chart-bar', label: 'Reports & Analytics', color: '#6f42c1', roles: ['admin', 'senior_ca'] },
    { path: '/audit', icon: 'fas fa-shield-alt', label: 'Audit & Security', color: '#dc3545', roles: ['admin'] }
  ];

  // Filter menu items based on user role
  const visibleMenuItems = menuItems.filter(item => 
    !user?.role || item.roles.includes(user.role)
  );

  const handleChangePassword = () => {
    openModal(
      <ChangePasswordModal 
        onSuccess={closeModal} 
        appContext={{ openModal, closeModal }} 
        user={user} 
      />
    );
  };

  return (
    <aside style={{
      width: '300px',
      background: 'white',
      borderRight: '1px solid #e1e8ed',
      padding: '0',
      position: 'sticky',
      top: '70px',
      height: 'calc(100vh - 70px)',
      overflowY: 'auto',
      boxShadow: '2px 0 8px rgba(0,0,0,0.1)'
    }}>
      
      {/* Current Firm Section - PRESERVE YOUR EXISTING DESIGN */}
      {selectedFirm && selectedFirm.id && (
        <div style={{
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          color: 'white',
          padding: '20px',
          borderBottom: '1px solid #e1e8ed'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <i className="fas fa-building" style={{ fontSize: '18px' }}></i>
            <div>
              <div style={{ fontWeight: '600', fontSize: '16px' }}>
                {selectedFirm.name || selectedFirm.firm_name || 'No Firm Selected'}
              </div>
              <div style={{ fontSize: '12px', opacity: '0.9' }}>
                Code: {selectedFirm.code || selectedFirm.firm_code || 'FIRM001'}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '11px', opacity: '0.8' }}>
            {selectedFirm.city || selectedFirm.firm_city || 'Chittorgarh'} • {selectedFirm.phone || selectedFirm.firm_phone || '941111476'}
          </div>
        </div>
      )}

      {/* Navigation Header - PRESERVE YOUR EXISTING STYLE */}
      <div style={{ padding: '24px 24px 16px' }}>
        <h3 style={{ 
          fontSize: '16px', 
          fontWeight: '600', 
          color: '#2c3e50',
          marginBottom: '16px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Navigation
        </h3>
        {user?.role && (
          <div style={{
            background: '#f8f9fa',
            padding: '12px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#666',
            marginBottom: '16px',
            border: '1px solid #e9ecef'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span><strong>Access Level:</strong></span>
              <span style={{ 
                background: user.role === 'admin' ? '#dc3545' : '#28a745',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '10px',
                fontWeight: '600'
              }}>
                {user.role.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            
            {/* NEW: User Profile Section with Password Change */}
            <div style={{ 
              borderTop: '1px solid #e9ecef', 
              paddingTop: '8px',
              marginTop: '8px'
            }}>
              <div style={{ marginBottom: '6px', fontWeight: '600', color: '#495057' }}>
                <i className="fas fa-user" style={{ marginRight: '6px', width: '12px' }}></i>
                {user.name || user.email}
              </div>
              <button
                onClick={handleChangePassword}
                style={{
                  background: 'none',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  color: '#495057',
                  cursor: 'pointer',
                  width: '100%',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#007bff';
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.borderColor = '#007bff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none';
                  e.currentTarget.style.color = '#495057';
                  e.currentTarget.style.borderColor = '#dee2e6';
                }}
              >
                <i className="fas fa-key" style={{ marginRight: '6px' }}></i>
                Change Password
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Menu - PRESERVE YOUR EXISTING HOVER EFFECTS AND STYLING */}
      <nav style={{ paddingBottom: '20px' }}>
        {visibleMenuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px 24px',
                textDecoration: 'none',
                color: isActive ? item.color : '#666',
                background: isActive ? `${item.color}08` : 'transparent',
                borderRight: isActive ? `4px solid ${item.color}` : '4px solid transparent',
                fontWeight: isActive ? '600' : '500',
                fontSize: '15px',
                transition: 'all 0.3s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = '#f8f9fa';
                  e.currentTarget.style.color = item.color;
                  e.currentTarget.style.transform = 'translateX(4px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#666';
                  e.currentTarget.style.transform = 'translateX(0)';
                }
              }}
            >
              <i className={item.icon} style={{ 
                width: '22px', 
                textAlign: 'center',
                fontSize: '16px'
              }}></i>
              <span>{item.label}</span>
              {item.isNew && (
                <span style={{
                  background: '#ff6b6b',
                  color: 'white',
                  fontSize: '9px',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontWeight: '600',
                  marginLeft: 'auto'
                }}>
                  NEW
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Firm Quick Actions - PRESERVE YOUR EXISTING DESIGN PATTERN */}
      {selectedFirm && user?.role === 'admin' && (
        <div style={{ padding: '0 24px 20px' }}>
          <div style={{
            background: '#f8f9fa',
            border: '1px solid #e9ecef',
            borderRadius: '10px',
            padding: '16px'
          }}>
            <h4 style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: '#2c3e50',
              marginBottom: '12px'
            }}>
              <i className="fas fa-tools" style={{ marginRight: '8px' }}></i>
              Quick Actions
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link
                to="/firms"
                style={{
                  display: 'block',
                  padding: '8px 12px',
                  background: 'white',
                  border: '1px solid #dee2e6',
                  borderRadius: '6px',
                  color: '#495057',
                  textDecoration: 'none',
                  fontSize: '12px',
                  fontWeight: '500',
                  textAlign: 'center',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#17a2b8';
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.borderColor = '#17a2b8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.color = '#495057';
                  e.currentTarget.style.borderColor = '#dee2e6';
                }}
              >
                <i className="fas fa-sync" style={{ marginRight: '6px' }}></i>
                Switch Firm
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Version Badge - PRESERVE YOUR EXISTING DESIGN */}
      <div style={{ padding: '0 24px 24px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea, #764ba2)',
          color: 'white',
          padding: '16px',
          borderRadius: '12px',
          fontSize: '12px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: '-50%',
            right: '-50%',
            width: '100%',
            height: '100%',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '50%'
          }}></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <i className="fas fa-star" style={{ marginRight: '8px', fontSize: '14px' }}></i>
            <strong style={{ fontSize: '13px' }}>Enhanced v2.3</strong>
            <br />
            <span style={{ opacity: '0.9', fontSize: '11px', lineHeight: '1.4' }}>
              Multi-Firm • Attendance • Reports • Audit
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;