const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { generateLicenseKey, verifyLicenseKey, generateTrialLicense } = require('../utils/licenseGenerator');
const { requireAdmin } = require('../middleware/auth');

router.post('/activate', async (req, res) => {
  try {
    const { licenseKey, companyName, email } = req.body;
    
    console.log('========================================');
    console.log('LICENSE ACTIVATION ATTEMPT');
    console.log('========================================');
    console.log('Company:', companyName);
    console.log('Email:', email);
    console.log('License Key Length:', licenseKey?.length);
    console.log('License Key Preview:', licenseKey?.substring(0, 50) + '...');
    
    if (!licenseKey) {
      console.log('❌ ERROR: No license key provided');
      return res.status(400).json({
        success: false,
        message: 'License key is required'
      });
    }
    
    console.log('→ Verifying license key...');
    const verification = verifyLicenseKey(licenseKey);
    console.log('→ Verification result:', verification.valid ? '✓ VALID' : '✗ INVALID');
    
    if (!verification.valid) {
      console.log('❌ Verification failed:', verification.reason);
      console.log('Verification details:', JSON.stringify(verification, null, 2));
      return res.status(400).json({
        success: false,
        message: verification.reason || 'Invalid license key'
      });
    }
    
    console.log('✓ License data:', JSON.stringify(verification.data, null, 2));
    
    // Deactivate existing active licenses
    console.log('→ Deactivating old licenses...');
    await query('UPDATE licenses SET status = ? WHERE status = ?', ['expired', 'active']);
    console.log('✓ Old licenses deactivated');
    
    // Determine license type based on duration
    const issueDate = new Date(verification.data.issued);
    const expiryDate = new Date(verification.data.expiry);
    const durationDays = Math.floor((expiryDate - issueDate) / (1000 * 60 * 60 * 24));
    
    let licenseType = 'trial';
    if (durationDays <= 31) licenseType = 'trial';
    else if (durationDays <= 400) licenseType = '1year';
    else if (durationDays <= 1200) licenseType = '3year';
    else if (durationDays <= 2000) licenseType = '5year';
    else licenseType = 'lifetime';
    
    console.log('→ License type determined:', licenseType);
    console.log('→ Duration days:', durationDays);
    
    // Extract dates properly
    const issueDateStr = verification.data.issued.includes('T') 
      ? verification.data.issued.split('T')[0] 
      : verification.data.issued;
    const expiryDateStr = verification.data.expiry.includes('T') 
      ? verification.data.expiry.split('T')[0] 
      : verification.data.expiry;
    
    console.log('→ Issue date:', issueDateStr);
    console.log('→ Expiry date:', expiryDateStr);
    
    // Insert new license
    console.log('→ Inserting new license...');
    const insertQuery = `INSERT INTO licenses 
       (license_key, company_name, email, issue_date, expiry_date, status, max_users, license_type, features) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const insertParams = [
      licenseKey, 
      companyName || verification.data.company, 
      email || verification.data.email, 
      issueDateStr,
      expiryDateStr,
      'active', 
      verification.data.users,
      licenseType,
      JSON.stringify(verification.data.features || {})
    ];
    
    console.log('→ Insert params:', JSON.stringify(insertParams.map((p, i) => 
      i === 0 ? p.substring(0, 20) + '...' : p
    ), null, 2));
    
    const result = await query(insertQuery, insertParams);
    
    console.log('✓ License activated successfully!');
    console.log('✓ License ID:', result.insertId);
    console.log('========================================');
    
    res.json({
      success: true,
      message: 'License activated successfully',
      expiry: verification.data.expiry,
      maxUsers: verification.data.users,
      company: companyName || verification.data.company,
      licenseType: licenseType
    });
  } catch (error) {
    console.error('========================================');
    console.error('❌ LICENSE ACTIVATION ERROR');
    console.error('========================================');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('========================================');
    
    res.status(500).json({
      success: false,
      message: 'License activation failed: ' + error.message
    });
  }
});

router.get('/status', async (req, res) => {
  try {
    const licenses = await query(
      'SELECT * FROM licenses WHERE status = ? ORDER BY id DESC LIMIT 1',
      ['active']
    );
    
    if (licenses.length === 0) {
      return res.json({
        success: true,
        activated: false,
        message: 'No active license found'
      });
    }
    
    const license = licenses[0];
    const verification = verifyLicenseKey(license.license_key);
    
    const expiryDate = new Date(license.expiry_date);
    const now = new Date();
    const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    
    res.json({
      success: true,
      activated: true,
      valid: verification.valid && daysRemaining > 0,
      company: license.company_name,
      email: license.email,
      issueDate: license.issue_date,
      expiryDate: license.expiry_date,
      daysRemaining: Math.max(0, daysRemaining),
      maxUsers: license.max_users,
      licenseType: license.license_type,
      status: verification.valid && daysRemaining > 0 ? 'active' : 'expired'
    });
  } catch (error) {
    console.error('License status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get license status: ' + error.message
    });
  }
});

router.post('/generate', requireAdmin, async (req, res) => {
  try {
    const { companyName, email, durationMonths, maxUsers } = req.body;
    
    if (!companyName || !email || !durationMonths || !maxUsers) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: companyName, email, durationMonths, maxUsers'
      });
    }
    
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + parseInt(durationMonths));
    
    const licenseKey = generateLicenseKey(
      companyName, 
      email, 
      expiryDate.toISOString(), 
      parseInt(maxUsers)
    );
    
    res.json({
      success: true,
      licenseKey: licenseKey,
      company: companyName,
      email: email,
      expiry: expiryDate.toISOString(),
      maxUsers: parseInt(maxUsers),
      durationMonths: parseInt(durationMonths)
    });
  } catch (error) {
    console.error('License generation error:', error);
    res.status(500).json({
      success: false,
      message: 'License generation failed: ' + error.message
    });
  }
});

router.post('/generate-trial', async (req, res) => {
  try {
    const trialLicense = generateTrialLicense(30);
    
    res.json({
      success: true,
      licenseKey: trialLicense,
      type: 'trial',
      duration: '30 days',
      maxUsers: 3,
      message: 'Trial license generated successfully'
    });
  } catch (error) {
    console.error('Trial license generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Trial license generation failed: ' + error.message
    });
  }
});

router.delete('/deactivate', requireAdmin, async (req, res) => {
  try {
    await query('UPDATE licenses SET status = ? WHERE status = ?', ['expired', 'active']);
    
    res.json({
      success: true,
      message: 'License deactivated successfully'
    });
  } catch (error) {
    console.error('License deactivation error:', error);
    res.status(500).json({
      success: false,
      message: 'License deactivation failed: ' + error.message
    });
  }
});

module.exports = router;