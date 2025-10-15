const bcrypt = require('bcryptjs');
const { query } = require('./config/database');

async function resetAdminPassword() {
  try {
    const newPassword = 'newadmin123';
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await query('UPDATE staff SET password = ? WHERE email = ?', [hashedPassword, 'admin@ca-office.com']);
    console.log('Admin password reset to: newadmin123');
  } catch (error) {
    console.error('Error:', error);
  }
}
resetAdminPassword();