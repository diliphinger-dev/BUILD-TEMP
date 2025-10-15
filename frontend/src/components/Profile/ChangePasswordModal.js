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

const ChangePasswordModal = ({ onSuccess, appContext, user }) => {
  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
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

    if (formData.current_password === formData.new_password) {
      alert('New password must be different from current password');
      return;
    }

    setLoading(true);
    const token = getAuthToken(appContext);

    try {
      const response = await fetch('/api/staff/change-password', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: formData.current_password,
          new_password: formData.new_password
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert('Password changed successfully. Please login again with your new password.');
        onSuccess();
        
        // Optional: Force logout after password change
        localStorage.clear();
        window.location.href = '/login';
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error changing password:', error);
      alert('Error changing password. Please try again.');
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
    if (password.length < 6) return { strength: 'weak', color: '#e74c3c', text: 'Too short' };
    if (password.length < 8) return { strength: 'fair', color: '#f39c12', text: 'Fair' };
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) return { strength: 'good', color: '#3498db', text: 'Good' };
    return { strength: 'strong', color: '#27ae60', text: 'Strong' };
  };

  const passwordStrength = getPasswordStrength(formData.new_password);

  return (
    <div style={{ maxWidth: '450px' }}>
      <div className="modal-header">
        <h3 className="modal-title">
          <i className="fas fa-key" style={{ marginRight: '8px', color: '#3498db' }}></i>
          Change Password
        </h3>
        <button className="btn btn-sm btn-outline" onClick={onSuccess}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          {user && (
            <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fas fa-user-circle" style={{ fontSize: '24px', color: '#666' }}></i>
                <div>
                  <strong>{user.name}</strong>
                  <br />
                  <small style={{ color: '#666' }}>{user.email}</small>
                </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Current Password *</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPasswords.current ? 'text' : 'password'}
                name="current_password"
                className="form-control"
                autoComplete="current-password"
                onChange={handleChange}
                required
                placeholder="Enter your current password"
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('current')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#666',
                  cursor: 'pointer'
                }}
              >
                <i className={`fas ${showPasswords.current ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">New Password *</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPasswords.new ? 'text' : 'password'}
                name="new_password"
                className="form-control"
                autoComplete="new-password"
                onChange={handleChange}
                required
                minLength="6"
                placeholder="Enter new password (minimum 6 characters)"
                style={{ paddingRight: '40px' }}
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
                  color: '#666',
                  cursor: 'pointer'
                }}
              >
                <i className={`fas ${showPasswords.new ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
            {formData.new_password && (
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '80px',
                  height: '4px',
                  background: '#e9ecef',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: passwordStrength.strength === 'weak' ? '25%' : 
                           passwordStrength.strength === 'fair' ? '50%' :
                           passwordStrength.strength === 'good' ? '75%' : '100%',
                    height: '100%',
                    background: passwordStrength.color,
                    transition: 'all 0.3s ease'
                  }}></div>
                </div>
                <small style={{ color: passwordStrength.color, fontWeight: '500' }}>
                  {passwordStrength.text}
                </small>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Confirm New Password *</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                name="confirm_password"
                className="form-control"
                autoComplete="new-password"
                onChange={handleChange}
                required
                placeholder="Re-enter new password"
                style={{ 
                  paddingRight: '40px',
                  borderColor: formData.confirm_password && formData.new_password !== formData.confirm_password ? '#e74c3c' : ''
                }}
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
                  color: '#666',
                  cursor: 'pointer'
                }}
              >
                <i className={`fas ${showPasswords.confirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
            {formData.confirm_password && formData.new_password !== formData.confirm_password && (
              <small style={{ color: '#e74c3c', marginTop: '4px', display: 'block' }}>
                <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                Passwords do not match
              </small>
            )}
            {formData.confirm_password && formData.new_password === formData.confirm_password && (
              <small style={{ color: '#27ae60', marginTop: '4px', display: 'block' }}>
                <i className="fas fa-check-circle" style={{ marginRight: '4px' }}></i>
                Passwords match
              </small>
            )}
          </div>

          <div style={{ 
            background: '#e3f2fd', 
            color: '#1565c0', 
            padding: '12px', 
            borderRadius: '8px',
            fontSize: '13px',
            marginTop: '16px'
          }}>
            <i className="fas fa-info-circle" style={{ marginRight: '8px' }}></i>
            <strong>Password Requirements:</strong>
            <ul style={{ margin: '8px 0 0 20px', paddingLeft: '0' }}>
              <li>Minimum 6 characters long</li>
              <li>Should be different from current password</li>
              <li>Recommended: Mix of letters, numbers, and symbols</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onSuccess}>
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading || formData.new_password !== formData.confirm_password || formData.new_password.length < 6}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                Changing Password...
              </>
            ) : (
              <>
                <i className="fas fa-key" style={{ marginRight: '8px' }}></i>
                Change Password
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChangePasswordModal;