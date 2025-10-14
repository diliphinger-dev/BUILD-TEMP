const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Use environment variable for production, fallback for development
const LICENSE_SECRET = process.env.LICENSE_SECRET || 'CA-OFFICE-LICENSE-SECRET-KEY-2024';

// Optional: Add encryption layer for additional security
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);

/**
 * Generate a commercial license key
 * @param {string} companyName - Name of the company
 * @param {string} email - Contact email
 * @param {string|Date} expiryDate - License expiration date
 * @param {number} maxUsers - Maximum number of users allowed
 * @param {object} features - Optional feature flags
 * @returns {string} Signed JWT license key
 */
function generateLicenseKey(companyName, email, expiryDate, maxUsers = 5, features = {}) {
  const data = {
    company: companyName,
    email: email,
    expiry: expiryDate instanceof Date ? expiryDate.toISOString() : expiryDate,
    users: maxUsers,
    issued: new Date().toISOString(),
    type: 'commercial',
    licenseId: crypto.randomUUID(),
    features: {
      advancedReports: features.advancedReports || false,
      apiAccess: features.apiAccess || false,
      customBranding: features.customBranding || false,
      prioritySupport: features.prioritySupport || false,
      ...features
    }
  };
  
  const token = jwt.sign(data, LICENSE_SECRET, { 
    algorithm: 'HS256',
    expiresIn: Math.floor((new Date(data.expiry) - new Date()) / 1000) // seconds until expiry
  });
  
  return token;
}

// REMOVED: generateTrialLicense function - No more trial license generation

/**
 * Generate a lifetime license key
 * @param {string} companyName - Name of the company
 * @param {string} email - Contact email
 * @param {number} maxUsers - Maximum number of users allowed
 * @param {object} features - Optional feature flags
 * @returns {string} Signed JWT lifetime license key
 */
function generateLifetimeLicense(companyName, email, maxUsers = 10, features = {}) {
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 99); // 99 years from now
  
  const data = {
    company: companyName,
    email: email,
    expiry: expiryDate.toISOString(),
    users: maxUsers,
    issued: new Date().toISOString(),
    type: 'lifetime',
    licenseId: crypto.randomUUID(),
    features: {
      advancedReports: true,
      apiAccess: true,
      customBranding: true,
      prioritySupport: true,
      ...features
    }
  };
  
  return jwt.sign(data, LICENSE_SECRET, { algorithm: 'HS256' });
}

/**
 * Generate a subscription-based license key
 * @param {string} companyName - Name of the company
 * @param {string} email - Contact email
 * @param {number} durationMonths - License duration in months
 * @param {number} maxUsers - Maximum number of users allowed
 * @param {object} features - Optional feature flags
 * @returns {string} Signed JWT subscription license key
 */
function generateSubscriptionLicense(companyName, email, durationMonths = 12, maxUsers = 5, features = {}) {
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + durationMonths);
  
  const data = {
    company: companyName,
    email: email,
    expiry: expiryDate.toISOString(),
    users: maxUsers,
    issued: new Date().toISOString(),
    type: 'subscription',
    licenseId: crypto.randomUUID(),
    features: {
      advancedReports: features.advancedReports || true,
      apiAccess: features.apiAccess || false,
      customBranding: features.customBranding || false,
      prioritySupport: features.prioritySupport || true,
      ...features
    }
  };
  
  return jwt.sign(data, LICENSE_SECRET, { algorithm: 'HS256' });
}

/**
 * Verify and decode a license key
 * @param {string} licenseKey - The license key to verify
 * @returns {object} Verification result with valid flag, data, and optional reason
 */
function verifyLicenseKey(licenseKey) {
  try {
    const decoded = jwt.verify(licenseKey, LICENSE_SECRET, { algorithms: ['HS256'] });
    
    const expiryDate = new Date(decoded.expiry);
    const now = new Date();
    
    if (expiryDate < now) {
      return { 
        valid: false, 
        reason: 'License expired', 
        data: decoded,
        daysExpired: Math.floor((now - expiryDate) / (1000 * 60 * 60 * 24))
      };
    }
    
    // Calculate days remaining
    const daysRemaining = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));
    
    return { 
      valid: true, 
      data: decoded,
      daysRemaining: daysRemaining,
      isExpiringSoon: daysRemaining < 30 // Flag if expiring within 30 days
    };
  } catch (error) {
    let reason = 'Invalid license key';
    
    if (error.name === 'TokenExpiredError') {
      reason = 'License expired';
    } else if (error.name === 'JsonWebTokenError') {
      reason = 'Invalid or corrupted license key';
    } else if (error.name === 'NotBeforeError') {
      reason = 'License not yet valid';
    }
    
    return { 
      valid: false, 
      reason: reason, 
      data: null,
      error: error.message 
    };
  }
}

/**
 * Decode a license key without verification (for inspection)
 * @param {string} licenseKey - The license key to decode
 * @returns {object|null} Decoded data or null if invalid
 */
function decodeLicenseKey(licenseKey) {
  try {
    return jwt.decode(licenseKey);
  } catch (error) {
    return null;
  }
}

/**
 * Extend an existing license
 * @param {string} licenseKey - Existing license key
 * @param {number} additionalDays - Days to add to expiry
 * @returns {object} Result with new license key or error
 */
function extendLicense(licenseKey, additionalDays) {
  const verification = verifyLicenseKey(licenseKey);
  
  if (!verification.data) {
    return { success: false, error: 'Invalid license key' };
  }
  
  const currentExpiry = new Date(verification.data.expiry);
  const newExpiry = new Date(currentExpiry);
  newExpiry.setDate(newExpiry.getDate() + additionalDays);
  
  const newLicense = generateLicenseKey(
    verification.data.company,
    verification.data.email,
    newExpiry.toISOString(),
    verification.data.users,
    verification.data.features
  );
  
  return { 
    success: true, 
    newLicense: newLicense,
    oldExpiry: currentExpiry.toISOString(),
    newExpiry: newExpiry.toISOString()
  };
}

/**
 * Check if a license allows a specific feature
 * @param {string} licenseKey - License key to check
 * @param {string} featureName - Name of the feature
 * @returns {boolean} True if feature is enabled
 */
function hasFeature(licenseKey, featureName) {
  const verification = verifyLicenseKey(licenseKey);
  
  if (!verification.valid || !verification.data) {
    return false;
  }
  
  return verification.data.features && verification.data.features[featureName] === true;
}

/**
 * Get license statistics
 * @param {string} licenseKey - License key to analyze
 * @returns {object} License statistics and info
 */
function getLicenseInfo(licenseKey) {
  const verification = verifyLicenseKey(licenseKey);
  
  if (!verification.data) {
    return null;
  }
  
  const issued = new Date(verification.data.issued);
  const expiry = new Date(verification.data.expiry);
  const now = new Date();
  
  const totalDays = Math.floor((expiry - issued) / (1000 * 60 * 60 * 24));
  const daysUsed = Math.floor((now - issued) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
  
  return {
    valid: verification.valid,
    company: verification.data.company,
    email: verification.data.email,
    type: verification.data.type,
    maxUsers: verification.data.users,
    licenseId: verification.data.licenseId,
    issued: issued.toISOString(),
    expiry: expiry.toISOString(),
    features: verification.data.features,
    statistics: {
      totalDays: totalDays,
      daysUsed: daysUsed,
      daysRemaining: Math.max(0, daysRemaining),
      percentageUsed: Math.min(100, Math.round((daysUsed / totalDays) * 100)),
      isExpired: !verification.valid,
      isExpiringSoon: daysRemaining > 0 && daysRemaining < 30
    }
  };
}

/**
 * Generate enterprise license key (for large organizations)
 * @param {string} companyName - Name of the company
 * @param {string} email - Contact email
 * @param {string|Date} expiryDate - License expiration date
 * @param {number} maxUsers - Maximum number of users allowed
 * @returns {string} Signed JWT enterprise license key
 */
function generateEnterpriseLicense(companyName, email, expiryDate, maxUsers = 50) {
  const data = {
    company: companyName,
    email: email,
    expiry: expiryDate instanceof Date ? expiryDate.toISOString() : expiryDate,
    users: maxUsers,
    issued: new Date().toISOString(),
    type: 'enterprise',
    licenseId: crypto.randomUUID(),
    features: {
      advancedReports: true,
      apiAccess: true,
      customBranding: true,
      prioritySupport: true,
      multiLocation: true,
      auditTrails: true,
      sso: true
    }
  };
  
  return jwt.sign(data, LICENSE_SECRET, { algorithm: 'HS256' });
}

// FIXED: Export only the functions that don't include trial generation
module.exports = { 
  generateLicenseKey, 
  verifyLicenseKey,
  generateLifetimeLicense,
  generateSubscriptionLicense,
  generateEnterpriseLicense,
  decodeLicenseKey,
  extendLicense,
  hasFeature,
  getLicenseInfo
  // REMOVED: generateTrialLicense - No longer exported
};