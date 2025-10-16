import React, { useState, useEffect } from 'react';

const EmergencyRecoveryModal = ({ email, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    email: email || '',
    new_password: '',
    confirm_password: ''
  });
  const [loading, setLoading] = useState(false);
  const [emergencyStatus, setEmergencyStatus] = useState(null);
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    if (email) {
      checkEmergencyStatus(email);
    }
  }, [email]);

  const checkEmergencyStatus = async (emailAddress) => {
    try {
      const response = await fetch(`/api/auth/emergency-status/${emailAddress}`);
      const result = await response.json();
      setEmergencyStatus(result);
    } catch (error) {
      console.error('Error checking emergency status:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.new_password !== formData.confirm_password) {
      alert('Passwords do not match');
      return;
    }

    if (formData.new_password.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/emergency-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (response.ok) {
        alert('Password reset successfully! You can now login with your new password.');
        onSuccess();
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Emergency reset error:', error);
      alert('Error resetting password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getPasswordStrength = (password) => {
    if (password.length < 6) return { level: 0, text: 'Too short', color: '#e74c3c' };
    if (password.length < 8) return { level: 1, text: 'Fair', color: '#f39c12' };
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) return { level: 2, text: 'Good', color: '#3498db' };
    return { level: 3, text: 'Strong', color: '#27ae60' };
  };

  const passwordStrength = getPasswordStrength(formData.new_password);

  if (!emergencyStatus) {
    return (
      <div style={{ maxWidth: '400px', textAlign: 'center', padding: '40px' }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '32px', color: '#3498db' }}></i>
        <p>Checking emergency recovery status...</p>
      </div>
    );
  }

  if (!emergencyStatus.emergency_mode) {
    return (
      <div style={{ maxWidth: '450px' }}>
        <div className="modal-header">
          <h3 className="modal-title">
            <i className="fas fa-shield-alt" style={{ marginRight: '8px', color: '#e74c3c' }}></i>
            Emergency Recovery Not Available
          </h3>
          <button className="btn btn-sm btn-outline" onClick={onCancel}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="modal-body">
          <div style={{ 
            background: '#fff3cd', 
            color: '#856404',
            padding: '16px', 
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #ffeaa7'
          }}>
            <i className="fas fa-info-circle" style={{ marginRight: '8px' }}></i>
            <strong>Emergency Recovery Mode Not Active</strong>
            <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
              Emergency recovery mode is activated after 10 consecutive failed login attempts. 
              Current failed attempts: <strong>{emergencyStatus.failed_attempts || 0}</strong>
            </p>
          </div>

          <div style={{ fontSize: '14px', color: '#666' }}>
            <h4>How Emergency Recovery Works:</h4>
            <ul style={{ paddingLeft: '20px' }}>
              <li>After 10 failed login attempts, emergency mode activates</li>
              <li>You get a 24-hour window to reset your password</li>
              <li>Emergency mode can only be used once per activation</li>
              <li>After 24 hours without failed attempts, the counter resets</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={onCancel}>
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  const expiresAt = new Date(emergencyStatus.expires_at);
  const hoursLeft = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60));

  return (
    <div style={{ maxWidth: '500px' }}>
      <div className="modal-header" style={{ borderBottom: '2px solid #e74c3c' }}>
        <h3 className="modal-title">
          <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px', color: '#e74c3c' }}></i>
          Emergency Password Recovery
        </h3>
        <button className="btn btn-sm btn-outline" onClick={onCancel}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div style={{ 
            background: '#f8d7da', 
            color: '#721c24',
            padding: '16px', 
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px solid #f5c6cb'
          }}>
            <i className="fas fa-clock" style={{ marginRight: '8px' }}></i>
            <strong>Emergency Recovery Active</strong>
            <p style={{ margin: '8px 0 0 0', fontSize: '14px' }}>
              You have <strong>{hoursLeft} hours</strong> remaining to reset your password.
              This emergency window expires at: <strong>{expiresAt.toLocaleString()}</strong>
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              name="email"
              className="form-control"
              value={formData.email}
              onChange={handleChange}
              required
              readOnly
              style={{ backgroundColor: '#f8f9fa' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">New Password *</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPasswords ? 'text' : 'password'}
                name="new_password"
                className="form-control"
                value={formData.new_password}
                onChange={handleChange}
                required
                minLength="6"
                placeholder="Enter new password (minimum 6 characters)"
                style={{ paddingRight: '40px' }}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
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
                <i className={`fas ${showPasswords ? 'fa-eye-slash' : 'fa-eye'}`}></i>
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

          <div className="form-group">
            <label className="form-label">Confirm New Password *</label>
            <input
              type={showPasswords ? 'text' : 'password'}
              name="confirm_password"
              className="form-control"
              value={formData.confirm_password}
              onChange={handleChange}
              required
              placeholder="Re-enter new password"
              autoComplete="new-password"
            />
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

          <div style={{ 
            background: '#e7f3ff', 
            color: '#31708f',
            padding: '12px', 
            borderRadius: '8px',
            fontSize: '13px',
            marginTop: '16px'
          }}>
            <i className="fas fa-shield-alt" style={{ marginRight: '8px' }}></i>
            <strong>Security Notice:</strong>
            <ul style={{ margin: '8px 0 0 20px', paddingLeft: '0' }}>
              <li>This emergency reset will be logged for security purposes</li>
              <li>Choose a strong password different from your previous one</li>
              <li>Emergency mode will deactivate after password reset</li>
              <li>Consider setting up multiple admin accounts to prevent future lockouts</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
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
                Resetting Password...
              </>
            ) : (
              <>
                <i className="fas fa-shield-alt" style={{ marginRight: '8px' }}></i>
                Reset Password (Emergency)
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EmergencyRecoveryModal;