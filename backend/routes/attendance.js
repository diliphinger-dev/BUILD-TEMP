const express = require('express');
const { query } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validationResult, body, param, query: queryValidator } = require('express-validator');
const calendarService = require('../services/calendarService');

const router = express.Router();

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

router.post('/mark-on-login', requireAuth, async (req, res) => {
  try {
    const staffId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const existing = await query(
      'SELECT id FROM attendance WHERE staff_id = ? AND attendance_date = ?',
      [staffId, today]
    );

    if (existing.length > 0) {
      return res.json({
        success: true,
        message: 'Attendance already marked for today',
        already_marked: true
      });
    }

    const now = new Date();
    const checkInTime = now.toTimeString().split(' ')[0];
    
    const lateThreshold = new Date(now);
    lateThreshold.setHours(9, 15, 0, 0);
    const status = now > lateThreshold ? 'late' : 'present';

    await query(`
      INSERT INTO attendance (staff_id, attendance_date, check_in_time, status)
      VALUES (?, ?, ?, ?)
    `, [staffId, today, checkInTime, status]);

    res.json({
      success: true,
      message: 'Attendance marked successfully',
      check_in_time: checkInTime,
      status: status
    });

  } catch (error) {
    console.error('Error marking attendance on login:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/today', requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const summary = await query(`
      SELECT 
        COUNT(DISTINCT s.id) as total_staff,
        COUNT(DISTINCT CASE WHEN a.status = 'present' THEN a.staff_id END) as present,
        COUNT(DISTINCT CASE WHEN a.status = 'late' THEN a.staff_id END) as late,
        COUNT(DISTINCT CASE WHEN a.status = 'half_day' THEN a.staff_id END) as half_day,
        COUNT(DISTINCT CASE WHEN a.status = 'leave' THEN a.staff_id END) as on_leave,
        COUNT(DISTINCT CASE WHEN a.status = 'absent' THEN a.staff_id END) as absent,
        COUNT(DISTINCT CASE WHEN a.id IS NULL THEN s.id END) as not_marked
      FROM staff s
      LEFT JOIN attendance a ON s.id = a.staff_id AND a.attendance_date = ?
      WHERE s.status = 'active'
    `, [today]);

    const attendance = await query(`
      SELECT 
        s.id as staff_id, s.name as staff_name, s.role, s.department,
        a.check_in_time, a.check_out_time, a.total_hours, a.status, a.notes
      FROM staff s
      LEFT JOIN attendance a ON s.id = a.staff_id AND a.attendance_date = ?
      WHERE s.status = 'active'
      ORDER BY s.name
    `, [today]);

    res.json({
      success: true,
      today_date: today,
      summary: summary[0],
      attendance: attendance
    });
  } catch (error) {
    console.error('Error fetching today attendance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const { 
      start_date, 
      end_date, 
      staff_id, 
      status,
      month,
      year,
      page = 1, 
      limit = 50,
      sort_by = 'attendance_date',
      sort_order = 'DESC'
    } = req.query;

    let sql = `
      SELECT 
        a.id, a.staff_id, a.attendance_date, a.check_in_time, a.check_out_time,
        a.total_hours, a.status, a.location, a.notes, a.approved_by,
        a.created_at, a.updated_at,
        s.name as staff_name, s.role as staff_role, s.department, s.employee_id,
        ap.name as approved_by_name
      FROM attendance a
      LEFT JOIN staff s ON a.staff_id = s.id
      LEFT JOIN staff ap ON a.approved_by = ap.id
      WHERE 1=1
    `;

    const params = [];

    if (start_date) {
      sql += ' AND a.attendance_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      sql += ' AND a.attendance_date <= ?';
      params.push(end_date);
    }

    if (month && year) {
      sql += ' AND MONTH(a.attendance_date) = ? AND YEAR(a.attendance_date) = ?';
      params.push(parseInt(month), parseInt(year));
    }

    if (staff_id && staff_id !== 'all') {
      sql += ' AND a.staff_id = ?';
      params.push(parseInt(staff_id));
    }

    if (status && status !== 'all') {
      sql += ' AND a.status = ?';
      params.push(status);
    }

    const allowedSortColumns = {
      'attendance_date': 'a.attendance_date',
      'staff_name': 's.name',
      'check_in_time': 'a.check_in_time',
      'total_hours': 'a.total_hours',
      'status': 'a.status'
    };

    const sortColumn = allowedSortColumns[sort_by] || 'a.attendance_date';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    sql += ` ORDER BY ${sortColumn} ${sortDirection}`;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    
    sql += ` LIMIT ${limitNum} OFFSET ${offset}`;

    const attendance = await query(sql, params);

    let countSql = `SELECT COUNT(*) as total FROM attendance a WHERE 1=1`;
    const countParams = [];

    if (start_date) {
      countSql += ' AND a.attendance_date >= ?';
      countParams.push(start_date);
    }
    if (end_date) {
      countSql += ' AND a.attendance_date <= ?';
      countParams.push(end_date);
    }
    if (month && year) {
      countSql += ' AND MONTH(a.attendance_date) = ? AND YEAR(a.attendance_date) = ?';
      countParams.push(parseInt(month), parseInt(year));
    }
    if (staff_id && staff_id !== 'all') {
      countSql += ' AND a.staff_id = ?';
      countParams.push(parseInt(staff_id));
    }
    if (status && status !== 'all') {
      countSql += ' AND a.status = ?';
      countParams.push(status);
    }

    const countResult = await query(countSql, countParams);
    const total = countResult[0].total;

    res.json({ 
      success: true, 
      attendance,
      pagination: {
        current_page: pageNum,
        per_page: limitNum,
        total: total,
        total_pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const { start_date, end_date, staff_id, month, year } = req.query;
    
    let dateCondition = '';
    const params = [];
    
    if (start_date && end_date) {
      dateCondition = 'AND a.attendance_date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    } else if (start_date) {
      dateCondition = 'AND a.attendance_date >= ?';
      params.push(start_date);
    } else if (end_date) {
      dateCondition = 'AND a.attendance_date <= ?';
      params.push(end_date);
    } else if (month && year) {
      dateCondition = 'AND MONTH(a.attendance_date) = ? AND YEAR(a.attendance_date) = ?';
      params.push(parseInt(month), parseInt(year));
    } else {
      dateCondition = 'AND MONTH(a.attendance_date) = MONTH(CURDATE()) AND YEAR(a.attendance_date) = YEAR(CURDATE())';
    }

    let overallStatsSql = `
      SELECT 
        COUNT(a.id) as total_records,
        COUNT(DISTINCT a.staff_id) as total_staff,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_days,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_days,
        COUNT(CASE WHEN a.status = 'half_day' THEN 1 END) as half_day_count,
        COUNT(CASE WHEN a.status = 'leave' THEN 1 END) as leave_count,
        AVG(a.total_hours) as avg_hours_per_day,
        SUM(a.total_hours) as total_hours,
        COALESCE(ROUND(
  (COUNT(CASE WHEN a.status IN ('present', 'late', 'half_day') THEN 1 END) * 100.0 / 
   NULLIF(COUNT(CASE WHEN a.status != 'leave' THEN 1 END), 0)), 2
), 0) as attendance_percentage
      FROM attendance a
      WHERE 1=1 ${dateCondition}
    `;

    if (staff_id && staff_id !== 'all') {
      overallStatsSql += ' AND a.staff_id = ?';
      params.push(parseInt(staff_id));
    }

    const overallStats = await query(overallStatsSql, params);

    let staffSummaryParams = [...params];
    let staffSummarySql = `
      SELECT 
        s.id, s.name, s.role, s.employee_id,
        COUNT(a.id) as total_days,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_days,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_days,
        COUNT(CASE WHEN a.status = 'half_day' THEN 1 END) as half_days,
        COUNT(CASE WHEN a.status = 'leave' THEN 1 END) as leave_days,
        COALESCE(SUM(a.total_hours), 0) as total_hours,
        COALESCE(AVG(a.total_hours), 0) as avg_hours,
        COALESCE(ROUND(
  (COUNT(CASE WHEN a.status IN ('present', 'late', 'half_day') THEN 1 END) * 100.0 / 
   NULLIF(COUNT(CASE WHEN a.status != 'leave' THEN 1 END), 0)), 2
), 0) as attendance_percentage
      FROM staff s
      LEFT JOIN attendance a ON s.id = a.staff_id ${dateCondition.replace('AND ', 'AND ')}
      WHERE s.status = 'active'
    `;

    if (staff_id && staff_id !== 'all') {
      staffSummarySql += ' AND s.id = ?';
      staffSummaryParams.push(parseInt(staff_id));
    }

    staffSummarySql += ' GROUP BY s.id, s.name, s.role, s.employee_id ORDER BY s.name';

    const staffSummary = await query(staffSummarySql, staffSummaryParams);

    const dailyPatternSql = `
      SELECT 
        a.attendance_date,
        COUNT(a.id) as total_staff,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
        COUNT(CASE WHEN a.status = 'late' THEN 1 END) as late_count,
        COUNT(CASE WHEN a.status = 'half_day' THEN 1 END) as half_day_count,
        COALESCE(AVG(a.total_hours), 0) as avg_hours
      FROM attendance a
      WHERE 1=1 ${dateCondition}
      ${staff_id && staff_id !== 'all' ? 'AND a.staff_id = ?' : ''}
      GROUP BY a.attendance_date
      ORDER BY a.attendance_date DESC
      LIMIT 30
    `;

    const dailyPatternParams = staff_id && staff_id !== 'all' ? [...params, parseInt(staff_id)] : params;
    const dailyPattern = await query(dailyPatternSql, dailyPatternParams);

    const lateArrivalSql = `
      SELECT 
        s.name as staff_name,
        s.employee_id,
        COUNT(a.id) as late_count,
        AVG(
          CASE 
            WHEN a.check_in_time > '09:15:00' THEN 
              TIME_TO_SEC(TIMEDIFF(a.check_in_time, '09:15:00'))
            ELSE 0 
          END
        ) as avg_late_minutes
      FROM attendance a
      LEFT JOIN staff s ON a.staff_id = s.id
      WHERE a.status = 'late' 
        ${dateCondition}
      ${staff_id && staff_id !== 'all' ? 'AND a.staff_id = ?' : ''}
      GROUP BY s.id, s.name, s.employee_id
      HAVING late_count > 0
      ORDER BY late_count DESC
      LIMIT 10
    `;

    const lateArrivalParams = staff_id && staff_id !== 'all' ? [...params, parseInt(staff_id)] : params;
    const lateArrival = await query(lateArrivalSql, lateArrivalParams);

    lateArrival.forEach(record => {
      record.avg_late_minutes = Math.round(record.avg_late_minutes / 60);
    });

    res.json({
      success: true,
      stats: {
        overall: overallStats[0],
        staff_summary: staffSummary,
        daily_pattern: dailyPattern,
        late_arrivals: lateArrival
      }
    });
  } catch (error) {
    console.error('Error fetching attendance stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/staff/:staff_id/summary', requireAuth, async (req, res) => {
  try {
    const { month, year } = req.query;
    const staffId = req.params.staff_id;

    let dateFilter = '';
    const params = [staffId];

    if (month && year) {
      dateFilter = 'AND MONTH(attendance_date) = ? AND YEAR(attendance_date) = ?';
      params.push(parseInt(month), parseInt(year));
    }

    const summary = await query(`
      SELECT 
        COUNT(*) as total_days,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late_days,
        SUM(CASE WHEN status = 'half_day' THEN 1 ELSE 0 END) as half_days,
        SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave_days,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
        SUM(total_hours) as total_hours
      FROM attendance
      WHERE staff_id = ? ${dateFilter}
    `, params);

    res.json({
      success: true,
      summary: summary[0]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/mark', requireAuth, [
  body('staff_id').isNumeric().withMessage('Staff ID is required and must be numeric'),
  body('attendance_date').optional().isDate().withMessage('Invalid attendance date'),
  body('check_in_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).withMessage('Invalid check-in time format (HH:MM or HH:MM:SS)'),
  body('check_out_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/).withMessage('Invalid check-out time format (HH:MM or HH:MM:SS)'),
  body('status').optional().isIn(['present', 'absent', 'late', 'half_day', 'leave']).withMessage('Invalid status'),
  body('location').optional().isLength({ max: 100 }).withMessage('Location must be less than 100 characters'),
  body('notes').optional().isLength({ max: 500 }).withMessage('Notes must be less than 500 characters')
], handleValidationErrors, async (req, res) => {
  try {
    const {
      staff_id,
      attendance_date = new Date().toISOString().split('T')[0],
      check_in_time,
      check_out_time,
      status,
      location,
      notes
    } = req.body;

    const staffCheck = await query('SELECT id, name, status FROM staff WHERE id = ?', [staff_id]);
    if (staffCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    if (staffCheck[0].status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot mark attendance for inactive staff member'
      });
    }

    const existingAttendance = await query(
      'SELECT * FROM attendance WHERE staff_id = ? AND attendance_date = ?',
      [staff_id, attendance_date]
    );

    let totalHours = 0;
    let attendanceStatus = status;

    if (check_in_time && check_out_time) {
      const checkIn = new Date(`${attendance_date} ${check_in_time}`);
      const checkOut = new Date(`${attendance_date} ${check_out_time}`);
      
      if (checkOut <= checkIn) {
        return res.status(400).json({
          success: false,
          message: 'Check-out time must be after check-in time'
        });
      }
      
      const diffMs = checkOut - checkIn;
      totalHours = Math.max(0, diffMs / (1000 * 60 * 60));

      if (!status) {
        const checkInHour = checkIn.getHours();
        const checkInMinute = checkIn.getMinutes();
        
        if (checkInHour > 9 || (checkInHour === 9 && checkInMinute > 15)) {
          attendanceStatus = 'late';
        } else if (totalHours < 4) {
          attendanceStatus = 'half_day';
        } else if (totalHours >= 8) {
          attendanceStatus = 'present';
        } else {
          attendanceStatus = 'present';
        }
      }
    } else if (check_in_time && !check_out_time && !status) {
      const checkIn = new Date(`${attendance_date} ${check_in_time}`);
      const checkInHour = checkIn.getHours();
      const checkInMinute = checkIn.getMinutes();
      
      if (checkInHour > 9 || (checkInHour === 9 && checkInMinute > 15)) {
        attendanceStatus = 'late';
      } else {
        attendanceStatus = 'present';
      }
    } else if (!attendanceStatus) {
      attendanceStatus = 'present';
    }

    if (existingAttendance.length > 0) {
      await query(`
        UPDATE attendance SET
          check_in_time = COALESCE(?, check_in_time),
          check_out_time = ?,
          total_hours = ?,
          status = ?,
          location = COALESCE(?, location),
          notes = COALESCE(?, notes),
          updated_at = NOW()
        WHERE staff_id = ? AND attendance_date = ?
      `, [
        check_in_time || existingAttendance[0].check_in_time,
        check_out_time,
        totalHours,
        attendanceStatus,
        location || existingAttendance[0].location,
        notes || existingAttendance[0].notes,
        staff_id,
        attendance_date
      ]);

      if (req.auditLogger) {
        await req.auditLogger('UPDATE', 'attendance', existingAttendance[0].id, existingAttendance[0], {
          check_in_time,
          check_out_time,
          total_hours: totalHours,
          status: attendanceStatus,
          location,
          notes
        });
      }

      res.json({ 
        success: true, 
        message: 'Attendance updated successfully',
        attendance_id: existingAttendance[0].id,
        status: attendanceStatus,
        action: 'updated'
      });
    } else {
      const result = await query(`
        INSERT INTO attendance (
          staff_id, attendance_date, check_in_time, check_out_time,
          total_hours, status, location, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        staff_id,
        attendance_date,
        check_in_time,
        check_out_time,
        totalHours,
        attendanceStatus,
        location,
        notes,
        req.user.id
      ]);

      if (req.auditLogger) {
        await req.auditLogger('CREATE', 'attendance', result.insertId, null, {
          staff_id,
          attendance_date,
          check_in_time,
          check_out_time,
          total_hours: totalHours,
          status: attendanceStatus,
          location,
          notes
        });
      }

      res.json({ 
        success: true, 
        message: 'Attendance marked successfully',
        attendance_id: result.insertId,
        status: attendanceStatus,
        action: 'created'
      });
    }
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/bulk-mark', requireAuth, async (req, res) => {
  try {
    const { staff_attendance, attendance_date } = req.body;

    if (!staff_attendance || !Array.isArray(staff_attendance) || staff_attendance.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Staff attendance data is required'
      });
    }

    let marked = 0;
    let updated = 0;
    const errors = [];

    for (const record of staff_attendance) {
      try {
        const { staff_id, status, check_in_time, check_out_time, notes } = record;

        if (!staff_id) continue;

        const existing = await query(
          'SELECT id FROM attendance WHERE staff_id = ? AND attendance_date = ?',
          [staff_id, attendance_date]
        );

        let totalHours = 0;
        if (check_in_time && check_out_time) {
          const checkIn = new Date(`2000-01-01 ${check_in_time}`);
          const checkOut = new Date(`2000-01-01 ${check_out_time}`);
          totalHours = (checkOut - checkIn) / (1000 * 60 * 60);
        }

        if (existing.length > 0) {
          await query(`
            UPDATE attendance SET
              check_in_time = ?,
              check_out_time = ?,
              total_hours = ?,
              status = ?,
              notes = ?,
              updated_at = NOW()
            WHERE staff_id = ? AND attendance_date = ?
          `, [check_in_time, check_out_time, totalHours, status, notes, staff_id, attendance_date]);
          updated++;
        } else {
          await query(`
            INSERT INTO attendance (staff_id, attendance_date, check_in_time, check_out_time, total_hours, status, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [staff_id, attendance_date, check_in_time, check_out_time, totalHours, status, notes]);
          marked++;
        }
      } catch (err) {
        errors.push({ staff_id: record.staff_id, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Attendance processed: ${marked} marked, ${updated} updated`,
      marked,
      updated,
      errors
    });

  } catch (error) {
    console.error('Error in bulk attendance marking:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/sync-holidays', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await calendarService.autoMarkHolidayAttendance();
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.message || 'Failed to sync holidays',
        error: result.error
      });
    }

    if (req.auditLogger) {
      await req.auditLogger('SYNC_HOLIDAYS', 'attendance', null, null, {
        marked_count: result.marked_count,
        date: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Holidays synced successfully',
      marked_count: result.marked_count,
      details: result.details
    });

  } catch (error) {
    console.error('Error syncing holidays:', error);
    res.status(500).json({
      success: false,
      message: 'Error syncing holidays',
      error: error.message
    });
  }
});

router.get('/check-holiday/:date', requireAuth, async (req, res) => {
  try {
    const result = await calendarService.detectHolidays(req.params.date);
    res.json({
      success: true,
      date: req.params.date,
      is_holiday: result.isHoliday,
      reason: result.reason,
      source: result.source
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/calendar/:staff_id/:year/:month', requireAuth, [
  param('staff_id').isNumeric().withMessage('Invalid staff ID'),
  param('year').isInt({ min: 2020, max: 2030 }).withMessage('Invalid year'),
  param('month').isInt({ min: 1, max: 12 }).withMessage('Invalid month')
], handleValidationErrors, async (req, res) => {
  try {
    const { staff_id, year, month } = req.params;

    const staffInfo = await query(`
      SELECT id, name, role, employee_id, email
      FROM staff 
      WHERE id = ? AND status = 'active'
    `, [staff_id]);
    
    if (staffInfo.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found or inactive'
      });
    }

    const attendance = await query(`
      SELECT 
        id, attendance_date, check_in_time, check_out_time, total_hours,
        status, location, notes, approved_by, created_at, updated_at
      FROM attendance
      WHERE staff_id = ? 
        AND YEAR(attendance_date) = ? 
        AND MONTH(attendance_date) = ?
      ORDER BY attendance_date
    `, [staff_id, year, month]);

    const leaves = await query(`
      SELECT 
        id, start_date, end_date, leave_type, status as leave_status,
        reason, approved_by, created_at
      FROM leaves
      WHERE staff_id = ?
        AND ((YEAR(start_date) = ? AND MONTH(start_date) = ?) 
             OR (YEAR(end_date) = ? AND MONTH(end_date) = ?)
             OR (start_date <= ? AND end_date >= ?))
      ORDER BY start_date
    `, [
      staff_id, year, month, year, month,
      `${year}-${String(month).padStart(2, '0')}-01`,
      new Date(year, month, 0).toISOString().split('T')[0]
    ]);

    res.json({
      success: true,
      staff: staffInfo[0],
      year: parseInt(year),
      month: parseInt(month),
      attendance: attendance,
      leaves: leaves
    });
  } catch (error) {
    console.error('Error fetching attendance calendar:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', requireAdmin, [
  param('id').isNumeric().withMessage('Invalid attendance ID'),
  body('check_in_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid check-in time format'),
  body('check_out_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid check-out time format'),
  body('status').optional().isIn(['present', 'absent', 'late', 'half_day', 'leave']).withMessage('Invalid status'),
  body('total_hours').optional().isFloat({ min: 0, max: 24 }).withMessage('Total hours must be between 0 and 24'),
  body('location').optional().isLength({ max: 100 }).withMessage('Location must be less than 100 characters'),
  body('notes').optional().isLength({ max: 500 }).withMessage('Notes must be less than 500 characters')
], handleValidationErrors, async (req, res) => {
  try {
    const attendanceId = req.params.id;
    const { check_in_time, check_out_time, status, total_hours, location, notes, approved_by } = req.body;

    const currentRecord = await query('SELECT * FROM attendance WHERE id = ?', [attendanceId]);
    
    if (currentRecord.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    if (check_in_time && check_out_time) {
      const checkIn = new Date(`2000-01-01 ${check_in_time}`);
      const checkOut = new Date(`2000-01-01 ${check_out_time}`);
      
      if (checkOut <= checkIn) {
        return res.status(400).json({
          success: false,
          message: 'Check-out time must be after check-in time'
        });
      }
    }

    const updates = [];
    const params = [];

    if (check_in_time !== undefined) {
      updates.push('check_in_time = ?');
      params.push(check_in_time);
    }
    if (check_out_time !== undefined) {
      updates.push('check_out_time = ?');
      params.push(check_out_time);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (total_hours !== undefined) {
      updates.push('total_hours = ?');
      params.push(total_hours);
    }
    if (location !== undefined) {
      updates.push('location = ?');
      params.push(location);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    if (approved_by !== undefined) {
      updates.push('approved_by = ?');
      params.push(approved_by);
    }

    updates.push('updated_at = NOW()');
    params.push(attendanceId);

    const sql = `UPDATE attendance SET ${updates.join(', ')} WHERE id = ?`;
    await query(sql, params);

    if (req.auditLogger) {
      await req.auditLogger('UPDATE', 'attendance', attendanceId, currentRecord[0], {
        check_in_time, check_out_time, status, total_hours, location, notes,
        approved_by, updated_by: req.user.id
      });
    }

    res.json({ 
      success: true, 
      message: 'Attendance record updated successfully'
    });
  } catch (error) {
    console.error('Error updating attendance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', requireAdmin, [
  param('id').isNumeric().withMessage('Invalid attendance ID')
], handleValidationErrors, async (req, res) => {
  try {
    const attendanceId = req.params.id;

    const record = await query('SELECT * FROM attendance WHERE id = ?', [attendanceId]);
    
    if (record.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found'
      });
    }

    await query('DELETE FROM attendance WHERE id = ?', [attendanceId]);

    if (req.auditLogger) {
      await req.auditLogger('DELETE', 'attendance', attendanceId, record[0], null);
    }

    res.json({ 
      success: true, 
      message: 'Attendance record deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting attendance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/bulk-import', requireAdmin, async (req, res) => {
  try {
    const { attendance_data } = req.body;

    if (!Array.isArray(attendance_data) || attendance_data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Attendance data array is required'
      });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const record of attendance_data) {
      try {
        const { staff_id, attendance_date, check_in_time, check_out_time, status, location, notes } = record;

        if (!staff_id || !attendance_date) {
          results.failed++;
          results.errors.push({ record, error: 'Staff ID and attendance date are required' });
          continue;
        }

        const existing = await query(
          'SELECT id FROM attendance WHERE staff_id = ? AND attendance_date = ?',
          [staff_id, attendance_date]
        );

        if (existing.length > 0) {
          results.failed++;
          results.errors.push({ record, error: 'Attendance record already exists for this date' });
          continue;
        }

        let totalHours = 0;
        if (check_in_time && check_out_time) {
          const checkIn = new Date(`${attendance_date} ${check_in_time}`);
          const checkOut = new Date(`${attendance_date} ${check_out_time}`);
          const diffMs = checkOut - checkIn;
          totalHours = Math.max(0, diffMs / (1000 * 60 * 60));
        }

        await query(`
          INSERT INTO attendance (
            staff_id, attendance_date, check_in_time, check_out_time,
            total_hours, status, location, notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          staff_id, attendance_date, check_in_time, check_out_time,
          totalHours, status || 'present', location, notes, req.user.id
        ]);

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({ record, error: error.message });
      }
    }

    if (req.auditLogger) {
      await req.auditLogger('BULK_IMPORT', 'attendance', null, null, {
        total_records: attendance_data.length,
        successful: results.success,
        failed: results.failed,
        imported_by: req.user.id
      });
    }

    res.json({
      success: true,
      message: `Bulk import completed: ${results.success} successful, ${results.failed} failed`,
      results
    });
  } catch (error) {
    console.error('Error in bulk attendance import:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;