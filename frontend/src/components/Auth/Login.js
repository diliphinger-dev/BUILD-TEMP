import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import EmergencyRecoveryModal from './EmergencyRecoveryModal';

const Login = () => {
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showEmergencyRecovery, setShowEmergencyRecovery] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);
  const [showDemoButton, setShowDemoButton] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const { login } = useAuth();

  useEffect(() => {
    checkAdminExists();
  }, []);

  const checkAdminExists = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/check-admin-exists');
      const data = await response.json();
      
      setShowDemoButton(!data.adminExists);
      setCheckingAdmin(false);
    } catch (error) {
      console.error('Error checking admin existence:', error);
      setShowDemoButton(true);
      setCheckingAdmin(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(credentials);
    
    if (!result.success) {
      setError(result.error || 'Login failed');
      
      if (result.response?.emergency_mode) {
        setEmergencyMode(true);
        setError(result.response.emergency_message || 'Too many failed attempts. Emergency recovery available.');
      } else if (result.response?.attempts_remaining !== undefined) {
        setAttemptsRemaining(result.response.attempts_remaining);
        if (result.response.attempts_remaining > 0) {
          setError(`Invalid credentials. ${result.response.attempts_remaining} attempts remaining before emergency mode.`);
        }
      }
    } else {
      if (result.response?.is_demo) {
        setTimeout(() => {
          alert('⚠️ DEMO MODE: Please create a real administrator account in Staff Management to secure your system.');
        }, 1000);
      }
    }
    
    setLoading(false);
  };

  const handleChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  const handleDemoLogin = () => {
    setCredentials({
      email: 'admin@ca-office.com',
      password: 'admin123'
    });
  };

  const handleEmergencyRecovery = () => {
    setShowEmergencyRecovery(true);
  };

  const handleEmergencySuccess = () => {
    setShowEmergencyRecovery(false);
    setEmergencyMode(false);
    setError('');
    setCredentials({ email: '', password: '' });
    alert('Password reset successful! Please login with your new password.');
  };

  const handleEmergencyCancel = () => {
    setShowEmergencyRecovery(false);
  };

  if (showEmergencyRecovery) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          padding: '0',
          width: '100%',
          maxWidth: '550px'
        }}>
          <EmergencyRecoveryModal
            email={credentials.email}
            onSuccess={handleEmergencySuccess}
            onCancel={handleEmergencyCancel}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        padding: '40px',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#2c3e50',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}>
            <i className="fas fa-building" style={{ color: '#3498db' }}></i>
            CA Office Pro
          </div>
          <p style={{ color: '#666', fontSize: '16px' }}>
            Complete Practice Management System
          </p>
        </div>

        {error && (
          <div style={{
            background: emergencyMode ? '#f8d7da' : '#f8d7da',
            color: emergencyMode ? '#721c24' : '#721c24',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            border: emergencyMode ? '1px solid #f5c6cb' : '1px solid #f5c6cb'
          }}>
            <i className={`fas ${emergencyMode ? 'fa-exclamation-triangle' : 'fa-exclamation-circle'}`} style={{ marginRight: '8px' }}></i>
            {error}
          </div>
        )}

        {emergencyMode && (
          <div style={{
            background: '#fff3cd',
            color: '#856404',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            border: '1px solid #ffeaa7',
            textAlign: 'center'
          }}>
            <i className="fas fa-shield-alt" style={{ marginRight: '8px', fontSize: '20px' }}></i>
            <div style={{ marginTop: '8px', fontWeight: '600' }}>
              Emergency Recovery Available
            </div>
            <button
              onClick={handleEmergencyRecovery}
              style={{
                marginTop: '12px',
                padding: '10px 20px',
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              <i className="fas fa-unlock-alt" style={{ marginRight: '8px' }}></i>
              Reset Password (Emergency)
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">
              <i className="fas fa-envelope" style={{ marginRight: '8px', color: '#666' }}></i>
              Email Address
            </label>
            <input
              type="email"
              name="email"
              className="form-control"
              value={credentials.email}
              onChange={handleChange}
              placeholder="Enter your email"
              required
              autoComplete="username"
              style={{ fontSize: '16px', padding: '14px 16px' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <i className="fas fa-lock" style={{ marginRight: '8px', color: '#666' }}></i>
              Password
            </label>
            <input
              type="password"
              name="password"
              className="form-control"
              value={credentials.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              style={{ fontSize: '16px', padding: '14px 16px' }}
            />
          </div>

          {attemptsRemaining !== null && attemptsRemaining < 5 && attemptsRemaining > 0 && (
            <div style={{
              fontSize: '13px',
              color: '#dc3545',
              marginBottom: '12px',
              textAlign: 'center',
              fontWeight: '600'
            }}>
              ⚠️ Warning: {attemptsRemaining} attempts remaining
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '16px',
              background: 'linear-gradient(135deg, #3498db, #2980b9)',
              border: 'none'
            }}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                Signing In...
              </>
            ) : (
              <>
                <i className="fas fa-sign-in-alt" style={{ marginRight: '8px' }}></i>
                Sign In
              </>
            )}
          </button>

          {!checkingAdmin && showDemoButton && (
            <button
              type="button"
              onClick={handleDemoLogin}
              className="btn btn-outline"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '14px',
                textAlign: 'center'
              }}
            >
              <i className="fas fa-play" style={{ marginRight: '8px' }}></i>
              Use Demo Credentials
            </button>
          )}
        </form>

        {!emergencyMode && credentials.email && (
          <div style={{
            marginTop: '16px',
            textAlign: 'center'
          }}>
            <button
              onClick={handleEmergencyRecovery}
              style={{
                background: 'none',
                border: 'none',
                color: '#3498db',
                fontSize: '13px',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              <i className="fas fa-question-circle" style={{ marginRight: '6px' }}></i>
              Forgot Password?
            </button>
          </div>
        )}

        {!checkingAdmin && showDemoButton && (
          <>
            <div style={{
              marginTop: '24px',
              padding: '16px',
              background: '#fff3cd',
              borderRadius: '8px',
              border: '1px solid #ffc107'
            }}>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: '600', 
                marginBottom: '8px', 
                color: '#856404',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <i className="fas fa-info-circle"></i>
                First Time Setup
              </div>
              <div style={{ fontSize: '13px', color: '#856404', lineHeight: '1.5' }}>
                1. Use demo login below<br />
                2. Create your admin account in Staff Management<br />
                3. Demo login will automatically disable
              </div>
            </div>

            <div style={{
              marginTop: '16px',
              padding: '20px',
              background: '#f8f9fa',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#2c3e50' }}>
                Demo Login Credentials
              </div>
              <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                <strong>Email:</strong> admin@ca-office.com
              </div>
              <div style={{ fontSize: '13px', color: '#666' }}>
                <strong>Password:</strong> admin123
              </div>
            </div>
          </>
        )}

        <div style={{
          marginTop: '24px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#999'
        }}>
          <p>Complete CA Office Management Solution</p>
          <p>✓ Client Management ✓ Staff Management ✓ Task Tracking ✓ Billing & Invoicing</p>
        </div>
      </div>
    </div>
  );
};

export default Login;