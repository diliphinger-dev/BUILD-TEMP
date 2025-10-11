# CA Office Pro - Complete Deployment Guide

## 📋 Overview

CA Office Pro is a comprehensive practice management system for Chartered Accountants, featuring client management, task tracking, billing, attendance management, and audit logging.

## 🚀 Quick Start (EXE Installer)

### For End Users:
1. Download the installer from the releases
2. Run `CA-Office-Pro-Setup.exe`
3. Follow installation wizard
4. Launch from Desktop shortcut or Start Menu
5. Login with: `admin@ca-office.com` / `admin123`

## 🛠️ Development Setup

### Prerequisites:
- Node.js 18+ and npm 8+
- Git

### Installation:
```bash
# Clone repository
git clone <repository-url>
cd ca-office-automation

# Install all dependencies
npm run setup-dev

# Build everything
npm run build-all

# Test the electron app
npm run test-build
```

## 📦 Building EXE Installer

### Step 1: Prepare Environment
```bash
# Install global dependencies
npm install -g electron-builder

# Clean previous builds
npm run clean

# Install and build everything
npm run build-all
```

### Step 2: Create Installer
```bash
cd backend
npm run dist
```

The installer will be created in `backend/dist/` directory.

## 🗂️ Project Structure

```
ca-office-automation/
├── backend/                 # Node.js/Express API server
│   ├── routes/             # API routes
│   ├── middleware/         # Custom middleware
│   ├── config/            # Database and app configuration
│   ├── services/          # Business logic services
│   ├── uploads/           # File uploads directory
│   ├── logs/             # Application logs
│   ├── data/             # SQLite database (Electron)
│   ├── assets/           # Application icons
│   ├── main.js           # Electron main process
│   └── server.js         # Express server
├── frontend/               # React frontend application
│   ├── src/
│   ├── public/
│   └── build/            # Production build
├── database/              # Database schemas
├── scripts/              # Build and deployment scripts
└── package.json          # Root package configuration
```

## ⚙️ Configuration

### Environment Variables (.env):
```env
NODE_ENV=production
PORT=5000
ELECTRON_APP=true

# Database (SQLite for Electron)
DB_TYPE=sqlite
DB_PATH=./data/ca_office.db

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this
BCRYPT_ROUNDS=12

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Logging
LOG_LEVEL=info
LOG_PATH=./logs
```

## 🔧 Key Features

### Phase 1 Features:
- ✅ Enhanced Task Management
- ✅ Role-based Access Control
- ✅ Dashboard Customization
- ✅ Trial Data Cleanup

### Phase 2 Features:
- ✅ Task Comments & Progress Tracking
- ✅ Advanced PDF/Excel Report Generation
- ✅ Enhanced Billing with Date/Amount Filters
- ✅ Client-wise & Status-based Invoice Sorting

### Phase 3 Features:
- ✅ Complete Audit Logging System
- ✅ Staff Attendance Management
- ✅ User Activity & Security Monitoring
- ✅ Real-time Attendance Tracking
- ✅ Automatic Holiday/Sunday Attendance Marking

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control (Admin, Manager, Staff)
- Complete audit logging
- Input validation and sanitization
- CORS protection
- Rate limiting
- Security headers with Helmet

## 📊 Database Support

- **Production/Electron**: SQLite (embedded)
- **Development**: MySQL/MariaDB support
- Automatic database initialization
- Migration support
- Data validation and constraints

## 🔍 API Endpoints

### Authentication:
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile

### Client Management:
- `GET /api/clients` - List clients
- `POST /api/clients` - Create client
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

### Task Management:
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task
- `POST /api/tasks/:id/comments` - Add comment

### Billing & Invoicing:
- `GET /api/billing/invoices` - List invoices
- `POST /api/billing/invoices` - Create invoice
- `GET /api/billing/outstanding` - Outstanding invoices
- `POST /api/billing/receipts` - Record payment

### Attendance Management:
- `GET /api/attendance` - List attendance records
- `POST /api/attendance/mark` - Mark attendance
- `GET /api/attendance/stats` - Attendance statistics
- `GET /api/attendance/calendar/:staff_id/:year/:month` - Monthly calendar

### Reports:
- `GET /api/reports/tasks` - Task reports (PDF/Excel)
- `GET /api/reports/billing` - Billing reports
- `GET /api/reports/clients` - Client reports
- `GET /api/reports/attendance` - Attendance reports

### System:
- `GET /api/health` - Health check
- `GET /api/system/status` - System status
- `GET /api/audit/logs` - Audit logs

## 🐛 Troubleshooting

### Common Issues:

1. **Database Connection Failed**:
   - Check if the data directory exists
   - Verify SQLite file permissions
   - Check .env configuration

2. **Port Already in Use**:
   - Change PORT in .env file
   - Kill existing Node.js processes

3. **Frontend Not Loading**:
   - Ensure frontend build exists
   - Check static file serving
   - Verify frontend build path

4. **Electron App Won't Start**:
   - Check if Node.js is installed
   - Verify all dependencies installed
   - Check console for errors

### Log Files:
- Application logs: `backend/logs/`
- Error logs: `backend/logs/error.log`
- Combined logs: `backend/logs/combined.log`

## 🔄 Updates and Maintenance

### Database Backup:
```bash
# Manual backup (SQLite)
cp backend/data/ca_office.db backend/data/backup_$(date +%Y%m%d_%H%M%S).db
```

### System Maintenance:
- Regular log file cleanup
- Database optimization (VACUUM)
- Security updates
- Dependency updates

## 📝 Default Login Credentials

- **Email**: `admin@ca-office.com`
- **Password**: `admin123`

⚠️ **Important**: Change default credentials after first login!

## 📞 Support

For technical support and licensing:
- Email: support@yourcompany.com
- Documentation: [Link to docs]
- Issue Tracker: [GitHub Issues]

## 📄 License

This software is licensed for authorized use only.
See `license.txt` for full terms and conditions.

---

## 🚀 Ready for Production!

Your CA Office Pro system is now ready for deployment as a standalone Windows application with installer.

### Post-Installation Checklist:
- [ ] Change default admin password
- [ ] Configure company settings
- [ ] Add staff members
- [ ] Set up client data
- [ ] Configure backup schedule
- [ ] Test all features
- [ ] Train users on system

**Version**: 2.2.0  
**Build Date**: $(date)  
**Support**: Professional Practice Management System