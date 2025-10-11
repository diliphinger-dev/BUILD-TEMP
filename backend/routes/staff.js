const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { requireAuth, requireAdmin, authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all staff with firm assignments
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { firm_id, status, role } = req.query;
    
    let sql = `
      SELECT DISTINCT s.*, 
             GROUP_CONCAT(DISTINCT f.firm_name ORDER BY sf.is_primary DESC SEPARATOR ', ') as firms
      FROM staff s
      LEFT JOIN staff_firms sf ON s.id = sf.staff_id AND sf.status = 'active'
      LEFT JOIN firms f ON sf.firm_id = f.id
      WHERE 1=1
    `;
    const params = [];

    if (firm_id) {
      sql += ' AND sf.firm_id = ?';
      params.push(firm_id);
    }

    if (status) {
      sql += ' AND s.status = ?';
      params.push(status);
    } else {
      sql += ' AND s.status = "active"';
    }

    if (role) {
      sql += ' AND s.role = ?';
      params.push(role);
    }

    sql += ' GROUP BY s.id ORDER BY s.name ASC';

    const staff = await query(sql, params);
    res.json({ success: true, staff, data: staff });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get active staff only
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const staff = await query(`
      SELECT id, name, email, role, phone, status, employee_id, department
      FROM staff 
      WHERE status = 'active'
      ORDER BY name ASC
    `);
    
    res.json({ success: true, staff });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Staff performance endpoint
router.get('/:id/performance', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { start = '2024-01-01', end = new Date().toISOString().split('T')[0] } = req.query;
    
    const taskPerformance = await query(`
      SELECT 
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN due_date < CURDATE() AND status != 'completed' THEN 1 ELSE 0 END) as overdue,
        AVG(CASE WHEN status = 'completed' THEN DATEDIFF(completion_date, created_at) END) as avg_completion_days,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as revenue_generated,
        SUM(CASE WHEN status != 'completed' THEN amount ELSE 0 END) as revenue_pending
      FROM tasks
      WHERE assigned_to = ?
        AND created_at BETWEEN ? AND ?
    `, [id, start, end]);
    
    const attendancePerformance = await query(`
      SELECT 
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late,
        ROUND(
          (SUM(CASE WHEN status IN ('present', 'late', 'half_day') THEN 1 ELSE 0 END) * 100.0) / 
          COUNT(*), 2
        ) as attendance_percentage
      FROM attendance
      WHERE staff_id = ?
        AND attendance_date BETWEEN ? AND ?
    `, [id, start, end]);
    
    const productivity = await query(`
      SELECT 
        COUNT(DISTINCT DATE(created_at)) as working_days,
        COUNT(*) / COUNT(DISTINCT DATE(created_at)) as tasks_per_day,
        AVG(actual_hours) as avg_hours_per_task
      FROM tasks
      WHERE assigned_to = ?
        AND created_at BETWEEN ? AND ?
        AND status = 'completed'
    `, [id, start, end]);
    
    const performance = {
      tasks: {
        completed: taskPerformance[0].completed || 0,
        pending: taskPerformance[0].pending || 0,
        overdue: taskPerformance[0].overdue || 0
      },
      attendance: {
        present: attendancePerformance[0].present || 0,
        absent: attendancePerformance[0].absent || 0,
        late: attendancePerformance[0].late || 0,
        percentage: attendancePerformance[0].attendance_percentage || 0
      },
      revenue: {
        generated: taskPerformance[0].revenue_generated || 0,
        pending: taskPerformance[0].revenue_pending || 0
      },
      productivity: {
        averageTaskTime: taskPerformance[0].avg_completion_days || 0,
        tasksPerDay: productivity[0].tasks_per_day || 0
      }
    };
    
    res.json({ success: true, performance });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Leave management endpoints
router.get('/:id/leaves', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { year = new Date().getFullYear() } = req.query;
    
    const leaves = await query(`
      SELECT 
        l.*,
        s.name as approved_by_name,
        DATEDIFF(l.end_date, l.start_date) + 1 as total_days
      FROM leaves l
      LEFT JOIN staff s ON l.approved_by = s.id
      WHERE l.staff_id = ?
        AND YEAR(l.start_date) = ?
      ORDER BY l.start_date DESC
    `, [id, year]);
    
    res.json({ success: true, leaves });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/leave-balance', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const year = new Date().getFullYear();
    
    const leavePolicy = await query(`
      SELECT * FROM leave_policies 
      WHERE applicable_to = 'all' OR applicable_to = ?
      ORDER BY applicable_to DESC
      LIMIT 1
    `, [id]);
    
    const policy = leavePolicy[0] || {
      casual_leave: 12,
      sick_leave: 7,
      earned_leave: 15
    };
    
    const usedLeaves = await query(`
      SELECT 
        leave_type,
        SUM(DATEDIFF(end_date, start_date) + 1) as days_used
      FROM leaves
      WHERE staff_id = ?
        AND YEAR(start_date) = ?
        AND status = 'approved'
      GROUP BY leave_type
    `, [id, year]);
    
    const used = {};
    usedLeaves.forEach(leave => {
      used[leave.leave_type] = leave.days_used;
    });
    
    const balance = {
      casual: policy.casual_leave - (used.casual || 0),
      sick: policy.sick_leave - (used.sick || 0),
      earned: policy.earned_leave - (used.earned || 0),
      total_taken: (used.casual || 0) + (used.sick || 0) + (used.earned || 0)
    };
    
    res.json({ success: true, balance });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Skills and training
router.get('/:id/skills', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const skills = await query(`
      SELECT * FROM staff_skills
      WHERE staff_id = ?
      ORDER BY proficiency_level DESC, skill_name ASC
    `, [id]);
    
    const trainings = await query(`
      SELECT * FROM staff_trainings
      WHERE staff_id = ?
      ORDER BY training_date DESC
    `, [id]);
    
    res.json({ success: true, skills, trainings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Team attendance dashboard
router.get('/team-dashboard', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const todayAttendance = await query(`
      SELECT 
        s.id,
        s.name,
        s.role,
        s.department,
        a.status,
        a.check_in_time,
        a.check_out_time,
        a.location
      FROM staff s
      LEFT JOIN attendance a ON s.id = a.staff_id AND a.attendance_date = ?
      WHERE s.status = 'active'
      ORDER BY s.department, s.name
    `, [today]);
    
    const departmentSummary = await query(`
      SELECT 
        s.department,
        COUNT(DISTINCT s.id) as total_staff,
        COUNT(DISTINCT CASE WHEN a.status = 'present' THEN s.id END) as present,
        COUNT(DISTINCT CASE WHEN a.status = 'late' THEN s.id END) as late,
        COUNT(DISTINCT CASE WHEN a.status IS NULL THEN s.id END) as not_marked
      FROM staff s
      LEFT JOIN attendance a ON s.id = a.staff_id AND a.attendance_date = ?
      WHERE s.status = 'active'
      GROUP BY s.department
    `, [today]);
    
    const lateArrivals = await query(`
      SELECT 
        s.name,
        s.department,
        a.check_in_time,
        TIME_TO_SEC(TIMEDIFF(a.check_in_time, '09:15:00')) / 60 as minutes_late
      FROM attendance a
      JOIN staff s ON a.staff_id = s.id
      WHERE a.attendance_date = ?
        AND a.status = 'late'
      ORDER BY a.check_in_time DESC
    `, [today]);
    
    res.json({
      success: true,
      dashboard: {
        today_attendance: todayAttendance,
        department_summary: departmentSummary,
        late_arrivals: lateArrivals
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single staff member with firm details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const staff = await query('SELECT * FROM staff WHERE id = ?', [req.params.id]);
    
    if (staff.length === 0) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    const firms = await query(`
      SELECT f.*, sf.access_level, sf.is_primary, sf.assigned_date
      FROM firms f
      INNER JOIN staff_firms sf ON f.id = sf.firm_id
      WHERE sf.staff_id = ? AND sf.status = 'active'
      ORDER BY sf.is_primary DESC, f.firm_name
    `, [req.params.id]);

    staff[0].firms = firms;

    res.json({ success: true, data: staff[0], staff: staff[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get staff firm assignments
router.get('/:id/firms', authenticateToken, async (req, res) => {
  try {
    const firms = await query(`
      SELECT f.*, sf.access_level, sf.is_primary, sf.assigned_date, sf.status
      FROM firms f
      INNER JOIN staff_firms sf ON f.id = sf.firm_id
      WHERE sf.staff_id = ?
      ORDER BY sf.is_primary DESC, f.firm_name
    `, [req.params.id]);

    res.json({ success: true, data: firms });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new staff member
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      name, email, password, role, phone, joining_date, salary, status,
      employee_id, department, designation, date_of_birth, gender, 
      blood_group, marital_status, current_address, permanent_address,
      city, state, pincode, emergency_contact_name, emergency_contact_phone,
      emergency_contact_relation, bank_name, account_number, ifsc_code,
      pan_number, aadhar_number, firm_assignments
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
        name, email, password, role, phone, joining_date, salary, status,
        employee_id, department, designation, date_of_birth, gender,
        blood_group, marital_status, current_address, permanent_address,
        city, state, pincode, emergency_contact_name, emergency_contact_phone,
        emergency_contact_relation, bank_name, account_number, ifsc_code,
        pan_number, aadhar_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name, email, hashedPassword, role || 'assistant', phone, 
      joining_date, salary, status || 'active',
      employee_id, department || 'operations', designation, date_of_birth, gender,
      blood_group, marital_status || 'single', current_address, permanent_address,
      city, state, pincode, emergency_contact_name, emergency_contact_phone,
      emergency_contact_relation, bank_name, account_number, ifsc_code,
      pan_number, aadhar_number
    ]);

    const staffId = result.insertId;

    if (firm_assignments && firm_assignments.length > 0) {
      for (const assignment of firm_assignments) {
        await query(`
          INSERT INTO staff_firms (staff_id, firm_id, access_level, is_primary)
          VALUES (?, ?, ?, ?)
        `, [staffId, assignment.firm_id, assignment.access_level || 'full', assignment.is_primary || false]);
      }
    }

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

// Update staff member
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      name, email, role, phone, joining_date, salary, status,
      employee_id, department, designation, date_of_birth, gender,
      blood_group, marital_status, current_address, permanent_address,
      city, state, pincode, emergency_contact_name, emergency_contact_phone,
      emergency_contact_relation, bank_name, account_number, ifsc_code,
      pan_number, aadhar_number
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
        name = ?, email = ?, role = ?, phone = ?, joining_date = ?,
        salary = ?, status = ?, employee_id = ?, department = ?,
        designation = ?, date_of_birth = ?, gender = ?, blood_group = ?,
        marital_status = ?, current_address = ?, permanent_address = ?,
        city = ?, state = ?, pincode = ?, emergency_contact_name = ?,
        emergency_contact_phone = ?, emergency_contact_relation = ?,
        bank_name = ?, account_number = ?, ifsc_code = ?, pan_number = ?,
        aadhar_number = ?, updated_at = NOW()
      WHERE id = ?
    `, [
      name, email, role, phone, joining_date, salary, status,
      employee_id, department, designation, date_of_birth, gender,
      blood_group, marital_status, current_address, permanent_address,
      city, state, pincode, emergency_contact_name, emergency_contact_phone,
      emergency_contact_relation, bank_name, account_number, ifsc_code,
      pan_number, aadhar_number, req.params.id
    ]);

    res.json({ success: true, message: 'Staff member updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Staff can change their own password
router.put('/change-password', authenticateToken, async (req, res) => {
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
    await query('UPDATE staff SET password = ?, updated_at = NOW() WHERE id = ?', [hashedNewPassword, userId]);

    if (req.auditLogger) {
      await req.auditLogger('PASSWORD_CHANGE', 'staff', userId, null, { changed_by: 'self' });
    }

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin can reset any user's password
router.put('/:id/reset-password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { new_password } = req.body;
    const staffId = req.params.id;

    if (!new_password) {
      return res.status(400).json({
        success: false,
        message: 'New password is required'
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const users = await query('SELECT id, name, email FROM staff WHERE id = ?', [staffId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    const hashedNewPassword = await bcrypt.hash(new_password, 12);
    await query('UPDATE staff SET password = ?, updated_at = NOW() WHERE id = ?', [hashedNewPassword, staffId]);

    if (req.auditLogger) {
      await req.auditLogger('PASSWORD_RESET', 'staff', staffId, null, { 
        reset_by: req.user.id,
        reset_by_name: req.user.name,
        target_user: users[0].email
      });
    }

    res.json({
      success: true,
      message: `Password reset successfully for ${users[0].name}`
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update staff password (legacy endpoint for compatibility)
router.put('/:id/password', authenticateToken, async (req, res) => {
  try {
    const { new_password } = req.body;
    
    if (req.user.id !== parseInt(req.params.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const hashedPassword = await bcrypt.hash(new_password, 12);
    
    await query('UPDATE staff SET password = ? WHERE id = ?', [hashedPassword, req.params.id]);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete staff member
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (req.params.id === '1') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete admin user'
      });
    }

    const tasks = await query('SELECT COUNT(*) as count FROM tasks WHERE assigned_to = ?', [req.params.id]);
    
    if (tasks[0].count > 0) {
      await query('UPDATE staff SET status = "inactive" WHERE id = ?', [req.params.id]);
      return res.json({ success: true, message: 'Staff member marked as inactive (has assigned tasks)' });
    }

    await query('DELETE FROM staff WHERE id = ?', [req.params.id]);
    
    res.json({ success: true, message: 'Staff member deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;