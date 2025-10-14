const express = require('express');
const { query } = require('../config/database');
const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const userRole = req.query.role;
    const userId = req.query.userId;

    // Try to get real stats from database
    try {
      let taskCountSql = `
        SELECT 
          (SELECT COUNT(*) FROM clients WHERE status = 'active') as total_clients,
          (SELECT COUNT(*) FROM staff WHERE status = 'active') as total_staff,
          (SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE status = 'paid' AND strftime('%m', paid_date) = strftime('%m', DATE('now'))) as monthly_revenue
      `;

      // Role-based task counting
      if (userRole && !['admin', 'senior_ca'].includes(userRole) && userId) {
        // For regular staff, only count their assigned tasks
        taskCountSql += `, 
          (SELECT COUNT(*) FROM tasks WHERE status IN ('pending', 'in_progress') AND assigned_to = ${userId}) as active_tasks,
          (SELECT COUNT(*) FROM tasks WHERE status = 'completed' AND assigned_to = ${userId}) as completed_tasks,
          (SELECT COUNT(*) FROM invoices WHERE status = 'pending') as pending_invoices
        `;
      } else {
        // For admin/senior_ca, show all tasks
        taskCountSql += `,
          (SELECT COUNT(*) FROM tasks WHERE status IN ('pending', 'in_progress')) as active_tasks,
          (SELECT COUNT(*) FROM tasks WHERE status = 'completed') as completed_tasks,
          (SELECT COUNT(*) FROM invoices WHERE status = 'pending') as pending_invoices
        `;
      }
      
      const stats = await query(taskCountSql);
      
      res.json({ success: true, stats: stats[0] });
      return;
    } catch (dbError) {
      console.log('Database not available, using demo stats');
    }

    // Fallback demo stats
    const demoStats = {
      total_clients: 25,
      total_staff: 8,
      active_tasks: 15,
      completed_tasks: 45,
      pending_invoices: 8,
      monthly_revenue: 125000
    };
    
    res.json({ success: true, stats: demoStats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/recent-activities', async (req, res) => {
  try {
    const userRole = req.query.role;
    const userId = req.query.userId;

    // Try database first
    try {
      let sql = `
        SELECT 'task' as type, t.title as title, c.name as client_name, t.created_at as date, t.status
        FROM tasks t 
        LEFT JOIN clients c ON t.client_id = c.id 
        WHERE t.created_at >= DATE('now', '-7 days')
      `;

      // Filter activities based on user role
      if (userRole && !['admin', 'senior_ca'].includes(userRole) && userId) {
        sql += ` AND t.assigned_to = ${userId}`;
      }

      sql += ' ORDER BY date DESC LIMIT 10';
      
      const activities = await query(sql);
      
      res.json({ success: true, activities });
      return;
    } catch (dbError) {
      console.log('Database not available, using demo activities');
    }

    // Fallback demo activities
    const demoActivities = [
      {
        type: 'task',
        title: 'ITR Filing Completed',
        client_name: 'ABC Corporation',
        date: new Date().toISOString(),
        status: 'completed'
      }
    ];
    
    res.json({ success: true, activities: demoActivities });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get dashboard settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await query('SELECT setting_key, setting_value FROM settings');
    
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.setting_key] = setting.setting_value;
    });
    
    res.json({ success: true, settings: settingsObj });
  } catch (error) {
    console.error('Error fetching dashboard settings:', error);
    res.json({ 
      success: true, 
      settings: { dashboard_name: 'Enhanced CA Office Pro' }
    });
  }
});

// Update dashboard settings
router.put('/settings', async (req, res) => {
  try {
    const { dashboard_name } = req.body;
    
    await query(
      'INSERT OR REPLACE INTO settings (setting_key, setting_value) VALUES (?, ?)',
      ['dashboard_name', dashboard_name]
    );
    
    res.json({ success: true, message: 'Dashboard name updated successfully' });
  } catch (error) {
    console.error('Error updating dashboard settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;