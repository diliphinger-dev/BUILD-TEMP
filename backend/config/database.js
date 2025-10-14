const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const isElectronApp = process.env.ELECTRON_APP === 'true';
const userDataPath = process.env.USER_DATA_PATH || './data';

// SQLite database file path
const dbPath = isElectronApp 
  ? path.join(userDataPath, 'ca_office.db')
  : path.join(__dirname, '../data/ca_office.db');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;

const initializeConnection = () => {
  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    console.log('✅ SQLite database connected:', dbPath);
    return true;
  } catch (error) {
    console.error('Failed to initialize SQLite database:', error);
    return false;
  }
};

const testConnection = () => {
  try {
    if (!db) {
      initializeConnection();
    }
    db.prepare('SELECT 1').get();
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error.message);
    return false;
  }
};

// FIXED: Async query function for compatibility with license routes
const query = async (sql, params = []) => {
  try {
    if (!db) {
      initializeConnection();
    }
    
    // Make it async compatible
    return new Promise((resolve, reject) => {
      try {
        const sqlUpper = sql.trim().toUpperCase();
        if (sqlUpper.startsWith('SELECT') || sqlUpper.startsWith('SHOW') || sqlUpper.includes('sqlite_master')) {
          const result = db.prepare(sql).all(params);
          resolve(result);
        } else {
          const result = db.prepare(sql).run(params);
          resolve(result);
        }
      } catch (error) {
        console.error('Database query error:', error.message);
        console.error('SQL:', sql);
        console.error('Params:', params);
        reject(error);
      }
    });
  } catch (error) {
    console.error('Database query error:', error.message);
    throw error;
  }
};

const initializeDatabase = async () => {
  try {
    const connected = testConnection();
    if (!connected) {
      console.log('⚠️ Database connection failed');
      return false;
    }

    // Always create/update all tables
    console.log('📋 Creating/updating database structure...');
    await createAllTables();
    
    // REMOVED: ensureDefaultFirm() - No longer auto-creating default firm
    await ensureDefaultAdmin();
    await ensureDefaultTaskTypes();
    await ensureDefaultSettings();
    
    console.log('✅ Database initialization completed successfully');
    return true;
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    return false;
  }
};

const createAllTables = async () => {
  const tables = [
    // Licenses table (FIRST - for license validation)
    `CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT UNIQUE NOT NULL,
      company_name TEXT NOT NULL,
      email TEXT NOT NULL,
      max_users INTEGER DEFAULT 5,
      features TEXT,
      expiry_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      license_type TEXT NOT NULL DEFAULT 'commercial',
      issue_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      activated_date DATETIME,
      last_validated DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Firms table (SECOND - referenced by other tables)
    `CREATE TABLE IF NOT EXISTS firms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      firm_name TEXT NOT NULL,
      registration_number TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      postal_code TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      logo_path TEXT,
      gstin TEXT,
      pan TEXT,
      owner_name TEXT,
      established_date DATE,
      status TEXT NOT NULL DEFAULT 'active',
      is_selected INTEGER DEFAULT 0,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Staff table - FIXED: Removed DEFAULT firm_id
    `CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      employee_id TEXT,
      phone TEXT,
      address TEXT,
      department TEXT DEFAULT 'operations',
      designation TEXT,
      qualification TEXT,
      experience_years INTEGER DEFAULT 0,
      date_of_birth DATE,
      gender TEXT,
      blood_group TEXT,
      marital_status TEXT DEFAULT 'single',
      current_address TEXT,
      permanent_address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      emergency_contact_name TEXT,
      emergency_contact_phone TEXT,
      emergency_contact_relation TEXT,
      bank_name TEXT,
      account_number TEXT,
      ifsc_code TEXT,
      pan_number TEXT,
      aadhar_number TEXT,
      date_of_joining DATE,
      joining_date DATE,
      hire_date DATE,
      salary DECIMAL(10,2),
      status TEXT NOT NULL DEFAULT 'active',
      firm_id INTEGER,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (firm_id) REFERENCES firms(id)
    )`,
    
    // Staff firms junction table (for multi-firm support)
    `CREATE TABLE IF NOT EXISTS staff_firms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      firm_id INTEGER NOT NULL,
      access_level TEXT DEFAULT 'full',
      is_primary INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      assigned_date DATE DEFAULT (DATE('now')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staff_id) REFERENCES staff(id),
      FOREIGN KEY (firm_id) REFERENCES firms(id),
      UNIQUE(staff_id, firm_id)
    )`,
    
    // Clients table - FIXED: Removed DEFAULT firm_id
    `CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      postal_code TEXT,
      pan_number TEXT,
      pan TEXT,
      gstin TEXT,
      contact_person TEXT,
      client_type TEXT NOT NULL DEFAULT 'individual',
      status TEXT NOT NULL DEFAULT 'active',
      firm_id INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES staff(id),
      FOREIGN KEY (firm_id) REFERENCES firms(id)
    )`,
    
    // Task types table
    `CREATE TABLE IF NOT EXISTS task_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type_key TEXT UNIQUE NOT NULL,
      type_label TEXT NOT NULL,
      icon TEXT DEFAULT 'fas fa-tasks',
      color TEXT DEFAULT '#6c757d',
      description TEXT,
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Tasks table - FIXED: Removed DEFAULT firm_id
    `CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      client_id INTEGER NOT NULL,
      assigned_to INTEGER,
      task_type TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'pending',
      due_date DATE,
      completion_date DATETIME,
      estimated_hours DECIMAL(5,2) DEFAULT 0.00,
      actual_hours DECIMAL(5,2) DEFAULT 0.00,
      amount DECIMAL(10,2) DEFAULT 0,
      notes TEXT,
      firm_id INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (assigned_to) REFERENCES staff(id),
      FOREIGN KEY (created_by) REFERENCES staff(id),
      FOREIGN KEY (firm_id) REFERENCES firms(id)
    )`,
    
    // Task comments table
    `CREATE TABLE IF NOT EXISTS task_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      comment_text TEXT NOT NULL,
      is_completed INTEGER DEFAULT 0,
      is_edited INTEGER DEFAULT 0,
      edited_at DATETIME,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES staff(id),
      FOREIGN KEY (created_by) REFERENCES staff(id)
    )`,
    
    // Task history table
    `CREATE TABLE IF NOT EXISTS task_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by INTEGER,
      change_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (changed_by) REFERENCES staff(id) ON DELETE SET NULL
    )`,
    
    // Basic Leave tables
    `CREATE TABLE IF NOT EXISTS leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      leave_type TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'pending',
      approved_by INTEGER,
      approved_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staff_id) REFERENCES staff(id),
      FOREIGN KEY (approved_by) REFERENCES staff(id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS leave_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      applicable_to TEXT DEFAULT 'all',
      casual_leave INTEGER DEFAULT 12,
      sick_leave INTEGER DEFAULT 7,
      earned_leave INTEGER DEFAULT 15,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Basic Skills tables
    `CREATE TABLE IF NOT EXISTS staff_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      skill_name TEXT NOT NULL,
      proficiency_level TEXT DEFAULT 'beginner',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS staff_trainings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      training_name TEXT NOT NULL,
      training_date DATE,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staff_id) REFERENCES staff(id)
    )`,
    
    // Invoices table - FIXED: Removed DEFAULT firm_id
    `CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      client_id INTEGER NOT NULL,
      task_id INTEGER,
      amount DECIMAL(10,2) NOT NULL,
      tax_amount DECIMAL(10,2) DEFAULT 0.00,
      discount_amount DECIMAL(10,2) DEFAULT 0.00,
      discount_type TEXT DEFAULT 'fixed',
      discount_reason TEXT,
      total_amount DECIMAL(10,2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      invoice_date DATE DEFAULT (DATE('now')),
      due_date DATE,
      paid_date DATETIME,
      payment_terms TEXT DEFAULT 'net_30',
      notes TEXT,
      firm_id INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (created_by) REFERENCES staff(id),
      FOREIGN KEY (firm_id) REFERENCES firms(id)
    )`,
    
    // Receipts table - FIXED: Removed DEFAULT firm_id
    `CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_number TEXT UNIQUE NOT NULL,
      invoice_id INTEGER NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_method TEXT NOT NULL,
      payment_reference TEXT,
      receipt_date DATE NOT NULL,
      discount_amount DECIMAL(10,2) DEFAULT 0.00,
      notes TEXT,
      firm_id INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id),
      FOREIGN KEY (created_by) REFERENCES staff(id),
      FOREIGN KEY (firm_id) REFERENCES firms(id)
    )`,
    
    // Attendance table - FIXED: Removed DEFAULT firm_id
    `CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      attendance_date DATE NOT NULL,
      check_in_time TIME,
      check_out_time TIME,
      break_time_minutes INTEGER DEFAULT 0,
      total_hours DECIMAL(4,2) DEFAULT 0.00,
      status TEXT NOT NULL DEFAULT 'absent',
      location TEXT,
      notes TEXT,
      approved_by INTEGER,
      firm_id INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staff_id) REFERENCES staff(id),
      FOREIGN KEY (approved_by) REFERENCES staff(id),
      FOREIGN KEY (created_by) REFERENCES staff(id),
      FOREIGN KEY (firm_id) REFERENCES firms(id),
      UNIQUE(staff_id, attendance_date)
    )`,
    
    // Audit logs table - FIXED: Removed DEFAULT firm_id
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT,
      user_agent TEXT,
      firm_id INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES staff(id),
      FOREIGN KEY (firm_id) REFERENCES firms(id)
    )`,
    
    // Settings table - FIXED: Removed DEFAULT firm_id
    `CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT UNIQUE NOT NULL,
      setting_value TEXT,
      description TEXT,
      firm_id INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (firm_id) REFERENCES firms(id)
    )`,
    
    // Trial data cleanup tracking table
    `CREATE TABLE IF NOT EXISTS trial_data_cleanup (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      is_trial_data INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  // Execute all table creation statements
  for (const sql of tables) {
    try {
      db.exec(sql);
    } catch (error) {
      console.error('Error creating table:', error.message);
      console.error('SQL:', sql);
      throw error;
    }
  }
  
  console.log('✅ All database tables created/updated successfully');
};

// REMOVED: ensureDefaultFirm() function - No longer auto-creating default firm

const ensureDefaultAdmin = async () => {
  try {
    const adminExists = db.prepare('SELECT id FROM staff WHERE role = ? LIMIT 1').get('admin');
    
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      // FIXED: Create admin without firm_id requirement
      db.prepare(`
        INSERT INTO staff (name, email, password, role, status) 
        VALUES (?, ?, ?, ?, ?)
      `).run('System Administrator', 'admin@ca-office.com', hashedPassword, 'admin', 'active');
      
      console.log('✅ Default admin user created');
      console.log('   Email: admin@ca-office.com');
      console.log('   Password: admin123');
      console.log('   NOTE: Admin can be assigned to firms after firm creation');
    }
  } catch (error) {
    console.error('Error ensuring default admin:', error.message);
  }
};

const ensureDefaultTaskTypes = async () => {
  try {
    const existingTypes = db.prepare('SELECT COUNT(*) as count FROM task_types').get();
    if (existingTypes.count === 0) {
      const defaultTaskTypes = [
        { type_key: 'itr', type_label: 'Income Tax Return', icon: 'fas fa-file-invoice', color: '#28a745', description: 'ITR Filing Services' },
        { type_key: 'gst', type_label: 'GST Return Filing', icon: 'fas fa-receipt', color: '#17a2b8', description: 'GST Return and Compliance' },
        { type_key: 'audit', type_label: 'Financial Audit', icon: 'fas fa-search-dollar', color: '#dc3545', description: 'Financial Audit Services' },
        { type_key: 'consultation', type_label: 'Tax Consultation', icon: 'fas fa-comments', color: '#6c757d', description: 'Tax Advisory Services' },
        { type_key: 'compliance', type_label: 'Regulatory Compliance', icon: 'fas fa-clipboard-check', color: '#fd7e14', description: 'Compliance Services' },
        { type_key: 'housing_loan', type_label: 'Housing Loan', icon: 'fas fa-home', color: '#e83e8c', description: 'Housing Loan Processing' },
        { type_key: 'project_loan', type_label: 'Project Loan', icon: 'fas fa-building', color: '#6f42c1', description: 'Project Loan Processing' },
        { type_key: 'accounting', type_label: 'Accounting Services', icon: 'fas fa-calculator', color: '#20c997', description: 'Bookkeeping and Accounting' },
        { type_key: 'certification', type_label: 'Certificate Services', icon: 'fas fa-certificate', color: '#ffc107', description: 'Various Certifications' },
        { type_key: 'other', type_label: 'Other Services', icon: 'fas fa-ellipsis-h', color: '#6c757d', description: 'Other Professional Services' }
      ];
      
      const insertType = db.prepare(`
        INSERT INTO task_types (type_key, type_label, icon, color, description, display_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      defaultTaskTypes.forEach((type, index) => {
        insertType.run(type.type_key, type.type_label, type.icon, type.color, type.description, index);
      });
      
      console.log('✅ Default task types created');
    }
  } catch (error) {
    console.error('Error ensuring default task types:', error.message);
  }
};

const ensureDefaultSettings = async () => {
  try {
    const existingSettings = db.prepare('SELECT COUNT(*) as count FROM settings').get();
    if (existingSettings.count === 0) {
      const defaultSettings = [
        { setting_key: 'company_name', setting_value: 'CA Office Pro', description: 'Company Name' },
        { setting_key: 'gst_rate', setting_value: '18', description: 'Default GST Rate %' },
        { setting_key: 'invoice_prefix', setting_value: 'INV', description: 'Invoice Number Prefix' },
        { setting_key: 'receipt_prefix', setting_value: 'RCP', description: 'Receipt Number Prefix' },
        { setting_key: 'currency_symbol', setting_value: '₹', description: 'Currency Symbol' },
        { setting_key: 'date_format', setting_value: 'DD-MM-YYYY', description: 'Date Display Format' },
        { setting_key: 'backup_frequency', setting_value: 'daily', description: 'Backup Frequency' },
        { setting_key: 'session_timeout', setting_value: '480', description: 'Session Timeout (minutes)' }
      ];
      
      const insertSetting = db.prepare(`
        INSERT INTO settings (setting_key, setting_value, description)
        VALUES (?, ?, ?)
      `);
      
      defaultSettings.forEach(setting => {
        insertSetting.run(setting.setting_key, setting.setting_value, setting.description);
      });
      
      console.log('✅ Default settings created (no firm association)');
    }
  } catch (error) {
    console.error('Error ensuring default settings:', error.message);
  }
};

const transaction = (callback) => {
  const transaction = db.transaction(() => {
    return callback(db);
  });
  return transaction();
};

const closeConnection = () => {
  if (db) {
    db.close();
    console.log('SQLite database connection closed');
  }
};

const backupDatabase = (backupPath) => {
  try {
    const fs = require('fs');
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ Database backed up to: ${backupPath}`);
    return true;
  } catch (error) {
    console.error('Database backup failed:', error);
    return false;
  }
};

const optimizeDatabase = () => {
  try {
    db.exec('VACUUM');
    db.exec('ANALYZE');
    console.log('✅ Database optimized');
    return true;
  } catch (error) {
    console.error('Database optimization failed:', error);
    return false;
  }
};

// Initialize on module load
initializeConnection();

module.exports = { 
  db,
  query, 
  testConnection, 
  initializeDatabase,
  transaction,
  closeConnection,
  backupDatabase,
  optimizeDatabase,
  dbType: 'sqlite'
};