import React, { useState } from 'react';

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

const AdminPasswordResetModal = ({ staff, onSuccess, appContext }) => {
  const [formData, setFormData] = useState({
    new_password: '',
    confirm_password: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    new: false,
    confirm: false
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.new_password !== formData.confirm_password) {
      alert('New password and confirm password do not match');
      return;
    }

    if (formData.new_password.length < 6) {
      alert('New password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    const token = getAuthToken(appContext);

    try {
      const response = await fetch(`/api/staff/${staff.id}/reset-password`, {

        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          new_password: formData.new_password
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Password reset successfully for ${staff.name}. They can now login with the new password.`);
        onSuccess();
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Error resetting password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const getPasswordStrength = (password) => {
    if (password.length < 6) return { level: 0, text: 'Too short', color: '#e74c3c' };
    if (password.length < 8) return { level: 1, text: 'Weak', color: '#f39c12' };
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) return { level: 2, text: 'Fair', color: '#f1c40f' };
    return { level: 3, text: 'Strong', color: '#27ae60' };
  };

  const passwordStrength = getPasswordStrength(formData.new_password);

  return (
    <div style={{ maxWidth: '500px' }}>
      <div className="modal-header" style={{ borderBottom: '2px solid #e74c3c', paddingBottom: '16px' }}>
        <h3 className="modal-title" style={{ color: '#2c3e50', fontSize: '20px' }}>
          <i className="fas fa-user-shield" style={{ marginRight: '10px', color: '#e74c3c' }}></i>
          Reset Password for {staff.name}
        </h3>
        <button className="btn btn-sm btn-outline" onClick={onSuccess}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="modal-body" style={{ padding: '24px' }}>
        {/* Security Warning */}
        <div style={{ 
          background: '#fff3cd', 
          color: '#856404',
          padding: '16px', 
          borderRadius: '8px',
          fontSize: '14px',
          marginBottom: '20px',
          border: '1px solid #ffeaa7'
        }}>
          <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px', fontSize: '16px' }}></i>
          <strong>Administrator Action:</strong>
          <ul style={{ margin: '8px 0 0 20px', paddingLeft: '0' }}>
            <li>You are resetting the password for <strong>{staff.name}</strong></li>
            <li>The staff member will need to login with this new password</li>
            <li>Consider sharing the password securely (in person or encrypted)</li>
            <li>Staff should change the password after first login</li>
            <li>This action will be logged in the audit trail</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Staff Information */}
          <div style={{ 
            background: '#f8f9fa', 
            padding: '16px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '1px solid #e9ecef'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <i className="fas fa-user" style={{ color: '#6c757d' }}></i>
              <div>
                <div style={{ fontWeight: '600', color: '#495057' }}>{staff.name}</div>
                <div style={{ fontSize: '14px', color: '#6c757d' }}>{staff.email}</div>
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#6c757d' }}>
              <span style={{ 
                background: staff.role === 'admin' ? '#dc3545' : '#28a745',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '10px',
                fontWeight: '600'
              }}>
                {staff.role.replace('_', ' ').toUpperCase()}
              </span>
              <span style={{ marginLeft: '10px' }}>
                Status: <strong>{staff.status}</strong>
              </span>
            </div>
          </div>

          {/* New Password Input */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ fontWeight: '600', marginBottom: '8px' }}>
              <i className="fas fa-lock" style={{ marginRight: '8px' }}></i>
              New Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPasswords.new ? "text" : "password"}
                name="new_password"
                className="form-control"
                autoComplete="new-password"
                onChange={handleChange}
                required
                minLength="6"
                style={{ paddingRight: '40px' }}
                placeholder="Enter new password (minimum 6 characters)"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('new')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#6c757d',
                  cursor: 'pointer'
                }}
              >
                <i className={`fas ${showPasswords.new ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
            {formData.new_password && (
              <div style={{ marginTop: '8px', fontSize: '12px' }}>
                <span style={{ color: passwordStrength.color, fontWeight: '600' }}>
                  Strength: {passwordStrength.text}
                </span>
                <div style={{ 
                  background: '#e9ecef', 
                  height: '4px', 
                  borderRadius: '2px', 
                  marginTop: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    background: passwordStrength.color,
                    height: '100%',
                    width: `${(passwordStrength.level + 1) * 25}%`,
                    transition: 'all 0.3s ease'
                  }}></div>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Input */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ fontWeight: '600', marginBottom: '8px' }}>
              <i className="fas fa-lock" style={{ marginRight: '8px' }}></i>
              Confirm New Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPasswords.confirm ? "text" : "password"}
                name="confirm_password"
                className="form-control"
                autoComplete="new-password"
                onChange={handleChange}
                required
                style={{ paddingRight: '40px' }}
                placeholder="Re-enter the new password"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('confirm')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#6c757d',
                  cursor: 'pointer'
                }}
              >
                <i className={`fas ${showPasswords.confirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
            {formData.confirm_password && (
              <div style={{ marginTop: '8px', fontSize: '12px' }}>
                {formData.new_password === formData.confirm_password ? (
                  <span style={{ color: '#27ae60' }}>
                    <i className="fas fa-check"></i> Passwords match
                  </span>
                ) : (
                  <span style={{ color: '#e74c3c' }}>
                    <i className="fas fa-times"></i> Passwords do not match
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Password Preview (when both fields match) */}
          {formData.new_password && 
           formData.confirm_password && 
           formData.new_password === formData.confirm_password && 
           formData.new_password.length >= 6 && (
            <div style={{ 
              background: '#d4edda', 
              color: '#155724', 
              padding: '16px', 
              borderRadius: '8px',
              fontSize: '14px',
              marginBottom: '20px',
              border: '1px solid #c3e6cb'
            }}>
              <i className="fas fa-info-circle" style={{ marginRight: '8px' }}></i>
              <strong>Ready to Reset Password</strong>
              <div style={{ marginTop: '8px', fontSize: '12px' }}>
                New password: 
                <code style={{ 
                  background: 'rgba(0,0,0,0.1)', 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  marginLeft: '8px',
                  fontFamily: 'monospace'
                }}>
                  {formData.new_password}
                </code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(formData.new_password)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#155724',
                    marginLeft: '8px',
                    cursor: 'pointer'
                  }}
                  title="Copy to clipboard"
                >
                  <i className="fas fa-copy"></i>
                </button>
              </div>
            </div>
          )}

          <div className="modal-footer" style={{ borderTop: '1px solid #e9ecef', paddingTop: '16px' }}>
            <button type="button" className="btn btn-outline" onClick={onSuccess}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-danger" 
              disabled={loading || formData.new_password !== formData.confirm_password || formData.new_password.length < 6}
              style={{ marginLeft: '12px' }}
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                  Resetting...
                </>
              ) : (
                <>
                  <i className="fas fa-user-shield" style={{ marginRight: '8px' }}></i>
                  Reset Password for {staff.name}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminPasswordResetModal;