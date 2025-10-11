const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const { exec } = require('child_process');
require('dotenv').config();

// Configure user data paths for Electron app early in the process
if (process.env.ELECTRON_APP === 'true' && process.env.USER_DATA_PATH) {
  // Set default paths using user data directory
  process.env.LOG_PATH = process.env.LOG_PATH || path.join(process.env.USER_DATA_PATH, 'logs');
  process.env.UPLOAD_PATH = process.env.UPLOAD_PATH || path.join(process.env.USER_DATA_PATH, 'uploads');
  process.env.DATABASE_PATH = process.env.DATABASE_PATH || path.join(process.env.USER_DATA_PATH, 'database');
  process.env.BACKUP_PATH = process.env.BACKUP_PATH || path.join(process.env.USER_DATA_PATH, 'backups');
  
  // Ensure all required directories exist
  const requiredDirs = [
    process.env.LOG_PATH,
    process.env.UPLOAD_PATH,
    process.env.DATABASE_PATH,
    process.env.BACKUP_PATH
  ];
  
  requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`🗂 Created directory: ${dir}`);
      } catch (error) {
        console.error(`❌ Failed to create directory ${dir}:`, error.message);
      }
    }
  });
}

// Import routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const clientRoutes = require('./routes/clients');
const staffRoutes = require('./routes/staff');
const taskRoutes = require('./routes/tasks');
const billingRoutes = require('./routes/billing');
const adminRoutes = require('./routes/admin');
const reportsRoutes = require('./routes/reports');
const attendanceRoutes = require('./routes/attendance');
const licenseRoutes = require('./routes/license');
const { checkLicense } = require('./middleware/licenseCheck');
const firmsRoutes = require('./routes/firms');

// Import notifications route with error handling
let notificationsRoutes;
try {
  notificationsRoutes = require('./routes/notifications');
} catch (error) {
  console.log('⚠️  Notifications route not found, will be disabled');
  notificationsRoutes = null;
}

// Import middleware and services
const { auditMiddleware, getAuditLogs, getAuditStats, getUserActivity, getEntityHistory, getSecurityEvents } = require('./middleware/auditLogger');
const db = require('./config/database');

// Configure Winston Logger with dynamic log path
const logPath = process.env.LOG_PATH || 'logs';
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ca-office-backend' },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logPath, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(logPath, 'combined.log') 
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';
const isElectronApp = process.env.ELECTRON_APP === 'true';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:", "http://localhost:5000", "ws://localhost:5000"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

app.use(compression());

// Enhanced rate limiting with Electron app support
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isElectronApp ? 10000 : (isDevelopment ? 5000 : (isProduction ? 100 : 1000)),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for Electron app or development
    if (isElectronApp || isDevelopment || process.env.NODE_ENV === 'development') {
      return true;
    }
    return false;
  }
});
app.use('/api/', limiter);

// Enhanced CORS configuration with additional ports
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5000',
      'http://localhost:5001',
      'http://127.0.0.1:5000',
      'http://127.0.0.1:5001',
      'http://localhost:3000',    // Add for React dev server
      'http://localhost:3001',    // Add for alternative React port
      'http://127.0.0.1:3000',    // Add for alternative IP
      'http://127.0.0.1:3001'     // Add for alternative IP
    ];
    
    // Allow requests with no origin (Electron, mobile apps, etc.)
    if (!origin || allowedOrigins.includes(origin) || isDevelopment || isElectronApp) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Add audit logging middleware
app.use(auditMiddleware);

// Cron job for automatic holiday/Sunday attendance marking
if (isProduction) {
  const cron = require('node-cron');
  const calendarService = require('./services/calendarService');

  cron.schedule('0 8 * * *', async () => {
    logger.info('Starting automatic holiday attendance marking...');
    try {
      await calendarService.autoMarkHolidayAttendance();
      logger.info('Holiday attendance marking completed successfully');
    } catch (error) {
      logger.error('Error in holiday attendance marking:', error);
    }
  });
}

// Database connection with retry mechanism
let dbRetryCount = 0;
const maxRetries = 5;

const connectToDatabase = async () => {
  try {
    const connected = await db.testConnection();
    if (connected) {
      logger.info('✅ Database connected successfully');
      await db.initializeDatabase();
      return true;
    } else {
      throw new Error('Database connection failed');
    }
  } catch (error) {
    dbRetryCount++;
    logger.error(`Database connection attempt ${dbRetryCount} failed:`, error.message);
    
    if (dbRetryCount < maxRetries) {
      logger.info(`Retrying database connection in 5 seconds... (${dbRetryCount}/${maxRetries})`);
      setTimeout(connectToDatabase, 5000);
    } else {
      logger.error('⚠️ Database connection failed - running in offline mode');
      return false;
    }
  }
};

// Initialize database connection
connectToDatabase();

// Health check middleware
const healthCheck = (req, res, next) => {
  res.locals.startTime = Date.now();
  next();
};

// API Routes with error handling
app.use('/api/auth', healthCheck, authRoutes);
app.use('/api/dashboard', healthCheck, dashboardRoutes);
app.use('/api/clients', healthCheck, clientRoutes);
app.use('/api/staff', healthCheck, staffRoutes);
app.use('/api/tasks', healthCheck, taskRoutes);
app.use('/api/billing', healthCheck, billingRoutes);
app.use('/api/admin', healthCheck, adminRoutes);
app.use('/api/reports', healthCheck, reportsRoutes);
app.use('/api/attendance', healthCheck, attendanceRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/firms', firmsRoutes);

// Conditionally add notifications route if it exists
if (notificationsRoutes && notificationsRoutes) {
  app.use('/api/notifications', healthCheck, notificationsRoutes.router);
  logger.info('✅ Notifications route enabled');
} else {
  logger.info('⚠️  Notifications route disabled - file not found');
}

// Audit logging API routes
app.get('/api/audit/logs', healthCheck, getAuditLogs);
app.get('/api/audit/stats', healthCheck, getAuditStats);
app.get('/api/audit/user/:user_id', healthCheck, getUserActivity);
app.get('/api/audit/entity/:entity_type/:entity_id', healthCheck, getEntityHistory);
app.get('/api/audit/security', healthCheck, getSecurityEvents);

// Enhanced health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbConnected = await db.testConnection();
    const responseTime = Date.now() - (res.locals.startTime || Date.now());
    
    const healthData = {
      status: 'OK',
      message: 'Enhanced CA Office System is running',
      version: '2.3.1',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: responseTime,
      database: dbConnected ? 'connected' : 'disconnected',
      electronApp: isElectronApp,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      features: {
        phase1: {
          status: 'active',
          features: [
            'Enhanced Task Management',
            'Role-based Access Control',
            'Dashboard Customization',
            'Trial Data Cleanup'
          ]
        },
        phase2: {
          status: 'active',
          features: [
            'Task Comments System',
            'PDF/Excel Report Generation',
            'Advanced Billing Filters',
            'Date Range & Amount Filtering'
          ]
        },
        phase3: {
          status: 'active',
          features: [
            'Audit Logging System',
            'Staff Attendance Management',
            'User Activity Tracking',
            'Security Event Monitoring'
          ]
        },
        phase4: {
          status: 'active',
          features: [
            'Auto Attendance on Login',
            'Late Arrival Detection',
            'Enhanced Token Management',
            'Logout Audit Trail'
          ]
        }
      },
      routes: {
        notifications: notificationsRoutes ? 'enabled' : 'disabled'
      }
    };

    res.json(healthData);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      message: 'System health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// System status endpoint
app.get('/api/system/status', async (req, res) => {
  try {
    const dbConnected = await db.testConnection();
    
    const systemStats = {
      database: dbConnected ? 'connected' : 'disconnected',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      node_version: process.version,
      environment: process.env.NODE_ENV || 'development',
      cpu_usage: process.cpuUsage(),
      platform: process.platform,
      arch: process.arch,
      electronApp: isElectronApp
    };

    res.json({
      success: true,
      status: 'healthy',
      stats: systemStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('System status check failed:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// In development, proxy to React dev server
if (isDevelopment) {
  const { createProxyMiddleware } = require('http-proxy-middleware');
  
  app.use(
    '/',
    createProxyMiddleware({
      target: 'http://localhost:3001',
      changeOrigin: true,
      ws: true,
      filter: (pathname) => !pathname.startsWith('/api'),
      onError: (err, req, res) => {
        console.log('Proxy error:', err.message);
        res.status(500).send('Proxy error');
      }
    })
  );
} else {
  // In production, serve static files from frontend build
  const frontendPath = path.join(__dirname, '../frontend/build');
  app.use(express.static(frontendPath));
  
  // Add specific handling for CSS files
  app.use('/static', express.static(path.join(frontendPath, 'static')));
  
  // Serve React app for all non-API routes
  app.get('*', (req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({
        error: 'Frontend not found',
        message: 'Please build the frontend first: npm run build:frontend'
      });
    }
  });
}

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  const errorId = require('uuid').v4();
  
  // Log error with ID for tracking
  logger.error(`Error ${errorId}:`, {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    query: req.query,
    params: req.params
  });

  // Send appropriate response
  const status = error.status || 500;
  const response = {
    error: status >= 500 ? 'Internal Server Error' : error.message,
    errorId: errorId,
    timestamp: new Date().toISOString()
  };

  if (process.env.NODE_ENV === 'development') {
    response.message = error.message;
    response.stack = error.stack;
    response.details = {
      url: req.originalUrl,
      method: req.method,
      body: req.body,
      query: req.query
    };
  }

  res.status(status).json(response);
});

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
  logger.warn(`API route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Function to open Chrome
const openInChrome = (url) => {
  const platform = process.platform;
  let chromeCommand;

  switch (platform) {
    case 'win32':
      chromeCommand = 'start chrome';
      break;
    case 'darwin':
      chromeCommand = 'open -a "Google Chrome"';
      break;
    case 'linux':
      chromeCommand = 'google-chrome';
      break;
    default:
      console.log('Unsupported platform. Please open manually:', url);
      return;
  }

  exec(`${chromeCommand} ${url}`, (error) => {
    if (error) {
      console.log('Could not open Chrome automatically. Please open manually:', url);
    }
  });
};

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🏢 ENHANCED CA OFFICE AUTOMATION SYSTEM v2.3.1');
  console.log('=======================================================');
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Application URL: http://localhost:${PORT}`);
  console.log(`🔌 API Base URL: http://localhost:${PORT}/api`);
  console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔍 System Status: http://localhost:${PORT}/api/system/status`);
  console.log('');
  console.log('🔐 Default Login:');
  console.log('   Email: admin@ca-office.com');
  console.log('   Password: admin123');
  console.log('');
  console.log(`🎯 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📱 Electron App: ${isElectronApp ? '✅ Yes' : '❌ No'}`);
  console.log(`📦 Notifications: ${notificationsRoutes ? '✅ Enabled' : '⚠️  Disabled'}`);
  console.log('');
  
  if (isDevelopment) {
    console.log('⚠️  Development Mode: Make sure to run frontend on port 3001');
    console.log('   cd ../frontend && PORT=3001 npm start');
  } else {
    console.log('🚀 Ready for production!');
    // setTimeout(() => {
      // console.log('🌐 Opening in Google Chrome...');
      // openInChrome(`http://localhost:${PORT}`);
    // }, 2000);
  }
  
  logger.info('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV,
    electronApp: isElectronApp,
    notificationsEnabled: !!notificationsRoutes
  });
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  logger.info(`${signal} received, initiating graceful shutdown`);
  
  server.close(() => {
    console.log('HTTP server closed');
    logger.info('HTTP server closed');
    
    // Close database connections
    if (db.pool) {
      db.pool.end(() => {
        console.log('Database connections closed');
        logger.info('Database connections closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app;