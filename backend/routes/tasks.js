const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { query } = require('../config/database');
const { logAuditEvent } = require('../middleware/auditLogger');
const { requireAuth, requireAdmin, authenticateToken } = require('../middleware/auth');
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

// Auto-create task_history table
const ensureTaskHistoryTable = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS task_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        action_type ENUM('created', 'assigned', 'reassigned', 'rescheduled', 'status_changed', 'updated') NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_by INT,
        change_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (changed_by) REFERENCES staff(id) ON DELETE SET NULL,
        INDEX idx_task_id (task_id),
        INDEX idx_action_type (action_type),
        INDEX idx_created_at (created_at)
      )
    `);
    console.log('✅ Task history table verified/created');
  } catch (error) {
    console.log('Task history table check:', error.message);
  }
};

ensureTaskHistoryTable();

// ============================================================================
// SPECIFIC ROUTES (MUST COME BEFORE PARAMETERIZED ROUTES)
// ============================================================================

// Test route for debugging
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Tasks route is working' });
});

// Task analytics endpoint
router.get('/analytics', requireAuth, async (req, res) => {
  try {
    const { start_date, end_date, group_by = 'status', firm_id } = req.query;
    
    let sql = `
      SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
        SUM(CASE WHEN due_date < CURDATE() AND status != 'completed' THEN 1 ELSE 0 END) as overdue_tasks,
        AVG(CASE WHEN status = 'completed' THEN DATEDIFF(completion_date, created_at) END) as avg_completion_days,
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
      clientSql += ' AND c.firm_id = ?';
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

// Batch update tasks
router.put('/batch-update', requireAuth, requireAdmin, async (req, res) => {
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
    
    updateValues.push(task_ids);
    
    const sql = `
      UPDATE tasks 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id IN (?)
    `;
    
    await query(sql, updateValues);
    
    res.json({
      success: true,
      message: `${task_ids.length} tasks updated successfully`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Bulk import tasks from CSV
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
        let clientResults = await query(
          'SELECT id FROM clients WHERE (name LIKE ? OR company LIKE ?) AND firm_id = ? LIMIT 1',
          [`%${task.client_name}%`, `%${task.client_name}%`, firm_id]
        );
        
        if (clientResults.length === 0) {
          errors.push(`Client '${task.client_name}' not found for task '${task.title}'`);
          continue;
        }
        
        const client_id = clientResults[0].id;
        
        let assigned_to = null;
        if (task.staff_name) {
          const staffResults = await query(
            'SELECT id FROM staff WHERE name LIKE ? AND status = "active" LIMIT 1',
            [`%${task.staff_name}%`]
          );
          
          if (staffResults.length > 0) {
            assigned_to = staffResults[0].id;
          } else {
            errors.push(`Staff '${task.staff_name}' not found, task '${task.title}' will be unassigned`);
          }
        }

        const validTypes = await query('SELECT type_key FROM task_types WHERE is_active = TRUE');
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
        `, [result.insertId, JSON.stringify({ title: task.title, client_id: client_id }), req.user?.id || 1]);

        if (req.auditLogger) {
          await req.auditLogger('BULK_IMPORT', 'task', result.insertId, null, {
            title: task.title,
            client_id: client_id
          });
        }
        
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
// TASK TYPES MANAGEMENT
// ============================================================================

// Get all task types
router.get('/types', requireAuth, async (req, res) => {
  try {
    const { include_inactive } = req.query;
    
    let sql = 'SELECT * FROM task_types';
    if (!include_inactive || include_inactive === 'false') {
      sql += ' WHERE is_active = TRUE';
    }
    sql += ' ORDER BY display_order ASC, type_label ASC';
    
    const types = await query(sql);
    
    res.json({
      success: true,
      task_types: types
    });
  } catch (error) {
    console.error('Error fetching task types:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reorder task types (Admin only)
router.put('/types-reorder', requireAuth, requireAdmin, async (req, res) => {
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// MAIN TASK ROUTES
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
        f.firm_name,
        (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id) as comment_count,
        (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id AND tc.is_completed = FALSE) as pending_comments
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

// Create new task
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      firm_id, title, description, client_id, assigned_to, priority, task_type,
      due_date, status, estimated_hours, actual_hours, amount
    } = req.body;

    if (!firm_id) {
      return res.status(400).json({ success: false, message: 'Firm ID is required' });
    }

    if (!title || !client_id) {
      return res.status(400).json({
        success: false,
        message: 'Title and client are required'
      });
    }

    const [client] = await query('SELECT firm_id FROM clients WHERE id = ?', [client_id]);
    if (client && client.firm_id != firm_id) {
      return res.status(400).json({ success: false, message: 'Client does not belong to selected firm' });
    }

    const result = await query(`
      INSERT INTO tasks (
        firm_id, title, description, client_id, assigned_to, priority, task_type,
        due_date, status, estimated_hours, actual_hours, amount, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      firm_id, title, description, client_id, assigned_to || null, priority || 'medium',
      task_type || 'other', due_date || null, status || 'pending',
      estimated_hours || 0, actual_hours || 0, amount || 0, req.user?.id || 1
    ]);

    await query(`
      INSERT INTO task_history (task_id, action_type, new_value, changed_by)
      VALUES (?, 'created', ?, ?)
    `, [result.insertId, JSON.stringify({ title, client_id, assigned_to }), req.user?.id || 1]);

    if (req.auditLogger) {
      await req.auditLogger('CREATE', 'task', result.insertId, null, {
        title, client_id, task_type
      });
    }

    res.json({
      success: true,
      message: 'Task created successfully',
      taskId: result.insertId,
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new task type (Admin only)
router.post('/types', requireAuth, requireAdmin, async (req, res) => {
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

    if (req.auditLogger) {
      await req.auditLogger('CREATE', 'task_type', result.insertId, null, {
        type_key, type_label
      });
    }

    res.json({
      success: true,
      message: 'Task type created successfully',
      task_type_id: result.insertId
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
        f.firm_name
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// Task Reassignment with History
router.put('/:id/reassign', requireAuth, async (req, res) => {
  try {
    const { assigned_to, reassigned_by, reason } = req.body;
    const taskId = req.params.id;

    const taskExists = await query('SELECT id, assigned_to, title FROM tasks WHERE id = ?', [taskId]);
    if (taskExists.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const currentTask = taskExists[0];

    if (assigned_to) {
      const staffExists = await query(
        'SELECT id, name FROM staff WHERE id = ? AND status = "active"', 
        [assigned_to]
      );
      
      if (staffExists.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Selected staff member not found or inactive'
        });
      }
    }

    if (currentTask.assigned_to == assigned_to) {
      return res.status(400).json({
        success: false,
        message: 'Task is already assigned to this person'
      });
    }

    const oldAssignment = currentTask.assigned_to;

    await query(`
      UPDATE tasks 
      SET assigned_to = ?, 
          updated_at = NOW()
      WHERE id = ?
    `, [assigned_to || null, taskId]);

    await query(`
      INSERT INTO task_history (task_id, action_type, old_value, new_value, changed_by, change_reason)
      VALUES (?, 'reassigned', ?, ?, ?, ?)
    `, [
      taskId, 
      oldAssignment ? oldAssignment.toString() : 'unassigned',
      assigned_to ? assigned_to.toString() : 'unassigned',
      req.user?.id || 1,
      reason || 'No reason provided'
    ]);

    if (req.auditLogger) {
      await req.auditLogger('REASSIGN', 'task', taskId, { assigned_to: oldAssignment }, {
        assigned_to: assigned_to,
        reason: reason
      });
    }

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
    res.status(500).json({ success: false, error: error.message });
  }
});

// Task Reschedule with History
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
      SET due_date = ?, updated_at = NOW()
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

    if (req.auditLogger) {
      await req.auditLogger('RESCHEDULE', 'task', taskId,
        { due_date: oldDueDate },
        { due_date: new_due_date, reason: reason }
      );
    }

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

// Update task status
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
      completionDate = new Date();
    }

    await query(`
      UPDATE tasks SET
        status = ?, 
        completion_date = ?, 
        updated_at = NOW()
      WHERE id = ?
    `, [status, completionDate, taskId]);

    await query(`
      INSERT INTO task_history (task_id, action_type, old_value, new_value, changed_by)
      VALUES (?, 'status_changed', ?, ?, ?)
    `, [taskId, oldStatus, status, req.user?.id || 1]);

    if (req.auditLogger) {
      await req.auditLogger('STATUS_CHANGE', 'task', taskId, { status: oldStatus }, { status: status });
    }

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

    if (req.auditLogger) {
      await req.auditLogger('CREATE', 'task_comment', result.insertId, null, {
        task_id: taskId,
        comment_text: comment_text.substring(0, 100) + '...'
      });
    }

    res.json({
      success: true,
      message: 'Comment added successfully',
      commentId: result.insertId
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update task type (Admin only)
router.put('/types/:id', requireAuth, requireAdmin, async (req, res) => {
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
        updated_at = NOW()
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

    if (req.auditLogger) {
      await req.auditLogger('UPDATE', 'task_type', typeId, oldType, {
        type_key, type_label, is_active
      });
    }

    res.json({
      success: true,
      message: 'Task type updated successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete task type (Admin only)
router.delete('/types/:id', requireAuth, requireAdmin, async (req, res) => {
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

    if (tasksCount[0].count > 0) {
      await query('UPDATE task_types SET is_active = FALSE WHERE id = ?', [typeId]);
      
      return res.json({
        success: true,
        message: `Task type deactivated (${tasksCount[0].count} tasks still use this type)`
      });
    }

    await query('DELETE FROM task_types WHERE id = ?', [typeId]);

    if (req.auditLogger) {
      await req.auditLogger('DELETE', 'task_type', typeId, deletedType, null);
    }

    res.json({
      success: true,
      message: 'Task type deleted successfully'
    });
  } catch (error) {
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
        f.firm_name
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
      completionDate = new Date();
    }

    await query(`
      UPDATE tasks SET
        title = ?, description = ?, client_id = ?, assigned_to = ?,
        priority = ?, task_type = ?, due_date = ?, status = ?,
        estimated_hours = ?, actual_hours = ?, amount = ?,
        completion_date = ?, updated_at = NOW()
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

    if (req.auditLogger) {
      await req.auditLogger('UPDATE', 'task', taskId, oldTask, {
        title, status, priority, task_type
      });
    }

    res.json({ success: true, message: 'Task updated successfully' });
  } catch (error) {
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

    const deletedTask = tasks[0];

    const invoices = await query('SELECT COUNT(*) as count FROM invoices WHERE task_id = ?', [taskId]);
    
    if (invoices[0].count > 0) {
      await query('UPDATE tasks SET status = "cancelled" WHERE id = ?', [taskId]);
      return res.json({ success: true, message: 'Task cancelled (has associated invoice)' });
    }

    await query('DELETE FROM tasks WHERE id = ?', [taskId]);

    if (req.auditLogger) {
      await req.auditLogger('DELETE', 'task', taskId, deletedTask, null);
    }
    
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
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

    const oldComment = currentComments[0];

    let updateFields = [];
    let updateValues = [];

    if (comment_text) {
      updateFields.push('comment_text = ?');
      updateValues.push(comment_text);
      updateFields.push('is_edited = TRUE');
      updateFields.push('edited_at = NOW()');
    }

    if (is_completed !== undefined) {
      updateFields.push('is_completed = ?');
      updateValues.push(is_completed);
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(commentId);

    await query(`
      UPDATE task_comments SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);

    if (req.auditLogger) {
      await req.auditLogger('UPDATE', 'task_comment', commentId, oldComment, {
        comment_text: comment_text,
        is_completed: is_completed
      });
    }

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

    const deletedComment = comments[0];

    await query('DELETE FROM task_comments WHERE id = ?', [commentId]);

    if (req.auditLogger) {
      await req.auditLogger('DELETE', 'task_comment', commentId, deletedComment, null);
    }

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