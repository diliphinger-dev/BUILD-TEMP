const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Try database first, fallback to demo mode
    try {
      const users = await query(
        'SELECT * FROM staff WHERE email = ? AND status = ?',
        [email, 'active']
      );
      
      if (users.length > 0) {
        const user = users[0];
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (isValidPassword) {
          // Update last_login (SQLite compatible)
          await query(
            'UPDATE staff SET last_login = CURRENT_TIMESTAMP WHERE id = ?', 
            [user.id]
          );

          // Auto-mark attendance on first login of the day
          const today = new Date().toISOString().split('T')[0];
          const attendanceExists = await query(
            'SELECT id FROM attendance WHERE staff_id = ? AND attendance_date = ?',
            [user.id, today]
          );
          
          let attendanceMarked = false;
          if (attendanceExists.length === 0) {
            const enableAttendance = process.env.ENABLE_ATTENDANCE_ON_LOGIN !== 'false';
            
            if (enableAttendance) {
              const now = new Date();
              const checkInTime = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM format
              
              // Check if late (after 9:15 AM)
              const lateThreshold = new Date(now);
              lateThreshold.setHours(9, 15, 0, 0);
              const status = now > lateThreshold ? 'late' : 'present';

              try {
                await query(
                  'INSERT INTO attendance (staff_id, attendance_date, check_in_time, status) VALUES (?, ?, ?, ?)',
                  [user.id, today, checkInTime, status]
                );
                attendanceMarked = true;
              } catch (attError) {
                console.error('Error marking attendance on login:', attError);
              }
            }
          }

          // Generate JWT token
          const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'enhanced-ca-office-secret-key',
            { expiresIn: process.env.TOKEN_EXPIRY || '24h' }
          );

          // Remove password from response
          const { password: _, ...userWithoutPassword } = user;

          return res.json({
            success: true,
            token,
            user: userWithoutPassword,
            message: 'Login successful',
            attendance_marked: attendanceMarked
          });
        }
      }
    } catch (dbError) {
      console.error('Database error during login:', dbError);
      console.log('Database not available, using demo mode');
    }

    // Demo mode fallback
    if (email === 'admin@ca-office.com' && password === 'admin123') {
      const demoUser = {
        id: 1,
        name: 'Demo Administrator',
        email: 'admin@ca-office.com',
        role: 'admin',
        status: 'active'
      };

      const token = jwt.sign(
        { id: demoUser.id, email: demoUser.email, role: demoUser.role },
        process.env.JWT_SECRET || 'enhanced-ca-office-secret-key',
        { expiresIn: process.env.TOKEN_EXPIRY || '24h' }
      );

      return res.json({
        success: true,
        token,
        user: demoUser,
        message: 'Demo login successful',
        attendance_marked: false
      });
    }

    // Invalid credentials
    res.status(401).json({
      success: false,
      message: 'Invalid email or password'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
});

// Token verification endpoint
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'enhanced-ca-office-secret-key'
    );

    const userId = decoded.id || decoded.userId;

    // Try database first, fallback to demo
    try {
      const users = await query(
        'SELECT id, name, email, role, status, firm_id FROM staff WHERE id = ? AND status = ?', 
        [userId, 'active']
      );
      
      if (users.length > 0) {
        return res.json({
          success: true,
          user: users[0]
        });
      }
    } catch (dbError) {
      console.error('Database error during token verification:', dbError);
      console.log('Database not available, using demo mode');
    }

    // Demo mode fallback
    if (decoded.email === 'admin@ca-office.com') {
      return res.json({
        success: true,
        user: {
          id: 1,
          name: 'Demo Administrator',
          email: 'admin@ca-office.com',
          role: 'admin',
          status: 'active'
        }
      });
    }

    res.status(401).json({
      success: false,
      message: 'User not found or inactive'
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format.'
      });
    }
    
    console.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      message: 'Token verification failed'
    });
  }
});

// Admin password reset endpoint
router.put('/reset-password/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { new_password } = req.body;

    if (!new_password) {
      return res.status(400).json({
        success: false,
        message: 'New password is required'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user exists
    const users = await query(
      'SELECT id, name, email FROM staff WHERE id = ?', 
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(new_password, 12);
    await query(
      'UPDATE staff SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [hashedPassword, userId]
    );

    res.json({
      success: true,
      message: `Password reset successfully for ${users[0].name}`
    });

  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password'
    });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (token) {
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'enhanced-ca-office-secret-key'
        );
        
        const userId = decoded.id || decoded.userId;
        
        // Log logout event for audit trail
        console.log(`User ${decoded.email} (ID: ${userId}) logged out at ${new Date().toISOString()}`);
        
        // Optional: Record in audit log if table exists
        try {
          await query(
            'INSERT INTO audit_logs (user_id, action, entity_type, ip_address, timestamp) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [userId, 'LOGOUT', 'auth', req.ip]
          );
        } catch (auditError) {
          // Ignore audit log errors
          console.log('Could not record logout in audit log:', auditError.message);
        }
        
      } catch (tokenError) {
        // Token invalid or expired, that's ok for logout
        console.log('Logout attempt with invalid/expired token');
      }
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    // Always return success for logout
    console.error('Logout error:', error);
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
});

// Change password endpoint (for staff to change their own password)
router.put('/change-password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.id;

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Get user's current password
    const users = await query(
      'SELECT id, name, email, password FROM staff WHERE id = ?', 
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(current_password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Check if new password is different
    const isSamePassword = await bcrypt.compare(new_password, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(new_password, 12);
    await query(
      'UPDATE staff SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [hashedPassword, userId]
    );

    // Log password change for audit
    try {
      await query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, timestamp) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [userId, 'PASSWORD_CHANGE', 'staff', userId, req.ip]
      );
    } catch (auditError) {
      console.log('Could not record password change in audit log:', auditError.message);
    }

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password'
    });
  }
});

// Get user profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const users = await query(
      'SELECT id, name, email, role, employee_id, phone, department, designation, status, firm_id, last_login, created_at FROM staff WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found'
      });
    }

    res.json({
      success: true,
      user: users[0]
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile'
    });
  }
});

module.exports = router;