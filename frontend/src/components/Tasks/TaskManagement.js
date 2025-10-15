import React, { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, getStatusBadgeClass, getPriorityBadgeClass } from '../../utils/helpers';

// Helper function to get auth token
const getAuthToken = () => localStorage.getItem('ca_auth_token');

// ============================================================================
// NEW: Task Type Management Modal (Admin Only)
// ============================================================================
const TaskTypeManagementModal = ({ onSuccess }) => {
  const [taskTypes, setTaskTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState(null);
  const [formData, setFormData] = useState({
    type_key: '',
    type_label: '',
    icon: 'fas fa-tasks',
    color: '#6c757d',
    description: ''
  });

  useEffect(() => {
    fetchTaskTypes();
  }, []);

  const fetchTaskTypes = async () => {
    try {
      const response = await fetch('/api/tasks/types', {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      if (response.ok) {
        const data = await response.json();
        setTaskTypes(data.task_types || []);
      } else {
        console.error('Failed to fetch task types');
      }
    } catch (error) {
      console.error('Error fetching task types:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = editingType 
        ? `/api/tasks/types/${editingType.id}`
        : '/api/tasks/types';
      const method = editingType ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();
      
      if (response.ok) {
        alert(result.message || (editingType ? 'Task type updated' : 'Task type created'));
        fetchTaskTypes();
        resetForm();
      } else {
        alert(`Error: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving task type:', error);
      alert('Error saving task type');
    }
  };

  const handleEdit = (type) => {
    setEditingType(type);
    setFormData({
      type_key: type.type_key,
      type_label: type.type_label,
      icon: type.icon,
      color: type.color,
      description: type.description || ''
    });
  };

  const handleDelete = async (typeId) => {
    if (!window.confirm('Delete this task type?')) return;

    try {
      const response = await fetch(`/api/tasks/types/${typeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });

      const result = await response.json();
      
      if (response.ok) {
        alert(result.message);
        fetchTaskTypes();
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Error deleting task type:', error);
      alert('Error deleting task type');
    }
  };

  const resetForm = () => {
    setEditingType(null);
    setFormData({
      type_key: '',
      type_label: '',
      icon: 'fas fa-tasks',
      color: '#6c757d',
      description: ''
    });
  };

  const iconOptions = [
    'fas fa-tasks', 'fas fa-file-alt', 'fas fa-receipt', 'fas fa-search',
    'fas fa-comments', 'fas fa-shield-alt', 'fas fa-home', 'fas fa-briefcase',
    'fas fa-calculator', 'fas fa-certificate', 'fas fa-cog', 'fas fa-gavel',
    'fas fa-balance-scale', 'fas fa-file-contract', 'fas fa-handshake'
  ];

  const colorOptions = [
    '#3498db', '#e74c3c', '#f39c12', '#27ae60', '#9b59b6',
    '#1abc9c', '#34495e', '#16a085', '#d35400', '#95a5a6',
    '#2ecc71', '#e67e22', '#c0392b', '#8e44ad', '#2c3e50'
  ];

  return (
    <div style={{ maxWidth: '900px', height: '700px' }}>
      <div className="modal-header">
        <h3 className="modal-title">
          <i className="fas fa-cog" style={{ marginRight: '8px' }}></i>
          Manage Task Types
        </h3>
        <button className="btn btn-sm btn-outline" onClick={onSuccess}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="modal-body" style={{ display: 'flex', gap: '20px', height: '580px' }}>
        <div style={{ flex: '0 0 350px', borderRight: '1px solid #dee2e6', paddingRight: '20px' }}>
          <h5 style={{ marginBottom: '16px' }}>
            {editingType ? 'Edit Task Type' : 'Add New Task Type'}
          </h5>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Type Key *</label>
              <input
                type="text"
                className="form-control"
                value={formData.type_key}
                onChange={(e) => setFormData({ ...formData, type_key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                placeholder="legal_notice"
                required
                disabled={editingType !== null}
              />
              <small className="text-muted">Lowercase, underscores only</small>
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Display Label *</label>
              <input
                type="text"
                className="form-control"
                value={formData.type_label}
                onChange={(e) => setFormData({ ...formData, type_label: e.target.value })}
                placeholder="Legal Notice"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Icon</label>
              <select
                className="form-control form-select"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              >
                {iconOptions.map(icon => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
              <div style={{ marginTop: '8px', fontSize: '24px', color: formData.color }}>
                <i className={formData.icon}></i> Preview
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Color</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {colorOptions.map(color => (
                  <div
                    key={color}
                    onClick={() => setFormData({ ...formData, color })}
                    style={{
                      width: '32px',
                      height: '32px',
                      background: color,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      border: formData.color === color ? '3px solid #000' : '1px solid #ddd'
                    }}
                  ></div>
                ))}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Description</label>
              <textarea
                className="form-control"
                rows="2"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description"
              ></textarea>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-primary btn-sm">
                {editingType ? 'Update' : 'Create'}
              </button>
              {editingType && (
                <button type="button" className="btn btn-outline btn-sm" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <h5 style={{ marginBottom: '16px' }}>Existing Types ({taskTypes.length})</h5>
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="loading-spinner"></div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {taskTypes.map(type => (
                <div
                  key={type.id}
                  style={{
                    background: type.is_active ? 'white' : '#f8f9fa',
                    border: '1px solid #dee2e6',
                    borderRadius: '8px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    opacity: type.is_active ? 1 : 0.6
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <i className={type.icon} style={{ fontSize: '20px', color: type.color, width: '24px' }}></i>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>
                        {type.type_label}
                        {!type.is_active && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#999' }}>(Inactive)</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: '#666' }}>{type.type_key}</div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn btn-sm btn-outline" onClick={() => handleEdit(type)}>
                      <i className="fas fa-edit"></i>
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(type.id)}>
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="modal-footer">
        <button className="btn btn-primary" onClick={() => { onSuccess(); window.location.reload(); }}>
          Done
        </button>
      </div>
    </div>
  );
};
// ============================================================================
// EXISTING COMPONENTS - ALL MAINTAINED
// ============================================================================

// Task Comments Component
const TaskCommentsModal = ({ task, onSuccess }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    fetchTaskDetails();
  }, [task.id]);

  const fetchTaskDetails = async () => {
    try {
      const response = await fetch(`/api/tasks/${task.id}/details`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      }
    } catch (error) {
      console.error('Error fetching task details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          comment_text: newComment,
          created_by: user.id
        })
      });

      if (response.ok) {
        setNewComment('');
        fetchTaskDetails();
      } else {
        const error = await response.json();
        alert(`Error adding comment: ${error.message}`);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Error adding comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateComment = async (commentId, updateData) => {
    try {
      const response = await fetch(`/api/tasks/comments/${commentId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        fetchTaskDetails();
        if (editingComment === commentId) {
          setEditingComment(null);
          setEditText('');
        }
      } else {
        const error = await response.json();
        alert(`Error updating comment: ${error.message}`);
      }
    } catch (error) {
      console.error('Error updating comment:', error);
      alert('Error updating comment');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      const response = await fetch(`/api/tasks/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });

      if (response.ok) {
        fetchTaskDetails();
      } else {
        const error = await response.json();
        alert(`Error deleting comment: ${error.message}`);
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Error deleting comment');
    }
  };

  const startEdit = (comment) => {
    setEditingComment(comment.id);
    setEditText(comment.comment_text);
  };

  const cancelEdit = () => {
    setEditingComment(null);
    setEditText('');
  };

  const saveEdit = async () => {
    if (!editText.trim()) return;
    await handleUpdateComment(editingComment, { comment_text: editText });
  };

  const toggleCompletion = async (commentId, currentStatus) => {
  try {
    const response = await fetch(`/api/tasks/comments/${commentId}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ 
        is_completed: !currentStatus 
      })
    });

    if (response.ok) {
      fetchTaskDetails(); // Refresh the data
    } else {
      const error = await response.json();
      alert(`Error updating status: ${error.message}`);
    }
  } catch (error) {
    console.error('Error toggling completion:', error);
    alert('Error updating comment status');
  }
};

  return (
    <div style={{ maxWidth: '800px', height: '600px' }}>
      <div className="modal-header" style={{ borderBottom: '1px solid #dee2e6', paddingBottom: '16px' }}>
        <div>
          <h3 className="modal-title" style={{ fontSize: '18px', marginBottom: '4px' }}>
            <i className="fas fa-comments" style={{ marginRight: '8px', color: '#3498db' }}></i>
            Task Comments & Progress
          </h3>
          <div style={{ fontSize: '14px', color: '#666' }}>
            {task.title} - {task.client_name}
          </div>
        </div>
        <button className="btn btn-sm btn-outline" onClick={onSuccess}>
          <i className="fas fa-times"></i>
        </button>
      </div>

      <div className="modal-body" style={{ height: '450px', overflowY: 'auto', padding: '20px' }}>
        <form onSubmit={handleAddComment} style={{ marginBottom: '24px', background: '#f8f9fa', padding: '16px', borderRadius: '8px' }}>
          <label className="form-label" style={{ fontWeight: '600', marginBottom: '8px' }}>
            <i className="fas fa-plus-circle" style={{ marginRight: '6px' }}></i>
            Add Progress Comment
          </label>
          <textarea
            className="form-control"
            rows="3"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Document progress, issues, or updates for this task..."
            style={{ marginBottom: '12px' }}
          ></textarea>
          <button 
            type="submit" 
            className="btn btn-primary btn-sm" 
            disabled={submitting || !newComment.trim()}
          >
            {submitting ? (
              <>
                <i className="fas fa-spinner fa-spin" style={{ marginRight: '6px' }}></i>
                Adding...
              </>
            ) : (
              <>
                <i className="fas fa-plus" style={{ marginRight: '6px' }}></i>
                Add Comment
              </>
            )}
          </button>
        </form>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="loading-spinner" style={{ width: '32px', height: '32px' }}></div>
            <p style={{ marginTop: '12px', color: '#666' }}>Loading comments...</p>
          </div>
        ) : (
          <>
            {comments.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {comments.map((comment) => (
                  <div 
                    key={comment.id} 
                    style={{
                      background: 'white',
                      border: '1px solid #e1e8ed',
                      borderRadius: '12px',
                      padding: '16px',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ 
                          width: '32px', 
                          height: '32px', 
                          borderRadius: '50%', 
                          background: '#3498db',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {comment.created_by_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '14px' }}>
                            {comment.created_by_name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            {formatDate(comment.created_at)}
                            {comment.is_edited && (
                              <span style={{ marginLeft: '8px', fontStyle: 'italic' }}>
                                (edited)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          className={`btn btn-sm ${comment.is_completed ? 'btn-success' : 'btn-outline-success'}`}
                          onClick={() => toggleCompletion(comment.id, comment.is_completed)}
                          title={comment.is_completed ? 'Mark as pending' : 'Mark as completed'}
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          <i className={`fas ${comment.is_completed ? 'fa-check-circle' : 'fa-circle'}`}></i>
                          {comment.is_completed ? 'Done' : 'Todo'}
                        </button>
                      </div>
                    </div>

                    {editingComment === comment.id ? (
                      <div style={{ marginBottom: '12px' }}>
                        <textarea
                          className="form-control"
                          rows="3"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          style={{ marginBottom: '8px' }}
                        ></textarea>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            className="btn btn-sm btn-primary" 
                            onClick={saveEdit}
                            disabled={!editText.trim()}
                          >
                            Save
                          </button>
                          <button 
                            className="btn btn-sm btn-outline" 
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ 
                        marginBottom: '12px', 
                        padding: '12px',
                        background: comment.is_completed ? '#d4edda' : '#f8f9fa',
                        borderRadius: '8px',
                        borderLeft: comment.is_completed ? '4px solid #28a745' : '4px solid #6c757d'
                      }}>
                        <div style={{ fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                          {comment.comment_text}
                        </div>
                      </div>
                    )}

                    {editingComment !== comment.id && comment.created_by === user.id && (
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => startEdit(comment)}
                          title="Edit comment"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          <i className="fas fa-edit"></i>
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDeleteComment(comment.id)}
                          title="Delete comment"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          <i className="fas fa-trash"></i>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                <i className="fas fa-comments" style={{ fontSize: '48px', marginBottom: '16px', opacity: '0.5' }}></i>
                <p>No comments yet. Add the first progress update!</p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="modal-footer" style={{ borderTop: '1px solid #dee2e6', padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ fontSize: '13px', color: '#666' }}>
            Total Comments: {comments.length} | 
            Completed: {comments.filter(c => c.is_completed).length} | 
            Pending: {comments.filter(c => !c.is_completed).length}
          </div>
          <button className="btn btn-primary btn-sm" onClick={onSuccess}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Bulk Task Import Modal
const BulkTaskImportModal = ({ onSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState({ headers: [], data: [] });
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
        const text = e.target.result;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const data = lines.slice(1, 4).map(line => {
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

    try {
      const response = await fetch('/api/tasks/import', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getAuthToken()}` },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Successfully imported ${result.imported} tasks out of ${result.total} total records.${result.errors.length > 0 ? ' Some errors occurred - check console for details.' : ''}`);
        if (result.errors.length > 0) {
          console.log('Import errors:', result.errors);
        }
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
    const template = `title,client_name,assigned_to,task_type,priority,status,due_date,amount,estimated_hours,description
ITR Filing for FY 2024-25,ABC Corporation,John Smith,itr,high,pending,2024-04-15,5000,8,Individual tax return filing
GST Return March 2024,XYZ Private Ltd,Jane Doe,gst,medium,in_progress,2024-04-20,2500,4,Monthly GST return preparation
Audit Services,PQR Industries,Senior CA,audit,high,pending,2024-05-30,50000,40,Annual audit for manufacturing company`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'task_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="modal-header">
        <h3 className="modal-title">Bulk Import Tasks</h3>
        <button className="btn btn-sm btn-outline" onClick={onSuccess}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      
      <div className="modal-body">
        <div className="form-group">
          <label className="form-label">Upload CSV File</label>
          <input
            type="file"
            className="form-control"
            accept=".csv"
            onChange={handleFileChange}
          />
          <small className="text-muted">
            Upload a CSV file with task details. Staff will be assigned based on name matching.
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
            <h5>Preview (First 3 rows):</h5>
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
            <li><strong>Required columns:</strong> title, client_name</li>
            <li><strong>Task types:</strong> Use your configured task type keys</li>
            <li><strong>Priority:</strong> low, medium, high</li>
            <li><strong>Status:</strong> pending, in_progress, completed, cancelled</li>
            <li>Client names will be matched with existing clients</li>
            <li>Staff names will be matched for assignment (optional)</li>
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
          {loading ? 'Importing...' : 'Import Tasks'}
        </button>
      </div>
    </div>
  );
};

// Compact Task Form Component - UPDATED WITH DYNAMIC TASK TYPES
const CompactTaskForm = ({ task, clients, staff, taskTypes, onSuccess }) => {
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    client_id: task?.client_id || '',
    assigned_to: task?.assigned_to || '',
    priority: task?.priority || 'medium',
    task_type: task?.task_type || 'other',
    due_date: task?.due_date ? task.due_date.split('T')[0] : '',
    status: task?.status || 'pending',
    estimated_hours: task?.estimated_hours || '',
    actual_hours: task?.actual_hours || '',
    amount: task?.amount || ''
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = task ? `/api/tasks/${task.id}` : '/api/tasks';
      const method = task ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(`Error saving task: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error saving task');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div style={{ maxWidth: '500px' }}>
      <div className="modal-header">
        <h3 className="modal-title" style={{ fontSize: '18px' }}>
          {task ? 'Edit Task' : 'Add New Task'}
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
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              fontSize: '13px',
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
            onClick={() => setActiveTab('details')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              fontSize: '13px',
              fontWeight: '500',
              color: activeTab === 'details' ? '#3498db' : '#666',
              borderBottom: activeTab === 'details' ? '2px solid #3498db' : '2px solid transparent',
              cursor: 'pointer'
            }}
          >
            Details
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="modal-body" style={{ padding: '16px 20px', minHeight: '300px' }}>
          {activeTab === 'basic' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontSize: '13px', fontWeight: '500' }}>Task Title *</label>
                <input
                  type="text"
                  name="title"
                  className="form-control"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  placeholder="Enter task title"
                  style={{ padding: '8px 12px', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: '500' }}>Client *</label>
                  <select
                    name="client_id"
                    className="form-control form-select"
                    value={formData.client_id}
                    onChange={handleChange}
                    required
                    style={{ padding: '8px 12px', fontSize: '14px' }}
                  >
                    <option value="">Select Client</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name} {client.company && `(${client.company})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: '500' }}>Assign To</label>
                  <select
                    name="assigned_to"
                    className="form-control form-select"
                    value={formData.assigned_to}
                    onChange={handleChange}
                    style={{ padding: '8px 12px', fontSize: '14px' }}
                  >
                    <option value="">Unassigned</option>
                    {staff.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: '500' }}>Type</label>
                  <select
                    name="task_type"
                    className="form-control form-select"
                    value={formData.task_type}
                    onChange={handleChange}
                    style={{ padding: '8px 12px', fontSize: '14px' }}
                  >
                    {taskTypes.filter(t => t.is_active).map(type => (
                      <option key={type.type_key} value={type.type_key}>
                        {type.type_label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: '500' }}>Priority</label>
                  <select
                    name="priority"
                    className="form-control form-select"
                    value={formData.priority}
                    onChange={handleChange}
                    style={{ padding: '8px 12px', fontSize: '14px' }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: '500' }}>Status</label>
                  <select
                    name="status"
                    className="form-control form-select"
                    value={formData.status}
                    onChange={handleChange}
                    style={{ padding: '8px 12px', fontSize: '14px' }}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" style={{ fontSize: '13px', fontWeight: '500' }}>Description</label>
                <textarea
                  name="description"
                  className="form-control"
                  rows="3"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Task description"
                  style={{ padding: '8px 12px', fontSize: '14px' }}
                ></textarea>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: '500' }}>Due Date</label>
                  <input
                    type="date"
                    name="due_date"
                    className="form-control"
                    value={formData.due_date}
                    onChange={handleChange}
                    min={new Date().toISOString().split('T')[0]}
                    style={{ padding: '8px 12px', fontSize: '14px' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: '500' }}>Amount (₹)</label>
                  <input
                    type="number"
                    name="amount"
                    className="form-control"
                    value={formData.amount}
                    onChange={handleChange}
                    placeholder="0"
                    step="0.01"
                    min="0"
                    style={{ padding: '8px 12px', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: '500' }}>Estimated Hours</label>
                  <input
                    type="number"
                    name="estimated_hours"
                    className="form-control"
                    value={formData.estimated_hours}
                    onChange={handleChange}
                    placeholder="0"
                    step="0.5"
                    min="0"
                    style={{ padding: '8px 12px', fontSize: '14px' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label" style={{ fontSize: '13px', fontWeight: '500' }}>Actual Hours</label>
                  <input
                    type="number"
                    name="actual_hours"
                    className="form-control"
                    value={formData.actual_hours}
                    onChange={handleChange}
                    placeholder="0"
                    step="0.5"
                    min="0"
                    style={{ padding: '8px 12px', fontSize: '14px' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ padding: '12px 20px' }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={onSuccess}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
            {loading ? 'Saving...' : (task ? 'Update Task' : 'Add Task')}
          </button>
        </div>
      </form>
    </div>
  );
};

// TaskReassignModal
const TaskReassignModal = ({ task, staff, onSuccess }) => {
  const [selectedStaff, setSelectedStaff] = useState(task.assigned_to || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/tasks/${task.id}/reassign`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
          assigned_to: selectedStaff || null,
          reason: 'Task reassigned via management interface'
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        onSuccess();
      } else {
        const error = await response.json();
        alert(`Error: ${error.message}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error reassigning task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px' }}>
      <div className="modal-header">
        <h3 className="modal-title" style={{ fontSize: '16px' }}>Reassign Task</h3>
        <button className="btn btn-sm btn-outline" onClick={onSuccess}>
          <i className="fas fa-times"></i>
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="modal-body" style={{ padding: '16px 20px' }}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <div style={{ background: '#f8f9fa', padding: '12px', borderRadius: '6px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                {task.title}
              </div>
              <div style={{ fontSize: '13px', color: '#666' }}>
                Client: {task.client_name}
              </div>
              <div style={{ fontSize: '13px', color: '#666' }}>
                Currently: {task.assigned_to_name || 'Unassigned'}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontSize: '13px', fontWeight: '500' }}>
              Reassign to:
            </label>
            <select
              className="form-control form-select"
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              style={{ padding: '8px 12px', fontSize: '14px' }}
            >
              <option value="">Unassigned</option>
              {staff.map(member => (
                <option key={member.id} value={member.id}>
                  {member.name} ({member.role?.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="modal-footer" style={{ padding: '12px 20px' }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={onSuccess}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
            {loading ? 'Reassigning...' : 'Reassign Task'}
          </button>
        </div>
      </form>
    </div>
  );
};

// StatusBadgeWithQuickChange
const StatusBadgeWithQuickChange = ({ task, onStatusChange, userRole }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  
  const statusOptions = [
    { value: 'pending', label: 'Pending', color: 'warning' },
    { value: 'in_progress', label: 'In Progress', color: 'info' },
    { value: 'completed', label: 'Completed', color: 'success' },
    { value: 'cancelled', label: 'Cancelled', color: 'secondary' }
  ];

  const handleStatusChange = (newStatus) => {
    if (newStatus !== task.status) {
      onStatusChange(task.id, newStatus);
    }
    setShowDropdown(false);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <span 
        className={`badge ${getStatusBadgeClass(task.status, 'task')}`}
        onClick={() => setShowDropdown(!showDropdown)}
        style={{ cursor: 'pointer' }}
        title="Click to change status"
      >
        {task.status?.replace('_', ' ').toUpperCase()}
        <i className="fas fa-chevron-down" style={{ marginLeft: '4px', fontSize: '10px' }}></i>
      </span>
      
      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          zIndex: 1000,
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          minWidth: '120px',
          padding: '4px 0'
        }}>
          {statusOptions.map(option => (
            <div
              key={option.value}
              onClick={() => handleStatusChange(option.value)}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                background: option.value === task.status ? '#f8f9fa' : 'transparent'
              }}
              onMouseEnter={(e) => e.target.style.background = '#f8f9fa'}
              onMouseLeave={(e) => e.target.style.background = option.value === task.status ? '#f8f9fa' : 'transparent'}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// TaskCards
const TaskCards = ({ tasks, taskTypes, onEdit, onDelete, onReassign, onStatusChange, onViewComments, selectedType, userRole }) => {
  const getTaskTypeInfo = (taskTypeKey) => {
    const type = taskTypes.find(t => t.type_key === taskTypeKey);
    return type || { type_label: taskTypeKey, icon: 'fas fa-tasks', color: '#6c757d' };
  };

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
      gap: '16px' 
    }}>
      {tasks.map(task => {
        const typeInfo = getTaskTypeInfo(task.task_type);
        return (
          <div key={task.id} className="task-card" style={{
            background: 'white',
            border: '1px solid #e1e8ed',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.3s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '6px', lineHeight: '1.4' }}>
                  {task.title}
                </h4>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '6px' }}>
                  <i className="fas fa-user" style={{ marginRight: '6px' }}></i>
                  {task.client_name}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <StatusBadgeWithQuickChange 
                task={task} 
                onStatusChange={onStatusChange}
                userRole={userRole}
              />
              <span className={`badge ${getPriorityBadgeClass(task.priority)}`}>
                {task.priority?.toUpperCase()}
              </span>
              <span className="badge badge-info" style={{ background: typeInfo.color }}>
                <i className={typeInfo.icon} style={{ marginRight: '4px' }}></i>
                {typeInfo.type_label}
              </span>
              {task.comment_count > 0 && (
                <span 
                  className="badge badge-info"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onViewComments(task)}
                  title={`${task.comment_count} comments, ${task.pending_comments || 0} pending`}
                >
                  <i className="fas fa-comments" style={{ marginRight: '4px' }}></i>
                  {task.comment_count}
                </span>
              )}
            </div>

            <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
              {task.assigned_to_name && (
                <div style={{ marginBottom: '3px' }}>
                  <i className="fas fa-user-tie" style={{ marginRight: '6px' }}></i>
                  {task.assigned_to_name}
                </div>
              )}
              {task.due_date && (
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3px' }}>
                  <i className="fas fa-calendar" style={{ marginRight: '6px' }}></i>
                  Due: {formatDate(task.due_date)}
                  {new Date(task.due_date) < new Date() && task.status !== 'completed' && (
                    <span style={{ color: '#e74c3c', fontWeight: '600', marginLeft: '6px', fontSize: '11px' }}>
                      OVERDUE
                    </span>
                  )}
                </div>
              )}
              {task.amount && parseFloat(task.amount) > 0 && (
                <div>
                  <i className="fas fa-rupee-sign" style={{ marginRight: '6px' }}></i>
                  ₹{parseFloat(task.amount).toLocaleString()}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                <button 
                  className="btn btn-sm btn-outline"
                  onClick={() => onEdit(task)}
                  title="Edit Task"
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                >
                  <i className="fas fa-edit"></i>
                </button>
                <button 
                  className="btn btn-sm btn-info"
                  onClick={() => onReassign(task)}
                  title="Reassign Task"
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                >
                  <i className="fas fa-user-edit"></i>
                </button>
                <button 
                  className="btn btn-sm btn-success"
                  onClick={() => onViewComments(task)}
                  title={`View Comments (${task.comment_count || 0})`}
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                >
                  <i className="fas fa-comments"></i>
                </button>
              </div>
              <button 
                className="btn btn-sm btn-danger"
                onClick={() => onDelete(task.id)}
                title="Delete Task"
                style={{ padding: '4px 8px', fontSize: '12px' }}
              >
                <i className="fas fa-trash"></i>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// EnhancedTaskTable
const EnhancedTaskTable = ({ tasks, taskTypes, onEdit, onDelete, onReassign, onStatusChange, onViewComments, userRole }) => {
  const getTaskTypeInfo = (taskTypeKey) => {
    const type = taskTypes.find(t => t.type_key === taskTypeKey);
    return type || { type_label: taskTypeKey, icon: 'fas fa-tasks', color: '#6c757d' };
  };

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Client</th>
            <th>Assigned To</th>
            <th>Type</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Due Date</th>
            <th>Amount</th>
            <th>Comments</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const typeInfo = getTaskTypeInfo(task.task_type);
            return (
              <tr key={task.id}>
                <td>
                  <div>
                    <strong style={{ fontSize: '14px' }}>{task.title}</strong>
                    {task.description && (
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                        {task.description.length > 40 
                          ? `${task.description.substring(0, 40)}...`
                          : task.description
                        }
                      </div>
                    )}
                  </div>
                </td>
                <td>{task.client_name}</td>
                <td>{task.assigned_to_name || 'Unassigned'}</td>
                <td>
                  <span className="badge badge-info" style={{ fontSize: '11px', background: typeInfo.color }}>
                    {typeInfo.type_label}
                  </span>
                </td>
                <td>
                  <span className={`badge ${getPriorityBadgeClass(task.priority)}`} style={{ fontSize: '11px' }}>
                    {task.priority}
                  </span>
                </td>
                <td>
                  <StatusBadgeWithQuickChange 
                    task={task} 
                    onStatusChange={onStatusChange}
                    userRole={userRole}
                  />
                </td>
                <td>
                  {task.due_date && (
                    <div>
                      {formatDate(task.due_date)}
                      {new Date(task.due_date) < new Date() && task.status !== 'completed' && (
                        <div style={{ fontSize: '10px', color: '#e74c3c', fontWeight: '600' }}>
                          OVERDUE
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  {task.amount ? `₹${parseFloat(task.amount).toLocaleString()}` : '-'}
                </td>
                <td>
                  {task.comment_count > 0 ? (
                    <button
                      className="btn btn-sm btn-outline-success"
                      onClick={() => onViewComments(task)}
                      style={{ padding: '2px 6px', fontSize: '11px' }}
                      title={`${task.comment_count} comments, ${task.pending_comments || 0} pending`}
                    >
                      <i className="fas fa-comments" style={{ marginRight: '3px' }}></i>
                      {task.comment_count}
                      {task.pending_comments > 0 && (
                        <span style={{ color: '#f39c12' }}> ({task.pending_comments})</span>
                      )}
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => onViewComments(task)}
                      style={{ padding: '2px 6px', fontSize: '11px' }}
                      title="Add first comment"
                    >
                      <i className="fas fa-plus"></i>
                    </button>
                  )}
                </td>
                <td>
                  <div className="action-buttons">
                    <button 
                      className="btn btn-sm btn-outline"
                      onClick={() => onEdit(task)}
                      title="Edit"
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button 
                      className="btn btn-sm btn-info"
                      onClick={() => onReassign(task)}
                      title="Reassign"
                    >
                      <i className="fas fa-user-edit"></i>
                    </button>
                    <button 
                      className="btn btn-sm btn-danger"
                      onClick={() => onDelete(task.id)}
                      title="Delete"
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
  );
};

// ============================================================================
// MAIN TASK MANAGEMENT COMPONENT - WITH DYNAMIC TASK TYPES
// ============================================================================
const TaskManagement = () => {
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [staff, setStaff] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]); // DYNAMIC TASK TYPES
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('tiles');
  const [selectedTaskType, setSelectedTaskType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { openModal, closeModal } = useApp();
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const taskParams = new URLSearchParams();
      if (user?.role) taskParams.append('role', user.role);
      if (user?.id) taskParams.append('userId', user.id);

      const [tasksRes, clientsRes, staffRes, typesRes] = await Promise.all([
        fetch(`/api/tasks?${taskParams}`, {
          headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        }),
        fetch('/api/clients', {
          headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        }),
        fetch('/api/staff/active', {
          headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        }),
        fetch('/api/tasks/types', { // FETCH TASK TYPES FROM DATABASE
          headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        })
      ]);

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData.tasks || []);
      }

      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        setClients(clientsData.clients || []);
      }

      if (staffRes.ok) {
        const staffData = await staffRes.json();
        setStaff(staffData.staff || []);
      }

      if (typesRes.ok) {
        const typesData = await typesRes.json();
        setTaskTypes(typesData.task_types || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = () => {
    openModal(
      <CompactTaskForm 
        clients={clients} 
        staff={staff} 
        taskTypes={taskTypes} 
        onSuccess={() => { closeModal(); fetchData(); }} 
      />
    );
  };

  const handleEditTask = (task) => {
    openModal(
      <CompactTaskForm 
        task={task} 
        clients={clients} 
        staff={staff} 
        taskTypes={taskTypes} 
        onSuccess={() => { closeModal(); fetchData(); }} 
      />
    );
  };

  const handleBulkImport = () => {
    openModal(<BulkTaskImportModal onSuccess={() => { closeModal(); fetchData(); }} />);
  };

  const handleViewComments = (task) => {
    openModal(<TaskCommentsModal task={task} onSuccess={() => { closeModal(); fetchData(); }} />);
  };

  const handleManageTaskTypes = () => {
    openModal(<TaskTypeManagementModal onSuccess={() => { closeModal(); fetchData(); }} />);
  };

  const handleQuickStatusChange = async (taskId, newStatus) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        fetchData();
      } else {
        const error = await response.json();
        alert(`Error updating status: ${error.message}`);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating task status');
    }
  };

  const handleReassignTask = (task) => {
    openModal(<TaskReassignModal task={task} staff={staff} onSuccess={() => { closeModal(); fetchData(); }} />);
  };

  const handleDeleteTask = async (id) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        const response = await fetch(`/api/tasks/${id}`, { 
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
        if (response.ok) {
          fetchData();
        } else {
          const error = await response.json();
          alert(`Cannot delete: ${error.message}`);
        }
      } catch (error) {
        console.error('Error deleting task:', error);
        alert('Error deleting task');
      }
    }
  };

  const getTaskTypeStats = () => {
    const stats = { all: tasks.length };
    taskTypes.forEach(type => {
      stats[type.type_key] = tasks.filter(task => task.task_type === type.type_key).length;
    });
    return stats;
  };

  const filteredTasks = tasks.filter(task => {
    const matchesType = selectedTaskType === 'all' || task.task_type === selectedTaskType;
    const matchesSearch = 
      task.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.assigned_to_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    
    return matchesType && matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="loading-container" style={{ height: '400px' }}>
        <div className="loading-spinner"></div>
        <p>Loading tasks...</p>
      </div>
    );
  }

  const taskStats = getTaskTypeStats();

  // BUILD DYNAMIC TASK TYPE TILES WITH 'ALL' OPTION
  const taskTypeTiles = [
    { type_key: 'all', type_label: 'All Tasks', icon: 'fas fa-tasks', color: '#6c757d' },
    ...taskTypes
  ];

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <i className="fas fa-tasks"></i>
            Task Management
            {user?.role && !['admin', 'senior_ca'].includes(user.role) && (
              <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#666', marginLeft: '8px' }}>
                (Your Tasks Only)
              </span>
            )}
          </h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {user?.role === 'admin' && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleManageTaskTypes}
                title="Manage Task Types"
              >
                <i className="fas fa-cog"></i>
                Task Types
              </button>
            )}
            <button
              className="btn btn-success btn-sm"
              onClick={handleBulkImport}
              title="Import tasks from CSV/Excel"
            >
              <i className="fas fa-file-import"></i>
              Bulk Import
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`btn btn-sm ${viewMode === 'tiles' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setViewMode('tiles')}
              >
                <i className="fas fa-th-large"></i>
                Tiles
              </button>
              <button
                className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setViewMode('table')}
              >
                <i className="fas fa-table"></i>
                Table
              </button>
            </div>
            <button className="btn btn-primary" onClick={handleAddTask}>
              <i className="fas fa-plus"></i>
              Add Task
            </button>
          </div>
        </div>

        {viewMode === 'tiles' && (
  <div style={{ padding: '24px' }}>  {/* ADD THIS WRAPPER WITH PADDING */}
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
      gap: '16px', 
      marginBottom: '24px' 
    }}>
              {taskTypeTiles.map(type => (
                <div
                  key={type.type_key}
                  className={`task-type-tile ${selectedTaskType === type.type_key ? 'active' : ''}`}
                  onClick={() => setSelectedTaskType(type.type_key)}
                  style={{
                    background: selectedTaskType === type.type_key ? `${type.color}15` : 'white',
                    border: `2px solid ${selectedTaskType === type.type_key ? type.color : '#e1e8ed'}`,
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    transform: selectedTaskType === type.type_key ? 'translateY(-2px)' : 'none',
                    boxShadow: selectedTaskType === type.type_key ? '0 4px 12px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)'
                  }}
                >
                  <i className={type.icon} style={{ fontSize: '24px', color: type.color, marginBottom: '8px' }}></i>
                  <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>
                    {type.type_label}
                  </div>
                  <div style={{ 
                    fontSize: '20px', 
                    fontWeight: '700', 
                    color: type.color 
                  }}>
                    {taskStats[type.type_key] || 0}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="row mb-3">
          <div className="col-3">
            <input
              type="text"
              className="form-control"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="col-3">
            <select
              className="form-control form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          {viewMode === 'table' && (
            <div className="col-3">
              <select
                className="form-control form-select"
                value={selectedTaskType}
                onChange={(e) => setSelectedTaskType(e.target.value)}
              >
                {taskTypeTiles.map(type => (
                  <option key={type.type_key} value={type.type_key}>
                    {type.type_label} ({taskStats[type.type_key] || 0})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {viewMode === 'table' ? (
          <EnhancedTaskTable 
            tasks={filteredTasks}
            taskTypes={taskTypes}
            onEdit={handleEditTask}
            onDelete={handleDeleteTask}
            onReassign={handleReassignTask}
            onStatusChange={handleQuickStatusChange}
            onViewComments={handleViewComments}
            userRole={user?.role}
          />
        ) : (
          <TaskCards 
            tasks={filteredTasks}
            taskTypes={taskTypes}
            onEdit={handleEditTask}
            onDelete={handleDeleteTask}
            onReassign={handleReassignTask}
            onStatusChange={handleQuickStatusChange}
            onViewComments={handleViewComments}
            selectedType={selectedTaskType}
            userRole={user?.role}
          />
        )}

        {filteredTasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            <i className="fas fa-tasks" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
            <p>
              {selectedTaskType === 'all' 
                ? 'No tasks found' 
                : `No ${taskTypeTiles.find(t => t.type_key === selectedTaskType)?.type_label} tasks found`
              }
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
              <button className="btn btn-primary" onClick={handleAddTask}>
                Create New Task
              </button>
              <button className="btn btn-success" onClick={handleBulkImport}>
                Import Tasks
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskManagement;