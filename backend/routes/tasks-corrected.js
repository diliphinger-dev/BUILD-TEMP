const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { query } = require('../config/database');
const { logAuditEvent } = require('../middleware/auditLogger');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Configure multer for bulk import
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const fileExtension = file.originalname.toLowerCase().substr(file.originalname.lastIndexOf('.'));
    
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// ============================================================================
// SPECIFIC ROUTES (MUST COME BEFORE PARAMETERIZED ROUTES)
// ============================================================================

// Test route for debugging
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Tasks route is working' });
});

// Get all tasks (filtered by firm_id)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { firm_id, status, assigned_to, priority, task_type, role, userId } = req.query;
    
    let sql = `
      SELECT 
        t.*,
        c.name as client_name,
        s.name as assigned_to_name,
        f.name as firm_name
      FROM tasks t
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN staff s ON t.assigned_to = s.id
      LEFT JOIN firms f ON t.firm_id = f.id
      WHERE 1=1
    `;
    const params = [];

    if (firm_id) {
      sql += ' AND t.firm_id = ?';
      params.push(firm_id);
    }

    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    if (assigned_to) {
      sql += ' AND t.assigned_to = ?';
      params.push(assigned_to);
    }

    if (priority) {
      sql += ' AND t.priority = ?';
      params.push(priority);
    }

    if (task_type) {
      sql += ' AND t.task_type = ?';
      params.push(task_type);
    }

    if (role && !['admin', 'senior_ca'].includes(role) && userId) {
      sql += ' AND t.assigned_to = ?';
      params.push(userId);
    }

    sql += ' ORDER BY t.due_date ASC, t.priority DESC, t.created_at DESC';

    const tasks = await query(sql, params);
    res.json({ success: true, tasks, data: tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new task - FIXED VERSION
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      firm_id, title, description, client_id, assigned_to, priority, task_type,
      due_date, status, estimated_hours, actual_hours, amount
    } = req.body;

    // Auto-assign to first available firm if not provided
    let actualFirmId = firm_id;
    if (!actualFirmId) {
      const defaultFirm = await query('SELECT id FROM firms WHERE status = ? ORDER BY id ASC LIMIT 1', ['active']);
      if (defaultFirm.length > 0) {
        actualFirmId = defaultFirm[0].id;
      } else {
        return res.status(400).json({ success: false, message: 'No active firms found' });
      }
    }

    if (!title || !client_id) {
      return res.status(400).json({
        success: false,
        message: 'Title and client are required'
      });
    }

    // Verify client exists
    const client = await query('SELECT id FROM clients WHERE id = ?', [client_id]);
    if (client.length === 0) {
      return res.status(400).json({ success: false, message: 'Client not found' });
    }

    const result = await query(`
      INSERT INTO tasks (
        firm_id, title, description, client_id, assigned_to, priority, task_type,
        due_date, status, estimated_hours, actual_hours, amount, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      actualFirmId, 
      title, 
      description, 
      client_id, 
      assigned_to || null, 
      priority || 'medium',
      task_type || 'other', 
      due_date || null, 
      status || 'pending',
      estimated_hours || 0, 
      actual_hours || 0, 
      amount || 0, 
      req.user?.id || 1
    ]);

    const taskId = result.lastInsertRowid || result.insertId;

    res.json({
      success: true,
      message: 'Task created successfully',
      taskId: taskId,
      data: { id: taskId }
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single task
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const tasks = await query(`
      SELECT 
        t.*,
        c.name as client_name,
        s.name as assigned_to_name,
        f.name as firm_name
      FROM tasks t
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN staff s ON t.assigned_to = s.id
      LEFT JOIN firms f ON t.firm_id = f.id
      WHERE t.id = ?
    `, [req.params.id]);

    if (tasks.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({ success: true, data: tasks[0], task: tasks[0] });
  } catch (error) {
    console.error('Error fetching single task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update task
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const {
      title, description, client_id, assigned_to, priority, task_type,
      due_date, status, estimated_hours, actual_hours, amount
    } = req.body;

    const taskId = req.params.id;

    const currentTasks = await query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (currentTasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const oldTask = currentTasks[0];

    let completionDate = oldTask.completion_date;
    if (status === 'completed' && oldTask.status !== 'completed') {
      completionDate = new Date().toISOString();
    }

    await query(`
      UPDATE tasks SET
        title = ?, description = ?, client_id = ?, assigned_to = ?,
        priority = ?, task_type = ?, due_date = ?, status = ?,
        estimated_hours = ?, actual_hours = ?, amount = ?,
        completion_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      title, description, client_id, assigned_to || null, priority,
      task_type, due_date || null, status, estimated_hours || 0,
      actual_hours || 0, amount || 0, completionDate,