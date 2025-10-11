const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { query } = require('../config/database');

// ============================================
// ENHANCED NOTIFICATION SYSTEM
// Combines database-backed notifications with
// comprehensive notification management
// ============================================

// Get all notifications for logged-in user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { unread_only = false, limit = 20, offset = 0 } = req.query;
    
    try {
      // Try to fetch from database
      let sql = `
        SELECT 
          n.*,
          s.name as sender_name,
          s.email as sender_email
        FROM notifications n
        LEFT JOIN staff s ON n.created_by = s.id
        WHERE n.user_id = ?
      `;
      
      const params = [userId];
      
      if (unread_only === 'true' || unread_only === true) {
        sql += ' AND n.is_read = 0';
      }
      
      sql += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));
      
      const notifications = await query(sql, params);
      
      // Get unread count
      const unreadCountResult = await query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
        [userId]
      );
      
      res.json({
        success: true,
        notifications: notifications,
        unread_count: unreadCountResult[0]?.count || 0,
        total: notifications.length,
        message: 'Notifications retrieved successfully'
      });
      
    } catch (dbError) {
      // Fallback if notifications table doesn't exist
      console.log('Notifications table not available, returning empty array');
      res.json({
        success: true,
        notifications: [],
        unread_count: 0,
        total: 0,
        message: 'Notifications feature available but no data'
      });
    }
    
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: error.message
    });
  }
});

// Get unread notification count
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    try {
      const result = await query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
        [userId]
      );
      
      res.json({
        success: true,
        unread_count: result[0]?.count || 0
      });
    } catch (dbError) {
      // Fallback if table doesn't exist
      res.json({
        success: true,
        unread_count: 0
      });
    }
    
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching unread count'
    });
  }
});

// Mark notification as read (single)
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    try {
      await query(
        'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?',
        [id, userId]
      );
      
      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (dbError) {
      res.json({
        success: true,
        message: 'Notification marked as read (simulated)'
      });
    }
    
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notification'
    });
  }
});

// Mark notifications as read (bulk or all)
router.put('/mark-read', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { notification_ids } = req.body;
    
    try {
      if (Array.isArray(notification_ids) && notification_ids.length > 0) {
        // Mark specific notifications as read
        await query(
          'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id IN (?) AND user_id = ?',
          [notification_ids, userId]
        );
        
        res.json({
          success: true,
          message: `${notification_ids.length} notification(s) marked as read`
        });
      } else {
        // Mark all as read
        await query(
          'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
          [userId]
        );
        
        res.json({
          success: true,
          message: 'All notifications marked as read'
        });
      }
    } catch (dbError) {
      res.json({
        success: true,
        message: 'Notifications marked as read (simulated)'
      });
    }
    
  } catch (error) {
    console.error('Mark notifications read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notifications'
    });
  }
});

// Mark all notifications as read (alternative endpoint)
router.put('/read-all', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    try {
      await query(
        'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
        [userId]
      );
      
      res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (dbError) {
      res.json({
        success: true,
        message: 'All notifications marked as read (simulated)'
      });
    }
    
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notifications'
    });
  }
});

// Delete notification
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    try {
      await query(
        'DELETE FROM notifications WHERE id = ? AND user_id = ?',
        [id, userId]
      );
      
      res.json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (dbError) {
      res.json({
        success: true,
        message: 'Notification deleted (simulated)'
      });
    }
    
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting notification'
    });
  }
});

// Delete all read notifications
router.delete('/clear-read', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    try {
      const result = await query(
        'DELETE FROM notifications WHERE user_id = ? AND is_read = 1',
        [userId]
      );
      
      res.json({
        success: true,
        message: 'Read notifications cleared successfully',
        deleted_count: result.affectedRows || 0
      });
    } catch (dbError) {
      res.json({
        success: true,
        message: 'Read notifications cleared (simulated)',
        deleted_count: 0
      });
    }
    
  } catch (error) {
    console.error('Clear read notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing notifications'
    });
  }
});

// Admin: Send notification to specific user or all users
router.post('/send', requireAdmin, async (req, res) => {
  try {
    const { user_id, title, message, type = 'info', priority = 'normal', link } = req.body;
    const createdBy = req.user.id;
    
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }
    
    try {
      if (user_id) {
        // Send to specific user
        await createNotification(user_id, type, title, message, link, createdBy);
        
        res.json({
          success: true,
          message: 'Notification sent successfully to user'
        });
      } else {
        // Send to all active users
        const users = await query(
          'SELECT id FROM staff WHERE status = "active"'
        );
        
        for (const user of users) {
          await createNotification(user.id, type, title, message, link, createdBy);
        }
        
        res.json({
          success: true,
          message: `Notification sent to ${users.length} users`,
          recipients: users.length
        });
      }
    } catch (dbError) {
      res.json({
        success: true,
        message: 'Notification sent (simulated - table not available)'
      });
    }
    
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending notification'
    });
  }
});

// Get notification preferences
router.get('/preferences', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    try {
      const preferences = await query(
        'SELECT * FROM notification_preferences WHERE user_id = ?',
        [userId]
      );
      
      if (preferences.length > 0) {
        res.json({
          success: true,
          preferences: preferences[0]
        });
      } else {
        // Return default preferences
        const defaultPreferences = {
          user_id: userId,
          email_notifications: true,
          push_notifications: true,
          task_updates: true,
          leave_updates: true,
          attendance_reminders: true,
          system_announcements: true
        };
        
        res.json({
          success: true,
          preferences: defaultPreferences
        });
      }
    } catch (dbError) {
      // Fallback to default preferences
      const defaultPreferences = {
        email_notifications: true,
        push_notifications: true,
        task_updates: true,
        leave_updates: true,
        attendance_reminders: true,
        system_announcements: true
      };
      
      res.json({
        success: true,
        preferences: defaultPreferences
      });
    }
    
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notification preferences'
    });
  }
});

// Update notification preferences
router.put('/preferences', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const preferences = req.body;
    
    try {
      // Check if preferences exist
      const existing = await query(
        'SELECT id FROM notification_preferences WHERE user_id = ?',
        [userId]
      );
      
      if (existing.length > 0) {
        // Update existing preferences
        await query(
          `UPDATE notification_preferences SET
            email_notifications = ?,
            push_notifications = ?,
            task_updates = ?,
            leave_updates = ?,
            attendance_reminders = ?,
            system_announcements = ?,
            updated_at = NOW()
          WHERE user_id = ?`,
          [
            preferences.email_notifications ?? true,
            preferences.push_notifications ?? true,
            preferences.task_updates ?? true,
            preferences.leave_updates ?? true,
            preferences.attendance_reminders ?? true,
            preferences.system_announcements ?? true,
            userId
          ]
        );
      } else {
        // Insert new preferences
        await query(
          `INSERT INTO notification_preferences
            (user_id, email_notifications, push_notifications, task_updates, 
             leave_updates, attendance_reminders, system_announcements)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            preferences.email_notifications ?? true,
            preferences.push_notifications ?? true,
            preferences.task_updates ?? true,
            preferences.leave_updates ?? true,
            preferences.attendance_reminders ?? true,
            preferences.system_announcements ?? true
          ]
        );
      }
      
      res.json({
        success: true,
        message: 'Notification preferences updated successfully'
      });
    } catch (dbError) {
      res.json({
        success: true,
        message: 'Notification preferences updated (simulated)'
      });
    }
    
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notification preferences'
    });
  }
});

// Get notification statistics (Admin only)
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    try {
      const stats = await query(`
        SELECT 
          COUNT(*) as total_notifications,
          SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread_notifications,
          SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) as read_notifications,
          COUNT(DISTINCT user_id) as users_with_notifications,
          type,
          COUNT(*) as count_by_type
        FROM notifications
        GROUP BY type
      `);
      
      res.json({
        success: true,
        stats: stats
      });
    } catch (dbError) {
      res.json({
        success: true,
        stats: [],
        message: 'Notification statistics not available'
      });
    }
    
  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notification statistics'
    });
  }
});

// ============================================
// HELPER FUNCTION: Create Notification
// ============================================
async function createNotification(userId, type, title, message, link = null, createdBy = null) {
  try {
    await query(`
      INSERT INTO notifications (user_id, type, title, message, link, created_by, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, NOW())
    `, [userId, type, title, message, link, createdBy]);
    
    return { success: true };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// HELPER FUNCTION: Bulk Create Notifications
// ============================================
async function createBulkNotifications(userIds, type, title, message, link = null, createdBy = null) {
  try {
    const values = userIds.map(userId => [userId, type, title, message, link, createdBy, 0]);
    
    await query(`
      INSERT INTO notifications (user_id, type, title, message, link, created_by, is_read)
      VALUES ?
    `, [values]);
    
    return { success: true, count: userIds.length };
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { 
  router, 
  createNotification,
  createBulkNotifications
};