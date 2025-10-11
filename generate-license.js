// Standalone License Key Generator
// Usage: node generate-license.js

const jwt = require('jsonwebtoken');
const readline = require('readline');

const LICENSE_SECRET = process.env.LICENSE_SECRET || 'CA-OFFICE-LICENSE-SECRET-KEY-2024';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function generateLicenseKey(companyName, email, expiryDate, maxUsers) {
  const data = {
    company: companyName,
    email: email,
    expiry: expiryDate,
    users: parseInt(maxUsers),
    issued: new Date().toISOString(),
    type: 'commercial'
  };
  
  const token = jwt.sign(data, LICENSE_SECRET, { algorithm: 'HS256' });
  return token;
}

function verifyLicenseKey(licenseKey) {
  try {
    const decoded = jwt.verify(licenseKey, LICENSE_SECRET);
    return { valid: true, data: decoded };
  } catch (error) {
    return { valid: false, reason: error.message };
  }
}

async function main() {
  console.log('\n==============================================');
  console.log('   CA OFFICE LICENSE KEY GENERATOR');
  console.log('==============================================\n');
  
  const action = await question('Choose action:\n1. Generate New License\n2. Verify Existing License\n3. Generate Trial License\n\nEnter choice (1/2/3): ');
  
  if (action === '1') {
    const companyName = await question('\nEnter Company Name: ');
    const email = await question('Enter Email: ');
    const durationMonths = await question('Enter License Duration (months): ');
    const maxUsers = await question('Enter Maximum Users: ');
    
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + parseInt(durationMonths));
    
    const licenseKey = generateLicenseKey(companyName, email, expiryDate.toISOString(), maxUsers);
    
    console.log('\n==============================================');
    console.log('LICENSE KEY GENERATED SUCCESSFULLY!');
    console.log('==============================================');
    console.log('\nLicense Details:');
    console.log('----------------');
    console.log('Company:', companyName);
    console.log('Email:', email);
    console.log('Max Users:', maxUsers);
    console.log('Valid Until:', expiryDate.toLocaleDateString());
    console.log('Duration:', durationMonths, 'months');
    console.log('\nLICENSE KEY:');
    console.log('----------------------------------------');
    console.log(licenseKey);
    console.log('----------------------------------------');
    console.log('\n⚠️  IMPORTANT: Save this license key securely!');
    console.log('Share this key with the customer for activation.\n');
    
  } else if (action === '2') {
    const licenseKey = await question('\nEnter License Key to Verify: ');
    
    const result = verifyLicenseKey(licenseKey);
    
    if (result.valid) {
      const expiryDate = new Date(result.data.expiry);
      const now = new Date();
      const daysRemaining = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
      
      console.log('\n==============================================');
      console.log('LICENSE KEY IS VALID ✅');
      console.log('==============================================');
      console.log('\nLicense Details:');
      console.log('----------------');
      console.log('Company:', result.data.company);
      console.log('Email:', result.data.email);
      console.log('Max Users:', result.data.users);
      console.log('Issued:', new Date(result.data.issued).toLocaleDateString());
      console.log('Expires:', expiryDate.toLocaleDateString());
      console.log('Days Remaining:', daysRemaining > 0 ? daysRemaining : 'EXPIRED');
      console.log('Status:', daysRemaining > 0 ? 'Active ✅' : 'Expired ❌');
      console.log('');
    } else {
      console.log('\n==============================================');
      console.log('LICENSE KEY IS INVALID ❌');
      console.log('==============================================');
      console.log('Reason:', result.reason);
      console.log('');
    }
    
  } else if (action === '3') {
    const durationDays = await question('\nEnter Trial Duration (days, default 30): ') || '30';
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(durationDays));
    
    const trialKey = generateLicenseKey('Trial User', 'trial@ca-office.com', expiryDate.toISOString(), 3);
    
    console.log('\n==============================================');
    console.log('TRIAL LICENSE GENERATED SUCCESSFULLY!');
    console.log('==============================================');
    console.log('\nTrial License Details:');
    console.log('----------------');
    console.log('Type: Trial Version');
    console.log('Max Users: 3');
    console.log('Valid Until:', expiryDate.toLocaleDateString());
    console.log('Duration:', durationDays, 'days');
    console.log('\nTRIAL LICENSE KEY:');
    console.log('----------------------------------------');
    console.log(trialKey);
    console.log('----------------------------------------');
    console.log('');
    
  } else {
    console.log('\nInvalid choice. Exiting...\n');
  }
  
  rl.close();
}

main().catch(console.error);