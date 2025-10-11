const { query } = require('../config/database');

// Middleware to verify user has access to the firm
const verifyFirmAccess = async (req, res, next) => {
  try {
    const firmId = req.body.firm_id || req.query.firm_id || req.params.firm_id;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Admin has access to all firms
    if (userRole === 'admin') {
      return next();
    }

    if (!firmId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Firm ID is required' 
      });
    }

    // Check if user has access to this firm
    const [access] = await query(`
      SELECT * FROM staff_firms 
      WHERE staff_id = ? AND firm_id = ? AND status = 'active'
    `, [userId, firmId]);

    if (!access) {
      return res.status(403).json({ 
        success: false, 
        message: 'You do not have access to this firm' 
      });
    }

    // Attach firm access info to request
    req.firmAccess = access;
    next();
  } catch (error) {
    console.error('Firm access verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error verifying firm access' 
    });
  }
};

// Middleware to add firm_id from user's context if not provided
const autoSetFirmId = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Skip if firm_id already provided
    if (req.body.firm_id || req.query.firm_id) {
      return next();
    }

    // For admin, require explicit firm_id
    if (userRole === 'admin') {
      return next();
    }

    // Get user's primary firm
    const [primaryFirm] = await query(`
      SELECT firm_id FROM staff_firms 
      WHERE staff_id = ? AND is_primary = TRUE AND status = 'active'
      LIMIT 1
    `, [userId]);

    if (primaryFirm) {
      req.body.firm_id = primaryFirm.firm_id;
    }

    next();
  } catch (error) {
    console.error('Auto set firm ID error:', error);
    next();
  }
};

module.exports = { verifyFirmAccess, autoSetFirmId };