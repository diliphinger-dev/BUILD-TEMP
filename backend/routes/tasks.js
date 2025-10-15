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

// Task analytics endpoint - UPDATED for global clients
router.get('/analytics', requireAuth, async (req, res) => {
  try {
    const { start_date, end_date, group_by = 'status', firm_id } = req.query;
    
    let sql = `
      SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
        SUM(CASE WHEN due_date < DATE('now') AND status != 'completed' THEN 1 ELSE 0 END) as overdue_tasks,
        SUM(amount) as total_value,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as completed_value
      FROM tasks
      WHERE 1=1
    `;
    
    const params = [];
    
    if (firm_id) {
      sql += ' AND firm_id = ?';
      params.push(firm_id);
    }
    
    if (start_date) {
      sql += ' AND created_at >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND created_at <= ?';
      params.push(end_date);
    }
    
    const analytics = await query(sql, params);
    
    // Type distribution
    let typeParams = [start_date || '2000-01-01', end_date || '2099-12-31'];
    let typeSql = `
      SELECT 
        task_type,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM tasks
      WHERE created_at BETWEEN ? AND ?
    `;
    
    if (firm_id) {
      typeSql += ' AND firm_id = ?';
      typeParams.push(firm_id);
    }
    
    typeSql += ' GROUP BY task_type ORDER BY count DESC';
    
    const typeDistribution = await query(typeSql, typeParams);
    
    // Client summary - UPDATED for global clients
    let clientParams = [];
    let clientSql = `
      SELECT 
        c.name as client_name,
        COUNT(t.id) as task_count,
        SUM(t.amount) as total_amount,
        SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_count
      FROM clients c
      LEFT JOIN tasks t ON c.id = t.client_id
      WHERE 1=1
    `;
    
    if (firm_id) {
      clientSql += ' AND t.firm_id = ?';
      clientParams.push(firm_id);
    }
    
    clientSql += `
      GROUP BY c.id, c.name
      HAVING task_count > 0
      ORDER BY total_amount DESC
      LIMIT 10
    `;
    
    const clientSummary = await query(clientSql, clientParams);
    
    res.json({
      success: true,
      analytics: analytics[0],
      type_distribution: typeDistribution,
      top_clients: clientSummary
    });
  } catch (error) {
    console.error('Error in analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get tasks ready for billing
router.get('/ready-for-billing', requireAuth, async (req, res) => {
  try {
    const { firm_id } = req.query;
    let sql = `
      SELECT 
        t.id,
        t.title,
        t.amount,
        t.status,
        t.completion_date,
        c.name as client_name,
        c.id as client_id,
        c.company as client_company
      FROM tasks t
      LEFT JOIN clients c ON t.client_id = c.id
      WHERE t.status = 'completed' 
        AND COALESCE(t.amount, 0) > 0
        AND t.id NOT IN (
          SELECT COALESCE(task_id, 0) 
          FROM invoices 
          WHERE task_id IS NOT NULL
        )
    `;
    
    const params = [];
    if (firm_id && firm_id !== 'null' && firm_id !== 'undefined') {
      sql += ' AND t.firm_id = ?';
      params.push(firm_id);
    }
    
    sql += ' ORDER BY t.completion_date DESC LIMIT 100';

    const tasks = await query(sql, params);

    res.json({ 
      success: true, 
      tasks: tasks || [],
      data: tasks || []
    });
  } catch (error) {
    console.error('Error fetching ready for billing tasks:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Error fetching ready for billing tasks',
      tasks: []
    });
  }
});

// Batch update tasks - SQLite Compatible
router.put('/batch-update', requireAuth, async (req, res) => {
  try {
    const { task_ids, updates } = req.body;
    
    if (!Array.isArray(task_ids) || task_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Task IDs array is required'
      });
    }
    
    const allowedFields = ['status', 'priority', 'assigned_to'];
    const updateFields = [];
    const updateValues = [];
    
    Object.keys(updates).forEach(field => {
      if (allowedFields.includes(field) && updates[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updates[field]);
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }
    
    // SQLite compatible batch update
    for (const taskId of task_ids) {
      const sql = `UPDATE tasks SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      await query(sql, [...updateValues, taskId]);
    }
    
    res.json({
      success: true,
      message: `${task_ids.length} tasks updated successfully`
    });
  } catch (error) {
    console.error('Error in batch update:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk import tasks from CSV - UPDATED for global clients
router.post('/import', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const { firm_id } = req.body;
  
  if (!firm_id) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, message: 'Firm ID is required' });
  }

  const filePath = req.file.path;
  const tasks = [];
  let imported = 0;
  let errors = [];

  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          const cleanRow = {};
          Object.keys(row).forEach(key => {
            cleanRow[key.trim().toLowerCase().replace(/\s+/g, '_')] = row[key]?.trim() || '';
          });
          
          const task = {
            title: cleanRow.title || cleanRow.task_title || '',
            description: cleanRow.description || cleanRow.task_description || '',
            client_name: cleanRow.client_name || cleanRow.client || '',
            staff_name: cleanRow.assigned_to || cleanRow.staff_name || cleanRow.assigned_staff || '',
            priority: (cleanRow.priority || 'medium').toLowerCase(),
            task_type: (cleanRow.task_type || cleanRow.type || 'other').toLowerCase(),
            due_date: cleanRow.due_date || cleanRow.deadline || '',
            amount: parseFloat(cleanRow.amount || cleanRow.fee || 0) || 0,
            estimated_hours: parseFloat(cleanRow.estimated_hours || cleanRow.hours || 0) || 0,
            status: (cleanRow.status || 'pending').toLowerCase()
          };

          if (task.title && task.client_name) {
            tasks.push(task);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    for (const task of tasks) {
      try {
        // Find client by name or company (global search, no firm_id)
        let clientResults = await query(
          'SELECT id FROM clients WHERE (name LIKE ? OR company LIKE ?) LIMIT 1',
          [`%${task.client_name}%`, `%${task.client_name}%`]
        );
        
        if (clientResults.length === 0) {
          errors.push(`Client '${task.client_name}' not found for task '${task.title}'`);
          continue;
        }
        
        const client_id = clientResults[0].id;
        
        let assigned_to = null;
        if (task.staff_name) {
          const staffResults = await query(
            'SELECT id FROM staff WHERE name LIKE ? AND status = ? LIMIT 1',
            [`%${task.staff_name}%`, 'active']
          );
          
          if (staffResults.length > 0) {
            assigned_to = staffResults[0].id;
          } else {
            errors.push(`Staff '${task.staff_name}' not found, task '${task.title}' will be unassigned`);
          }
        }

        const validTypes = await query('SELECT type_key FROM task_types WHERE is_active = 1');
        const validTaskTypes = validTypes.map(t => t.type_key);
        if (!validTaskTypes.includes(task.task_type)) {
          task.task_type = 'other';
        }

        const validPriorities = ['low', 'medium', 'high'];
        if (!validPriorities.includes(task.priority)) {
          task.priority = 'medium';
        }

        const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
        if (!validStatuses.includes(task.status)) {
          task.status = 'pending';
        }

        let due_date = null;
        if (task.due_date) {
          const parsedDate = new Date(task.due_date);
          if (!isNaN(parsedDate.getTime())) {
            due_date = parsedDate.toISOString().split('T')[0];
          }
        }

        const result = await query(`
          INSERT INTO tasks (
            firm_id, title, description, client_id, assigned_to, priority, task_type,
            due_date, status, estimated_hours, amount, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          firm_id, task.title, task.description, client_id, assigned_to, task.priority,
          task.task_type, due_date, task.status, task.estimated_hours, 
          task.amount, req.user?.id || 1
        ]);

        await query(`
          INSERT INTO task_history (task_id, action_type, new_value, changed_by)
          VALUES (?, 'created', ?, ?)
        `, [result.lastInsertRowid || result.insertId, JSON.stringify({ title: task.title, client_id: client_id }), req.user?.id || 1]);
        
        imported++;
      } catch (dbError) {
        errors.push(`Error importing task '${task.title}': ${dbError.message}`);
      }
    }

    fs.unlinkSync(filePath);

    res.json({
      success: true,
      imported,
      total: tasks.length,
      errors: errors.slice(0, 10)
    });

  } catch (error) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    console.error('Bulk import error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Import failed', 
      error: error.message 
    });
  }
});

// ============================================================================
// TASK TYPES MANAGEMENT - SQLite Compatible
// ============================================================================

// Get all task types - FIXED SQLite Compatible
router.get('/types', requireAuth, async (req, res) => {
  try {
    const { include_inactive } = req.query;
    
    let sql = 'SELECT * FROM task_types';
    const params = [];
    
    if (!include_inactive || include_inactive === 'false') {
      sql += ' WHERE is_active = 1';
    }
    sql += ' ORDER BY display_order ASC, type_label ASC';
    
    const types = await query(sql, params);
    
    res.json({
      success: true,
      task_types: types || []
    });
  } catch (error) {
    console.error('Error fetching task types:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      task_types: []
    });
  }
});

// Reorder task types
router.put('/types-reorder', requireAuth, async (req, res) => {
  try {
    const { type_orders } = req.body;

    if (!Array.isArray(type_orders)) {
      return res.status(400).json({
        success: false,
        message: 'type_orders must be an array'
      });
    }

    for (const item of type_orders) {
      await query('UPDATE task_types SET display_order = ? WHERE id = ?', [
        item.display_order,
        item.id
      ]);
    }

    res.json({
      success: true,
      message: 'Task types reordered successfully'
    });
  } catch (error) {
    console.error('Error reordering task types:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// MAIN TASK ROUTES - SQLite Compatible
// ============================================================================

// Get all tasks (filtered by firm_id)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { firm_id, status, assigned_to, priority, task_type, role, userId } = req.query;
    
    let sql = `
      SELECT 
        t.*,
        c.name as client_name,
        s.name as assigned_to_name,
        f.name as firm_name,
        (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id) as comment_count
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

// Create new task - UPDATED for global clients - FIXED VERSION
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
      actualFirmId, title, description, client_id, assigned_to || null, priority || 'medium',
      task_type || 'other', due_date || null, status || 'pending',
      estimated_hours || 0, actual_hours || 0, amount || 0, req.user?.id || 1
    ]);

    const taskId = result.lastInsertRowid || result.insertId;

    await query(`
      INSERT INTO task_history (task_id, action_type, new_value, changed_by)
      VALUES (?, 'created', ?, ?)
    `, [taskId, JSON.stringify({ title, client_id, assigned_to }), req.user?.id || 1]);

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

// Create new task type
router.post('/types', requireAuth, async (req, res) => {
  try {
    const {
      type_key,
      type_label,
      icon,
      color,
      description,
      display_order
    } = req.body;

    if (!type_key || !type_label) {
      return res.status(400).json({
        success: false,
        message: 'Type key and label are required'
      });
    }

    const existing = await query('SELECT id FROM task_types WHERE type_key = ?', [type_key]);
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Task type key already exists'
      });
    }

    const result = await query(`
      INSERT INTO task_types (
        type_key, type_label, icon, color, description, display_order, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      type_key,
      type_label,
      icon || 'fas fa-tasks',
      color || '#6c757d',
      description || null,
      display_order || 0,
      req.user?.id || 1
    ]);

    res.json({
      success: true,
      message: 'Task type created successfully',
      task_type_id: result.lastInsertRowid || result.insertId
    });
  } catch (error) {
    console.error('Error creating task type:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// PARAMETERIZED ROUTES (MUST COME AFTER SPECIFIC ROUTES)
// ============================================================================

// Get task with history
router.get('/:id/details', requireAuth, async (req, res) => {
  try {
    const taskId = req.params.id;
    
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
    `, [taskId]);

    if (tasks.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const comments = await query(`
      SELECT 
        tc.*,
        s.name as created_by_name
      FROM task_comments tc
      LEFT JOIN staff s ON tc.created_by = s.id
      WHERE tc.task_id = ?
      ORDER BY tc.created_at DESC
    `, [taskId]);

    const history = await query(`
      SELECT 
        th.*,
        s.name as changed_by_name,
        s.role as changed_by_role
      FROM task_history th
      LEFT JOIN staff s ON th.changed_by = s.id
      WHERE th.task_id = ?
      ORDER BY th.created_at DESC
    `, [taskId]);

    res.json({ 
      success: true, 
      task: tasks[0],
      data: tasks[0],
      comments: comments,
      history: history
    });
  } catch (error) {
    console.error('Error fetching task details:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get task history only
router.get('/:id/history', requireAuth, async (req, res) => {
  try {
    const history = await query(`
      SELECT 
        th.*,
        s.name as changed_by_name,
        s.role as changed_by_role
      FROM task_history th
      LEFT JOIN staff s ON th.changed_by = s.id
      WHERE th.task_id = ?
      ORDER BY th.created_at DESC
    `, [req.params.id]);

    res.json({
      success: true,
      history: history
    });
  } catch (error) {
    console.error('Error fetching task history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Task Reassignment with History - SQLite Compatible
router.put('/:id/reassign', requireAuth, async (req, res) => {
  try {
    const { assigned_to, reason } = req.body;
    const taskId = req.params.id;

    // Fix: Add proper validation
    if (!taskId || isNaN(taskId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID'
      });
    }

    const taskExists = await query('SELECT id, assigned_to, title FROM tasks WHERE id = ?', [taskId]);
    if (taskExists.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const currentTask = taskExists[0];

    // Fix: Properly handle assigned_to validation
    if (assigned_to && assigned_to !== '' && assigned_to !== 'null') {
      const staffExists = await query(
        'SELECT id, name FROM staff WHERE id = ? AND status = ?', 
        [assigned_to, 'active']
      );
      
      if (staffExists.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Selected staff member not found or inactive'
        });
      }
    }

    // Fix: Normalize values for comparison
    const currentAssigned = currentTask.assigned_to ? currentTask.assigned_to.toString() : null;
    const newAssigned = (assigned_to && assigned_to !== '' && assigned_to !== 'null') ? assigned_to.toString() : null;

    if (currentAssigned === newAssigned) {
      return res.status(400).json({
        success: false,
        message: 'Task is already assigned to this person'
      });
    }

    const oldAssignment = currentTask.assigned_to;

    // Fix: Update task assignment
    await query(`
      UPDATE tasks 
      SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newAssigned, taskId]);

    // Fix: Add task history with proper error handling
    try {
      await query(`
        INSERT INTO task_history (task_id, action_type, old_value, new_value, changed_by, change_reason)
        VALUES (?, 'reassigned', ?, ?, ?, ?)
      `, [
        taskId, 
        oldAssignment ? oldAssignment.toString() : 'unassigned',
        newAssigned ? newAssigned.toString() : 'unassigned',
        req.user?.id || 1,
        reason || 'No reason provided'
      ]);
    } catch (historyError) {
      console.warn('Warning: Could not insert task history:', historyError.message);
      // Continue execution - don't fail the reassignment if history fails
    }

    // Fix: Return updated task information
    const updatedTask = await query(`
      SELECT 
        t.id, t.title, t.assigned_to,
        s.name as assigned_to_name
      FROM tasks t
      LEFT JOIN staff s ON t.assigned_to = s.id
      WHERE t.id = ?
    `, [taskId]);

    res.json({
      success: true,
      message: 'Task reassigned successfully',
      task: updatedTask[0]
    });

  } catch (error) {
    console.error('Error reassigning task:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Unknown error occurred'
    });
  }
});

// Task Reschedule with History - SQLite Compatible
router.put('/:id/reschedule', requireAuth, async (req, res) => {
  try {
    const { new_due_date, reason } = req.body;
    const taskId = req.params.id;

    if (!new_due_date) {
      return res.status(400).json({
        success: false,
        message: 'New due date is required'
      });
    }

    const taskExists = await query('SELECT id, due_date, title FROM tasks WHERE id = ?', [taskId]);
    if (taskExists.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const currentTask = taskExists[0];
    const oldDueDate = currentTask.due_date;

    await query(`
      UPDATE tasks 
      SET due_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [new_due_date, taskId]);

    await query(`
      INSERT INTO task_history (task_id, action_type, old_value, new_value, changed_by, change_reason)
      VALUES (?, 'rescheduled', ?, ?, ?, ?)
    `, [
      taskId,
      oldDueDate || 'no date',
      new_due_date,
      req.user?.id || 1,
      reason || 'No reason provided'
    ]);

    res.json({
      success: true,
      message: 'Task rescheduled successfully',
      old_due_date: oldDueDate,
      new_due_date: new_due_date
    });

  } catch (error) {
    console.error('Error rescheduling task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update task status - SQLite Compatible
router.put('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const taskId = req.params.id;

    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const currentTasks = await query('SELECT status FROM tasks WHERE id = ?', [taskId]);
    if (currentTasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const oldStatus = currentTasks[0].status;

    let completionDate = null;
    if (status === 'completed') {
      completionDate = new Date().toISOString();
    }

    await query(`
      UPDATE tasks SET
        status = ?, 
        completion_date = ?, 
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, completionDate, taskId]);

    await query(`
      INSERT INTO task_history (task_id, action_type, old_value, new_value, changed_by)
      VALUES (?, 'status_changed', ?, ?, ?)
    `, [taskId, oldStatus, status, req.user?.id || 1]);

    res.json({ 
      success: true, 
      message: 'Task status updated successfully',
      status: status 
    });
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add comment to task
router.post('/:id/comments', requireAuth, async (req, res) => {
  try {
    const taskId = req.params.id;
    const { comment_text, created_by } = req.body;

    if (!comment_text || !created_by) {
      return res.status(400).json({
        success: false,
        message: 'Comment text and user ID are required'
      });
    }

    const tasks = await query('SELECT id, title FROM tasks WHERE id = ?', [taskId]);
    if (tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const result = await query(`
      INSERT INTO task_comments (task_id, comment_text, created_by)
      VALUES (?, ?, ?)
    `, [taskId, comment_text, created_by]);

    res.json({
      success: true,
      message: 'Comment added successfully',
      commentId: result.lastInsertRowid || result.insertId
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single task type by ID
router.get('/types/:id', requireAuth, async (req, res) => {
  try {
    const types = await query('SELECT * FROM task_types WHERE id = ?', [req.params.id]);
    
    if (types.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task type not found'
      });
    }
    
    res.json({
      success: true,
      task_type: types[0]
    });
  } catch (error) {
    console.error('Error fetching task type:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update task type
router.put('/types/:id', requireAuth, async (req, res) => {
  try {
    const typeId = req.params.id;
    const {
      type_key,
      type_label,
      icon,
      color,
      description,
      is_active,
      display_order
    } = req.body;

    const currentTypes = await query('SELECT * FROM task_types WHERE id = ?', [typeId]);
    if (currentTypes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task type not found'
      });
    }

    const oldType = currentTypes[0];

    if (type_key && type_key !== oldType.type_key) {
      const existing = await query('SELECT id FROM task_types WHERE type_key = ? AND id != ?', [type_key, typeId]);
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Task type key already exists'
        });
      }
    }

    await query(`
      UPDATE task_types SET
        type_key = ?,
        type_label = ?,
        icon = ?,
        color = ?,
        description = ?,
        is_active = ?,
        display_order = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      type_key || oldType.type_key,
      type_label || oldType.type_label,
      icon || oldType.icon,
      color || oldType.color,
      description !== undefined ? description : oldType.description,
      is_active !== undefined ? is_active : oldType.is_active,
      display_order !== undefined ? display_order : oldType.display_order,
      typeId
    ]);

    res.json({
      success: true,
      message: 'Task type updated successfully'
    });
  } catch (error) {
    console.error('Error updating task type:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete task type
router.delete('/types/:id', requireAuth, async (req, res) => {
  try {
    const typeId = req.params.id;

    const types = await query('SELECT * FROM task_types WHERE id = ?', [typeId]);
    if (types.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task type not found'
      });
    }

    const deletedType = types[0];

    const tasksCount = await query(
      'SELECT COUNT(*) as count FROM tasks WHERE task_type = ?',
      [deletedType.type_key]
    );

    if (tasksCount[0] && tasksCount[0].count > 0) {
      await query('UPDATE task_types SET is_active = 0 WHERE id = ?', [typeId]);
      
      return res.json({
        success: true,
        message: `Task type deactivated (${tasksCount[0].count} tasks still use this type)`
      });
    }

    await query('DELETE FROM task_types WHERE id = ?', [typeId]);

    res.json({
      success: true,
      message: 'Task type deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting task type:', error);
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

// Update task - SQLite Compatible
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
      actual_hours || 0, amount || 0, completionDate, taskId
    ]);

    if (oldTask.status !== status) {
      await query(`
        INSERT INTO task_history (task_id, action_type, old_value, new_value, changed_by)
        VALUES (?, 'status_changed', ?, ?, ?)
      `, [taskId, oldTask.status, status, req.user?.id || 1]);
    }

    res.json({ success: true, message: 'Task updated successfully' });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete task
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const taskId = req.params.id;

    const tasks = await query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const invoices = await query('SELECT COUNT(*) as count FROM invoices WHERE task_id = ?', [taskId]);
    
    if (invoices[0] && invoices[0].count > 0) {
      await query('UPDATE tasks SET status = ? WHERE id = ?', ['cancelled', taskId]);
      return res.json({ success: true, message: 'Task cancelled (has associated invoice)' });
    }

    await query('DELETE FROM tasks WHERE id = ?', [taskId]);
    
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update comment
router.put('/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const commentId = req.params.commentId;
    const { comment_text, is_completed } = req.body;

    if (!comment_text && is_completed === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Comment text or completion status is required'
      });
    }

    const currentComments = await query('SELECT * FROM task_comments WHERE id = ?', [commentId]);
    if (currentComments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    let updateFields = [];
    let updateValues = [];

    if (comment_text) {
      updateFields.push('comment_text = ?');
      updateValues.push(comment_text);
      updateFields.push('is_edited = 1');
      updateFields.push('edited_at = CURRENT_TIMESTAMP');
    }

    if (is_completed !== undefined) {
      updateFields.push('is_completed = ?');
      updateValues.push(is_completed ? 1 : 0);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(commentId);

    await query(`
      UPDATE task_comments SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);

    res.json({
      success: true,
      message: 'Comment updated successfully'
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete comment
router.delete('/comments/:commentId', requireAuth, async (req, res) => {
  try {
    const commentId = req.params.commentId;

    const comments = await query('SELECT * FROM task_comments WHERE id = ?', [commentId]);
    if (comments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    await query('DELETE FROM task_comments WHERE id = ?', [commentId]);

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;