const express = require('express');
const { query } = require('../config/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * ORIGINAL TRIAL DATA AND HEALTH ENDPOINTS
 */

// Get trial data summary & details
router.get('/trial-data', requireAdmin, async (req, res) => {
  try {
    const summary = await query(`
      SELECT table_name, COUNT(*) as count
      FROM trial_data_cleanup
      WHERE is_trial_data = TRUE
      GROUP BY table_name
    `);

    const details = await query(`
      SELECT tdc.*,
        CASE
          WHEN tdc.table_name = 'clients' THEN c.name
          WHEN tdc.table_name = 'staff' THEN s.name
          WHEN tdc.table_name = 'tasks' THEN t.title
          WHEN tdc.table_name = 'invoices' THEN i.invoice_number
          WHEN tdc.table_name = 'receipts' THEN r.receipt_number
        END as record_name
      FROM trial_data_cleanup tdc
      LEFT JOIN clients c ON tdc.table_name = 'clients' AND tdc.record_id = c.id
      LEFT JOIN staff s ON tdc.table_name = 'staff' AND tdc.record_id = s.id
      LEFT JOIN tasks t ON tdc.table_name = 'tasks' AND tdc.record_id = t.id
      LEFT JOIN invoices i ON tdc.table_name = 'invoices' AND tdc.record_id = i.id
      LEFT JOIN receipts r ON tdc.table_name = 'receipts' AND tdc.record_id = r.id
      WHERE tdc.is_trial_data = TRUE
      ORDER BY tdc.table_name, tdc.record_id
    `);

    res.json({
      success: true,
      summary,
      details,
      total_records: details.length
    });
  } catch (error) {
    console.error('Error fetching trial data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clean all trial data
router.delete('/trial-data', requireAdmin, async (req, res) => {
  try {
    await query('CALL CleanTrialData()');
    res.json({
      success: true,
      message: 'All trial data has been successfully removed from the system'
    });
  } catch (error) {
    console.error('Error cleaning trial data:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to clean trial data. Please check database logs.'
    });
  }
});

// Mark specific records as trial data
router.post('/mark-trial-data', requireAdmin, async (req, res) => {
  try {
    const { table_name, record_id } = req.body;
    if (!table_name || !record_id) {
      return res.status(400).json({
        success: false,
        message: 'Table name and record ID are required'
      });
    }
    await query(
      'INSERT INTO trial_data_cleanup (table_name, record_id, is_trial_data) VALUES (?, ?, TRUE)',
      [table_name, record_id]
    );
    res.json({
      success: true,
      message: 'Record marked as trial data successfully'
    });
  } catch (error) {
    console.error('Error marking trial data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// System health check for admin
router.get('/health', requireAdmin, async (req, res) => {
  try {
    const healthCheck = { database: 'connected', tables: {}, trial_data: 0 };
    const tables = ['clients', 'staff', 'tasks', 'invoices', 'receipts'];
    for (const table of tables) {
      try {
        const result = await query(`SELECT COUNT(*) as count FROM ${table}`);
        healthCheck.tables[table] = result[0].count;
      } catch {
        healthCheck.tables[table] = 'error';
      }
    }
    const trialCount = await query(
      'SELECT COUNT(*) as count FROM trial_data_cleanup WHERE is_trial_data = TRUE'
    );
    healthCheck.trial_data = trialCount[0].count;
    res.json({ success: true, health: healthCheck });
  } catch (error) {
    res.status(500).json({
      success: false,
      health: { database: 'disconnected' },
      error: error.message
    });
  }
});


/**
 * ENHANCED PHASE 3 ENDPOINTS
 */

// Dashboard stats
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const systemStats = await query(`
      SELECT
        'overview' as category,
        (SELECT COUNT(*) FROM staff WHERE status = 'active') as active_staff,
        (SELECT COUNT(*) FROM clients WHERE status = 'active') as active_clients,
        (SELECT COUNT(*) FROM tasks WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as monthly_tasks,
        (SELECT COUNT(*) FROM invoices WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as monthly_invoices,
        (SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as monthly_revenue,
        (SELECT COUNT(*) FROM audit_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as daily_activities
    `);
    const recentActivities = await query(`
      SELECT al.action, al.entity_type, al.entity_id, al.created_at, s.name as user_name,
        CASE al.entity_type
          WHEN 'task' THEN (SELECT title FROM tasks WHERE id = al.entity_id LIMIT 1)
          WHEN 'client' THEN (SELECT name FROM clients WHERE id = al.entity_id LIMIT 1)
          WHEN 'invoice' THEN (SELECT invoice_number FROM invoices WHERE id = al.entity_id LIMIT 1)
          ELSE CONCAT(al.entity_type, ' #', al.entity_id)
        END as entity_name
      FROM audit_logs al
      LEFT JOIN staff s ON al.user_id = s.id
      ORDER BY al.created_at DESC
      LIMIT 10
    `);
    const systemHealth = await query(`
      SELECT
        'health' as category,
        (SELECT COUNT(*) FROM invoices WHERE status != 'paid' AND due_date < CURDATE()) as overdue_invoices,
        (SELECT COUNT(*) FROM tasks WHERE status = 'pending' AND due_date < CURDATE()) as overdue_tasks,
        (SELECT COUNT(*) FROM audit_logs WHERE action = 'LOGIN_FAILED' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as failed_logins_today,
        (SELECT COUNT(DISTINCT staff_id) FROM attendance WHERE attendance_date = CURDATE() AND status = 'absent') as absent_today
    `);
    const performanceStats = await query(`
      SELECT
        AVG(CASE WHEN t.status = 'completed' THEN DATEDIFF(t.completion_date, t.created_at) END) as avg_task_completion_days,
        AVG(CASE WHEN i.status = 'paid' THEN DATEDIFF(i.paid_date, i.invoice_date) END) as avg_payment_days,
        (SELECT COUNT(*) FROM tasks WHERE status = 'completed' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as tasks_completed_monthly,
        (SELECT AVG(total_hours) FROM attendance WHERE attendance_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND total_hours > 0) as avg_work_hours_daily
      FROM tasks t
      LEFT JOIN invoices i ON 1=1
    `);
    res.json({
      success: true,
      dashboard: {
        system_stats: systemStats[0],
        recent_activities: recentActivities,
        system_health: systemHealth[0],
        performance: performanceStats[0]
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// FIXED: Detailed audit logs with filtering - MySQL2 compatible version
// ============================================================================
router.get('/audit-logs', requireAdmin, async (req, res) => {
  try {
    const {
      user_id, action, entity_type, start_date, end_date,
      severity = 'all', search_term, page = 1, limit = 50
    } = req.query;
    
    // Parse and validate pagination values
    const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const offsetNum = (pageNum - 1) * limitNum;
    
    let sql = `
      SELECT al.*, s.name as user_name, s.email as user_email, s.role as user_role,
        CASE al.entity_type
          WHEN 'task' THEN (SELECT title FROM tasks WHERE id = al.entity_id LIMIT 1)
          WHEN 'client' THEN (SELECT name FROM clients WHERE id = al.entity_id LIMIT 1)
          WHEN 'invoice' THEN (SELECT invoice_number FROM invoices WHERE id = al.entity_id LIMIT 1)
          WHEN 'staff' THEN (SELECT name FROM staff WHERE id = al.entity_id LIMIT 1)
          ELSE NULL
        END as entity_name
      FROM audit_logs al
      LEFT JOIN staff s ON al.user_id = s.id
      WHERE 1=1
    `;
    const params = [];
    
    if (user_id && user_id !== 'all') { 
      sql += ' AND al.user_id = ?'; 
      params.push(user_id); 
    }
    if (action && action !== 'all') { 
      sql += ' AND al.action = ?'; 
      params.push(action); 
    }
    if (entity_type && entity_type !== 'all') { 
      sql += ' AND al.entity_type = ?'; 
      params.push(entity_type); 
    }
    if (start_date) { 
      sql += ' AND DATE(al.created_at) >= ?'; 
      params.push(start_date); 
    }
    if (end_date) { 
      sql += ' AND DATE(al.created_at) <= ?'; 
      params.push(end_date); 
    }
    
    if (severity !== 'all') {
      let list = [];
      if (severity === 'critical') list = ['DELETE','LOGIN_FAILED','PERMISSION_DENIED','SYSTEM_ERROR'];
      if (severity === 'warning')  list = ['UPDATE','REASSIGN','STATUS_CHANGE','BULK_IMPORT'];
      if (severity === 'info')     list = ['CREATE','VIEW','LOGIN'];
      if (list.length > 0) {
        sql += ` AND al.action IN (${list.map(()=>'?').join(',')})`;
        params.push(...list);
      }
    }
    
    if (search_term) {
      sql += `
        AND (
          s.name LIKE ? OR s.email LIKE ? OR al.action LIKE ? OR al.entity_type LIKE ?
          OR JSON_EXTRACT(al.new_values, '$') LIKE ? OR al.ip_address LIKE ?
        )
      `;
      const p = `%${search_term}%`;
      params.push(p,p,p,p,p,p);
    }
    
    // Use direct interpolation for LIMIT/OFFSET to avoid MySQL2 prepared statement issues
    sql += ` ORDER BY al.created_at DESC LIMIT ${limitNum} OFFSET ${offsetNum}`;

    const auditLogs = await query(sql, params);

    // Count total (rebuild query to match filters)
    let countSql = `
      SELECT COUNT(*) as total
      FROM audit_logs al
      LEFT JOIN staff s ON al.user_id = s.id
      WHERE 1=1
    `;
    const countParams = [];
    
    if (user_id && user_id !== 'all') { 
      countSql += ' AND al.user_id = ?'; 
      countParams.push(user_id); 
    }
    if (action && action !== 'all') { 
      countSql += ' AND al.action = ?'; 
      countParams.push(action); 
    }
    if (entity_type && entity_type !== 'all') { 
      countSql += ' AND al.entity_type = ?'; 
      countParams.push(entity_type); 
    }
    if (start_date) { 
      countSql += ' AND DATE(al.created_at) >= ?'; 
      countParams.push(start_date); 
    }
    if (end_date) { 
      countSql += ' AND DATE(al.created_at) <= ?'; 
      countParams.push(end_date); 
    }
    
    if (severity !== 'all') {
      let list = [];
      if (severity === 'critical') list = ['DELETE','LOGIN_FAILED','PERMISSION_DENIED','SYSTEM_ERROR'];
      if (severity === 'warning')  list = ['UPDATE','REASSIGN','STATUS_CHANGE','BULK_IMPORT'];
      if (severity === 'info')     list = ['CREATE','VIEW','LOGIN'];
      if (list.length > 0) {
        countSql += ` AND al.action IN (${list.map(()=>'?').join(',')})`;
        countParams.push(...list);
      }
    }
    
    if (search_term) {
      countSql += `
        AND (
          s.name LIKE ? OR s.email LIKE ? OR al.action LIKE ? OR al.entity_type LIKE ?
          OR JSON_EXTRACT(al.new_values, '$') LIKE ? OR al.ip_address LIKE ?
        )
      `;
      const p = `%${search_term}%`;
      countParams.push(p,p,p,p,p,p);
    }
    
    const countResult = await query(countSql, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      audit_logs: auditLogs,
      pagination: {
        current_page: pageNum,
        per_page: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export audit logs
router.get('/audit-logs/export', requireAdmin, async (req, res) => {
  try {
    const { format = 'csv', start_date, end_date, user_id, action, entity_type } = req.query;
    let sql = `
      SELECT al.created_at, s.name as user_name, s.email as user_email,
             al.action, al.entity_type, al.entity_id, al.ip_address, al.user_agent,
             JSON_EXTRACT(al.old_values, '$') as old_values,
             JSON_EXTRACT(al.new_values, '$') as new_values
      FROM audit_logs al
      LEFT JOIN staff s ON al.user_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (start_date) { sql += ' AND DATE(al.created_at) >= ?'; params.push(start_date); }
    if (end_date)   { sql += ' AND DATE(al.created_at) <= ?'; params.push(end_date); }
    if (user_id && user_id !== 'all') { sql += ' AND al.user_id = ?'; params.push(user_id); }
    if (action && action !== 'all')    { sql += ' AND al.action = ?'; params.push(action); }
    if (entity_type && entity_type !== 'all') { sql += ' AND al.entity_type = ?'; params.push(entity_type); }
    sql += ' ORDER BY al.created_at DESC LIMIT 10000';
    const auditData = await query(sql, params);

    if (format === 'csv') {
      let csv = 'Timestamp,User Name,Email,Action,Entity Type,Entity ID,IP Address,Old Values,New Values\n';
      auditData.forEach(row => {
        csv += [
          row.created_at, row.user_name||'', row.user_email||'', row.action,
          row.entity_type, row.entity_id||'', row.ip_address||'',
          row.old_values ? JSON.stringify(row.old_values).replace(/"/g,'""') : '',
          row.new_values ? JSON.stringify(row.new_values).replace(/"/g,'""') : ''
        ].map(f => `"${f}"`).join(',') + '\n';
      });
      res.setHeader('Content-Type','text/csv');
      res.setHeader('Content-Disposition',`attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`);
      return res.send(csv);
    }

    res.json({ success: true, data: auditData, total_records: auditData.length, exported_at: new Date().toISOString() });
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Security alerts
router.get('/security-alerts', requireAdmin, async (req, res) => {
  try {
    const alerts = [];
    // Failed login attempts
    const failedLogins = await query(`
      SELECT al.ip_address, s.email, COUNT(*) as attempt_count, MAX(al.created_at) as last_attempt
      FROM audit_logs al
      LEFT JOIN staff s ON al.user_id = s.id
      WHERE al.action = 'LOGIN_FAILED' AND al.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY al.ip_address, s.email
      HAVING attempt_count >= 3
      ORDER BY attempt_count DESC
    `);
    failedLogins.forEach(l => {
      alerts.push({
        type: 'security', severity: 'high',
        title: 'Multiple Failed Login Attempts',
        message: `${l.attempt_count} failed login attempts from IP ${l.ip_address}${l.email ? ` for ${l.email}` : ''}`,
        timestamp: l.last_attempt, action_required: true
      });
    });
    // After-hours activity (fixed query syntax)
    const afterHours = await query(`
      SELECT COUNT(*) as activity_count, s.name as user_name
      FROM audit_logs al
      LEFT JOIN staff s ON al.user_id = s.id
      WHERE (HOUR(al.created_at) < 6 OR HOUR(al.created_at) > 22)
        AND DATE(al.created_at) = CURDATE()
        AND al.action IN ('CREATE','UPDATE','DELETE')
      GROUP BY al.user_id, s.name
      HAVING activity_count >= 5
    `);
    afterHours.forEach(a => {
      alerts.push({
        type: 'security', severity: 'medium',
        title: 'After-Hours Activity Detected',
        message: `${a.user_name || 'Unknown user'} performed ${a.activity_count} actions outside business hours`,
        timestamp: new Date(), action_required: false
      });
    });
    // Bulk deletions
    const bulk = await query(`
      SELECT al.user_id, s.name as user_name, COUNT(*) as deletion_count, MAX(al.created_at) as last_deletion
      FROM audit_logs al
      LEFT JOIN staff s ON al.user_id = s.id
      WHERE al.action = 'DELETE' AND al.created_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR)
      GROUP BY al.user_id, s.name
      HAVING deletion_count >= 3
    `);
    bulk.forEach(d => {
      alerts.push({
        type: 'security', severity: 'high',
        title: 'Bulk Deletion Activity',
        message: `${d.user_name || 'Unknown user'} deleted ${d.deletion_count} records in the last 2 hours`,
        timestamp: d.last_deletion, action_required: true
      });
    });
    // Business health alert
    const overdue = await query(`
      SELECT COUNT(*) as count FROM invoices
      WHERE status != 'paid' AND due_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `);
    if (overdue[0].count > 5) {
      alerts.push({
        type: 'business', severity: 'medium',
        title: 'High Number of Overdue Invoices',
        message: `${overdue[0].count} invoices are overdue by more than 30 days`,
        timestamp: new Date(), action_required: true
      });
    }
    alerts.sort((a,b) => {
      const order = { high:3, medium:2, low:1 };
      if (order[a.severity] !== order[b.severity]) return order[b.severity] - order[a.severity];
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    res.json({
      success: true,
      alerts: alerts.slice(0,20),
      summary: {
        total: alerts.length,
        high_severity: alerts.filter(a => a.severity==='high').length,
        medium_severity: alerts.filter(a => a.severity==='medium').length,
        requires_action: alerts.filter(a => a.action_required).length
      }
    });
  } catch (error) {
    console.error('Error fetching security alerts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// System maintenance and cleanup
router.post('/maintenance/cleanup', requireAdmin, async (req, res) => {
  try {
    const {
      cleanup_audit_logs_older_than_days = 90,
      cleanup_completed_tasks_older_than_days = 180,
      vacuum_database = false
    } = req.body;
    const summary = { audit_logs_deleted: 0, completed_tasks_archived: 0, database_optimized: false };

    if (cleanup_audit_logs_older_than_days > 0) {
      const r = await query(`
        DELETE FROM audit_logs
        WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
          AND action NOT IN ('LOGIN_FAILED','DELETE','SYSTEM_ERROR')
      `, [cleanup_audit_logs_older_than_days]);
      summary.audit_logs_deleted = r.affectedRows;
    }
    if (cleanup_completed_tasks_older_than_days > 0) {
      const r = await query(`
        UPDATE tasks SET status='archived'
        WHERE status='completed'
          AND completion_date < DATE_SUB(NOW(), INTERVAL ? DAY)
      `, [cleanup_completed_tasks_older_than_days]);
      summary.completed_tasks_archived = r.affectedRows;
    }
    if (vacuum_database) {
      try {
        await query('OPTIMIZE TABLE audit_logs, tasks, invoices, receipts, attendance');
        summary.database_optimized = true;
      } catch (optErr) {
        console.error('Database optimization error:', optErr);
      }
    }
    if (req.auditLogger) {
      await req.auditLogger('MAINTENANCE','system', null, null, { cleanup_summary: summary, requested_by: req.user?.id||'system' });
    }
    res.json({ success: true, message: 'System maintenance completed', cleanup_summary: summary });
  } catch (error) {
    console.error('Error during system maintenance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Run trial data cleanup procedure (enhanced)
router.post('/cleanup-trial-data', requireAdmin, async (req, res) => {
  try {
    const result = await query('CALL CleanTrialData()');
    if (req.auditLogger) {
      await req.auditLogger('CLEANUP','system', null, null, { action: 'trial_data_cleanup', result: result[0] });
    }
    res.json({ success: true, message: 'Trial data cleanup completed successfully', result: result[0] });
  } catch (error) {
    console.error('Error cleaning trial data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Settings management
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await query('SELECT * FROM settings ORDER BY setting_key');
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/settings/:key', requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const current = await query('SELECT * FROM settings WHERE setting_key = ?', [key]);
    await query(`
      INSERT INTO settings (setting_key, setting_value, updated_at)
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE setting_value = ?, updated_at = NOW()
    `, [key, value, value]);
    if (req.auditLogger) {
      await req.auditLogger('UPDATE','setting', key,
        current.length ? { value: current[0].setting_value } : null,
        { value }
      );
    }
    res.json({ success: true, message: 'Setting updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * TASK TYPES MANAGEMENT
 */

// Get all task types
router.get('/task-types', requireAdmin, async (req, res) => {
  try {
    const taskTypes = await query(`
      SELECT * FROM task_types 
      ORDER BY display_label ASC
    `);
    res.json({ success: true, task_types: taskTypes });
  } catch (error) {
    console.error('Error fetching task types:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new task type
router.post('/task-types', requireAdmin, async (req, res) => {
  try {
    const { type_key, display_label, icon, color, description } = req.body;

    // Validate required fields
    if (!type_key || !display_label) {
      return res.status(400).json({
        success: false,
        message: 'Type key and display label are required'
      });
    }

    // Check for duplicate key
    const existing = await query('SELECT id FROM task_types WHERE type_key = ?', [type_key]);
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Task type with this key already exists'
      });
    }

    const result = await query(`
      INSERT INTO task_types (type_key, display_label, icon, color, description)
      VALUES (?, ?, ?, ?, ?)
    `, [type_key, display_label, icon || 'fa-tasks', color || '#007bff', description || '']);

    if (req.auditLogger) {
      await req.auditLogger('CREATE', 'task_type', result.insertId, null, {
        type_key, display_label
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

// Update task type
router.put('/task-types/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { display_label, icon, color, description } = req.body;

    const current = await query('SELECT * FROM task_types WHERE id = ?', [id]);
    if (current.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task type not found'
      });
    }

    await query(`
      UPDATE task_types 
      SET display_label = ?, icon = ?, color = ?, description = ?, updated_at = NOW()
      WHERE id = ?
    `, [display_label, icon, color, description, id]);

    if (req.auditLogger) {
      await req.auditLogger('UPDATE', 'task_type', id, current[0], {
        display_label, icon, color, description
      });
    }

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
router.delete('/task-types/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if task type is in use
    const tasksUsingType = await query(
      'SELECT COUNT(*) as count FROM tasks WHERE task_type = (SELECT type_key FROM task_types WHERE id = ?)',
      [id]
    );

    if (tasksUsingType[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete task type - ${tasksUsingType[0].count} tasks are using it`
      });
    }

    const current = await query('SELECT * FROM task_types WHERE id = ?', [id]);
    if (current.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task type not found'
      });
    }

    await query('DELETE FROM task_types WHERE id = ?', [id]);

    if (req.auditLogger) {
      await req.auditLogger('DELETE', 'task_type', id, current[0], null);
    }

    res.json({
      success: true,
      message: 'Task type deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting task type:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;