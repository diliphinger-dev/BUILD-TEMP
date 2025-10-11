import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';

// Auth Components
import Login from './components/Auth/Login';
import LicenseActivation from './components/LicenseActivation';

// Layout Components
import Navigation from './components/Layout/Navigation';
import Sidebar from './components/Layout/Sidebar';

// Core Module Components
import Dashboard from './components/Dashboard/Dashboard';
import ClientManagement from './components/Clients/ClientManagement';
import StaffManagement from './components/Staff/StaffManagement';
import TaskManagement from './components/Tasks/TaskManagement';
import BillingManagement from './components/Billing/BillingManagement';

// Enhanced Module Components (Phase 2 & 3)
import AttendanceManagement from './components/Attendance/AttendanceManagement';
import ReportsManagement from './components/Reports/ReportsManagement';
import AuditLogViewer from './components/Audit/AuditLogViewer';

// Multi-Firm Components
import FirmSelector from './components/FirmSelector';
import FirmManagement from './components/FirmManagement';

// Global Styles
import './index.css';

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <Router>
          <LicenseActivation />
          <AppContent />
        </Router>
      </AppProvider>
    </AuthProvider>    
  );
}

// Role-based Route Protection Component
function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/" replace />;
  }
  
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
        <i className="fas fa-lock" style={{ fontSize: '64px', color: '#e74c3c', marginBottom: '20px' }}></i>
        <h3 style={{ color: '#e74c3c', marginBottom: '16px' }}>Access Restricted</h3>
        <p style={{ color: '#666', fontSize: '16px' }}>
          You don't have permission to access this section.
        </p>
        <p style={{ color: '#999', fontSize: '14px', marginTop: '8px' }}>
          Required role: {allowedRoles.join(' or ')} | Your role: {user.role}
        </p>
        <div style={{ marginTop: '20px' }}>
          <a href="/" className="btn btn-primary">
            <i className="fas fa-home"></i>
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }
  
  return children;
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container" style={{ 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <div className="loading-spinner" style={{
          width: '50px',
          height: '50px',
          border: '4px solid rgba(255,255,255,0.3)',
          borderRadius: '50%',
          borderTopColor: '#ffffff',
          animation: 'spin 1s ease-in-out infinite',
          marginBottom: '20px'
        }}></div>
        <p style={{ fontSize: '18px', fontWeight: '600' }}>
          Loading Enhanced CA Office System v3.0...
        </p>
        <p style={{ fontSize: '14px', opacity: '0.9', marginTop: '8px' }}>
          Multi-Firm • Attendance • Reports • Audit Logging
        </p>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <div className="app-layout">
      <Navigation />
      <div className="app-body">
        <Sidebar>
          {/* Firm Selector at top of sidebar */}
          <div className="firm-selector-container p-4 border-b">
            <FirmSelector />
          </div>
        </Sidebar>
        <main className="main-content">
          <Routes>
            {/* Core Routes */}
            <Route path="/" element={<Dashboard />} />
            
            {/* Multi-Firm Management - Admin Only */}
            <Route path="/firms" element={<ProtectedRoute allowedRoles={['admin']}>
                  <FirmManagement />
                </ProtectedRoute>
              } 
            />
            
            {/* Client Management */}
            <Route 
              path="/clients" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'senior_ca', 'junior_ca']}>
                  <ClientManagement />
                </ProtectedRoute>
              } 
            />
            
            {/* Staff Management - Admin Only */}
            <Route 
              path="/staff" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <StaffManagement />
                </ProtectedRoute>
              } 
            />
            
            {/* Task Management */}
            <Route path="/tasks" element={<TaskManagement />} />
            
            {/* Billing & Invoicing */}
            <Route 
              path="/billing" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'senior_ca']}>
                  <BillingManagement />
                </ProtectedRoute>
              } 
            />
            
            {/* Attendance Management - Admin & Senior CA */}
            <Route 
              path="/attendance" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'senior_ca']}>
                  <AttendanceManagement />
                </ProtectedRoute>
              } 
            />
            
            {/* Reports & Analytics - Admin & Senior CA */}
            <Route 
              path="/reports" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'senior_ca']}>
                  <ReportsManagement />
                </ProtectedRoute>
              } 
            />
            
            {/* Audit & Security Logs - Admin Only */}
            <Route 
              path="/audit" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AuditLogViewer />
                </ProtectedRoute>
              } 
            />
            
            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;