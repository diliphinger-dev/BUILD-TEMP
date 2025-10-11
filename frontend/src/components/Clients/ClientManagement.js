import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';

// FIXED: Add the same auth token helper from StaffManagement.js
const getAuthToken = (appContext) => {
  // First try to get from AppContext if available
  if (appContext?.token) {
    console.log('Auth Token: Found in AppContext');
    return appContext.token;
  }
  
  // Try localStorage with multiple possible keys
  const token = localStorage.getItem('ca_auth_token') || 
                localStorage.getItem('token') || 
                localStorage.getItem('authToken') ||
                localStorage.getItem('auth_token');
  
  console.log('Auth Token:', token ? 'Found in localStorage' : 'Not Found');
  
  if (!token) {
    console.error('No auth token available. Available localStorage keys:', Object.keys(localStorage));
  }
  
  return token;
};

const ClientManagement = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const appContext = useApp();
  const { openModal, closeModal } = appContext;

  useEffect(() => {
    // FIXED: Check for authentication before fetching
    const token = getAuthToken(appContext);
    if (token) {
      fetchClients();
    } else {
      console.warn('No authentication token found - user needs to log in');
      setLoading(false);
    }
  }, []);

  const fetchClients = async () => {
    try {
      const token = getAuthToken(appContext);
      
      if (!token) {
        console.error('No auth token found');
        setLoading(false);
        return;
      }

      // FIXED: Add authentication headers
      const response = await fetch('/api/clients', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 401) {
        console.error('Authentication failed - token may be invalid or expired');
      } else if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      } else {
        console.error('Failed to fetch clients:', response.status);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddClient = () => {
    openModal(<ClientForm appContext={appContext} onSuccess={() => { closeModal(); fetchClients(); }} />);
  };

  const handleImportClients = () => {
    openModal(<ClientImportModal appContext={appContext} onSuccess={() => { closeModal(); fetchClients(); }} />);
  };

  const handleEditClient = (client) => {
    openModal(<ClientForm appContext={appContext} client={client} onSuccess={() => { closeModal(); fetchClients(); }} />);
  };

  const handleDeleteClient = async (id) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      try {
        const token = getAuthToken(appContext);
        // FIXED: Add authentication headers
        const response = await fetch(`/api/clients/${id}`, { 
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          fetchClients();
        } else {
          const error = await response.json();
          alert(`Cannot delete: ${error.message}`);
        }
      } catch (error) {
        console.error('Error deleting client:', error);
        alert('Error deleting client');
      }
    }
  };

  const filteredClients = clients.filter(client =>
    client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.company?.toLowerCase().includes(searchTerm.toLowerCase())||
    client.phone?.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, '')) // Phone search
  );

  if (loading) {
    return (
      <div className="loading-container" style={{ height: '400px' }}>
        <div className="loading-spinner"></div>
        <p>Loading clients...</p>
      </div>
    );
  }

  // FIXED: Add authentication check like in StaffManagement.js
  const token = getAuthToken(appContext);
  if (!token) {
    return (
      <div className="card">
        <div className="card-body" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-lock" style={{ fontSize: '64px', color: '#ccc', marginBottom: '20px' }}></i>
          <h3>Authentication Required</h3>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Please log in to access Client Management
          </p>
          <button 
            className="btn btn-primary"
            onClick={() => window.location.href = '/login'}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <i className="fas fa-users"></i>
            Client Management
          </h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-success" onClick={handleImportClients}>
              <i className="fas fa-file-excel"></i>
              Import from Excel
            </button>
            <button className="btn btn-primary" onClick={handleAddClient}>
              <i className="fas fa-plus"></i>
              Add Client
            </button>
          </div>
        </div>

        <div className="row mb-3">
          <div className="col">
            <input
              type="text"
              className="form-control"
              placeholder="Search clients by name, email, company, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {filteredClients.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Company</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <div>
                        <strong>{client.name}</strong>
                        {client.pan_number && (
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            PAN: {client.pan_number}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>{client.email || '-'}</td>
                    <td>{client.phone || '-'}</td>
                    <td>{client.company || '-'}</td>
                    <td>
                      <span className={`badge ${client.client_type === 'company' ? 'badge-info' : 'badge-secondary'}`}>
                        {client.client_type}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${client.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                        {client.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn btn-sm btn-outline"
                          onClick={() => handleEditClient(client)}
                          title="Edit Client"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button 
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteClient(client.id)}
                          title="Delete Client"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <i className="fas fa-users" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
            <p>No clients found</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={handleAddClient}>
                Add Your First Client
              </button>
              <button className="btn btn-success" onClick={handleImportClients}>
                Import from Excel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// FIXED: Client Import Modal Component with authentication
const ClientImportModal = ({ onSuccess, appContext }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      previewFile(selectedFile);
    }
  };

  const previewFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        // This is a basic CSV reader for preview
        const text = e.target.result;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const data = lines.slice(1, 6).map(line => {
          const values = line.split(',');
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index]?.trim() || '';
          });
          return row;
        }).filter(row => Object.values(row).some(val => val));
        
        setPreviewData({ headers, data });
        setShowPreview(true);
      } catch (error) {
        console.error('Error previewing file:', error);
        alert('Error reading file. Please check the format.');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!file) return;
    
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    const token = getAuthToken(appContext);

    try {
      // FIXED: Add authentication headers
      const response = await fetch('/api/clients/import', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Successfully imported ${result.imported} clients`);
        onSuccess();
      } else {
        const error = await response.json();
        alert(`Import failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = `name,email,phone,company,client_type,address,city,state,postal_code,pan_number,gstin
John Doe,john@example.com,9876543210,ABC Corp,company,123 Main St,Mumbai,Maharashtra,400001,ABCPD1234E,27ABCPD1234E1Z5
Jane Smith,jane@example.com,9876543211,,individual,456 Oak Ave,Delhi,Delhi,110001,XYZPQ5678F,`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'client_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="modal-header">
        <h3 className="modal-title">Import Clients from Excel/CSV</h3>
        <button className="btn btn-sm btn-outline" onClick={onSuccess}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label">Upload Excel/CSV File</label>
          <input
            type="file"
            className="form-control"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
          />
          <small className="text-muted">
            Supported formats: CSV, Excel (.xlsx, .xls)
          </small>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <button 
            type="button" 
            className="btn btn-outline btn-sm"
            onClick={downloadTemplate}
          >
            <i className="fas fa-download"></i>
            Download Template
          </button>
        </div>

        {showPreview && previewData.data.length > 0 && (
          <div>
            <h4>Preview (First 5 rows):</h4>
            <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
              <table className="table" style={{ fontSize: '12px' }}>
                <thead>
                  <tr>
                    {previewData.headers.map((header, index) => (
                      <th key={index}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.data.map((row, index) => (
                    <tr key={index}>
                      {previewData.headers.map((header, colIndex) => (
                        <td key={colIndex}>{row[header] || '-'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px' }}>
          <h5>Import Instructions:</h5>
          <ul style={{ fontSize: '14px', marginBottom: '0' }}>
            <li>Download the template file for correct format</li>
            <li>Required columns: name, email (optional but recommended)</li>
            <li>Client types: individual, company, partnership, llp, trust</li>
            <li>Make sure there are no empty rows in your file</li>
          </ul>
        </div>
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onSuccess}>
          Cancel
        </button>
        <button 
          type="button" 
          className="btn btn-primary" 
          onClick={handleImport}
          disabled={!file || loading}
        >
          {loading ? 'Importing...' : 'Import Clients'}
        </button>
      </div>
    </div>
  );
};

// FIXED: Client Form Component with authentication
const ClientForm = ({ client, onSuccess, appContext }) => {
  const [formData, setFormData] = useState({
    name: client?.name || '',
    email: client?.email || '',
    phone: client?.phone || '',
    company: client?.company || '',
    address: client?.address || '',
    city: client?.city || '',
    state: client?.state || '',
    postal_code: client?.postal_code || '',
    pan_number: client?.pan_number || '',
    gstin: client?.gstin || '',
    client_type: client?.client_type || 'individual',
    status: client?.status || 'active'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = getAuthToken(appContext);
      
      if (!token) {
        alert('Authentication required. Please log in again.');
        setLoading(false);
        return;
      }

      const url = client ? `/api/clients/${client.id}` : '/api/clients';
      const method = client ? 'PUT' : 'POST';

      // FIXED: Add authentication headers
      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.status === 401) {
        alert('Session expired. Please log in again.');
        setLoading(false);
        return;
      }

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(`Error saving client: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error saving client');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div>
      <div className="modal-header">
        <h3 className="modal-title">
          {client ? 'Edit Client' : 'Add New Client'}
        </h3>
        <button className="btn btn-sm btn-outline" onClick={onSuccess}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="row">
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input
                  type="text"
                  name="name"
                  className="form-control"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  name="email"
                  className="form-control"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  type="text"
                  name="phone"
                  className="form-control"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">Company</label>
                <input
                  type="text"
                  name="company"
                  className="form-control"
                  value={formData.company}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea
              name="address"
              className="form-control"
              rows="3"
              value={formData.address}
              onChange={handleChange}
            ></textarea>
          </div>

          <div className="row">
            <div className="col-3">
              <div className="form-group">
                <label className="form-label">City</label>
                <input
                  type="text"
                  name="city"
                  className="form-control"
                  value={formData.city}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="col-3">
              <div className="form-group">
                <label className="form-label">State</label>
                <input
                  type="text"
                  name="state"
                  className="form-control"
                  value={formData.state}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="col-3">
              <div className="form-group">
                <label className="form-label">Postal Code</label>
                <input
                  type="text"
                  name="postal_code"
                  className="form-control"
                  value={formData.postal_code}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">PAN Number</label>
                <input
                  type="text"
                  name="pan_number"
                  className="form-control"
                  value={formData.pan_number}
                  onChange={handleChange}
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
            </div>
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">GSTIN</label>
                <input
                  type="text"
                  name="gstin"
                  className="form-control"
                  value={formData.gstin}
                  onChange={handleChange}
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">Client Type</label>
                <select
                  name="client_type"
                  className="form-control form-select"
                  value={formData.client_type}
                  onChange={handleChange}
                >
                  <option value="individual">Individual</option>
                  <option value="company">Company</option>
                  <option value="partnership">Partnership</option>
                  <option value="llp">LLP</option>
                  <option value="trust">Trust</option>
                </select>
              </div>
            </div>
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  name="status"
                  className="form-control form-select"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onSuccess}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : (client ? 'Update Client' : 'Add Client')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ClientManagement;