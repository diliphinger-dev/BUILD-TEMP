import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const FirmManagement = () => {
  const { user } = useAuth();
  const [firms, setFirms] = useState([]);
  const [selectedFirm, setSelectedFirm] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('add');
  const [editingFirm, setEditingFirm] = useState(null);

  useEffect(() => {
    fetchFirms();
    fetchSelectedFirm();
  }, []);

  // Helper function to get auth token (matches your other components)
  const getAuthToken = () => {
    return localStorage.getItem('ca_auth_token') || localStorage.getItem('token');
  };

  const fetchFirms = async () => {
    try {
      const token = getAuthToken();
      const response = await fetch('/api/firms', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setFirms(data.data || data.firms || []);
      }
    } catch (error) {
      console.error('Error fetching firms:', error);
      // Demo data for development
      setFirms([
        {
          id: 1,
          firm_name: 'DILIP HINGER & ASSOCIATES',
          firm_code: 'FIRM001',
          firm_city: 'Chittorgarh',
          firm_phone: '9411114765',
          client_count: 1,
          staff_count: 1,
          status: 'active'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSelectedFirm = async () => {
    try {
      const token = getAuthToken();
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
      // Set default selected firm
      setSelectedFirm({
        id: 1,
        firm_name: 'DILIP HINGER & ASSOCIATES',
        firm_code: 'FIRM001'
      });
    }
  };

  const handleAddFirm = () => {
    setModalType('add');
    setEditingFirm(null);
    setShowModal(true);
  };

  const handleEditFirm = (firm) => {
    setModalType('edit');
    setEditingFirm(firm);
    setShowModal(true);
  };

  const handleSwitchFirm = async (firmId) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`/api/firms/${firmId}/switch`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSelectedFirm(data.firm || data.data);
        alert(`Switched to ${data.firm?.firm_name || 'selected firm'} successfully!`);
        // Trigger a custom event to update header
        window.dispatchEvent(new CustomEvent('firmChanged', { 
          detail: data.firm || data.data 
        }));
      } else {
        alert('Failed to switch firm');
      }
    } catch (error) {
      console.error('Error switching firm:', error);
      alert('Error switching firm');
    }
  };

  const handleDeleteFirm = async (firmId) => {
    if (window.confirm('Are you sure you want to delete this firm?')) {
      try {
        const token = getAuthToken();
        const response = await fetch(`/api/firms/${firmId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          fetchFirms();
          alert('Firm deleted successfully');
        } else {
          alert('Failed to delete firm');
        }
      } catch (error) {
        console.error('Error deleting firm:', error);
        alert('Error deleting firm');
      }
    }
  };

  const filteredFirms = firms.filter(firm =>
    firm.firm_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    firm.firm_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    firm.firm_city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    firm.firm_phone?.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="loading-container" style={{ height: '400px' }}>
        <div className="loading-spinner"></div>
        <p>Loading firms...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Enhanced Page Header */}
      <div className="card" style={{ 
        background: 'linear-gradient(135deg, #3498db, #2c3e50)',
        color: 'white',
        marginBottom: '24px',
        border: 'none'
      }}>
        <div style={{ padding: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '700', margin: '0 0 8px 0' }}>
                <i className="fas fa-building" style={{ marginRight: '12px' }}></i>
                Firm Management
              </h1>
              <p style={{ fontSize: '16px', opacity: '0.9', margin: '0' }}>
                Manage your CA practice firms and switch between them
              </p>
            </div>
            
            {selectedFirm && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', opacity: '0.8', marginBottom: '4px' }}>
                  Currently Selected:
                </div>
                <div style={{ fontSize: '20px', fontWeight: '600' }}>
                  {selectedFirm.firm_name}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <i className="fas fa-building"></i>
            All Firms
          </h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-success" onClick={handleAddFirm}>
              <i className="fas fa-plus"></i>
              Add New Firm
            </button>
          </div>
        </div>

        {/* Enhanced Search Bar */}
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{ position: 'relative' }}>
            <i className="fas fa-search" style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#666',
              zIndex: 2
            }}></i>
            <input
              type="text"
              className="form-control"
              placeholder="Search firms by name, code, city, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '45px' }}
            />
          </div>
        </div>

        {/* Enhanced Firms Table */}
        {filteredFirms.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Firm Name</th>
                  <th>Code</th>
                  <th>City</th>
                  <th>Phone</th>
                  <th>Clients</th>
                  <th>Staff</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFirms.map((firm) => {
                  const isSelected = selectedFirm && selectedFirm.id === firm.id;
                  return (
                    <tr 
                      key={firm.id}
                      style={{
                        background: isSelected ? 'rgba(52, 152, 219, 0.05)' : '',
                        borderLeft: isSelected ? '4px solid var(--secondary-color)' : '4px solid transparent'
                      }}
                    >
                      <td>
                        <div>
                          <strong style={{ 
                            fontSize: '16px', 
                            color: isSelected ? 'var(--secondary-color)' : 'inherit' 
                          }}>
                            {firm.firm_name}
                          </strong>
                          {isSelected && (
                            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                              <i className="fas fa-star" style={{ color: '#f39c12', marginRight: '4px' }}></i>
                              Currently Selected
                            </div>
                          )}
                        </div>
                      </td>
                      <td><strong>{firm.firm_code}</strong></td>
                      <td>{firm.firm_city || '-'}</td>
                      <td>{firm.firm_phone || '-'}</td>
                      <td>
                        <span className={`badge ${
                          firm.client_count > 0 ? 'badge-success' : 'badge-secondary'
                        }`}>
                          {firm.client_count || 0}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          firm.staff_count > 0 ? 'badge-success' : 'badge-secondary'
                        }`}>
                          {firm.staff_count || 0}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          firm.status === 'active' ? 'badge-success' : 'badge-warning'
                        }`}>
                          {firm.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => handleEditFirm(firm)}
                            title="Edit Firm"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          
                          {!isSelected && (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleSwitchFirm(firm.id)}
                              title="Switch to this Firm"
                              style={{ fontSize: '12px' }}
                            >
                              <i className="fas fa-exchange-alt"></i>
                              Switch
                            </button>
                          )}
                          
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeleteFirm(firm.id)}
                            title="Delete Firm"
                            disabled={isSelected}
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
            <i className="fas fa-building" style={{ fontSize: '64px', marginBottom: '16px', opacity: '0.3' }}></i>
            <h3>No firms found</h3>
            <p>No firms match your search criteria.</p>
            <button className="btn btn-primary" onClick={handleAddFirm}>
              <i className="fas fa-plus"></i>
              Add Your First Firm
            </button>
          </div>
        )}
      </div>

      {/* FIXED: Modal with proper z-index and no transparency issues */}
      {showModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'none'
          }}
          onClick={() => setShowModal(false)}
        >
          <div 
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              maxWidth: '700px',
              width: '90vw',
              maxHeight: '90vh',
              overflow: 'hidden',
              position: 'relative',
              border: '1px solid #e0e0e0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <FirmForm
              firm={editingFirm}
              onSuccess={() => {
                setShowModal(false);
                fetchFirms();
                if (modalType === 'edit' && selectedFirm && editingFirm.id === selectedFirm.id) {
                  fetchSelectedFirm();
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Enhanced Firm Form Component
const FirmForm = ({ firm, onSuccess }) => {
  const [formData, setFormData] = useState({
    firm_name: firm?.firm_name || '',
    firm_code: firm?.firm_code || '',
    firm_address: firm?.firm_address || '',
    firm_city: firm?.firm_city || '',
    firm_state: firm?.firm_state || '',
    firm_pincode: firm?.firm_pincode || '',
    firm_phone: firm?.firm_phone || '',
    firm_email: firm?.firm_email || '',
    firm_pan: firm?.firm_pan || '',
    firm_gstin: firm?.firm_gstin || '',
    firm_tan: firm?.firm_tan || '',
    status: firm?.status || 'active'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = firm ? `/api/firms/${firm.id}` : '/api/firms';
      const method = firm ? 'PUT' : 'POST';
      const token = localStorage.getItem('ca_auth_token') || localStorage.getItem('token');

      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        alert(firm ? 'Firm updated successfully!' : 'Firm created successfully!');
        onSuccess();
      } else {
        const error = await response.json();
        alert(`Error: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error saving firm');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Modal Header */}
      <div style={{
        padding: '20px 30px',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f8f9fa'
      }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#333' }}>
          <i className="fas fa-building" style={{ marginRight: '8px', color: '#3498db' }}></i>
          {firm ? 'Edit Firm' : 'Add New Firm'}
        </h3>
        <button 
          onClick={onSuccess}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '5px',
            color: '#666',
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <i className="fas fa-times"></i>
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Modal Body */}
        <div style={{ 
          padding: '30px', 
          maxHeight: '500px', 
          overflowY: 'auto',
          backgroundColor: '#ffffff'
        }}>
          {/* Basic Information */}
          <div style={{ marginBottom: '24px' }}>
            <h5 style={{ marginBottom: '16px', color: '#3498db', fontSize: '16px', fontWeight: '600' }}>
              <i className="fas fa-info-circle" style={{ marginRight: '8px' }}></i>
              Basic Information
            </h5>
            <div className="row">
              <div className="col-6">
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '500', color: '#333' }}>Firm Name *</label>
                  <input
                    type="text"
                    name="firm_name"
                    className="form-control"
                    value={formData.firm_name}
                    onChange={handleChange}
                    required
                    placeholder="Enter firm name"
                    style={{ 
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      padding: '10px 12px'
                    }}
                  />
                </div>
              </div>
              <div className="col-6">
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '500', color: '#333' }}>Firm Code *</label>
                  <input
                    type="text"
                    name="firm_code"
                    className="form-control"
                    value={formData.firm_code}
                    onChange={handleChange}
                    required
                    disabled={!!firm}
                    placeholder="e.g., FIRM001"
                    style={{ 
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      backgroundColor: firm ? '#f5f5f5' : '#fff'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div style={{ marginBottom: '24px' }}>
            <h5 style={{ marginBottom: '16px', color: '#3498db', fontSize: '16px', fontWeight: '600' }}>
              <i className="fas fa-map-marker-alt" style={{ marginRight: '8px' }}></i>
              Address Information
            </h5>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: '500', color: '#333' }}>Address</label>
              <textarea
                name="firm_address"
                className="form-control"
                rows="2"
                value={formData.firm_address}
                onChange={handleChange}
                placeholder="Complete address"
                style={{ 
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  padding: '10px 12px'
                }}
              ></textarea>
            </div>

            <div className="row">
              <div className="col-4">
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '500', color: '#333' }}>City</label>
                  <input
                    type="text"
                    name="firm_city"
                    className="form-control"
                    value={formData.firm_city}
                    onChange={handleChange}
                    style={{ 
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      padding: '10px 12px'
                    }}
                  />
                </div>
              </div>
              <div className="col-4">
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '500', color: '#333' }}>State</label>
                  <input
                    type="text"
                    name="firm_state"
                    className="form-control"
                    value={formData.firm_state}
                    onChange={handleChange}
                    style={{ 
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      padding: '10px 12px'
                    }}
                  />
                </div>
              </div>
              <div className="col-4">
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '500', color: '#333' }}>Pincode</label>
                  <input
                    type="text"
                    name="firm_pincode"
                    className="form-control"
                    value={formData.firm_pincode}
                    onChange={handleChange}
                    style={{ 
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      padding: '10px 12px'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div style={{ marginBottom: '24px' }}>
            <h5 style={{ marginBottom: '16px', color: '#3498db', fontSize: '16px', fontWeight: '600' }}>
              <i className="fas fa-phone" style={{ marginRight: '8px' }}></i>
              Contact Information
            </h5>
            <div className="row">
              <div className="col-6">
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '500', color: '#333' }}>Phone</label>
                  <input
                    type="text"
                    name="firm_phone"
                    className="form-control"
                    value={formData.firm_phone}
                    onChange={handleChange}
                    style={{ 
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      padding: '10px 12px'
                    }}
                  />
                </div>
              </div>
              <div className="col-6">
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '500', color: '#333' }}>Email</label>
                  <input
                    type="email"
                    name="firm_email"
                    className="form-control"
                    value={formData.firm_email}
                    onChange={handleChange}
                    style={{ 
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      padding: '10px 12px'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Legal Information */}
          <div style={{ marginBottom: '24px' }}>
            <h5 style={{ marginBottom: '16px', color: '#3498db', fontSize: '16px', fontWeight: '600' }}>
              <i className="fas fa-file-alt" style={{ marginRight: '8px' }}></i>
              Legal Information
            </h5>
            <div className="row">
              <div className="col-4">
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '500', color: '#333' }}>PAN Number</label>
                  <input
                    type="text"
                    name="firm_pan"
                    className="form-control"
                    value={formData.firm_pan}
                    onChange={handleChange}
                    style={{ 
                      textTransform: 'uppercase',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      padding: '10px 12px'
                    }}
                  />
                </div>
              </div>
              <div className="col-4">
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '500', color: '#333' }}>GSTIN</label>
                  <input
                    type="text"
                    name="firm_gstin"
                    className="form-control"
                    value={formData.firm_gstin}
                    onChange={handleChange}
                    style={{ 
                      textTransform: 'uppercase',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      padding: '10px 12px'
                    }}
                  />
                </div>
              </div>
              <div className="col-4">
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '500', color: '#333' }}>TAN</label>
                  <input
                    type="text"
                    name="firm_tan"
                    className="form-control"
                    value={formData.firm_tan}
                    onChange={handleChange}
                    style={{ 
                      textTransform: 'uppercase',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      padding: '10px 12px'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Status */}
          {firm && (
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: '500', color: '#333' }}>Status</label>
              <select
                name="status"
                className="form-control form-select"
                value={formData.status}
                onChange={handleChange}
                style={{ 
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  padding: '10px 12px'
                }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '20px 30px',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          backgroundColor: '#f8f9fa'
        }}>
          <button 
            type="button" 
            onClick={onSuccess}
            style={{
              padding: '10px 20px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              backgroundColor: '#fff',
              color: '#666',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={loading}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: '#3498db',
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Saving...' : (firm ? 'Update Firm' : 'Add Firm')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FirmManagement;