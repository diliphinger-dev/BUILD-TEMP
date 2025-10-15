import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const Login = () => {
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(credentials);
    
    if (!result.success) {
      setError(result.error || 'Login failed');
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
            background: '#f8d7da',
            color: '#721c24',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
            border: '1px solid #f5c6cb'
          }}>
            <i className="fas fa-exclamation-circle" style={{ marginRight: '8px' }}></i>
            {error}
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
             value={credentials.email}           // ✅ Uses 'credentials' not 'formData'
             onChange={handleChange}
             placeholder="Enter your email"
             required
             autoComplete="username"             // ADD THIS LINE
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
            value={credentials.password}        // ✅ Uses 'credentials' not 'formData'
            onChange={handleChange}
            placeholder="Enter your password"
            required
            autoComplete="current-password"     // ADD THIS LINE
            style={{ fontSize: '16px', padding: '14px 16px' }}
            />
          </div>

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
        </form>

        <div style={{
          marginTop: '32px',
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