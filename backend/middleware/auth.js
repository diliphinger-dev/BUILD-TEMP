const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Enhanced JWT secret for better security
const JWT_SECRET = process.env.JWT_SECRET || 'enhanced-ca-office-secret-key';

// Middleware to require authentication
const requireAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // FIX: Handle both userId and id from token for backward compatibility
    const userId = decoded.userId || decoded.id;
    
    // Get user details from database - FIXED: Use userId variable instead of decoded.userId
    const users = await query('SELECT * FROM staff WHERE id = ? AND status = ?', [userId, 'active']);
    
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found'
      });
    }

    // Add user to request object
    req.user = users[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Middleware to require admin role
const requireAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    console.log('[ADMIN] Token exists:', !!token);
    
    if (!token) {
      console.log('[ADMIN] No token provided');
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('[ADMIN] Decoded token:', decoded);
    
    // FIXED: Ensure userId is properly defined
    const userId = decoded.userId || decoded.id;
    console.log('[ADMIN] User ID:', userId);
    
    const users = await query('SELECT * FROM staff WHERE id = ? AND status = ?', [userId, 'active']);
    console.log('[ADMIN] Users found:', users.length);
    if (users.length > 0) {
      console.log('[ADMIN] User data:', { id: users[0].id, email: users[0].email, role: users[0].role });
    }
    
    if (users.length === 0) {
      console.log('[ADMIN] No user found in database');
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found'
      });
    }

    req.user = users[0];
    console.log('[ADMIN] Checking role. Current role:', req.user.role);

    if (req.user.role !== 'admin') {
      console.log('[ADMIN] Access denied. Role is:', req.user.role, '(expected: admin)');
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    console.log('[ADMIN] Access granted to user:', req.user.email);
    next();
  } catch (error) {
    console.error('[ADMIN] Error:', error.message);
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
};

// Middleware to require manager or admin role
const requireManagerOrAdmin = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId || decoded.id;
    
    const users = await query('SELECT * FROM staff WHERE id = ? AND status = ?', [userId, 'active']);
    
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found'
      });
    }

    req.user = users[0];

    // Check if user has manager or admin role
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Manager or Admin access required'
      });
    }

    next();
  } catch (error) {
    console.error('Manager/Admin middleware error:', error);
    return res.status(403).json({
      success: false,
      message: 'Manager or Admin access required'
    });
  }
};

// Middleware to check if user can access resource
const checkResourceAccess = (resourceType) => {
  return async (req, res, next) => {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Access token is required'
        });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.userId || decoded.id;
      
      const users = await query('SELECT * FROM staff WHERE id = ? AND status = ?', [userId, 'active']);
      
      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token or user not found'
        });
      }

      const user = users[0];
      req.user = user;
      const resourceId = req.params.id;

      // Admin can access everything
      if (user.role === 'admin') {
        return next();
      }

      // Check specific resource access based on type
      switch (resourceType) {
        case 'task':
          // Users can access tasks assigned to them or created by them
          const tasks = await query('SELECT * FROM tasks WHERE id = ? AND (assigned_to = ? OR created_by = ?)', 
            [resourceId, user.id, user.id]);
          if (tasks.length === 0) {
            return res.status(403).json({
              success: false,
              message: 'Access denied to this task'
            });
          }
          break;

        case 'client':
          // Managers can access all clients, staff can access clients they created
          if (user.role === 'manager') {
            return next();
          }
          const clients = await query('SELECT * FROM clients WHERE id = ? AND created_by = ?', 
            [resourceId, user.id]);
          if (clients.length === 0) {
            return res.status(403).json({
              success: false,
              message: 'Access denied to this client'
            });
          }
          break;

        case 'staff':
          // Only admins can access staff records
          if (user.role !== 'admin') {
            return res.status(403).json({
              success: false,
              message: 'Admin access required for staff records'
            });
          }
          break;

        default:
          // For other resources, require manager or admin
          if (!['admin', 'manager'].includes(user.role)) {
            return res.status(403).json({
              success: false,
              message: 'Insufficient permissions'
            });
          }
      }

      next();
    } catch (error) {
      console.error('Resource access check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking resource access'
      });
    }
  };
};

// Middleware to extract user info from token (optional auth)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.userId || decoded.id;
        const users = await query('SELECT * FROM staff WHERE id = ? AND status = ?', [userId, 'active']);
        
        if (users.length > 0) {
          req.user = users[0];
        }
      } catch (tokenError) {
        // Token is invalid, but we continue without user
        console.warn('Invalid token in optional auth:', tokenError.message);
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    next(); // Continue even if there's an error
  }
};

// Generate JWT token with enhanced compatibility
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id,
      userId: user.id,  // Add this for backward compatibility
      email: user.email, 
      role: user.role 
    },
    JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '24h' 
    }
  );
};

// Verify token utility
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

module.exports = {
  requireAuth,
  authenticateToken: requireAuth,  // ✅ Add this alias
  requireAdmin,
  requireManagerOrAdmin,
  checkResourceAccess,
  optionalAuth,
  generateToken,
  verifyToken
};