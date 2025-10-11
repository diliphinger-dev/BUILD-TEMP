const { google } = require('googleapis');
const { query } = require('../config/database');
require('dotenv').config();

// Initialize Google Calendar API
let calendar = null;
let isConfigured = false;

// ============================================================================
// Initialize calendar service
// ============================================================================
const initializeCalendar = () => {
  try {
    if (!process.env.GOOGLE_CALENDAR_API_KEY) {
      console.log('ℹ️  Google Calendar API key not configured - using offline mode (Sundays only)');
      return false;
    }

    // Method 1: API Key authentication (for public calendars)
    if (process.env.GOOGLE_CALENDAR_API_KEY) {
      calendar = google.calendar({
        version: 'v3',
        auth: process.env.GOOGLE_CALENDAR_API_KEY
      });
    }

    // Method 2: Service Account authentication (for private calendars)
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = require(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        const auth = new google.auth.GoogleAuth({
          credentials: serviceAccount,
          scopes: ['https://www.googleapis.com/auth/calendar.readonly']
        });
        
        calendar = google.calendar({ version: 'v3', auth });
        console.log('✅ Google Calendar service initialized with Service Account');
      } catch (serviceError) {
        console.log('Service account key not found, using API key method');
      }
    }

    isConfigured = true;
    console.log('✅ Google Calendar service initialized');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Google Calendar:', error.message);
    isConfigured = false;
    return false;
  }
};

// ============================================================================
// Check if date is a holiday or Sunday
// ENHANCED: Better error handling and API error recovery
// ============================================================================
const detectHolidays = async (date) => {
  try {
    // Check if Sunday
    const dateObj = new Date(date);
    if (dateObj.getDay() === 0) {
      console.log(`${date} is Sunday - marking as holiday`);
      return { isHoliday: true, reason: 'Sunday', source: 'system' };
    }

    // If Google Calendar not configured, only check for Sundays
    if (!isConfigured || !calendar) {
      return { isHoliday: false, reason: 'Calendar not configured', source: 'system' };
    }

    // Check Google Calendar for holidays
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'en.indian#holiday@group.v.calendar.google.com';
    
    try {
      const response = await calendar.events.list({
        calendarId: calendarId,
        timeMin: `${date}T00:00:00Z`,
        timeMax: `${date}T23:59:59Z`,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      
      if (events.length > 0) {
        const holidayNames = events.map(event => event.summary).join(', ');
        console.log(`${date} has holidays: ${holidayNames}`);
        return { 
          isHoliday: true, 
          reason: holidayNames, 
          source: 'google_calendar',
          events: events 
        };
      }

      return { isHoliday: false, reason: 'No holidays found', source: 'google_calendar' };
      
    } catch (apiError) {
      // Enhanced error handling - log API errors but don't fail completely
      console.error('Google Calendar API error:', apiError.message);
      return { isHoliday: false, reason: 'API error', source: 'error', error: apiError.message };
    }

  } catch (error) {
    console.error('Error detecting holidays:', error.message);
    
    // Fallback: Check if Sunday
    const dateObj = new Date(date);
    if (dateObj.getDay() === 0) {
      return { isHoliday: true, reason: 'Sunday (fallback)', source: 'system' };
    }
    
    return { isHoliday: false, reason: 'Error', source: 'error', error: error.message };
  }
};

// ============================================================================
// Auto-mark attendance for holidays/Sundays
// MERGED: Combines both marking strategies with configurable behavior
// ============================================================================
const autoMarkHolidayAttendance = async (date = null) => {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    console.log(`Checking holidays for ${targetDate}...`);
    
    // Check if it's a holiday or Sunday
    const holidayCheck = await detectHolidays(targetDate);
    
    if (!holidayCheck.isHoliday) {
      console.log(`${targetDate} is not a holiday`);
      return {
        success: true,
        message: `${targetDate} is not a holiday`,
        date: targetDate,
        marked_count: 0,
        reason: holidayCheck.reason
      };
    }

    console.log(`${targetDate} is a holiday: ${holidayCheck.reason}`);

    // Get all active staff
    const activeStaff = await query(
      'SELECT id, name, email FROM staff WHERE status = "active"'
    );

    if (activeStaff.length === 0) {
      return {
        success: true,
        message: 'No active staff found',
        date: targetDate,
        marked_count: 0
      };
    }

    let markedCount = 0;
    const details = [];
    const errors = [];

    // Determine marking strategy from environment or default to 'leave'
    const markingStrategy = process.env.HOLIDAY_MARKING_STRATEGY || 'leave';
    
    for (const staff of activeStaff) {
      try {
        // Check if attendance already exists
        const existing = await query(
          'SELECT id FROM attendance WHERE staff_id = ? AND attendance_date = ?',
          [staff.id, targetDate]
        );

        if (existing.length > 0) {
          console.log(`Attendance already exists for ${staff.name} on ${targetDate}`);
          details.push({
            staff_id: staff.id,
            staff_name: staff.name,
            status: 'already_marked'
          });
          continue;
        }

        // Two strategies: 'leave' or 'present'
        if (markingStrategy === 'leave') {
          // Strategy 1: Mark as leave (original behavior from calendar_service_fixed.js)
          await query(`
            INSERT INTO attendance (staff_id, attendance_date, status, notes)
            VALUES (?, ?, 'leave', ?)
          `, [staff.id, targetDate, `Holiday: ${holidayCheck.reason}`]);
          
          markedCount++;
          details.push({
            staff_id: staff.id,
            staff_name: staff.name,
            status: 'marked',
            marked_as: 'leave'
          });
          
        } else {
          // Strategy 2: Mark as present with full hours (original behavior from calendarService.js)
          const attendanceStatus = process.env.HOLIDAY_DEFAULT_STATUS || 'present';
          const checkInTime = process.env.OFFICE_START_TIME || '09:00:00';
          const checkOutTime = process.env.OFFICE_END_TIME || '18:00:00';
          
          // Calculate total hours
          const checkIn = new Date(`${targetDate} ${checkInTime}`);
          const checkOut = new Date(`${targetDate} ${checkOutTime}`);
          const totalHours = (checkOut - checkIn) / (1000 * 60 * 60);

          await query(`
            INSERT INTO attendance (
              staff_id, attendance_date, check_in_time, check_out_time,
              total_hours, status, location, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            staff.id, targetDate, checkInTime, checkOutTime,
            totalHours, attendanceStatus, 'Auto-marked', 
            `Holiday auto-attendance: ${holidayCheck.reason}`
          ]);

          markedCount++;
          details.push({
            staff_id: staff.id,
            staff_name: staff.name,
            status: 'marked',
            marked_as: attendanceStatus
          });
        }

        // Log audit event (optional - only if audit_logs table exists)
        try {
          await query(`
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
            VALUES (?, ?, ?, ?, ?)
          `, [
            null, 'AUTO_HOLIDAY_ATTENDANCE', 'attendance', staff.id,
            JSON.stringify({
              date: targetDate,
              reason: holidayCheck.reason,
              strategy: markingStrategy
            })
          ]);
        } catch (auditError) {
          // Ignore audit log errors - table might not exist
          console.log('Audit log skipped (table may not exist)');
        }

        console.log(`✅ Auto-marked attendance for ${staff.name}`);

      } catch (staffError) {
        console.error(`❌ Error marking attendance for ${staff.name}:`, staffError.message);
        errors.push(`${staff.name}: ${staffError.message}`);
        details.push({
          staff_id: staff.id,
          staff_name: staff.name,
          status: 'error',
          error: staffError.message
        });
      }
    }

    console.log(`Holiday attendance marking completed: ${markedCount} staff marked`);

    return {
      success: true,
      message: `Marked ${markedCount} staff members for holiday: ${holidayCheck.reason}`,
      date: targetDate,
      holiday_reason: holidayCheck.reason,
      marked_count: markedCount,
      marked: markedCount, // Alias for compatibility
      total_staff: activeStaff.length,
      details: details,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    console.error('Error in autoMarkHolidayAttendance:', error);
    return {
      success: false,
      message: 'Error marking holiday attendance',
      error: error.message,
      date: date,
      marked_count: 0
    };
  }
};

// ============================================================================
// Manual sync for specific date
// ============================================================================
const syncHolidayAttendance = async (date) => {
  try {
    console.log(`🔄 Syncing holiday attendance for ${date}`);
    const result = await autoMarkHolidayAttendance(date);
    return result;
  } catch (error) {
    console.error('Error syncing holiday attendance:', error);
    return {
      success: false,
      message: error.message,
      date: date,
      marked_count: 0
    };
  }
};

// ============================================================================
// Get holidays for date range
// ============================================================================
const getHolidays = async (startDate, endDate) => {
  try {
    if (!isConfigured || !calendar) {
      // Return Sundays in the range
      const holidays = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 0) { // Sunday
          holidays.push({
            date: d.toISOString().split('T')[0],
            name: 'Sunday',
            source: 'system'
          });
        }
      }
      
      return holidays;
    }

    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'en.indian#holiday@group.v.calendar.google.com';
    
    const response = await calendar.events.list({
      calendarId: calendarId,
      timeMin: `${startDate}T00:00:00Z`,
      timeMax: `${endDate}T23:59:59Z`,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const holidays = (response.data.items || []).map(event => ({
      date: event.start.date || event.start.dateTime.split('T')[0],
      name: event.summary,
      description: event.description,
      source: 'google_calendar'
    }));

    // Add Sundays
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0) { // Sunday
        const dateStr = d.toISOString().split('T')[0];
        if (!holidays.some(h => h.date === dateStr)) {
          holidays.push({
            date: dateStr,
            name: 'Sunday',
            source: 'system'
          });
        }
      }
    }

    return holidays.sort((a, b) => new Date(a.date) - new Date(b.date));

  } catch (error) {
    console.error('Error fetching holidays:', error);
    return [];
  }
};

// ============================================================================
// Check if calendar is connected
// ============================================================================
const isCalendarConnected = async () => {
  return isConfigured && calendar !== null;
};

// ============================================================================
// Test calendar connection
// ============================================================================
const testCalendarConnection = async () => {
  try {
    if (!calendar) {
      return { connected: false, error: 'Calendar not initialized' };
    }

    // Test by fetching today's events
    const today = new Date().toISOString().split('T')[0];
    const result = await detectHolidays(today);
    
    return {
      connected: true,
      test_date: today,
      result: result
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message
    };
  }
};

// ============================================================================
// Initialize calendar on module load
// ============================================================================
initializeCalendar();

// ============================================================================
// Export functions
// ============================================================================
module.exports = {
  initializeCalendar,
  detectHolidays,
  autoMarkHolidayAttendance,
  syncHolidayAttendance,
  getHolidays,
  isCalendarConnected,
  testCalendarConnection
};