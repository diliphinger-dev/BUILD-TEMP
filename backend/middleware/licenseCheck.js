const { query } = require('../config/database');
const { verifyLicenseKey } = require('../utils/licenseGenerator');

const checkLicense = async (req, res, next) => {
  try {
    const licenses = await query('SELECT * FROM licenses WHERE status = "active" ORDER BY id DESC LIMIT 1');
    
    if (licenses.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'No active license found. Please activate your license.',
        requiresLicense: true
      });
    }
    
    const license = licenses[0];
    const verification = verifyLicenseKey(license.license_key);
    
    if (!verification.valid) {
      await query('UPDATE licenses SET status = "expired" WHERE id = ?', [license.id]);
      
      return res.status(403).json({
        success: false,
        message: verification.reason,
        expired: true,
        expiryDate: license.expiry_date
      });
    }
    
    const staffCount = await query('SELECT COUNT(*) as count FROM staff WHERE status = "active"');
    
    if (staffCount[0].count > verification.data.users) {
      return res.status(403).json({
        success: false,
        message: `User limit exceeded. License allows ${verification.data.users} users, but you have ${staffCount[0].count} active users.`,
        userLimitExceeded: true
      });
    }
    
    req.license = verification.data;
    next();
  } catch (error) {
    console.error('License check error:', error);
    return res.status(500).json({
      success: false,
      message: 'License verification failed'
    });
  }
};

module.exports = { checkLicense };