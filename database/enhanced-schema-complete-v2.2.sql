-- ENHANCED CA OFFICE AUTOMATION SYSTEM DATABASE
-- Version 2.3 - Complete with ALL Features
-- Includes: Comments System, Audit Logging, Attendance Module, Task History, Password Management, Holidays, Licenses

DROP DATABASE IF EXISTS enhanced_ca_office;
CREATE DATABASE enhanced_ca_office;
USE enhanced_ca_office;

-- Staff table (enhanced with Phase 2 fields)
CREATE TABLE staff (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'senior_ca', 'junior_ca', 'assistant', 'intern') DEFAULT 'assistant',
  status ENUM('active', 'inactive') DEFAULT 'active',
  phone VARCHAR(20),
  address TEXT,
  joining_date DATE,
  salary DECIMAL(10,2),
  employee_id VARCHAR(50),
  department VARCHAR(100) DEFAULT 'operations',
  designation VARCHAR(100),
  date_of_birth DATE,
  gender ENUM('male', 'female', 'other'),
  blood_group VARCHAR(10),
  marital_status ENUM('single', 'married', 'divorced', 'widowed') DEFAULT 'single',
  current_address TEXT,
  permanent_address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(20),
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  emergency_contact_relation VARCHAR(100),
  bank_name VARCHAR(255),
  account_number VARCHAR(50),
  ifsc_code VARCHAR(20),
  pan_number VARCHAR(20),
  aadhar_number VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_status (status)
);

-- Clients table
CREATE TABLE clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  company VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  pan_number VARCHAR(20),
  gstin VARCHAR(20),
  client_type ENUM('individual', 'company', 'partnership', 'llp', 'trust') DEFAULT 'individual',
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL,
  INDEX idx_name (name),
  INDEX idx_email (email),
  INDEX idx_status (status)
);

-- Enhanced Tasks table with Phase 1 new task types
CREATE TABLE tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  client_id INT NOT NULL,
  assigned_to INT,
  priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
  status ENUM('pending', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
  task_type ENUM('itr', 'gst', 'audit', 'consultation', 'compliance', 'housing_loan', 'project_loan', 'accounting', 'certification', 'other') DEFAULT 'other',
  due_date DATE,
  completion_date TIMESTAMP NULL,
  estimated_hours DECIMAL(5,2) DEFAULT 0.00,
  actual_hours DECIMAL(5,2) DEFAULT 0.00,
  amount DECIMAL(10,2) DEFAULT 0.00,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES staff(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL,
  INDEX idx_client_id (client_id),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_status (status),
  INDEX idx_task_type (task_type),
  INDEX idx_due_date (due_date)
);

-- ============================================================================
-- Task History table for tracking all changes
-- ============================================================================
CREATE TABLE task_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  action_type ENUM('created', 'assigned', 'reassigned', 'rescheduled', 'status_changed', 'updated') NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by INT,
  change_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES staff(id) ON DELETE SET NULL,
  INDEX idx_task_id (task_id),
  INDEX idx_action_type (action_type),
  INDEX idx_created_at (created_at)
);

-- Task Comments System
CREATE TABLE task_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  comment_text TEXT NOT NULL,
  created_by INT NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE CASCADE,
  INDEX idx_task_id (task_id),
  INDEX idx_created_by (created_by),
  INDEX idx_is_completed (is_completed)
);

-- Enhanced Invoices table (with edit capability)
CREATE TABLE invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  client_id INT NOT NULL,
  task_id INT,
  amount DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0.00,
  total_amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending', 'partially_paid', 'paid') DEFAULT 'pending',
  invoice_date DATE DEFAULT (CURDATE()),
  due_date DATE,
  paid_date DATE NULL,
  payment_terms VARCHAR(50) DEFAULT 'net_30',
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL,
  INDEX idx_invoice_number (invoice_number),
  INDEX idx_client_id (client_id),
  INDEX idx_status (status),
  INDEX idx_invoice_date (invoice_date)
);

-- Receipts table for payment tracking
CREATE TABLE receipts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  invoice_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method ENUM('cash', 'cheque', 'bank_transfer', 'upi', 'card', 'other') DEFAULT 'cash',
  payment_reference VARCHAR(100),
  receipt_date DATE DEFAULT (CURDATE()),
  discount_amount DECIMAL(10,2) DEFAULT 0.00,
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES staff(id) ON DELETE SET NULL,
  INDEX idx_receipt_number (receipt_number),
  INDEX idx_invoice_id (invoice_id),
  INDEX idx_receipt_date (receipt_date),
  INDEX idx_payment_method (payment_method)
);

-- Settings table for dashboard customization
CREATE TABLE settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Trial data cleanup tracking table
CREATE TABLE trial_data_cleanup (
    id INT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id INT NOT NULL,
    is_trial_data BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_table_record (table_name, record_id),
    INDEX idx_trial_data (is_trial_data)
);

-- Audit Logging System
CREATE TABLE audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES staff(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_entity_type (entity_type),
    INDEX idx_entity_id (entity_id),
    INDEX idx_created_at (created_at)
);

-- Attendance Management System (with auto-mark on login)
CREATE TABLE attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    check_in_time TIME,
    check_out_time TIME,
    break_duration INT DEFAULT 0,
    total_hours DECIMAL(4,2) DEFAULT 0.00,
    status ENUM('present', 'absent', 'half_day', 'late', 'leave') DEFAULT 'present',
    location VARCHAR(255),
    notes TEXT,
    approved_by INT,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES staff(id) ON DELETE SET NULL,
    UNIQUE KEY unique_staff_date (staff_id, attendance_date),
    INDEX idx_staff_id (staff_id),
    INDEX idx_attendance_date (attendance_date),
    INDEX idx_status (status)
);

-- Leave Management System
CREATE TABLE leaves (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    leave_type ENUM('casual', 'sick', 'earned', 'maternity', 'paternity', 'emergency') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INT NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    applied_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by INT,
    approved_at TIMESTAMP NULL,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES staff(id) ON DELETE SET NULL,
    INDEX idx_staff_id (staff_id),
    INDEX idx_start_date (start_date),
    INDEX idx_status (status)
);

-- ============================================================================
-- HOLIDAYS TABLE - For Google Calendar sync and attendance automation
-- ============================================================================
CREATE TABLE holidays (
  id INT AUTO_INCREMENT PRIMARY KEY,
  holiday_date DATE NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  type ENUM('national', 'regional', 'company') DEFAULT 'national',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_holiday_date (holiday_date),
  INDEX idx_type (type)
);

-- ============================================================================
-- PASSWORD RESET TOKENS - For staff password change functionality
-- ============================================================================
CREATE TABLE password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_staff_id (staff_id),
  INDEX idx_expires_at (expires_at)
);

-- ============================================================================
-- LICENSES TABLE - For software license management
-- ============================================================================
CREATE TABLE licenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  license_key TEXT NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  issue_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  status ENUM('active', 'expired', 'suspended') DEFAULT 'active',
  max_users INT DEFAULT 5,
  license_type ENUM('trial', '1year', '3year', '5year', 'lifetime') DEFAULT 'trial',
  features JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_expiry_date (expiry_date)
);

-- ============================================================================
-- INSERT DEFAULT DATA
-- ============================================================================

-- Insert default admin user (password: admin123)
INSERT INTO staff (name, email, password, role, status) VALUES 
('System Administrator', 'admin@ca-office.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewLdMXUtwmqpk7jw', 'admin', 'active');

-- Insert default settings
INSERT INTO settings (setting_key, setting_value) VALUES 
('dashboard_name', 'CA Office Pro v2.3'),
('company_name', 'Your CA Office'),
('enable_attendance_on_login', 'true'),
('enable_auto_holiday_sync', 'true'),
('db_version', '2.3');

-- Sample data for demonstration
INSERT INTO clients (name, email, phone, company, client_type, created_by) VALUES
('Rajesh Sharma', 'rajesh@example.com', '+91-9876543210', 'Sharma Enterprises', 'company', 1),
('Priya Patel', 'priya@example.com', '+91-9876543211', NULL, 'individual', 1),
('ABC Corporation Ltd', 'contact@abc-corp.com', '+91-9876543212', 'ABC Corporation', 'company', 1),
('Mumbai Housing Society', 'society@mumbaihousing.com', '+91-9876543213', 'Mumbai Housing Coop Society', 'trust', 1),
('Tech Innovations Pvt Ltd', 'info@techinnovations.com', '+91-9876543214', 'Tech Innovations', 'company', 1);

INSERT INTO staff (name, email, password, role, status, phone, joining_date, salary) VALUES
('CA Amit Gupta', 'amit@ca-office.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewLdMXUtwmqpk7jw', 'senior_ca', 'active', '+91-9876543214', '2023-01-15', 75000),
('CA Neha Singh', 'neha@ca-office.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewLdMXUtwmqpk7jw', 'junior_ca', 'active', '+91-9876543215', '2023-03-20', 45000),
('Ravi Kumar', 'ravi@ca-office.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewLdMXUtwmqpk7jw', 'assistant', 'active', '+91-9876543216', '2023-06-10', 25000);

-- Sample tasks with new task types
INSERT INTO tasks (title, description, client_id, assigned_to, priority, task_type, due_date, amount, created_by) VALUES
('ITR Filing for FY 2023-24', 'Individual Income Tax Return filing', 2, 2, 'high', 'itr', DATE_ADD(CURDATE(), INTERVAL 5 DAY), 5000.00, 1),
('GST Return - March 2024', 'Monthly GST return filing', 3, 2, 'medium', 'gst', DATE_ADD(CURDATE(), INTERVAL 3 DAY), 2500.00, 1),
('Housing Loan Documentation', 'Complete documentation for housing loan application', 4, 3, 'high', 'housing_loan', DATE_ADD(CURDATE(), INTERVAL 10 DAY), 15000.00, 1),
('Project Loan Consultation', 'Financial consultation for new project loan', 5, 2, 'medium', 'project_loan', DATE_ADD(CURDATE(), INTERVAL 7 DAY), 25000.00, 1),
('Annual Audit - 2023-24', 'Complete annual audit for ABC Corporation', 3, 2, 'high', 'audit', DATE_ADD(CURDATE(), INTERVAL 15 DAY), 50000.00, 1),
('Accounting System Setup', 'Complete accounting system implementation', 1, 4, 'medium', 'accounting', DATE_ADD(CURDATE(), INTERVAL 12 DAY), 30000.00, 1),
('ISO Certification Process', 'ISO 9001 certification documentation and process', 5, 2, 'high', 'certification', DATE_ADD(CURDATE(), INTERVAL 20 DAY), 75000.00, 1);

-- Mark first task as completed
UPDATE tasks SET status = 'completed', completion_date = NOW() WHERE id = 1;

-- Sample task comments
INSERT INTO task_comments (task_id, comment_text, created_by, is_completed) VALUES
(1, 'Started working on ITR documentation collection', 2, TRUE),
(1, 'All documents received from client, proceeding with filing', 2, TRUE),
(1, 'ITR successfully filed and acknowledgment received', 2, TRUE),
(2, 'GST return data being compiled from client records', 2, FALSE),
(3, 'Initial meeting scheduled with client to discuss loan requirements', 3, TRUE),
(3, 'Document checklist prepared and shared with client', 3, FALSE);

-- Create sample invoices
INSERT INTO invoices (invoice_number, client_id, task_id, amount, tax_amount, total_amount, status, due_date, created_by) VALUES
('INV-2024-0001', 2, 1, 5000.00, 900.00, 5900.00, 'paid', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 1),
('INV-2024-0002', 3, 2, 2500.00, 450.00, 2950.00, 'partially_paid', DATE_ADD(CURDATE(), INTERVAL 15 DAY), 1),
('INV-2024-0003', 4, 3, 15000.00, 2700.00, 17700.00, 'pending', DATE_ADD(CURDATE(), INTERVAL -5 DAY), 1),
('INV-2024-0004', 5, 4, 25000.00, 4500.00, 29500.00, 'pending', DATE_ADD(CURDATE(), INTERVAL -10 DAY), 1);

-- Create sample receipts
INSERT INTO receipts (receipt_number, invoice_id, amount, payment_method, receipt_date, created_by) VALUES
('RCP-2024-0001', 1, 5900.00, 'bank_transfer', CURDATE(), 1),
('RCP-2024-0002', 2, 1500.00, 'cheque', DATE_SUB(CURDATE(), INTERVAL 2 DAY), 1),
('RCP-2024-0003', 2, 1450.00, 'upi', CURDATE(), 1);

-- Update invoice status based on payments
UPDATE invoices SET status = 'paid', paid_date = CURDATE() WHERE id = 1;
UPDATE invoices SET status = 'paid', paid_date = CURDATE() WHERE id = 2;

-- Sample attendance records
INSERT INTO attendance (staff_id, attendance_date, check_in_time, check_out_time, total_hours, status) VALUES
(2, CURDATE(), '09:00:00', '18:00:00', 8.0, 'present'),
(3, CURDATE(), '09:15:00', '18:00:00', 7.75, 'late'),
(4, CURDATE(), '09:00:00', '13:00:00', 4.0, 'half_day'),
(2, DATE_SUB(CURDATE(), INTERVAL 1 DAY), '09:00:00', '18:00:00', 8.0, 'present'),
(3, DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL, NULL, 0.0, 'absent');

-- Sample audit log entries
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values) VALUES
(1, 'CREATE', 'task', 1, '{"title": "ITR Filing for FY 2023-24", "status": "pending"}'),
(2, 'UPDATE', 'task', 1, '{"status": "completed"}'),
(1, 'CREATE', 'invoice', 1, '{"invoice_number": "INV-2024-0001", "total_amount": 5900.00}');

-- ============================================================================
-- INSERT HOLIDAY DATA (Indian National Holidays 2025)
-- ============================================================================
INSERT INTO holidays (holiday_date, name, type, description) VALUES
('2025-01-26', 'Republic Day', 'national', 'Indian Republic Day'),
('2025-03-14', 'Holi', 'national', 'Festival of Colors'),
('2025-03-31', 'Eid al-Fitr', 'national', 'End of Ramadan'),
('2025-04-10', 'Mahavir Jayanti', 'national', 'Jain Festival'),
('2025-04-14', 'Ambedkar Jayanti', 'national', 'Dr. B.R. Ambedkar Birthday'),
('2025-04-18', 'Good Friday', 'national', 'Christian Holiday'),
('2025-05-01', 'May Day', 'national', 'Labour Day'),
('2025-08-15', 'Independence Day', 'national', 'Indian Independence Day'),
('2025-08-27', 'Janmashtami', 'national', 'Lord Krishna Birthday'),
('2025-09-05', 'Ganesh Chaturthi', 'national', 'Lord Ganesha Festival'),
('2025-10-02', 'Gandhi Jayanti', 'national', 'Mahatma Gandhi Birthday'),
('2025-10-22', 'Dussehra', 'national', 'Victory of Good over Evil'),
('2025-10-23', 'Diwali', 'national', 'Festival of Lights'),
('2025-11-05', 'Guru Nanak Jayanti', 'national', 'Sikh Festival'),
('2025-12-25', 'Christmas', 'national', 'Christian Holiday');

-- ============================================================================
-- INSERT DEFAULT LICENSE (30-day trial)
-- ============================================================================
INSERT INTO licenses (license_key, company_name, email, issue_date, expiry_date, status, max_users, license_type) VALUES
('TRIAL-LICENSE-KEY', 'Trial User', 'trial@ca-office.com', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'active', 3, 'trial');

-- Mark sample data as trial data for cleanup utility
INSERT INTO trial_data_cleanup (table_name, record_id, is_trial_data)
SELECT 'clients', id, TRUE FROM clients WHERE name IN ('Rajesh Sharma', 'Priya Patel', 'ABC Corporation Ltd', 'Mumbai Housing Society', 'Tech Innovations Pvt Ltd');

INSERT INTO trial_data_cleanup (table_name, record_id, is_trial_data)
SELECT 'staff', id, TRUE FROM staff WHERE email IN ('amit@ca-office.com', 'neha@ca-office.com', 'ravi@ca-office.com');

INSERT INTO trial_data_cleanup (table_name, record_id, is_trial_data)
SELECT 'tasks', id, TRUE FROM tasks WHERE id BETWEEN 1 AND 7;

INSERT INTO trial_data_cleanup (table_name, record_id, is_trial_data)
SELECT 'invoices', id, TRUE FROM invoices WHERE invoice_number LIKE 'INV-2024-%';

INSERT INTO trial_data_cleanup (table_name, record_id, is_trial_data)
SELECT 'receipts', id, TRUE FROM receipts WHERE receipt_number LIKE 'RCP-2024-%';

-- ============================================================================
-- CREATE STORED PROCEDURES
-- ============================================================================

-- Create stored procedure for trial data cleanup
DELIMITER //
CREATE PROCEDURE CleanTrialData()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE table_name_var VARCHAR(100);
    DECLARE record_id_var INT;
    DECLARE cur CURSOR FOR 
        SELECT table_name, record_id FROM trial_data_cleanup WHERE is_trial_data = TRUE;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    SET FOREIGN_KEY_CHECKS = 0;
    
    OPEN cur;
    
    read_loop: LOOP
        FETCH cur INTO table_name_var, record_id_var;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        CASE table_name_var
            WHEN 'receipts' THEN
                DELETE FROM receipts WHERE id = record_id_var;
            WHEN 'invoices' THEN
                DELETE FROM invoices WHERE id = record_id_var;
            WHEN 'tasks' THEN
                DELETE FROM tasks WHERE id = record_id_var;
            WHEN 'clients' THEN
                DELETE FROM clients WHERE id = record_id_var;
            WHEN 'staff' THEN
                DELETE FROM staff WHERE id = record_id_var AND id != 1;
        END CASE;
    END LOOP;
    
    CLOSE cur;
    
    SET FOREIGN_KEY_CHECKS = 1;
    
    DELETE FROM trial_data_cleanup WHERE is_trial_data = TRUE;
    
    SELECT 'Trial data cleanup completed successfully' as message;
END //
DELIMITER ;

-- ============================================================================
-- CREATE VIEWS
-- ============================================================================

-- Create view for outstanding invoices
CREATE VIEW outstanding_invoices AS
SELECT 
    i.*,
    c.name as client_name,
    t.title as task_title,
    COALESCE(SUM(r.amount), 0) as received_amount,
    (i.total_amount - COALESCE(SUM(r.amount), 0)) as pending_amount,
    CASE 
        WHEN i.due_date < CURDATE() AND i.status != 'paid' THEN 
            DATEDIFF(CURDATE(), i.due_date)
        ELSE 0 
    END as days_overdue
FROM invoices i
LEFT JOIN clients c ON i.client_id = c.id
LEFT JOIN tasks t ON i.task_id = t.id
LEFT JOIN receipts r ON i.id = r.invoice_id
WHERE i.status != 'paid'
GROUP BY i.id, c.name, t.title
HAVING pending_amount > 0
ORDER BY days_overdue DESC, pending_amount DESC;

-- Create view for task comments with user details
CREATE VIEW task_comments_view AS
SELECT 
    tc.*,
    s.name as created_by_name,
    t.title as task_title
FROM task_comments tc
LEFT JOIN staff s ON tc.created_by = s.id
LEFT JOIN tasks t ON tc.task_id = t.id
ORDER BY tc.created_at DESC;

-- Create view for attendance summary
CREATE VIEW attendance_summary AS
SELECT 
    a.*,
    s.name as staff_name,
    s.role as staff_role,
    CASE 
        WHEN a.check_in_time > '09:15:00' THEN 'Late'
        WHEN a.total_hours < 4 THEN 'Half Day'
        WHEN a.total_hours >= 8 THEN 'Full Day'
        ELSE 'Partial'
    END as attendance_summary
FROM attendance a
LEFT JOIN staff s ON a.staff_id = s.id
ORDER BY a.attendance_date DESC, s.name;

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================

SELECT 'Enhanced CA Office Database v2.3 with ALL Features setup completed successfully!' as message;

-- Show comprehensive summary
SELECT 
    'SETUP SUMMARY' as info,
    (SELECT COUNT(*) FROM staff) as total_staff,
    (SELECT COUNT(*) FROM clients) as total_clients,
    (SELECT COUNT(*) FROM tasks) as total_tasks,
    (SELECT COUNT(*) FROM invoices) as total_invoices,
    (SELECT COUNT(*) FROM receipts) as total_receipts,
    (SELECT COUNT(*) FROM task_comments) as total_comments,
    (SELECT COUNT(*) FROM attendance) as attendance_records,
    (SELECT COUNT(*) FROM audit_logs) as audit_entries,
    (SELECT COUNT(*) FROM holidays) as holidays_count,
    (SELECT COUNT(*) FROM licenses) as licenses_count;

-- Show new features summary
SELECT 
    'VERSION 2.3 FEATURES' as feature_category,
    'task_history, task_comments, audit_logs, attendance, holidays, password_reset_tokens, licenses' as tables,
    'Task History, Password Management, Invoice Editing, Auto-Attendance, Holiday Sync, License Management' as new_features,
    'Complete tracking of task reassignments and reschedules with reasons' as enhancements;

SELECT 
    'DEFAULT LOGIN CREDENTIALS' as login_info,
    'admin@ca-office.com' as email,
    'admin123' as password,
    'Use these credentials to access the system' as note;