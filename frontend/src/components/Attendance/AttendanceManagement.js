import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../utils/helpers';

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

const MarkAttendanceModal = ({ staff, selectedDate, onSuccess, appContext }) => {
  const [allStaff, setAllStaff] = useState([]);
  const [formData, setFormData] = useState({
    staff_id: staff?.id || '',
    attendance_date: selectedDate || new Date().toISOString().split('T')[0],
    check_in_time: '',
    check_out_time: '',
    status: 'present',
    location: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!staff) {
      fetchAllStaff();
    }
  }, []);

  const fetchAllStaff = async () => {
    const token = getAuthToken(appContext);
    try {
      const response = await fetch('/api/staff?status=active', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAllStaff(data.staff || []);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.staff_id) {
      alert('Please select a staff member');
      return;
    }
    
    setLoading(true);
    const token = getAuthToken(appContext);

    try {
      const response = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Attendance marked successfully. Status: ${result.status.replace('_', ' ').toUpperCase()}`);
        onSuccess();
      } else {
        const error = await response.json();
        alert(`Error marking attendance: ${error.message}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error marking attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const selectedStaff = staff || allStaff.find(s => s.id === parseInt(formData.staff_id));

  return (
    <div style={{ maxWidth: '500px' }}>
      <div className="modal-header">
        <h3 className="modal-title">
          <i className="fas fa-clock" style={{ marginRight: '8px' }}></i>
          Mark Attendance
        </h3>
        <button className="btn btn-sm btn-outline" onClick={onSuccess}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          {!staff && (
            <div className="form-group">
              <label className="form-label">Staff Member *</label>
              <select
                name="staff_id"
                className="form-control form-select"
                value={formData.staff_id}
                onChange={handleChange}
                required
              >
                <option value="">Select Staff Member</option>
                {allStaff.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.name} - {member.role?.replace('_', ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedStaff && (
            <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <strong>{selectedStaff.name}</strong> - {selectedStaff.role?.replace('_', ' ').toUpperCase()}
              <br />
              <small>{selectedStaff.email}</small>
            </div>
          )}

          <div className="row">
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input
                  type="date"
                  name="attendance_date"
                  className="form-control"
                  value={formData.attendance_date}
                  onChange={handleChange}
                  required
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
            <div className="col-2">
              <div className="form-group">
                <label className="form-label">Status *</label>
                <select
                  name="status"
                  className="form-control form-select"
                  value={formData.status}
                  onChange={handleChange}
                  required
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="half_day">Half Day</option>
                  <option value="leave">On Leave</option>
                </select>
              </div>
            </div>
          </div>

          {formData.status !== 'absent' && formData.status !== 'leave' && (
            <div className="row">
              <div className="col-2">
                <div className="form-group">
                  <label className="form-label">Check In Time</label>
                  <input
                    type="time"
                    name="check_in_time"
                    className="form-control"
                    value={formData.check_in_time}
                    onChange={handleChange}
                  />
                  <small className="text-muted">Standard: 9:00 AM</small>
                </div>
              </div>
              <div className="col-2">
                <div className="form-group">
                  <label className="form-label">Check Out Time</label>
                  <input
                    type="time"
                    name="check_out_time"
                    className="form-control"
                    value={formData.check_out_time}
                    onChange={handleChange}
                  />
                  <small className="text-muted">Standard: 6:00 PM</small>
                </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Location</label>
            <input
              type="text"
              name="location"
              className="form-control"
              value={formData.location}
              onChange={handleChange}
              placeholder="Office, Remote, Client Site, etc."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              name="notes"
              className="form-control"
              rows="3"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Additional notes about attendance"
            ></textarea>
          </div>

          {formData.check_in_time && formData.check_out_time && (
            <div style={{ background: '#e8f5e8', padding: '10px', borderRadius: '6px' }}>
              <small>
                <strong>Calculated Hours:</strong> {
                  (() => {
                    const checkIn = new Date(`${formData.attendance_date} ${formData.check_in_time}`);
                    const checkOut = new Date(`${formData.attendance_date} ${formData.check_out_time}`);
                    const diffMs = checkOut - checkIn;
                    const hours = Math.max(0, diffMs / (1000 * 60 * 60));
                    return hours.toFixed(2);
                  })()
                } hours
              </small>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onSuccess}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Marking...' : 'Mark Attendance'}
          </button>
        </div>
      </form>
    </div>
  );
};

const BulkAttendanceModal = ({ staff, selectedDate, onSuccess, appContext }) => {
  const [staffAttendance, setStaffAttendance] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initialData = staff.map(member => ({
      staff_id: member.id,
      staff_name: member.name,
      status: 'present',
      check_in_time: '09:00',
      check_out_time: '18:00',
      notes: ''
    }));
    setStaffAttendance(initialData);
  }, [staff]);

  const handleStatusChange = (index, field, value) => {
    const updated = [...staffAttendance];
    updated[index][field] = value;
    
    if (field === 'status' && ['absent', 'leave'].includes(value)) {
      updated[index].check_in_time = '';
      updated[index].check_out_time = '';
    }
    
    setStaffAttendance(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const token = getAuthToken(appContext);

    try {
      const response = await fetch('/api/attendance/bulk-mark', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          attendance_date: selectedDate,
          staff_attendance: staffAttendance
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`${result.message}\n${result.errors.length > 0 ? 'Some errors occurred - check details.' : ''}`);
        if (result.errors.length > 0) {
          console.log('Bulk attendance errors:', result.errors);
        }
        onSuccess();
      } else {
        const error = await response.json();
        alert(`Error in bulk attendance: ${error.message}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error processing bulk attendance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', maxHeight: '80vh' }}>
      <div className="modal-header">
        <h3 className="modal-title">
          <i className="fas fa-users-clock" style={{ marginRight: '8px' }}></i>
          Bulk Attendance - {formatDate(selectedDate)}
        </h3>
        <button className="btn btn-sm btn-outline" onClick={onSuccess}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <div className="table-container">
            <table className="table" style={{ fontSize: '13px' }}>
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Status</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {staffAttendance.map((attendance, index) => (
                  <tr key={attendance.staff_id}>
                    <td><strong>{attendance.staff_name}</strong></td>
                    <td>
                      <select
                        className="form-control form-select"
                        value={attendance.status}
                        onChange={(e) => handleStatusChange(index, 'status', e.target.value)}
                        style={{ minWidth: '100px', fontSize: '12px' }}
                      >
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="late">Late</option>
                        <option value="half_day">Half Day</option>
                        <option value="leave">On Leave</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="time"
                        className="form-control"
                        value={attendance.check_in_time}
                        onChange={(e) => handleStatusChange(index, 'check_in_time', e.target.value)}
                        disabled={['absent', 'leave'].includes(attendance.status)}
                        style={{ minWidth: '100px', fontSize: '12px' }}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        className="form-control"
                        value={attendance.check_out_time}
                        onChange={(e) => handleStatusChange(index, 'check_out_time', e.target.value)}
                        disabled={['absent', 'leave'].includes(attendance.status)}
                        style={{ minWidth: '100px', fontSize: '12px' }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control"
                        value={attendance.notes}
                        onChange={(e) => handleStatusChange(index, 'notes', e.target.value)}
                        placeholder="Notes"
                        style={{ minWidth: '120px', fontSize: '12px' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '8px', marginTop: '16px' }}>
            <h6 style={{ marginBottom: '8px' }}>Quick Actions:</h6>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm btn-outline-success"
                onClick={() => {
                  const updated = staffAttendance.map(s => ({ 
                    ...s, 
                    status: 'present',
                    check_in_time: '09:00',
                    check_out_time: '18:00'
                  }));
                  setStaffAttendance(updated);
                }}
              >
                Mark All Present
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-warning"
                onClick={() => {
                  const updated = staffAttendance.map(s => ({ 
                    ...s, 
                    check_in_time: '09:15',
                    status: 'late'
                  }));
                  setStaffAttendance(updated);
                }}
              >
                Mark All Late
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  const updated = staffAttendance.map(s => ({ 
                    ...s, 
                    check_in_time: '09:00',
                    check_out_time: '18:00',
                    status: 'present',
                    notes: ''
                  }));
                  setStaffAttendance(updated);
                }}
              >
                Reset All
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onSuccess}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Processing...' : `Mark Attendance for ${staffAttendance.length} Staff`}
          </button>
        </div>
      </form>
    </div>
  );
};

const TodayAttendanceWidget = ({ todayData, onRefresh, onMarkAttendance, onBulkMark, onHolidaySync, user }) => {
  if (!todayData) return null;

  const { summary, attendance } = todayData;
  const attendanceRate = summary.total_staff > 0 
    ? ((summary.present / summary.total_staff) * 100).toFixed(1)
    : 0;

  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <div className="card-header" style={{ 
        background: 'linear-gradient(135deg, #3498db, #2980b9)', 
        color: 'white' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: '0', fontSize: '16px' }}>
              <i className="fas fa-calendar-day" style={{ marginRight: '8px' }}></i>
              Today's Attendance - {formatDate(todayData.today_date)}
            </h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', opacity: '0.9' }}>
              {summary.present} of {summary.total_staff} staff present ({attendanceRate}%)
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-sm btn-light" onClick={onRefresh} title="Refresh data">
              <i className="fas fa-sync-alt"></i>
            </button>
            {user?.role === 'admin' && (
              <button 
                className="btn btn-sm btn-light"
                onClick={onHolidaySync}
                title="Sync holiday calendar and mark attendance for holidays/Sundays"
              >
                <i className="fas fa-calendar-alt"></i>
              </button>
            )}
            <button className="btn btn-sm btn-success" onClick={onBulkMark}>
              <i className="fas fa-users"></i>
              Bulk Mark
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <div className="stats-grid" style={{ 
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
          gap: '12px', 
          marginBottom: '16px' 
        }}>
          <div style={{ textAlign: 'center', padding: '12px', background: '#d4edda', borderRadius: '8px' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#155724' }}>{summary.present}</div>
            <div style={{ fontSize: '12px', color: '#155724' }}>Present</div>
          </div>
          <div style={{ textAlign: 'center', padding: '12px', background: '#f8d7da', borderRadius: '8px' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#721c24' }}>{summary.absent}</div>
            <div style={{ fontSize: '12px', color: '#721c24' }}>Absent</div>
          </div>
          <div style={{ textAlign: 'center', padding: '12px', background: '#fff3cd', borderRadius: '8px' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#856404' }}>{summary.late}</div>
            <div style={{ fontSize: '12px', color: '#856404' }}>Late</div>
          </div>
          <div style={{ textAlign: 'center', padding: '12px', background: '#cce5ff', borderRadius: '8px' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#004085' }}>{summary.on_leave}</div>
            <div style={{ fontSize: '12px', color: '#004085' }}>On Leave</div>
          </div>
          <div style={{ textAlign: 'center', padding: '12px', background: '#e2e3e5', borderRadius: '8px' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#383d41' }}>{summary.not_marked}</div>
            <div style={{ fontSize: '12px', color: '#383d41' }}>Not Marked</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {attendance.slice(0, 6).map(staff => (
            <div 
              key={staff.staff_id} 
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: staff.status ? getStatusColor(staff.status) : '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                fontSize: '13px'
              }}
            >
              <div>
                <strong>{staff.staff_name}</strong>
                <br />
                {staff.check_in_time && (
                  <span style={{ color: '#666', fontSize: '11px' }}>
                    In: {staff.check_in_time}
                    {staff.check_out_time && ` | Out: ${staff.check_out_time}`}
                  </span>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`badge badge-${getStatusBadgeClass(staff.status)}`} style={{ fontSize: '10px' }}>
                  {staff.status ? staff.status.replace('_', ' ').toUpperCase() : 'NOT MARKED'}
                </span>
                {!staff.status && (
                  <div style={{ marginTop: '4px' }}>
                    <button
                      className="btn btn-xs btn-primary"
                      onClick={() => onMarkAttendance(staff)}
                      style={{ fontSize: '10px', padding: '2px 6px' }}
                    >
                      Mark
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {attendance.length > 6 && (
          <div style={{ textAlign: 'center', marginTop: '12px' }}>
            <small style={{ color: '#666' }}>
              and {attendance.length - 6} more staff members...
            </small>
          </div>
        )}
      </div>
    </div>
  );
};

const getStatusColor = (status) => {
  switch (status) {
    case 'present': return '#d4edda';
    case 'absent': return '#f8d7da';
    case 'late': return '#fff3cd';
    case 'half_day': return '#d1ecf1';
    case 'leave': return '#e2e3e5';
    default: return '#f8f9fa';
  }
};

const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'present': return 'success';
    case 'absent': return 'danger';
    case 'late': return 'warning';
    case 'half_day': return 'info';
    case 'leave': return 'secondary';
    default: return 'light';
  }
};

const Attendance = () => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [staff, setStaff] = useState([]);
  const [todayData, setTodayData] = useState(null);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    staff_id: 'all',
    start_date: '',
    end_date: '',
    status: 'all',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });
  const [activeTab, setActiveTab] = useState('today');

  const appContext = useApp();
  const { openModal, closeModal } = appContext;
  const { user } = useAuth();

  const hasAccessToAttendance = user && ['admin', 'senior_ca'].includes(user.role);

  useEffect(() => {
    if (hasAccessToAttendance) {
      fetchData();
      fetchTodayData();
      fetchStaff();
    } else {
      setLoading(false);
    }
  }, [hasAccessToAttendance, filters]);

  const fetchData = async () => {
    const token = getAuthToken(appContext);
    
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.staff_id) queryParams.append('staff_id', filters.staff_id);
      if (filters.start_date) queryParams.append('start_date', filters.start_date);
      if (filters.end_date) queryParams.append('end_date', filters.end_date);
      if (filters.status) queryParams.append('status', filters.status);
      
      const response = await fetch(`/api/attendance?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAttendanceData(data.attendance || []);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const fetchTodayData = async () => {
    const token = getAuthToken(appContext);
    
    try {
      const response = await fetch('/api/attendance/today', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTodayData(data);
      }
    } catch (error) {
      console.error('Error fetching today\'s attendance:', error);
    }
  };

  const fetchStaff = async () => {
    const token = getAuthToken(appContext);
    
    try {
      const response = await fetch('/api/staff?status=active', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStaff(data.staff || []);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const fetchStats = async () => {
    const token = getAuthToken(appContext);
    
    try {
      const response = await fetch(`/api/attendance/stats?month=${filters.month}&year=${filters.year}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats || {});
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccessToAttendance && activeTab === 'statistics') {
      fetchStats();
    }
  }, [hasAccessToAttendance, filters.month, filters.year, activeTab]);

  const handleMarkAttendance = (staff = null) => {
    const today = new Date().toISOString().split('T')[0];
    openModal(
      <MarkAttendanceModal 
        staff={staff} 
        selectedDate={today}
        appContext={appContext}
        onSuccess={() => { 
          closeModal(); 
          fetchData(); 
          fetchTodayData(); 
        }} 
      />
    );
  };

  const handleBulkMark = () => {
    const today = new Date().toISOString().split('T')[0];
    openModal(
      <BulkAttendanceModal 
        staff={staff}
        selectedDate={today}
        appContext={appContext}
        onSuccess={() => { 
          closeModal(); 
          fetchData(); 
          fetchTodayData(); 
        }} 
      />
    );
  };

  const handleHolidaySync = async () => {
    const token = getAuthToken(appContext);
    
    try {
      const response = await fetch('/api/attendance/sync-holidays', { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        alert('Holiday calendar synced successfully');
        fetchTodayData();
        fetchData();
      } else {
        const error = await response.json();
        alert(`Error syncing holidays: ${error.message}`);
      }
    } catch (error) {
      console.error('Error syncing holidays:', error);
      alert('Error syncing holiday calendar');
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  if (!hasAccessToAttendance) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
        <i className="fas fa-lock" style={{ fontSize: '64px', color: '#e74c3c', marginBottom: '20px' }}></i>
        <h3 style={{ color: '#e74c3c', marginBottom: '16px' }}>Access Restricted</h3>
        <p style={{ color: '#666', fontSize: '16px' }}>
          Attendance management is only accessible to administrators and senior staff members.
        </p>
        <div style={{ marginTop: '20px' }}>
          <a href="/dashboard" className="btn btn-primary">
            <i className="fas fa-home"></i>
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (loading && activeTab !== 'today') {
    return (
      <div className="loading-container" style={{ height: '400px' }}>
        <div className="loading-spinner"></div>
        <p>Loading attendance data...</p>
      </div>
    );
  }

  const tabConfig = [
    { key: 'today', label: "Today's Attendance", icon: 'fas fa-calendar-day' },
    { key: 'records', label: 'Attendance Records', icon: 'fas fa-list' },
    { key: 'statistics', label: 'Statistics & Reports', icon: 'fas fa-chart-bar' }
  ];

  return (
    <div>
      {activeTab === 'today' && (
        <TodayAttendanceWidget 
          todayData={todayData}
          onRefresh={fetchTodayData}
          onMarkAttendance={handleMarkAttendance}
          onBulkMark={handleBulkMark}
          onHolidaySync={handleHolidaySync}
          user={user}
        />
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <i className="fas fa-user-clock"></i>
            Attendance Management
          </h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {user?.role === 'admin' && (
              <button 
                className="btn btn-outline-info"
                onClick={handleHolidaySync}
                title="Sync holiday calendar and mark attendance for holidays/Sundays"
              >
                <i className="fas fa-calendar-alt"></i>
                Sync Holidays
              </button>
            )}
            <button className="btn btn-primary" onClick={() => handleMarkAttendance()}>
              <i className="fas fa-plus"></i>
              Mark Attendance
            </button>
          </div>
        </div>

        <div style={{ borderBottom: '1px solid #dee2e6' }}>
          <div style={{ display: 'flex', gap: '0', padding: '0 24px' }}>
            {tabConfig.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '16px 24px',
                  border: 'none',
                  background: 'none',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: activeTab === tab.key ? '#3498db' : '#666',
                  borderBottom: activeTab === tab.key ? '3px solid #3498db' : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
              >
                <i className={tab.icon} style={{ marginRight: '8px' }}></i>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'today' && (
          <div style={{ padding: '24px' }}>
            <div style={{ textAlign: 'center', color: '#666' }}>
              <i className="fas fa-calendar-check" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
              <h4>Today's Attendance Overview</h4>
              <p>View and manage today's attendance above. Use other tabs for historical data and reports.</p>
            </div>
          </div>
        )}

        {activeTab === 'records' && (
          <AttendanceRecordsTab 
            attendanceData={attendanceData}
            staff={staff}
            filters={filters}
            onFilterChange={handleFilterChange}
            onMarkAttendance={handleMarkAttendance}
          />
        )}

        {activeTab === 'statistics' && (
          <AttendanceStatisticsTab 
            stats={stats}
            filters={filters}
            onFilterChange={handleFilterChange}
          />
        )}
      </div>
    </div>
  );
};

const AttendanceRecordsTab = ({ attendanceData, staff, filters, onFilterChange, onMarkAttendance }) => {
  return (
    <div style={{ padding: '24px' }}>
      <div className="row mb-3">
        <div className="col-3">
          <label className="form-label">Staff Member</label>
          <select
            className="form-control form-select"
            value={filters.staff_id}
            onChange={(e) => onFilterChange('staff_id', e.target.value)}
          >
            <option value="all">All Staff</option>
            {staff.map(member => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-2">
          <label className="form-label">Start Date</label>
          <input
            type="date"
            className="form-control"
            value={filters.start_date}
            onChange={(e) => onFilterChange('start_date', e.target.value)}
          />
        </div>
        <div className="col-2">
          <label className="form-label">End Date</label>
          <input
            type="date"
            className="form-control"
            value={filters.end_date}
            onChange={(e) => onFilterChange('end_date', e.target.value)}
          />
        </div>
        <div className="col-2">
          <label className="form-label">Status</label>
          <select
            className="form-control form-select"
            value={filters.status}
            onChange={(e) => onFilterChange('status', e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="late">Late</option>
            <option value="half_day">Half Day</option>
            <option value="leave">On Leave</option>
          </select>
        </div>
        <div className="col-3" style={{ display: 'flex', alignItems: 'end', gap: '8px' }}>
          <button
            className="btn btn-outline-secondary"
            onClick={() => {
              onFilterChange('start_date', '');
              onFilterChange('end_date', '');
              onFilterChange('staff_id', 'all');
              onFilterChange('status', 'all');
            }}
          >
            <i className="fas fa-times"></i>
            Clear
          </button>
        </div>
      </div>

      {attendanceData.length > 0 ? (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Staff Member</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Total Hours</th>
                <th>Status</th>
                <th>Location</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {attendanceData.map((record) => (
                <tr key={record.id}>
                  <td>{formatDate(record.attendance_date)}</td>
                  <td>
                    <strong>{record.staff_name}</strong>
                    <br />
                    <small style={{ color: '#666' }}>{record.staff_role?.replace('_', ' ').toUpperCase()}</small>
                  </td>
                  <td>{record.check_in_time || '-'}</td>
                  <td>{record.check_out_time || '-'}</td>
                  <td>
                    {record.total_hours 
                      ? `${parseFloat(record.total_hours).toFixed(2)}h` 
                      : '-'
                    }
                  </td>
                  <td>
                    <span className={`badge badge-${getStatusBadgeClass(record.status)}`}>
                      {record.status?.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td>{record.location || '-'}</td>
                  <td>{record.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          <i className="fas fa-calendar-times" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
          <p>No attendance records found for the selected criteria</p>
        </div>
      )}
    </div>
  );
};

const AttendanceStatisticsTab = ({ stats, filters, onFilterChange }) => {
  return (
    <div style={{ padding: '24px' }}>
      <div className="row mb-4">
        <div className="col-2">
          <label className="form-label">Month</label>
          <select
            className="form-control form-select"
            value={filters.month}
            onChange={(e) => onFilterChange('month', parseInt(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2024, i, 1).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>
        <div className="col-2">
          <label className="form-label">Year</label>
          <select
            className="form-control form-select"
            value={filters.year}
            onChange={(e) => onFilterChange('year', parseInt(e.target.value))}
          >
            {Array.from({ length: 5 }, (_, i) => (
              <option key={2020 + i} value={2020 + i}>
                {2020 + i}
              </option>
            ))}
          </select>
        </div>
      </div>

      {stats.overall && (
        <div className="stats-grid" style={{ marginBottom: '24px' }}>
          <div className="stat-card" style={{ borderLeftColor: '#3498db' }}>
            <div className="stat-number">{stats.overall.total_staff}</div>
            <div className="stat-label">Active Staff</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#27ae60' }}>
            <div className="stat-number">{stats.overall.present_days}</div>
            <div className="stat-label">Present Days</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#e74c3c' }}>
            <div className="stat-number">{stats.overall.absent_days}</div>
            <div className="stat-label">Absent Days</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#f39c12' }}>
            <div className="stat-number">{stats.overall.late_days}</div>
            <div className="stat-label">Late Arrivals</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#9b59b6' }}>
            <div className="stat-number">{parseFloat(stats.overall.avg_hours_per_day || 0).toFixed(1)}h</div>
            <div className="stat-label">Avg Hours/Day</div>
          </div>
        </div>
      )}

      {stats.staff_summary && stats.staff_summary.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h5 style={{ marginBottom: '16px' }}>Staff Attendance Summary</h5>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Role</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Late</th>
                  <th>Total Hours</th>
                  <th>Attendance %</th>
                </tr>
              </thead>
              <tbody>
                {stats.staff_summary.map((staff) => (
                  <tr key={staff.id}>
                    <td><strong>{staff.name}</strong></td>
                    <td>{staff.role?.replace('_', ' ').toUpperCase()}</td>
                    <td>{staff.present_days}</td>
                    <td>{staff.absent_days}</td>
                    <td>{staff.late_days}</td>
                    <td>{parseFloat(staff.total_hours || 0).toFixed(1)}h</td>
                    <td>
                      <span 
                        className={`badge ${staff.attendance_percentage >= 90 ? 'badge-success' : 
                          staff.attendance_percentage >= 80 ? 'badge-warning' : 'badge-danger'}`}
                      >
                        {parseFloat(staff.attendance_percentage || 0).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;