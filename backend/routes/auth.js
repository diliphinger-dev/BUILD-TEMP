const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

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
        'SELECT * FROM staff WHERE email = ? AND status = ?' 
        [email]
      );
      
      if (users.length > 0) {
        const user = users[0];
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (isValidPassword) {
          // Update last_login
          await query('UPDATE staff SET last_login = NOW() WHERE id = ?', [user.id]);

          // ENHANCED: Auto-mark attendance on first login of the day
          const today = new Date().toISOString().split('T')[0];
          const attendanceExists = await query(
            'SELECT id FROM attendance WHERE staff_id = ? AND attendance_date = ?',
            [user.id, today]
          );
          
          let attendanceMarked = false;
          if (attendanceExists.length === 0) {
            // Check if attendance auto-marking is enabled (defaults to true if not set)
            const enableAttendance = process.env.ENABLE_ATTENDANCE_ON_LOGIN !== 'false';
            
            if (enableAttendance) {
              const now = new Date();
              const checkInTime = now.toTimeString().split(' ')[0];
              
              // Check if late (after 9:15 AM)
              const lateThreshold = new Date(now);
              lateThreshold.setHours(9, 15, 0, 0);
              const status = now > lateThreshold ? 'late' : 'present';

              try {
                // Try with check_in_time field first, fallback to check_in if column doesn't exist
                await query(
                  'INSERT INTO attendance (staff_id, attendance_date, check_in_time, status) VALUES (?, ?, ?, ?)',
                  [user.id, today, checkInTime, status]
                ).catch(async (err) => {
                  // Fallback to check_in column if check_in_time doesn't exist
                  if (err.code === 'ER_BAD_FIELD_ERROR') {
                    await query(
                      'INSERT INTO attendance (staff_id, attendance_date, check_in, status) VALUES (?, ?, NOW(), ?)',
                      [user.id, today, status]
                    );
                  } else {
                    throw err;
                  }
                });
                attendanceMarked = true;
              } catch (attError) {
                console.error('Error marking attendance on login:', attError);
              }
            }
          }

          const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'enhanced-ca-office-secret-key',
            { expiresIn: process.env.TOKEN_EXPIRY || '24h' }
          );

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

router.post('/reset-password', requireAdmin, async (req, res) => {
  try {
    const { user_id, new_password } = req.body;

    if (!user_id || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'User ID and new password are required'
      });
    }

    // FIX: Use userId variable consistently
    const userId = user_id;

    const users = await query('SELECT id, name FROM staff WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(new_password, 12);
    await query('UPDATE staff SET password = ?, updated_at = NOW() WHERE id = ?', [hashedPassword, userId]);

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

    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'enhanced-ca-office-secret-key'
    );

    // FIX: Handle both userId and id from token
    const userId = decoded.userId || decoded.id;

    // Try database first, fallback to demo
    try {
      // FIXED: Use userId variable instead of decoded.userId
      const users = await query(
        'SELECT id, name, email, role, status FROM staff WHERE id = ?', 
        [userId]
      );
      
      if (users.length > 0) {
        return res.json({
          success: true,
          user: users[0]
        });
      }
    } catch (dbError) {
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
      message: 'User not found'
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }
    
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// NEW: Logout endpoint (for audit trail)
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
        
        // FIX: Handle both userId and id
        const userId = decoded.userId || decoded.id;
        
        // Log logout event for audit trail
        console.log(`User ${decoded.email} (ID: ${userId}) logged out at ${new Date().toISOString()}`);
        
        // Optional: Record logout in database if you have an audit_log table
        // await query('INSERT INTO audit_log (user_id, action, timestamp) VALUES (?, ?, NOW())', 
        //   [userId, 'logout']);
        
      } catch (err) {
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
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
});

module.exports = router;