const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { query } = require('../config/database');
const router = express.Router();

// PHASE 2: Generate Tasks Report (PDF/Excel)
router.get('/tasks', async (req, res) => {
  try {
    const { format = 'excel', start_date, end_date, status, task_type, assigned_to } = req.query;

    // Build dynamic query based on filters
    let sql = `
      SELECT 
        t.id,
        t.title,
        t.description,
        c.name as client_name,
        c.company as client_company,
        s.name as assigned_to_name,
        t.priority,
        t.status,
        t.task_type,
        t.due_date,
        t.completion_date,
        t.estimated_hours,
        t.actual_hours,
        t.amount,
        t.created_at,
        (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id) as comment_count,
        (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id AND tc.is_completed = FALSE) as pending_comments
      FROM tasks t
      LEFT JOIN clients c ON t.client_id = c.id
      LEFT JOIN staff s ON t.assigned_to = s.id
      WHERE 1=1
    `;

    const params = [];
    
    if (start_date) {
      sql += ' AND t.created_at >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND t.created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }
    
    if (status && status !== 'all') {
      sql += ' AND t.status = ?';
      params.push(status);
    }
    
    if (task_type && task_type !== 'all') {
      sql += ' AND t.task_type = ?';
      params.push(task_type);
    }
    
    if (assigned_to && assigned_to !== 'all') {
      sql += ' AND t.assigned_to = ?';
      params.push(assigned_to);
    }

    sql += ' ORDER BY t.created_at DESC';

    const tasks = await query(sql, params);

    if (format === 'pdf') {
      await generateTasksPDF(res, tasks, { start_date, end_date, status, task_type });
    } else {
      await generateTasksExcel(res, tasks, { start_date, end_date, status, task_type });
    }

  } catch (error) {
    console.error('Error generating tasks report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PHASE 2: Generate Billing Report (PDF/Excel)
router.get('/billing', async (req, res) => {
  try {
    const { format = 'excel', start_date, end_date, status, client_id } = req.query;

    let sql = `
      SELECT 
        i.id,
        i.invoice_number,
        i.invoice_date,
        i.due_date,
        i.paid_date,
        c.name as client_name,
        c.company as client_company,
        c.email as client_email,
        c.phone as client_phone,
        t.title as task_title,
        i.amount,
        i.tax_amount,
        i.total_amount,
        i.status,
        i.payment_terms,
        COALESCE(SUM(r.amount), 0) as received_amount,
        (i.total_amount - COALESCE(SUM(r.amount), 0)) as pending_amount,
        CASE 
          WHEN i.due_date < DATE('now') AND i.status != 'paid' THEN 
            CAST((JULIANDAY('now') - JULIANDAY(i.due_date)) AS INTEGER)
          ELSE 0 
        END as days_overdue
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN tasks t ON i.task_id = t.id
      LEFT JOIN receipts r ON i.id = r.invoice_id
      WHERE 1=1
    `;

    const params = [];
    
    if (start_date) {
      sql += ' AND DATE(i.invoice_date) >= DATE(?)';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND DATE(i.invoice_date) <= DATE(?)';
      params.push(end_date);
    }
    
    if (status && status !== 'all') {
      sql += ' AND i.status = ?';
      params.push(status);
    }
    
    if (client_id && client_id !== 'all') {
      sql += ' AND i.client_id = ?';
      params.push(client_id);
    }

    sql += ' GROUP BY i.id ORDER BY i.invoice_date DESC';

    const invoices = await query(sql, params);

    // Get payment receipts for detailed report
    let receiptSql = `
      SELECT 
        r.*,
        i.invoice_number,
        c.name as client_name
      FROM receipts r
      LEFT JOIN invoices i ON r.invoice_id = i.id
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE 1=1
    `;
    
    const receiptParams = [];
    if (start_date) {
      receiptSql += ' AND DATE(r.receipt_date) >= DATE(?)';
      receiptParams.push(start_date);
    }
    if (end_date) {
      receiptSql += ' AND DATE(r.receipt_date) <= DATE(?)';
      receiptParams.push(end_date);
    }
    receiptSql += ' ORDER BY r.receipt_date DESC';

    const receipts = await query(receiptSql, receiptParams);

    if (format === 'pdf') {
      await generateBillingPDF(res, invoices, receipts, { start_date, end_date, status });
    } else {
      await generateBillingExcel(res, invoices, receipts, { start_date, end_date, status });
    }

  } catch (error) {
    console.error('Error generating billing report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PHASE 2: Generate Client Report (PDF/Excel)
router.get('/clients', async (req, res) => {
  try {
    const { format = 'excel', client_type, status } = req.query;

    let sql = `
      SELECT 
        c.*,
        s.name as created_by_name,
        (SELECT COUNT(*) FROM tasks t WHERE t.client_id = c.id) as total_tasks,
        (SELECT COUNT(*) FROM tasks t WHERE t.client_id = c.id AND t.status = 'completed') as completed_tasks,
        (SELECT COUNT(*) FROM invoices i WHERE i.client_id = c.id) as total_invoices,
        (SELECT COALESCE(SUM(i.total_amount), 0) FROM invoices i WHERE i.client_id = c.id) as total_billed,
        (SELECT COALESCE(SUM(r.amount), 0) FROM receipts r 
         LEFT JOIN invoices i ON r.invoice_id = i.id 
         WHERE i.client_id = c.id) as total_received
      FROM clients c
      LEFT JOIN staff s ON c.created_by = s.id
      WHERE 1=1
    `;

    const params = [];
    
    if (client_type && client_type !== 'all') {
      sql += ' AND c.client_type = ?';
      params.push(client_type);
    }
    
    if (status && status !== 'all') {
      sql += ' AND c.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY c.name';

    const clients = await query(sql, params);

    if (format === 'pdf') {
      await generateClientsPDF(res, clients, { client_type, status });
    } else {
      await generateClientsExcel(res, clients, { client_type, status });
    }

  } catch (error) {
    console.error('Error generating clients report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PHASE 3: Generate Attendance Report (PDF/Excel)
router.get('/attendance', async (req, res) => {
  try {
    const { format = 'excel', start_date, end_date, staff_id } = req.query;

    let sql = `
      SELECT 
        a.*,
        s.name as staff_name,
        s.role as staff_role,
        s.email as staff_email
      FROM attendance a
      LEFT JOIN staff s ON a.staff_id = s.id
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
    
    if (staff_id && staff_id !== 'all') {
      sql += ' AND a.staff_id = ?';
      params.push(staff_id);
    }

    sql += ' ORDER BY a.attendance_date DESC, s.name';

    const attendance = await query(sql, params);

    if (format === 'pdf') {
      await generateAttendancePDF(res, attendance, { start_date, end_date });
    } else {
      await generateAttendanceExcel(res, attendance, { start_date, end_date });
    }

  } catch (error) {
    console.error('Error generating attendance report:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Excel Generation Functions
async function generateTasksExcel(res, tasks, filters) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Tasks Report');

  // Add title
  worksheet.mergeCells('A1:M1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'CA Office - Tasks Report';
  titleCell.font = { name: 'Arial', size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center' };

  // Add filters info
  let filterText = 'Filters: ';
  if (filters.start_date) filterText += `From: ${filters.start_date} `;
  if (filters.end_date) filterText += `To: ${filters.end_date} `;
  if (filters.status && filters.status !== 'all') filterText += `Status: ${filters.status} `;
  if (filters.task_type && filters.task_type !== 'all') filterText += `Type: ${filters.task_type} `;
  
  worksheet.mergeCells('A2:M2');
  const filterCell = worksheet.getCell('A2');
  filterCell.value = filterText;
  filterCell.font = { name: 'Arial', size: 10 };

  // Add headers
  const headers = [
    'ID', 'Title', 'Client', 'Company', 'Assigned To', 'Type', 'Priority', 
    'Status', 'Due Date', 'Amount (₹)', 'Est. Hours', 'Actual Hours', 'Comments'
  ];
  
  worksheet.addRow([]); // Empty row
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6E6E6' }
  };

  // Add data
  tasks.forEach(task => {
    worksheet.addRow([
      task.id,
      task.title,
      task.client_name || '',
      task.client_company || '',
      task.assigned_to_name || 'Unassigned',
      task.task_type?.toUpperCase() || '',
      task.priority?.toUpperCase() || '',
      task.status?.toUpperCase() || '',
      task.due_date ? new Date(task.due_date).toLocaleDateString() : '',
      task.amount || 0,
      task.estimated_hours || 0,
      task.actual_hours || 0,
      task.comment_count || 0
    ]);
  });

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      if (cell.value) {
        maxLength = Math.max(maxLength, cell.value.toString().length);
      }
    });
    column.width = Math.min(Math.max(maxLength + 2, 10), 50);
  });

  // Set response headers
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="tasks-report-${new Date().toISOString().split('T')[0]}.xlsx"`);

  await workbook.xlsx.write(res);
}

async function generateBillingExcel(res, invoices, receipts, filters) {
  const workbook = new ExcelJS.Workbook();
  
  // Invoices worksheet
  const invoiceSheet = workbook.addWorksheet('Invoices');
  
  // Add title
  invoiceSheet.mergeCells('A1:K1');
  const titleCell = invoiceSheet.getCell('A1');
  titleCell.value = 'CA Office - Billing Report (Invoices)';
  titleCell.font = { name: 'Arial', size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center' };

  // Add invoice headers
  const invoiceHeaders = [
    'Invoice #', 'Date', 'Client', 'Task', 'Amount (₹)', 'Tax (₹)', 
    'Total (₹)', 'Received (₹)', 'Pending (₹)', 'Status', 'Days Overdue'
  ];
  
  invoiceSheet.addRow([]);
  invoiceSheet.addRow([]);
  const invHeaderRow = invoiceSheet.addRow(invoiceHeaders);
  invHeaderRow.font = { bold: true };
  invHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6E6E6' }
  };

  // Add invoice data
  invoices.forEach(invoice => {
    invoiceSheet.addRow([
      invoice.invoice_number,
      new Date(invoice.invoice_date).toLocaleDateString(),
      invoice.client_name,
      invoice.task_title || 'Direct Invoice',
      invoice.amount,
      invoice.tax_amount,
      invoice.total_amount,
      invoice.received_amount,
      invoice.pending_amount,
      invoice.status?.toUpperCase(),
      invoice.days_overdue > 0 ? invoice.days_overdue : ''
    ]);
  });

  // Receipts worksheet
  const receiptSheet = workbook.addWorksheet('Payment Receipts');
  
  receiptSheet.mergeCells('A1:H1');
  const receiptTitleCell = receiptSheet.getCell('A1');
  receiptTitleCell.value = 'CA Office - Payment Receipts';
  receiptTitleCell.font = { name: 'Arial', size: 16, bold: true };
  receiptTitleCell.alignment = { horizontal: 'center' };

  const receiptHeaders = [
    'Receipt #', 'Date', 'Invoice #', 'Client', 'Amount (₹)', 
    'Payment Method', 'Reference', 'Notes'
  ];
  
  receiptSheet.addRow([]);
  receiptSheet.addRow([]);
  const recHeaderRow = receiptSheet.addRow(receiptHeaders);
  recHeaderRow.font = { bold: true };
  recHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6E6E6' }
  };

  // Add receipt data
  receipts.forEach(receipt => {
    receiptSheet.addRow([
      receipt.receipt_number,
      new Date(receipt.receipt_date).toLocaleDateString(),
      receipt.invoice_number,
      receipt.client_name,
      receipt.amount,
      receipt.payment_method?.toUpperCase(),
      receipt.payment_reference || '',
      receipt.notes || ''
    ]);
  });

  // Auto-fit columns for both sheets
  [invoiceSheet, receiptSheet].forEach(sheet => {
    sheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        if (cell.value) {
          maxLength = Math.max(maxLength, cell.value.toString().length);
        }
      });
      column.width = Math.min(Math.max(maxLength + 2, 10), 50);
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="billing-report-${new Date().toISOString().split('T')[0]}.xlsx"`);

  await workbook.xlsx.write(res);
}

async function generateClientsExcel(res, clients, filters) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Clients Report');

  // Add title
  worksheet.mergeCells('A1:M1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'CA Office - Clients Report';
  titleCell.font = { name: 'Arial', size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center' };

  // Add headers
  const headers = [
    'ID', 'Name', 'Email', 'Phone', 'Company', 'Type', 'Status', 'City', 
    'PAN', 'GSTIN', 'Total Tasks', 'Completed Tasks', 'Total Billed (₹)', 'Total Received (₹)'
  ];
  
  worksheet.addRow([]);
  worksheet.addRow([]);
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6E6E6' }
  };

  // Add data
  clients.forEach(client => {
    worksheet.addRow([
      client.id,
      client.name,
      client.email || '',
      client.phone || '',
      client.company || '',
      client.client_type?.toUpperCase(),
      client.status?.toUpperCase(),
      client.city || '',
      client.pan_number || '',
      client.gstin || '',
      client.total_tasks || 0,
      client.completed_tasks || 0,
      client.total_billed || 0,
      client.total_received || 0
    ]);
  });

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      if (cell.value) {
        maxLength = Math.max(maxLength, cell.value.toString().length);
      }
    });
    column.width = Math.min(Math.max(maxLength + 2, 10), 50);
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="clients-report-${new Date().toISOString().split('T')[0]}.xlsx"`);

  await workbook.xlsx.write(res);
}

async function generateAttendanceExcel(res, attendance, filters) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Attendance Report');

  // Add title
  worksheet.mergeCells('A1:I1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'CA Office - Staff Attendance Report';
  titleCell.font = { name: 'Arial', size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center' };

  // Add headers
  const headers = [
    'Date', 'Staff Name', 'Role', 'Check In', 'Check Out', 
    'Total Hours', 'Status', 'Location', 'Notes'
  ];
  
  worksheet.addRow([]);
  worksheet.addRow([]);
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6E6E6' }
  };

  // Add data
  attendance.forEach(record => {
    worksheet.addRow([
      new Date(record.attendance_date).toLocaleDateString(),
      record.staff_name,
      record.staff_role?.replace('_', ' ').toUpperCase(),
      record.check_in_time || '',
      record.check_out_time || '',
      record.total_hours || 0,
      record.status?.toUpperCase(),
      record.location || '',
      record.notes || ''
    ]);
  });

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      if (cell.value) {
        maxLength = Math.max(maxLength, cell.value.toString().length);
      }
    });
    column.width = Math.min(Math.max(maxLength + 2, 10), 50);
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${new Date().toISOString().split('T')[0]}.xlsx"`);

  await workbook.xlsx.write(res);
}

// PDF Generation Functions
async function generateTasksPDF(res, tasks, filters) {
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="tasks-report-${new Date().toISOString().split('T')[0]}.pdf"`);

  doc.pipe(res);

  // Header
  doc.fontSize(18).font('Helvetica-Bold').text('CA Office - Tasks Report', { align: 'center' });
  doc.moveDown();

  // Filters
  let filterText = 'Report Filters: ';
  if (filters.start_date) filterText += `From: ${filters.start_date} `;
  if (filters.end_date) filterText += `To: ${filters.end_date} `;
  if (filters.status && filters.status !== 'all') filterText += `Status: ${filters.status} `;
  
  doc.fontSize(10).font('Helvetica').text(filterText);
  doc.moveDown();

  // Summary
  doc.fontSize(12).font('Helvetica-Bold').text(`Total Tasks: ${tasks.length}`);
  doc.moveDown();

  // Tasks list
  tasks.forEach((task, index) => {
    if (index > 0 && index % 10 === 0) {
      doc.addPage();
    }

    doc.fontSize(10).font('Helvetica-Bold').text(`${task.id}. ${task.title}`);
    doc.fontSize(9).font('Helvetica')
       .text(`Client: ${task.client_name} | Status: ${task.status?.toUpperCase()} | Priority: ${task.priority?.toUpperCase()}`)
       .text(`Type: ${task.task_type?.toUpperCase()} | Amount: ₹${task.amount || 0}`)
       .text(`Due: ${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Not set'} | Assigned: ${task.assigned_to_name || 'Unassigned'}`);
    doc.moveDown();
  });

  doc.end();
}

async function generateBillingPDF(res, invoices, receipts, filters) {
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="billing-report-${new Date().toISOString().split('T')[0]}.pdf"`);

  doc.pipe(res);

  // Header
  doc.fontSize(18).font('Helvetica-Bold').text('CA Office - Billing Report', { align: 'center' });
  doc.moveDown();

  // Summary
  const totalBilled = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0);
  const totalReceived = invoices.reduce((sum, inv) => sum + parseFloat(inv.received_amount), 0);
  const totalPending = invoices.reduce((sum, inv) => sum + parseFloat(inv.pending_amount), 0);

  doc.fontSize(12).font('Helvetica-Bold')
     .text(`Total Invoices: ${invoices.length}`)
     .text(`Total Billed: ₹${totalBilled.toLocaleString()}`)
     .text(`Total Received: ₹${totalReceived.toLocaleString()}`)
     .text(`Total Pending: ₹${totalPending.toLocaleString()}`);
  doc.moveDown();

  // Outstanding invoices
  const outstanding = invoices.filter(inv => inv.status !== 'paid');
  if (outstanding.length > 0) {
    doc.fontSize(14).font('Helvetica-Bold').text('Outstanding Invoices:');
    doc.moveDown();

    outstanding.forEach(invoice => {
      doc.fontSize(10).font('Helvetica-Bold').text(`${invoice.invoice_number} - ${invoice.client_name}`);
      doc.fontSize(9).font('Helvetica')
         .text(`Amount: ₹${invoice.total_amount} | Pending: ₹${invoice.pending_amount} | Status: ${invoice.status?.toUpperCase()}`)
         .text(`Due: ${new Date(invoice.due_date).toLocaleDateString()}${invoice.days_overdue > 0 ? ` (${invoice.days_overdue} days overdue)` : ''}`);
      doc.moveDown();
    });
  }

  doc.end();
}

async function generateClientsPDF(res, clients, filters) {
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="clients-report-${new Date().toISOString().split('T')[0]}.pdf"`);

  doc.pipe(res);

  // Header
  doc.fontSize(18).font('Helvetica-Bold').text('CA Office - Clients Report', { align: 'center' });
  doc.moveDown();

  // Summary
  doc.fontSize(12).font('Helvetica-Bold').text(`Total Clients: ${clients.length}`);
  doc.moveDown();

  // Client list
  clients.forEach((client, index) => {
    if (index > 0 && index % 15 === 0) {
      doc.addPage();
    }

    doc.fontSize(10).font('Helvetica-Bold').text(`${client.id}. ${client.name}`);
    doc.fontSize(9).font('Helvetica')
       .text(`Company: ${client.company || 'Individual'} | Type: ${client.client_type?.toUpperCase()}`)
       .text(`Email: ${client.email || 'Not provided'} | Phone: ${client.phone || 'Not provided'}`)
       .text(`Tasks: ${client.total_tasks} (${client.completed_tasks} completed) | Billed: ₹${client.total_billed || 0}`);
    doc.moveDown();
  });

  doc.end();
}

async function generateAttendancePDF(res, attendance, filters) {
  const doc = new PDFDocument({ margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${new Date().toISOString().split('T')[0]}.pdf"`);

  doc.pipe(res);

  // Header
  doc.fontSize(18).font('Helvetica-Bold').text('CA Office - Attendance Report', { align: 'center' });
  doc.moveDown();

  // Summary
  doc.fontSize(12).font('Helvetica-Bold').text(`Total Records: ${attendance.length}`);
  doc.moveDown();

  // Group by staff
  const groupedData = {};
  attendance.forEach(record => {
    if (!groupedData[record.staff_name]) {
      groupedData[record.staff_name] = [];
    }
    groupedData[record.staff_name].push(record);
  });

  Object.keys(groupedData).forEach(staffName => {
    doc.fontSize(12).font('Helvetica-Bold').text(`${staffName}:`);
    doc.moveDown(0.5);

    groupedData[staffName].forEach(record => {
      doc.fontSize(9).font('Helvetica')
         .text(`${new Date(record.attendance_date).toLocaleDateString()} - ${record.status?.toUpperCase()}`)
         .text(`In: ${record.check_in_time || 'N/A'} | Out: ${record.check_out_time || 'N/A'} | Hours: ${record.total_hours || 0}`);
    });
    doc.moveDown();
  });

  doc.end();
}

module.exports = router;