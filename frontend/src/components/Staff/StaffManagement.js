import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import AdminPasswordResetModal from './AdminPasswordResetModal';

// Helper function to get auth token from multiple sources
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

const StaffManagement = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const appContext = useApp();
  const { openModal, closeModal, user } = appContext;

  useEffect(() => {
    // Only fetch staff if we have authentication
    const token = getAuthToken(appContext);
    if (token) {
      fetchStaff();
    } else {
      console.warn('No authentication token found - user needs to log in');
      setLoading(false);
    }
  }, []);

  const fetchStaff = async () => {
    try {
      const token = getAuthToken(appContext);
      
      if (!token) {
        console.error('No auth token found');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/staff', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 401) {
        console.error('Authentication failed - token may be invalid or expired');
      } else if (response.ok) {
        const data = await response.json();
        setStaff(data.staff || []);
      } else {
        console.error('Failed to fetch staff:', response.status);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = () => {
    openModal(<EnhancedStaffForm appContext={appContext} onSuccess={() => { closeModal(); fetchStaff(); }} />);
  };

  const handleEditStaff = (member) => {
    openModal(<EnhancedStaffForm appContext={appContext} staff={member} onSuccess={() => { closeModal(); fetchStaff(); }} />);
  };

  const handleResetPassword = (member) => {
    openModal(
      <AdminPasswordResetModal 
        staff={member} 
        appContext={appContext} 
        onSuccess={() => { 
          closeModal(); 
          fetchStaff(); 
        }} 
      />
    );
  };

  const handleDeleteStaff = async (id) => {
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      try {
        const token = getAuthToken(appContext);
        const response = await fetch(`/api/staff/${id}`, { 
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          fetchStaff();
        } else {
          const error = await response.json();
          alert(`Cannot delete: ${error.message}`);
        }
      } catch (error) {
        console.error('Error deleting staff:', error);
        alert('Error deleting staff member');
      }
    }
  };

  const handleViewPerformance = (member) => {
    openModal(<StaffPerformanceModal appContext={appContext} staff={member} onClose={closeModal} />);
  };

  const handleManageLeaves = (member) => {
    openModal(<LeaveManagementModal appContext={appContext} staff={member} onClose={closeModal} />);
  };

  const handleManageSkills = (member) => {
    alert('Skills & Training management coming soon!');
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: 'badge-danger',
      senior_ca: 'badge-success',
      junior_ca: 'badge-info',
      assistant: 'badge-warning',
      intern: 'badge-secondary'
    };
    return colors[role] || 'badge-secondary';
  };

  const filteredStaff = staff.filter(member =>
    member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-container" style={{ height: '400px' }}>
        <div className="loading-spinner"></div>
        <p>Loading staff...</p>
      </div>
    );
  }

  // Check if user is authenticated
  const token = getAuthToken(appContext);
  if (!token) {
    return (
      <div className="card">
        <div className="card-body" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <i className="fas fa-lock" style={{ fontSize: '64px', color: '#ccc', marginBottom: '20px' }}></i>
          <h3>Authentication Required</h3>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Please log in to access Staff Management
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
            <i className="fas fa-user-tie"></i>
            Staff Management
          </h3>
          <button className="btn btn-primary" onClick={handleAddStaff}>
            <i className="fas fa-plus"></i>
            Add Staff Member
          </button>
        </div>

        <div className="row mb-3">
          <div className="col">
            <input
              type="text"
              className="form-control"
              placeholder="Search staff by name, email, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {filteredStaff.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div>
                        <strong>{member.name}</strong>
                        {member.joining_date && (
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            Joined: {new Date(member.joining_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getRoleBadgeColor(member.role)}`}>
                        {member.role?.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td>{member.phone || '-'}</td>
                    <td>{member.email}</td>
                    <td>
                      <span className={`badge ${member.status === 'active' ? 'badge-success' : 'badge-secondary'}`}>
                        {member.status?.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn btn-sm btn-outline"
                          onClick={() => handleEditStaff(member)}
                          title="Edit Staff"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        
                        {/* PASSWORD RESET BUTTON - NEW */}
                        {user?.role === 'admin' && (
                          <button 
                            className="btn btn-sm btn-warning"
                            onClick={() => handleResetPassword(member)}
                            title="Reset Password"
                          >
                            <i className="fas fa-key"></i>
                          </button>
                        )}
                        
                        {(user?.role === 'admin' || user?.role === 'senior_ca') && (
                          <button 
                            className="btn btn-sm btn-info"
                            onClick={() => handleViewPerformance(member)}
                            title="View Performance"
                          >
                            <i className="fas fa-chart-line"></i>
                          </button>
                        )}
                        
                        <button 
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleManageLeaves(member)}
                          title="Manage Leaves"
                        >
                          <i className="fas fa-calendar-alt"></i>
                        </button>
                        
                        <button 
                          className="btn btn-sm btn-success"
                          onClick={() => handleManageSkills(member)}
                          title="Skills & Training"
                        >
                          <i className="fas fa-graduation-cap"></i>
                        </button>
                        
                        {member.id !== 1 && user?.role === 'admin' && (
                          <button 
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeleteStaff(member.id)}
                            title="Delete Staff"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <i className="fas fa-user-tie" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
            <p>No staff members found</p>
            <button className="btn btn-primary" onClick={handleAddStaff}>
              Add Your First Staff Member
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Staff Performance Dashboard
const StaffPerformanceModal = ({ staff, onClose, appContext }) => {
  const [performanceData, setPerformanceData] = useState({
    tasks: { completed: 0, pending: 0, overdue: 0 },
    attendance: { present: 0, absent: 0, late: 0, percentage: 0 },
    revenue: { generated: 0, pending: 0 },
    productivity: { averageTaskTime: 0, tasksPerDay: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchPerformanceData();
  }, [staff.id, dateRange]);

  const fetchPerformanceData = async () => {
    try {
      const token = getAuthToken(appContext);
      const response = await fetch(`/api/staff/${staff.id}/performance?start=${dateRange.start}&end=${dateRange.end}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPerformanceData(data.performance);
      }
    } catch (error) {
      console.error('Error fetching performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPerformanceRating = () => {
    const score = 
      (performanceData.attendance.percentage * 0.3) +
      (performanceData.tasks.completed / (performanceData.tasks.completed + performanceData.tasks.pending) * 100 * 0.4) +
      (performanceData.productivity.tasksPerDay * 10 * 0.3);
    
    if (score >= 90) return { rating: 'Excellent', color: '#27ae60' };
    if (score >= 75) return { rating: 'Good', color: '#3498db' };
    if (score >= 60) return { rating: 'Average', color: '#f39c12' };
    return { rating: 'Needs Improvement', color: '#e74c3c' };
  };

  const rating = getPerformanceRating();

  return (
    <div style={{ width: '800px', maxHeight: '90vh', overflow: 'auto' }}>
      <div className="modal-header">
        <h3 className="modal-title">
          <i className="fas fa-chart-line" style={{ marginRight: '8px' }}></i>
          Performance Dashboard - {staff.name}
        </h3>
        <button className="btn btn-sm btn-outline" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="modal-body">
        <div style={{ marginBottom: '20px', padding: '16px', background: '#f8f9fa', borderRadius: '8px' }}>
          <div className="row">
            <div className="col-2">
              <label className="form-label">Start Date</label>
              <input
                type="date"
                className="form-control"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
            </div>
            <div className="col-2">
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-control"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
          </div>
        ) : (
          <>
            <div style={{ 
              textAlign: 'center', 
              padding: '24px', 
              background: rating.color + '20', 
              borderRadius: '12px',
              marginBottom: '24px',
              border: `2px solid ${rating.color}`
            }}>
              <h4 style={{ color: rating.color, marginBottom: '8px' }}>Overall Performance</h4>
              <div style={{ fontSize: '48px', fontWeight: '700', color: rating.color }}>
                {rating.rating}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
              <div className="stat-card" style={{ borderLeftColor: '#3498db' }}>
                <h5 style={{ marginBottom: '16px', color: '#2c3e50' }}>
                  <i className="fas fa-tasks" style={{ marginRight: '8px' }}></i>
                  Task Performance
                </h5>
                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: '600', color: '#27ae60' }}>
                      {performanceData.tasks.completed}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Completed</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: '600', color: '#f39c12' }}>
                      {performanceData.tasks.pending}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Pending</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: '600', color: '#e74c3c' }}>
                      {performanceData.tasks.overdue}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Overdue</div>
                  </div>
                </div>
                <div style={{ marginTop: '16px', textAlign: 'center' }}>
                  <small className="text-muted">
                    Avg. completion time: {performanceData.productivity.averageTaskTime} days
                  </small>
                </div>
              </div>

              <div className="stat-card" style={{ borderLeftColor: '#27ae60' }}>
                <h5 style={{ marginBottom: '16px', color: '#2c3e50' }}>
                  <i className="fas fa-calendar-check" style={{ marginRight: '8px' }}></i>
                  Attendance Record
                </h5>
                <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: '36px', fontWeight: '700', color: '#27ae60' }}>
                    {performanceData.attendance.percentage}%
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>Attendance Rate</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '12px' }}>
                  <div>Present: {performanceData.attendance.present}</div>
                  <div>Absent: {performanceData.attendance.absent}</div>
                  <div>Late: {performanceData.attendance.late}</div>
                </div>
              </div>

              <div className="stat-card" style={{ borderLeftColor: '#9b59b6' }}>
                <h5 style={{ marginBottom: '16px', color: '#2c3e50' }}>
                  <i className="fas fa-rupee-sign" style={{ marginRight: '8px' }}></i>
                  Revenue Contribution
                </h5>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: '600', color: '#27ae60' }}>
                    ₹{performanceData.revenue.generated.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Generated</div>
                </div>
                <div style={{ textAlign: 'center', marginTop: '12px' }}>
                  <div style={{ fontSize: '18px', fontWeight: '500', color: '#f39c12' }}>
                    ₹{performanceData.revenue.pending.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Pending Collection</div>
                </div>
              </div>

              <div className="stat-card" style={{ borderLeftColor: '#e74c3c' }}>
                <h5 style={{ marginBottom: '16px', color: '#2c3e50' }}>
                  <i className="fas fa-tachometer-alt" style={{ marginRight: '8px' }}></i>
                  Productivity Metrics
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: '600' }}>
                      {performanceData.productivity.tasksPerDay.toFixed(1)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Tasks per Day</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: '600' }}>
                      {Math.round(performanceData.tasks.completed / performanceData.tasks.pending * 100) || 0}%
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>Completion Rate</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
              <h5 style={{ marginBottom: '16px' }}>
                <i className="fas fa-history" style={{ marginRight: '8px' }}></i>
                Recent Activities
              </h5>
              <div style={{ color: '#666', fontSize: '14px' }}>
                Recent activity timeline will be displayed here...
              </div>
            </div>
          </>
        )}
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Close
        </button>
        <button type="button" className="btn btn-primary">
          <i className="fas fa-download"></i>
          Export Report
        </button>
      </div>
    </div>
  );
};

// Leave Management Modal
const LeaveManagementModal = ({ staff, onClose, appContext }) => {
  const [leaves, setLeaves] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState({
    casual: 0,
    sick: 0,
    earned: 0,
    unpaid: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaveData();
  }, [staff.id]);

  const fetchLeaveData = async () => {
    try {
      const token = getAuthToken(appContext);
      const response = await fetch(`/api/staff/${staff.id}/leaves`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLeaves(data.leaves || []);
        setLeaveBalance(data.balance || { casual: 0, sick: 0, earned: 0, unpaid: 0 });
      }
    } catch (error) {
      console.error('Error fetching leave data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveLeave = async (leaveId, status) => {
    try {
      const token = getAuthToken(appContext);
      const response = await fetch(`/api/leaves/${leaveId}/approve`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        fetchLeaveData();
      }
    } catch (error) {
      alert('Error updating leave status');
    }
  };

  return (
    <div style={{ width: '700px' }}>
      <div className="modal-header">
        <h3 className="modal-title">
          <i className="fas fa-calendar-alt" style={{ marginRight: '8px' }}></i>
          Leave Management - {staff.name}
        </h3>
        <button className="btn btn-sm btn-outline" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="modal-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          <div style={{ background: '#e8f5e9', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#2e7d32' }}>
              {leaveBalance.casual}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>Casual Leave</div>
          </div>
          <div style={{ background: '#fff3e0', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#ef6c00' }}>
              {leaveBalance.sick}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>Sick Leave</div>
          </div>
          <div style={{ background: '#e3f2fd', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#1565c0' }}>
              {leaveBalance.earned}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>Earned Leave</div>
          </div>
          <div style={{ background: '#fce4ec', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#c2185b' }}>
              {leaveBalance.unpaid}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>Unpaid Leave</div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="loading-spinner"></div>
          </div>
        ) : leaves.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Days</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((leave) => (
                  <tr key={leave.id}>
                    <td>{leave.leave_type}</td>
                    <td>{new Date(leave.start_date).toLocaleDateString()}</td>
                    <td>{new Date(leave.end_date).toLocaleDateString()}</td>
                    <td>{leave.days}</td>
                    <td>
                      <span className={`badge badge-${
                        leave.status === 'approved' ? 'success' : 
                        leave.status === 'rejected' ? 'danger' : 'warning'
                      }`}>
                        {leave.status}
                      </span>
                    </td>
                    <td>
                      {leave.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button 
                            className="btn btn-sm btn-success"
                            onClick={() => handleApproveLeave(leave.id, 'approved')}
                          >
                            Approve
                          </button>
                          <button 
                            className="btn btn-sm btn-danger"
                            onClick={() => handleApproveLeave(leave.id, 'rejected')}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <i className="fas fa-calendar-times" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
            <p>No leave records found</p>
          </div>
        )}
      </div>

      <div className="modal-footer">
        <button className="btn btn-primary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

// Enhanced Staff Form
const EnhancedStaffForm = ({ staff, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: staff?.name || '',
    email: staff?.email || '',
    phone: staff?.phone || '',
    role: staff?.role || 'assistant',
    joining_date: staff?.joining_date ? staff.joining_date.split('T')[0] : '',
    salary: staff?.salary || '',
    status: staff?.status || 'active',
    
    employee_id: staff?.employee_id || '',
    department: staff?.department || 'operations',
    designation: staff?.designation || '',
    date_of_birth: staff?.date_of_birth || '',
    gender: staff?.gender || '',
    blood_group: staff?.blood_group || '',
    marital_status: staff?.marital_status || 'single',
    
    current_address: staff?.current_address || '',
    permanent_address: staff?.permanent_address || '',
    city: staff?.city || '',
    state: staff?.state || '',
    pincode: staff?.pincode || '',
    
    emergency_contact_name: staff?.emergency_contact_name || '',
    emergency_contact_phone: staff?.emergency_contact_phone || '',
    emergency_contact_relation: staff?.emergency_contact_relation || '',
    
    bank_name: staff?.bank_name || '',
    account_number: staff?.account_number || '',
    ifsc_code: staff?.ifsc_code || '',
    pan_number: staff?.pan_number || '',
    aadhar_number: staff?.aadhar_number || ''
  });
  
  const [activeTab, setActiveTab] = useState('basic');
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = getAuthToken();
      
      if (!token) {
        alert('Authentication required. Please log in again.');
        setLoading(false);
        return;
      }

      const url = staff ? `/api/staff/${staff.id}` : '/api/staff';
      const method = staff ? 'PUT' : 'POST';

      console.log('Submitting staff form:', { method, url, hasToken: !!token });

      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      console.log('Response status:', response.status);

      if (response.status === 401) {
        alert('Session expired. Please log in again.');
        setLoading(false);
        return;
      }

      if (response.ok) {
        if (documents.length > 0) {
          const formDataDoc = new FormData();
          documents.forEach((doc, index) => {
            formDataDoc.append(`documents`, doc);
          });
          formDataDoc.append('staff_id', staff?.id || response.json().staffId);

          await fetch('/api/staff/documents', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formDataDoc
          });
        }
        
        onSuccess();
      } else {
        const error = await response.json();
        console.error('Backend error response:', error);
        alert(`Error: ${error.message || JSON.stringify(error)}`);
      }
    } catch (error) {
      console.error('Error saving staff:', error);
      alert('Error saving staff member');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setDocuments(Array.from(e.target.files));
  };

  return (
    <div style={{ width: '800px' }}>
      <div className="modal-header">
        <h3 className="modal-title">
          {staff ? 'Edit Staff Member' : 'Add New Staff Member'}
        </h3>
        <button className="btn btn-sm btn-outline" onClick={onSuccess}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div style={{ borderBottom: '1px solid #dee2e6' }}>
        <div style={{ display: 'flex', gap: '0', padding: '0 20px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'none',
              fontSize: '14px',
              fontWeight: '500',
              color: activeTab === 'basic' ? '#3498db' : '#666',
              borderBottom: activeTab === 'basic' ? '2px solid #3498db' : '2px solid transparent',
              cursor: 'pointer'
            }}
          >
            Basic Info
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('personal')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'none',
              fontSize: '14px',
              fontWeight: '500',
              color: activeTab === 'personal' ? '#3498db' : '#666',
              borderBottom: activeTab === 'personal' ? '2px solid #3498db' : '2px solid transparent',
              cursor: 'pointer'
            }}
          >
            Personal Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contact')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'none',
              fontSize: '14px',
              fontWeight: '500',
              color: activeTab === 'contact' ? '#3498db' : '#666',
              borderBottom: activeTab === 'contact' ? '2px solid #3498db' : '2px solid transparent',
              cursor: 'pointer'
            }}
          >
            Contact & Address
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bank')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'none',
              fontSize: '14px',
              fontWeight: '500',
              color: activeTab === 'bank' ? '#3498db' : '#666',
              borderBottom: activeTab === 'bank' ? '2px solid #3498db' : '2px solid transparent',
              cursor: 'pointer'
            }}
          >
            Bank & Documents
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body" style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {activeTab === 'basic' && (
            <div>
              <div className="row">
                <div className="col-2">
                  <div className="form-group">
                    <label className="form-label">Employee ID</label>
                    <input
                      type="text"
                      name="employee_id"
                      className="form-control"
                      value={formData.employee_id}
                      onChange={handleChange}
                      placeholder="EMP001"
                    />
                  </div>
                </div>
                <div className="col-2">
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
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
              </div>

              <div className="row">
                <div className="col-2">
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      name="email"
                      className="form-control"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="col-2">
                  <div className="form-group">
                    <label className="form-label">Phone *</label>
                    <input
                      type="tel"
                      name="phone"
                      className="form-control"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </div>

              {!staff && (
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <input
                    type="password"
                    name="password"
                    className="form-control"
                    value={formData.password || ''}
                    onChange={handleChange}
                    required={!staff}
                    minLength="6"
                    placeholder="Minimum 6 characters"
                  />
                  <small className="text-muted">
                    This will be the staff member's login password
                  </small>
                </div>
              )}

              <div className="row">
                <div className="col-3">
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <select
                      name="role"
                      className="form-control form-select"
                      value={formData.role}
                      onChange={handleChange}
                    >
                      <option value="admin">Admin</option>
                      <option value="senior_ca">Senior CA</option>
                      <option value="junior_ca">Junior CA</option>
                      <option value="assistant">Assistant</option>
                      <option value="intern">Intern</option>
                    </select>
                  </div>
                </div>
                <div className="col-3">
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <select
                      name="department"
                      className="form-control form-select"
                      value={formData.department}
                      onChange={handleChange}
                    >
                      <option value="operations">Operations</option>
                      <option value="audit">Audit</option>
                      <option value="taxation">Taxation</option>
                      <option value="consulting">Consulting</option>
                      <option value="accounts">Accounts</option>
                    </select>
                  </div>
                </div>
                <div className="col-3">
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
                      <option value="on_leave">On Leave</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="col-2">
                  <div className="form-group">
                    <label className="form-label">Joining Date</label>
                    <input
                      type="date"
                      name="joining_date"
                      className="form-control"
                      value={formData.joining_date}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="col-2">
                  <div className="form-group">
                    <label className="form-label">Monthly Salary (₹)</label>
                    <input
                      type="number"
                      name="salary"
                      className="form-control"
                      value={formData.salary}
                      onChange={handleChange}
                      step="1000"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'personal' && (
            <div>
              <div className="row">
                <div className="col-3">
                  <div className="form-group">
                    <label className="form-label">Date of Birth</label>
                    <input
                      type="date"
                      name="date_of_birth"
                      className="form-control"
                      value={formData.date_of_birth}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="col-3">
                  <div className="form-group">
                    <label className="form-label">Gender</label>
                    <select
                      name="gender"
                      className="form-control form-select"
                      value={formData.gender}
                      onChange={handleChange}
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="col-3">
                  <div className="form-group">
                    <label className="form-label">Blood Group</label>
                    <select
                      name="blood_group"
                      className="form-control form-select"
                      value={formData.blood_group}
                      onChange={handleChange}
                    >
                      <option value="">Select</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="col-2">
                  <div className="form-group">
                    <label className="form-label">Marital Status</label>
                    <select
                      name="marital_status"
                      className="form-control form-select"
                      value={formData.marital_status}
                      onChange={handleChange}
                    >
                      <option value="single">Single</option>
                      <option value="married">Married</option>
                      <option value="divorced">Divorced</option>
                      <option value="widowed">Widowed</option>
                    </select>
                  </div>
                </div>
                <div className="col-2">
                  <div className="form-group">
                    <label className="form-label">Designation</label>
                    <input
                      type="text"
                      name="designation"
                      className="form-control"
                      value={formData.designation}
                      onChange={handleChange}
                      placeholder="e.g., Tax Consultant"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'contact' && (
            <div>
              <h5 style={{ marginBottom: '20px' }}>Current Address</h5>
              <div className="form-group">
                <label className="form-label">Address Line</label>
                <textarea
                  name="current_address"
                  className="form-control"
                  rows="2"
                  value={formData.current_address}
                  onChange={handleChange}
                  placeholder="House/Flat No, Street, Area"
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
                    <label className="form-label">PIN Code</label>
                    <input
                      type="text"
                      name="pincode"
                      className="form-control"
                      value={formData.pincode}
                      onChange={handleChange}
                      maxLength="6"
                    />
                  </div>
                </div>
              </div>

              <h5 style={{ marginTop: '24px', marginBottom: '20px' }}>Emergency Contact</h5>
              <div className="row">
                <div className="col-3">
                  <div className="form-group">
                    <label className="form-label">Contact Name</label>
                    <input
                      type="text"
                      name="emergency_contact_name"
                      className="form-control"
                      value={formData.emergency_contact_name}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="col-3">
                  <div className="form-group">
                    <label className="form-label">Contact Phone</label>
                    <input
                      type="tel"
                      name="emergency_contact_phone"
                      className="form-control"
                      value={formData.emergency_contact_phone}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="col-3">
                  <div className="form-group">
                    <label className="form-label">Relationship</label>
                    <input
                      type="text"
                      name="emergency_contact_relation"
                      className="form-control"
                      value={formData.emergency_contact_relation}
                      onChange={handleChange}
                      placeholder="e.g., Spouse, Parent"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bank' && (
            <div>
              <h5 style={{ marginBottom: '20px' }}>Bank Details</h5>
              <div className="row">
                <div className="col-3">
                  <div className="form-group">
                    <label className="form-label">Bank Name</label>
                    <input
                      type="text"
                      name="bank_name"
                      className="form-control"
                      value={formData.bank_name}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="col-3">
                  <div className="form-group">
                    <label className="form-label">Account Number</label>
                    <input
                      type="text"
                      name="account_number"
                      className="form-control"
                      value={formData.account_number}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                <div className="col-3">
                  <div className="form-group">
                    <label className="form-label">IFSC Code</label>
                    <input
                      type="text"
                      name="ifsc_code"
                      className="form-control"
                      value={formData.ifsc_code}
                      onChange={handleChange}
                      style={{ textTransform: 'uppercase' }}
                    />
                  </div>
                </div>
              </div>

              <h5 style={{ marginTop: '24px', marginBottom: '20px' }}>Government IDs</h5>
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
                      maxLength="10"
                      style={{ textTransform: 'uppercase' }}
                    />
                  </div>
                </div>
                <div className="col-2">
                  <div className="form-group">
                    <label className="form-label">Aadhar Number</label>
                    <input
                      type="text"
                      name="aadhar_number"
                      className="form-control"
                      value={formData.aadhar_number}
                      onChange={handleChange}
                      maxLength="12"
                    />
                  </div>
                </div>
              </div>

              <h5 style={{ marginTop: '24px', marginBottom: '20px' }}>Upload Documents</h5>
              <div className="form-group">
                <label className="form-label">Select Documents</label>
                <input
                  type="file"
                  className="form-control"
                  multiple
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                />
                <small className="text-muted">
                  Upload Resume, ID Proofs, Certificates (PDF, JPG, PNG, DOC)
                </small>
              </div>

              {documents.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <strong>Selected Files:</strong>
                  <ul style={{ marginTop: '8px', fontSize: '14px' }}>
                    {documents.map((doc, index) => (
                      <li key={index}>{doc.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onSuccess}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : (staff ? 'Update' : 'Create')} Staff
          </button>
        </div>
      </form>
    </div>
  );
};

export default StaffManagement;