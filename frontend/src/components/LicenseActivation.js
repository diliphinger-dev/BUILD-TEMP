import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './LicenseActivation.css';

function LicenseActivation() {
  const [status, setStatus] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [licenseKey, setLicenseKey] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkStatus();
    
    // Check if should show dialog on startup
    const shouldShow = localStorage.getItem('showLicenseDialog');
    if (shouldShow === 'true') {
      setShowDialog(true);
      localStorage.removeItem('showLicenseDialog');
    }
  }, []);

  const checkStatus = async () => {
    try {
      const res = await axios.get('/api/license/status');
      setStatus(res.data);
    } catch (err) {
      setStatus({ activated: false });
      setShowDialog(true);
    }
  };

  const activate = async () => {
    if (!licenseKey.trim()) {
      alert('Please enter license key');
      return;
    }

    setLoading(true);
  try {
    console.log('Sending activation request...');
    const res = await axios.post('/api/license/activate', {
      licenseKey: licenseKey.trim(),
      companyName,
      email
    });

    console.log('Activation response:', res.data);

      if (res.data.success) {
        alert('License activated successfully!\n\nPlease restart the application.');
        setShowDialog(false);
        checkStatus();
      }
   } catch (err) {
    console.error('Activation error:', err);
    const errorMsg = err.response?.data?.message || err.message || 'Activation failed';
    alert('License Activation Failed:\n\n' + errorMsg);
  }
  setLoading(false);
};

  const generateTrial = async () => {
    try {
      const res = await axios.post('/api/license/generate-trial');
      if (res.data.success) {
        setLicenseKey(res.data.licenseKey);
        alert('30-day trial license generated!');
      }
    } catch (err) {
      alert('Failed to generate trial license');
    }
  };

  if (!status) return null;

  return (
    <>
      {/* Status Banner */}
      {status.activated && status.valid && status.daysRemaining < 30 && (
        <div style={{
          background: '#ff9800',
          color: 'white',
          padding: '10px 20px',
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: '14px'
        }}>
          ⚠️ License expires in {status.daysRemaining} days - 
          <button 
            onClick={() => setShowDialog(true)}
            style={{
              marginLeft: '10px',
              padding: '5px 15px',
              background: 'white',
              color: '#ff9800',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Renew Now
          </button>
        </div>
      )}

      {!status.activated && (
        <div style={{
          background: '#f44336',
          color: 'white',
          padding: '10px 20px',
          textAlign: 'center',
          fontWeight: 'bold'
        }}>
          ⚠️ No License Active - 
          <button 
            onClick={() => setShowDialog(true)}
            style={{
              marginLeft: '10px',
              padding: '5px 15px',
              background: 'white',
              color: '#f44336',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Activate License
          </button>
        </div>
      )}

      {/* License Dialog */}
      {showDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999
        }}>
          <div style={{
            background: 'white',
            borderRadius: '10px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{ marginTop: 0, color: '#333' }}>
              <i className="fas fa-key"></i> License Activation
            </h2>

            {status.activated && status.valid ? (
              <div style={{
                background: '#d4edda',
                padding: '15px',
                borderRadius: '5px',
                marginBottom: '20px',
                border: '1px solid #c3e6cb'
              }}>
                <strong>✓ Active License</strong><br/>
                Company: {status.company}<br/>
                Users: {status.maxUsers}<br/>
                Expires: {new Date(status.expiryDate).toLocaleDateString()}<br/>
                Days Left: {status.daysRemaining}
              </div>
            ) : (
              <div style={{
                background: '#fff3cd',
                padding: '15px',
                borderRadius: '5px',
                marginBottom: '20px',
                border: '1px solid #ffc107'
              }}>
                <strong>⚠️ No Active License</strong><br/>
                Please activate to continue using CA Office Pro
              </div>
            )}

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                License Key *
              </label>
              <textarea
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="Paste your license key here"
                rows="3"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Company Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your Company Name"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <button
                onClick={activate}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                {loading ? 'Activating...' : 'Activate License'}
              </button>

              {!status.activated && (
                <button
                  onClick={generateTrial}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}
                >
                  30-Day Trial
                </button>
              )}
            </div>

            {status.activated && (
              <button
                onClick={() => setShowDialog(false)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#757575',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            )}

            <div style={{
              marginTop: '20px',
              padding: '15px',
              background: '#f5f5f5',
              borderRadius: '5px',
              fontSize: '12px'
            }}>
              <strong>Don't have a license?</strong><br/>
              Contact: support@caoffice.com<br/>
              Phone: +91-XXXXXXXXXX
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default LicenseActivation;