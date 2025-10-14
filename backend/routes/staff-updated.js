const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Get all staff - Uses only existing columns
router.get('/', requireAuth, async (req, res) => {
  try {
    const { primary_firm_id, status, role, department } = req.query;
    
    let sql = 'SELECT * FROM staff WHERE 1=1';
    const params = [];

    if (primary_firm_id) {
      sql += ' AND primary_firm_id = ?';
      params.push(primary_firm_id);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    } else {
      sql += " AND status = 'active'";
    }

    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }

    if (department) {
      sql += ' AND department = ?';
      params.push(department);
    }

    sql += ' ORDER BY name ASC';

    const staff = await query(sql, params);
    res.json({ success: true, staff, data: staff });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get active staff only
router.get('/active', requireAuth, async (req, res) => {
  try {
    const staff = await query(`
      SELECT id, name, email, role, phone, status, employee_id, department
      FROM staff 
      WHERE status = 'active'
      ORDER BY name ASC
    `);
    
    res.json({ success: true, staff });
  } catch (error) {
    console.error('Error fetching active staff:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single staff member
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const staff = await query('SELECT * FROM staff WHERE id = ?', [req.params.id]);
    
    if (staff.length === 0) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    res.json({ success: true, data: staff[0], staff: staff[0] });
  } catch (error) {
    console.error('Error fetching staff member:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new staff member - ALL existing fields
router.post('/', requireAuth, async (req, res) => {
  try {
    const { 
      name, email, password, role, employee_id, phone, department, status, primary_firm_id 
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    const existingStaff = await query('SELECT id FROM staff WHERE email = ?', [email]);
    if (existingStaff.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await query(`
      INSERT INTO staff (
        name, email, password, role, employee_id, phone, department, 
        status, primary_firm_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, email, hashedPassword, role || 'staff', employee_id, phone, 
      department || 'operations', status || 'active', primary_firm_id || null
    ]);

    const staffId = result.lastInsertRowid || result.insertId;

    res.json({
      success: true,
      message: 'Staff member created successfully',
      staffId: staffId,
      data: { id: staffId }
    });
  } catch (error) {
    console.error('Error creating staff:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update staff member - ALL existing fields
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { 
      name, email, role, employee_id, phone, department, status, primary_firm_id 
    } = req.body;

    const existingStaff = await query(
      'SELECT id FROM staff WHERE email = ? AND id != ?', 
      [email, req.params.id]
    );
    
    if (existingStaff.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists for another staff member'
      });
    }

    await query(`
      UPDATE staff SET
        name = ?, email = ?, role = ?, employee_id = ?, phone = ?, 
        department = ?, status = ?, primary_firm_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      name, email, role, employee_id, phone, department, status, 
      primary_firm_id || null, req.params.id
    ]);

    res.json({ success: true, message: 'Staff member updated successfully' });
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Change password
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

    const users = await query('SELECT password FROM staff WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isValidPassword = await bcrypt.compare(current_password, users[0].password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    const hashedNewPassword = await bcrypt.hash(new_password, 12);
    await query('UPDATE staff SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hashedNewPassword, userId]);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete staff member
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (req.params.id === '1') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete admin user'
      });
    }

    const tasks = await query('SELECT COUNT(*) as count FROM tasks WHERE assigned_to = ?', [req.params.id]);
    
    if (tasks[0] && tasks[0].count > 0) {
      await query('UPDATE staff SET status = "inactive" WHERE id = ?', [req.params.id]);
      return res.json({ success: true, message: 'Staff member marked as inactive (has assigned tasks)' });
    }

    await query('DELETE FROM staff WHERE id = ?', [req.params.id]);
    
    res.json({ success: true, message: 'Staff member deleted successfully' });
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;