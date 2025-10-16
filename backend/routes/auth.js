const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Emergency Recovery Configuration
const EMERGENCY_CONFIG = {
  MAX_FAILED_ATTEMPTS: 5,
  EMERGENCY_WINDOW_HOURS: 0.25,
  RESET_AFTER_HOURS: 0.25
};

// Track failed login attempts
const trackFailedAttempt = async (email, ip) => {
  try {
    const existing = await query(
      'SELECT * FROM emergency_recovery WHERE email = ? ORDER BY created_at DESC LIMIT 1',
      [email]
    );

    const now = new Date();
    
    if (existing.length > 0) {
      const record = existing[0];
      const firstFailed = new Date(record.first_failed_attempt);
      const hoursSinceFirst = (now - firstFailed) / (1000 * 60 * 60);
      
      if (hoursSinceFirst > EMERGENCY_CONFIG.RESET_AFTER_HOURS) {
        await query(
          'INSERT INTO emergency_recovery (email, failed_attempts, first_failed_attempt, ip_address) VALUES (?, 1, ?, ?)',
          [email, now.toISOString(), ip]
        );
      } else {
        const newAttempts = record.failed_attempts + 1;
        
        if (newAttempts >= EMERGENCY_CONFIG.MAX_FAILED_ATTEMPTS && !record.emergency_mode_enabled) {
          const expiresAt = new Date(now.getTime() + EMERGENCY_CONFIG.EMERGENCY_WINDOW_HOURS * 60 * 60 * 1000);
          
          await query(
            'UPDATE emergency_recovery SET failed_attempts = ?, emergency_mode_enabled = 1, emergency_mode_expires = ?, updated_at = ? WHERE id = ?',
            [newAttempts, expiresAt.toISOString(), now.toISOString(), record.id]
          );
          
          return { emergencyActivated: true, expiresAt };
        } else {
          await query(
            'UPDATE emergency_recovery SET failed_attempts = ?, updated_at = ? WHERE id = ?',
            [newAttempts, now.toISOString(), record.id]
          );
        }
      }
    } else {
      await query(
        'INSERT INTO emergency_recovery (email, failed_attempts, first_failed_attempt, ip_address) VALUES (?, 1, ?, ?)',
        [email, now.toISOString(), ip]
      );
    }
    
    return { emergencyActivated: false };
  } catch (error) {
    console.error('Error tracking failed attempt:', error);
    return { emergencyActivated: false };
  }
};

const resetFailedAttempts = async (email) => {
  try {
    await query(
      'DELETE FROM emergency_recovery WHERE email = ?',
      [email]
    );
    console.log(`✅ Cleared emergency recovery records for ${email}`);
  } catch (error) {
    console.error('Error resetting failed attempts:', error);
  }
};

// NEW: Check if real admin exists (excluding demo)
router.get('/check-admin-exists', async (req, res) => {
  try {
    const admins = await query(
      'SELECT COUNT(*) as count FROM staff WHERE role = ? AND email != ? AND status = ?',
      ['admin', 'admin@ca-office.com', 'active']
    );
    
    res.json({
      success: true,
      adminExists: admins[0].count > 0
    });
  } catch (error) {
    console.error('Error checking admin existence:', error);
    res.json({ success: true, adminExists: false });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    console.log('=== LOGIN ATTEMPT ===');
    console.log('Email:', email);
    console.log('IP:', ip);

    try {
      const users = await query(
        'SELECT * FROM staff WHERE email = ? AND status = ?',
        [email, 'active']
      );
      
      if (users.length > 0) {
        const user = users[0];
        
        console.log('User found:', user.id, user.name);
        console.log('Stored hash length:', user.password.length);
        console.log('Stored hash starts with:', user.password.substring(0, 7));
        
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        console.log('Password valid:', isValidPassword);
        
        if (isValidPassword) {
          await resetFailedAttempts(email);
          
          try {
            await query('UPDATE staff SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
          } catch (err) {
            console.log('⚠️  Could not update last_login (column may not exist)');
          }
          
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
              const checkInTime = now.toTimeString().split(' ')[0].substring(0, 5);
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

          const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'enhanced-ca-office-secret-key',
            { expiresIn: process.env.TOKEN_EXPIRY || '24h' }
          );

          const { password: _, ...userWithoutPassword } = user;

          console.log('✅ Login successful for:', email);

          return res.json({
            success: true,
            token,
            user: userWithoutPassword,
            message: 'Login successful',
            attendance_marked: attendanceMarked
          });
        } else {
          console.log('❌ Invalid password for:', email);
          
          const result = await trackFailedAttempt(email, ip);
          
          if (result.emergencyActivated) {
            return res.status(401).json({
              success: false,
              message: 'Invalid password',
              emergency_mode: true,
              emergency_message: `Emergency recovery mode activated! You have ${EMERGENCY_CONFIG.EMERGENCY_WINDOW_HOURS * 60} minutes to reset your password.`,
              attempts_remaining: 0
            });
          }
          
          const currentAttempts = await query(
            'SELECT failed_attempts FROM emergency_recovery WHERE email = ? ORDER BY created_at DESC LIMIT 1',
            [email]
          );
          
          const attempts = currentAttempts.length > 0 ? currentAttempts[0].failed_attempts : 0;
          const remaining = EMERGENCY_CONFIG.MAX_FAILED_ATTEMPTS - attempts;
          
          return res.status(401).json({
            success: false,
            message: 'Invalid email or password',
            attempts_remaining: remaining > 0 ? remaining : 0,
            emergency_mode: false
          });
        }
      } else {
        console.log('❌ User not found:', email);
        await trackFailedAttempt(email, ip);
      }
    } catch (dbError) {
      console.error('Database error during login:', dbError);
      console.log('Database not available, using demo mode');
    }

    // UPDATED: Demo mode fallback - Only if no real admin exists
    if (email === 'admin@ca-office.com' && password === 'admin123') {
      try {
        const realAdmins = await query(
          'SELECT COUNT(*) as count FROM staff WHERE role = ? AND email != ? AND status = ?',
          ['admin', 'admin@ca-office.com', 'active']
        );
        
        if (realAdmins[0].count > 0) {
          console.log('❌ Demo login blocked - Real admin exists');
          return res.status(403).json({
            success: false,
            message: 'Demo login has been disabled. A real administrator account exists. Please use your credentials.'
          });
        }
      } catch (err) {
        console.log('Error checking real admin:', err);
      }

      const demoUser = {
        id: 999999,
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

      console.log('✅ Demo login successful - No real admin exists yet');

      return res.json({
        success: true,
        token,
        user: demoUser,
        message: '⚠️ Demo Mode: Create a real admin account to disable demo login',
        attendance_marked: false,
        is_demo: true
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

// Emergency password reset
router.post('/emergency-reset', async (req, res) => {
  try {
    const { email, new_password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;

    console.log('=== EMERGENCY RESET ATTEMPT ===');
    console.log('Email:', email);

    if (!email || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Email and new password are required'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const recovery = await query(
      'SELECT * FROM emergency_recovery WHERE email = ? AND emergency_mode_enabled = 1 AND recovery_used = 0 ORDER BY created_at DESC LIMIT 1',
      [email]
    );

    if (recovery.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Emergency recovery mode not active or already used'
      });
    }

    const recoveryRecord = recovery[0];
    const now = new Date();
    const expiresAt = new Date(recoveryRecord.emergency_mode_expires);

    if (now > expiresAt) {
      return res.status(403).json({
        success: false,
        message: 'Emergency recovery window has expired'
      });
    }

    const users = await query(
      'SELECT id, name, email FROM staff WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];
    const hashedPassword = await bcrypt.hash(new_password, 10);
    
    console.log('New hash length:', hashedPassword.length);
    console.log('New hash starts with:', hashedPassword.substring(0, 7));
    
    await query(
      'UPDATE staff SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, user.id]
    );

    await query('DELETE FROM emergency_recovery WHERE email = ?', [email]);

    try {
      await query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, timestamp) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [user.id, 'EMERGENCY_PASSWORD_RESET', 'staff', user.id, ip]
      );
    } catch (auditError) {
      console.log('Could not record emergency reset in audit log');
    }

    console.log(`✅ Emergency password reset completed for ${email}`);

    res.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });

  } catch (error) {
    console.error('Emergency password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password'
    });
  }
});

// Check emergency recovery status
router.get('/emergency-status/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const recovery = await query(
      'SELECT emergency_mode_enabled, emergency_mode_expires, failed_attempts, recovery_used FROM emergency_recovery WHERE email = ? ORDER BY created_at DESC LIMIT 1',
      [email]
    );

    if (recovery.length === 0) {
      return res.json({
        success: true,
        emergency_mode: false,
        failed_attempts: 0
      });
    }

    const record = recovery[0];
    const now = new Date();
    const isActive = record.emergency_mode_enabled && 
                    !record.recovery_used &&
                    record.emergency_mode_expires && 
                    new Date(record.emergency_mode_expires) > now;

    res.json({
      success: true,
      emergency_mode: isActive,
      failed_attempts: record.failed_attempts,
      expires_at: record.emergency_mode_expires
    });

  } catch (error) {
    console.error('Emergency status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking emergency status'
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

    const decoded = jwt.verify(
      token, 
      process.env.JWT_SECRET || 'enhanced-ca-office-secret-key'
    );

    const userId = decoded.id || decoded.userId;

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
    }

    if (decoded.email === 'admin@ca-office.com' && decoded.id === 999999) {
      return res.json({
        success: true,
        user: {
          id: 999999,
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

    console.log('=== ADMIN RESET PASSWORD ===');
    console.log('Target user ID:', userId);

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

    const hashedPassword = await bcrypt.hash(new_password, 10);
    
    console.log('New hash length:', hashedPassword.length);
    console.log('New hash starts with:', hashedPassword.substring(0, 7));
    
    await query(
      'UPDATE staff SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [hashedPassword, userId]
    );

    await query('DELETE FROM emergency_recovery WHERE email = ?', [users[0].email]);

    console.log(`✅ Admin reset password for user ${userId}`);

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
        
        console.log(`User ${decoded.email} (ID: ${userId}) logged out at ${new Date().toISOString()}`);
        
        try {
          await query(
            'INSERT INTO audit_logs (user_id, action, entity_type, ip_address, timestamp) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [userId, 'LOGOUT', 'auth', req.ip]
          );
        } catch (auditError) {
          console.log('Could not record logout in audit log');
        }
        
      } catch (tokenError) {
        console.log('Logout attempt with invalid/expired token');
      }
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }
});

// Change password endpoint
router.put('/change-password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.id;

    console.log('=== CHANGE PASSWORD ===');
    console.log('User ID:', userId);

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
    
    console.log('Current hash length:', user.password.length);
    
    const isValidPassword = await bcrypt.compare(current_password, user.password);
    
    console.log('Current password valid:', isValidPassword);
    
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    const isSamePassword = await bcrypt.compare(new_password, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password'
      });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    
    console.log('New hash length:', hashedPassword.length);
    console.log('New hash starts with:', hashedPassword.substring(0, 7));
    
    await query(
      'UPDATE staff SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [hashedPassword, userId]
    );

    await query('DELETE FROM emergency_recovery WHERE email = ?', [user.email]);

    try {
      await query(
        'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, timestamp) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [userId, 'PASSWORD_CHANGE', 'staff', userId, req.ip]
      );
    } catch (auditError) {
      console.log('Could not record password change in audit log');
    }

    console.log(`✅ Password changed successfully for user ${userId}`);

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