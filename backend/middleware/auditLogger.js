const { query } = require('../config/database');

// PHASE 3: Audit Logger Middleware
const auditLogger = async (userId, action, entityType, entityId, oldValues = null, newValues = null, ipAddress = null, userAgent = null) => {
  try {
    await query(`
      INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id, old_values, new_values, 
        ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      userId,
      action,
      entityType,
      entityId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress,
      userAgent
    ]);
  } catch (error) {
    console.error('Error logging audit event:', error);
    // Don't throw error to avoid breaking main functionality
  }
};

// Middleware to add audit logger to request object
const auditMiddleware = (req, res, next) => {
  req.auditLogger = async (action, entityType, entityId, oldValues = null, newValues = null) => {
    const userId = req.user?.id || req.body?.created_by || req.body?.user_id || null;
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    await auditLogger(userId, action, entityType, entityId, oldValues, newValues, ipAddress, userAgent);
  };
  
  next();
};

// Get audit logs with filtering
const getAuditLogs = async (req, res) => {
  try {
    const { 
      user_id, 
      action, 
      entity_type, 
      start_date, 
      end_date,
      page = 1,
      limit = 50 
    } = req.query;

    let sql = `
      SELECT 
        al.*,
        s.name as user_name,
        s.email as user_email
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

    sql += ' ORDER BY al.created_at DESC';

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const auditLogs = await query(sql, params);

    // Get total count for pagination
    let countSql = `
      SELECT COUNT(*) as total
      FROM audit_logs al
      WHERE 1=1
    `;
    
    const countParams = [];
    let paramIndex = 0;
    
    if (user_id && user_id !== 'all') {
      countSql += ' AND al.user_id = ?';
      countParams.push(params[paramIndex++]);
    }

    if (action && action !== 'all') {
      countSql += ' AND al.action = ?';
      countParams.push(params[paramIndex++]);
    }

    if (entity_type && entity_type !== 'all') {
      countSql += ' AND al.entity_type = ?';
      countParams.push(params[paramIndex++]);
    }

    if (start_date) {
      countSql += ' AND DATE(al.created_at) >= ?';
      countParams.push(params[paramIndex++]);
    }

    if (end_date) {
      countSql += ' AND DATE(al.created_at) <= ?';
      countParams.push(params[paramIndex++]);
    }

    const countResult = await query(countSql, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      audit_logs: auditLogs,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: total,
        total_pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get audit statistics
const getAuditStats = async (req, res) => {
  try {
    const { period = 'last_30_days' } = req.query;

    let dateCondition = '';
    switch (period) {
      case 'today':
        dateCondition = 'WHERE DATE(al.created_at) = CURDATE()';
        break;
      case 'last_7_days':
        dateCondition = 'WHERE al.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        break;
      case 'last_30_days':
        dateCondition = 'WHERE al.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
        break;
      case 'last_90_days':
        dateCondition = 'WHERE al.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)';
        break;
      default:
        dateCondition = 'WHERE al.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
    }

    // Overall stats
    const overallStats = await query(`
      SELECT 
        COUNT(*) as total_events,
        COUNT(DISTINCT al.user_id) as active_users,
        COUNT(DISTINCT al.entity_type) as entity_types,
        MAX(al.created_at) as last_activity
      FROM audit_logs al
      ${dateCondition}
    `);

    // Activity by action
    const actionStats = await query(`
      SELECT 
        al.action,
        COUNT(*) as count,
        COUNT(DISTINCT al.user_id) as unique_users
      FROM audit_logs al
      ${dateCondition}
      GROUP BY al.action
      ORDER BY count DESC
      LIMIT 10
    `);

    // Activity by entity type
    const entityStats = await query(`
      SELECT 
        al.entity_type,
        COUNT(*) as count,
        COUNT(DISTINCT al.user_id) as unique_users
      FROM audit_logs al
      ${dateCondition}
      GROUP BY al.entity_type
      ORDER BY count DESC
      LIMIT 10
    `);

    // Top active users
    const userStats = await query(`
      SELECT 
        s.name,
        s.email,
        COUNT(al.id) as activity_count,
        MAX(al.created_at) as last_activity
      FROM audit_logs al
      LEFT JOIN staff s ON al.user_id = s.id
      ${dateCondition}
      GROUP BY al.user_id, s.name, s.email
      ORDER BY activity_count DESC
      LIMIT 10
    `);

    // Daily activity trend (last 7 days)
    const dailyActivity = await query(`
      SELECT 
        DATE(al.created_at) as activity_date,
        COUNT(*) as event_count,
        COUNT(DISTINCT al.user_id) as unique_users
      FROM audit_logs al
      WHERE al.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(al.created_at)
      ORDER BY activity_date DESC
    `);

    // Hourly activity distribution (today)
    const hourlyActivity = await query(`
      SELECT 
        HOUR(al.created_at) as hour,
        COUNT(*) as event_count
      FROM audit_logs al
      WHERE DATE(al.created_at) = CURDATE()
      GROUP BY HOUR(al.created_at)
      ORDER BY hour
    `);

    res.json({
      success: true,
      stats: {
        overall: overallStats[0],
        by_action: actionStats,
        by_entity: entityStats,
        top_users: userStats,
        daily_trend: dailyActivity,
        hourly_distribution: hourlyActivity
      }
    });
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get user activity timeline
const getUserActivity = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { limit = 50 } = req.query;

    const userActivity = await query(`
      SELECT 
        al.*,
        CASE al.entity_type
          WHEN 'task' THEN (SELECT title FROM tasks WHERE id = al.entity_id LIMIT 1)
          WHEN 'client' THEN (SELECT name FROM clients WHERE id = al.entity_id LIMIT 1)
          WHEN 'invoice' THEN (SELECT invoice_number FROM invoices WHERE id = al.entity_id LIMIT 1)
          ELSE NULL
        END as entity_name
      FROM audit_logs al
      WHERE al.user_id = ?
      ORDER BY al.created_at DESC
      LIMIT ?
    `, [user_id, parseInt(limit)]);

    res.json({
      success: true,
      activity: userActivity
    });
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get entity change history
const getEntityHistory = async (req, res) => {
  try {
    const { entity_type, entity_id } = req.params;

    const entityHistory = await query(`
      SELECT 
        al.*,
        s.name as user_name
      FROM audit_logs al
      LEFT JOIN staff s ON al.user_id = s.id
      WHERE al.entity_type = ? AND al.entity_id = ?
      ORDER BY al.created_at DESC
    `, [entity_type, entity_id]);

    res.json({
      success: true,
      history: entityHistory
    });
  } catch (error) {
    console.error('Error fetching entity history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Security events detection
const getSecurityEvents = async (req, res) => {
  try {
    // Define suspicious activities
    const suspiciousEvents = await query(`
      SELECT 
        al.*,
        s.name as user_name,
        'Multiple failed logins' as security_concern
      FROM audit_logs al
      LEFT JOIN staff s ON al.user_id = s.id
      WHERE al.action = 'LOGIN_FAILED'
        AND al.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
      
      UNION ALL
      
      SELECT 
        al.*,
        s.name as user_name,
        'Bulk deletion activity' as security_concern
      FROM audit_logs al
      LEFT JOIN staff s ON al.user_id = s.id
      WHERE al.action = 'DELETE'
        AND al.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
        AND al.user_id IN (
          SELECT user_id 
          FROM audit_logs 
          WHERE action = 'DELETE' 
            AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
          GROUP BY user_id 
          HAVING COUNT(*) >= 5
        )
      
      UNION ALL
      
      SELECT 
        al.*,
        s.name as user_name,
        'After-hours activity' as security_concern
      FROM audit_logs al
      LEFT JOIN staff s ON al.user_id = s.id
      WHERE (HOUR(al.created_at) < 6 OR HOUR(al.created_at) > 22)
        AND DATE(al.created_at) = CURDATE()
        AND al.action IN ('CREATE', 'UPDATE', 'DELETE')
      
      ORDER BY created_at DESC
      LIMIT 100
    `);

    res.json({
      success: true,
      security_events: suspiciousEvents
    });
  } catch (error) {
    console.error('Error fetching security events:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  auditLogger,
  auditMiddleware,
  getAuditLogs,
  getAuditStats,
  getUserActivity,
  getEntityHistory,
  getSecurityEvents
};