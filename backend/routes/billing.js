const express = require('express');
const { query } = require('../config/database');
const { requireAuth, authenticateToken } = require('../middleware/auth');
const { validationResult, body, param, query: queryValidator } = require('express-validator');
const PDFDocument = require('pdfkit');
const router = express.Router();

// Validation middleware
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

// Generate invoice number - FIXED: SQLite compatible
async function generateInvoiceNumber(firmId) {
  if (firmId) {
    const lastInvoice = await query(
      'SELECT invoice_number FROM invoices WHERE firm_id = ? ORDER BY id DESC LIMIT 1',
      [firmId]
    );

    if (lastInvoice.length === 0) {
      return `INV-${firmId}-0001`;
    }

    const lastNumber = parseInt(lastInvoice[0].invoice_number.split('-').pop());
    const newNumber = (lastNumber + 1).toString().padStart(4, '0');
    return `INV-${firmId}-${newNumber}`;
  } else {
    const invoiceDate = new Date();
    const year = invoiceDate.getFullYear();
    // FIXED: SQLite compatible YEAR function
    const invoiceCount = await query('SELECT COUNT(*) as count FROM invoices WHERE strftime(\'%Y\', created_at) = ?', [year.toString()]);
    return `INV-${year}-${String(invoiceCount[0].count + 1).padStart(4, '0')}`;
  }
}

// Enhanced Get all invoices with improved status calculation - FIXED: SQLite compatible
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      firm_id, start_date, end_date, status, client_id, min_amount, max_amount,
      overdue_only, sort_by = 'created_at', sort_order = 'DESC',
      page = 1, limit = 20
    } = req.query;

    let sql = `
      SELECT i.id, i.invoice_number, i.client_id, i.task_id, i.invoice_date,
             i.due_date, i.amount, i.tax_amount, i.discount_amount, i.discount_type,
             i.discount_reason, i.total_amount, i.firm_id,
             i.payment_terms, i.notes, i.created_at, i.updated_at,
             c.name as client_name, c.company as client_company,
             c.email as client_email, c.phone as client_phone,
             t.title as task_title, t.task_type,
             f.firm_name,
             COALESCE(SUM(r.amount + COALESCE(r.discount_amount, 0)), 0) as received_amount,
             (i.total_amount - COALESCE(SUM(r.amount + COALESCE(r.discount_amount, 0)), 0)) as pending_amount,
             CASE 
               WHEN COALESCE(SUM(r.amount + COALESCE(r.discount_amount, 0)), 0) = 0 THEN 'pending'
               WHEN COALESCE(SUM(r.amount + COALESCE(r.discount_amount, 0)), 0) >= i.total_amount THEN 'paid'
               ELSE 'partially_paid'
             END as computed_status,
             CASE WHEN i.due_date < DATE('now') AND COALESCE(SUM(r.amount + COALESCE(r.discount_amount, 0)), 0) < i.total_amount
                  THEN CAST(julianday('now') - julianday(i.due_date) as INTEGER) ELSE 0 END as days_overdue
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN tasks t ON i.task_id = t.id
      LEFT JOIN firms f ON i.firm_id = f.id
      LEFT JOIN receipts r ON i.id = r.invoice_id 
      WHERE 1=1`;

    const params = [];
    
    if (firm_id) {
      sql += ' AND i.firm_id = ?';
      params.push(firm_id);
    }
    
    if (start_date) { sql += ' AND i.invoice_date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND i.invoice_date <= ?'; params.push(end_date); }
    
    if (status && status !== 'all') {
      if (status === 'overdue') {
        sql += " AND i.due_date < DATE('now')";
      } else {
        // We'll filter by computed status after grouping
        sql += ' AND ? = ?'; // Placeholder, will be replaced
        params.push(status, status);
      }
    }
    
    if (client_id && client_id !== 'all') { sql += ' AND i.client_id = ?'; params.push(parseInt(client_id)); }
    if (min_amount && parseFloat(min_amount) > 0) { sql += ' AND i.total_amount >= ?'; params.push(parseFloat(min_amount)); }
    if (max_amount && parseFloat(max_amount) > 0) { sql += ' AND i.total_amount <= ?'; params.push(parseFloat(max_amount)); }
    if (overdue_only === 'true') { sql += " AND i.due_date < DATE('now')"; }

    sql += ' GROUP BY i.id';
    
    // Add HAVING clause for computed status filtering
    if (status && status !== 'all' && status !== 'overdue') {
      sql += ` HAVING computed_status = '${status}'`;
      // Remove the placeholder params
      params.splice(-2, 2);
    }
    
    if (status === 'overdue') {
      sql += ' HAVING computed_status != \'paid\' AND days_overdue > 0';
    }
    
    const allowedSortColumns = { 
      'invoice_date': 'i.invoice_date', 
      'due_date': 'i.due_date', 
      'total_amount': 'i.total_amount', 
      'client_name': 'c.name', 
      'status': 'computed_status', 
      'created_at': 'i.created_at', 
      'days_overdue': 'days_overdue', 
      'pending_amount': 'pending_amount' 
    };
    const sortColumn = allowedSortColumns[sort_by] || 'i.created_at';
    const sortDirection = ['ASC', 'DESC'].includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'DESC';
    sql += ` ORDER BY ${sortColumn} ${sortDirection}`;

    const limitVal = parseInt(limit);
    const offsetVal = (parseInt(page) - 1) * limitVal;
    sql += ` LIMIT ${limitVal} OFFSET ${offsetVal}`;

    const invoices = await query(sql, params);

    // Enhanced count query with same filtering logic
    let countSql = `
      SELECT COUNT(DISTINCT i.id) as total 
      FROM invoices i
      LEFT JOIN receipts r ON i.id = r.invoice_id
      WHERE 1=1`;
    const countParams = [];
    
    if (firm_id) { countSql += ' AND i.firm_id = ?'; countParams.push(firm_id); }
    if (start_date) { countSql += ' AND i.invoice_date >= ?'; countParams.push(start_date); }
    if (end_date) { countSql += ' AND i.invoice_date <= ?'; countParams.push(end_date); }
    if (client_id && client_id !== 'all') { countSql += ' AND i.client_id = ?'; countParams.push(parseInt(client_id)); }

    const countResult = await query(countSql, countParams);
    const total = countResult[0].total;

    // Map computed_status to status for consistent API response
    const processedInvoices = invoices.map(invoice => ({
      ...invoice,
      status: invoice.computed_status
    }));

    res.json({
      success: true, 
      invoices: processedInvoices,
      data: processedInvoices,
      pagination: { 
        current_page: parseInt(page), 
        per_page: limitVal, 
        total, 
        total_pages: Math.ceil(total / limitVal) 
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single invoice (enhanced)
router.get('/invoices/:id', authenticateToken, async (req, res) => {
  try {
    const invoices = await query(`
      SELECT i.*, c.name as client_name, t.title as task_title, f.firm_name,
             COALESCE(SUM(r.amount + COALESCE(r.discount_amount, 0)), 0) as paid_amount,
             (i.total_amount - COALESCE(SUM(r.amount + COALESCE(r.discount_amount, 0)), 0)) as pending_amount,
             CASE 
               WHEN COALESCE(SUM(r.amount + COALESCE(r.discount_amount, 0)), 0) = 0 THEN 'pending'
               WHEN COALESCE(SUM(r.amount + COALESCE(r.discount_amount, 0)), 0) >= i.total_amount THEN 'paid'
               ELSE 'partially_paid'
             END as computed_status
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN tasks t ON i.task_id = t.id
      LEFT JOIN firms f ON i.firm_id = f.id
      LEFT JOIN receipts r ON i.id = r.invoice_id
      WHERE i.id = ?
      GROUP BY i.id
    `, [req.params.id]);

    if (invoices.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const processedInvoice = {
      ...invoices[0],
      status: invoices[0].computed_status
    };

    res.json({ success: true, data: processedInvoice, invoice: processedInvoice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create invoice from task with multi-firm support
router.post('/create-from-task', authenticateToken, async (req, res) => {
  try {
    const { 
      task_id, firm_id, amount, tax_rate = 18, discount_amount = 0, 
      discount_type = 'fixed', discount_reason = '',
      due_date, payment_terms, notes 
    } = req.body;
    
    const tasks = await query('SELECT * FROM tasks WHERE id = ?', [task_id]);
    if (tasks.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    
    const task = tasks[0];
    const existing = await query('SELECT id FROM invoices WHERE task_id = ?', [task_id]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Invoice already exists for this task' });
    }

    const taskFirmId = task.firm_id || firm_id;
    
    if (firm_id && taskFirmId && taskFirmId != firm_id) {
      return res.status(400).json({ success: false, message: 'Task does not belong to selected firm' });
    }
    
    const invoiceNumber = await generateInvoiceNumber(taskFirmId);
    
    const baseAmount = parseFloat(amount || task.amount || 0);
    const taxAmount = (baseAmount * parseFloat(tax_rate)) / 100;
    const discountValue = parseFloat(discount_amount || 0);
    const totalAmount = baseAmount + taxAmount - discountValue;
    
    const invoiceDate = new Date();
    
    const result = await query(`
      INSERT INTO invoices (
        firm_id, invoice_number, client_id, task_id, invoice_date, due_date, 
        amount, tax_amount, discount_amount, discount_type, discount_reason,
        total_amount, payment_terms, notes, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `, [
      taskFirmId, invoiceNumber, task.client_id, task_id, invoiceDate, 
      due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 
      baseAmount, taxAmount, discountValue, discount_type, discount_reason,
      totalAmount, payment_terms || 'Net 30 days', 
      notes || `Invoice for ${task.title}`, req.user?.id || 1
    ]);

    // Update task status to invoiced
    await query('UPDATE tasks SET status = ? WHERE id = ?', ['invoiced', task_id]);
    
    if (req.auditLogger) {
      await req.auditLogger('CREATE', 'invoice', result.insertId, null, {
        invoice_number: invoiceNumber,
        task_id,
        firm_id: taskFirmId,
        total_amount: totalAmount,
        discount_amount: discountValue
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Invoice created from task successfully', 
      invoice_id: result.insertId, 
      invoice_number: invoiceNumber,
      data: { id: result.insertId, invoice_number: invoiceNumber }
    });
  } catch (error) {
    console.error('Error creating invoice from task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new invoice (direct creation)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { firm_id, client_id, task_id, amount, tax_amount, total_amount, 
            due_date, payment_terms, notes, discount_amount, discount_type, discount_reason } = req.body;

    if (!firm_id) {
      return res.status(400).json({ success: false, message: 'Firm ID is required' });
    }

    const clients = await query('SELECT firm_id FROM clients WHERE id = ?', [client_id]);
    if (clients.length > 0 && clients[0].firm_id != firm_id) {
      return res.status(400).json({ success: false, message: 'Client does not belong to selected firm' });
    }

    const invoice_number = await generateInvoiceNumber(firm_id);
    const invoiceDate = new Date();

    const result = await query(`
      INSERT INTO invoices (firm_id, invoice_number, client_id, task_id, invoice_date, amount, 
                           tax_amount, discount_amount, discount_type, discount_reason,
                           total_amount, due_date, payment_terms, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [firm_id, invoice_number, client_id, task_id, invoiceDate, amount, tax_amount, 
        discount_amount || 0, discount_type || 'fixed', discount_reason || '',
        total_amount, due_date, payment_terms, notes, req.user?.id || 1]);

    res.json({ 
      success: true, 
      data: { id: result.insertId, invoice_number }, 
      message: 'Invoice created successfully' 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update invoice (enhanced)
router.put('/invoices/:id', authenticateToken, async (req, res) => {
  try {
    const { amount, tax_amount, total_amount, status, due_date, payment_terms, notes,
            discount_amount, discount_type, discount_reason } = req.body;

    const oldInvoice = await query('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    
    // Don't update status here if not provided - let computed status handle it
    const updateFields = [];
    const updateParams = [];

    if (amount !== undefined) { updateFields.push('amount = ?'); updateParams.push(amount); }
    if (tax_amount !== undefined) { updateFields.push('tax_amount = ?'); updateParams.push(tax_amount); }
    if (discount_amount !== undefined) { updateFields.push('discount_amount = ?'); updateParams.push(discount_amount || 0); }
    if (discount_type !== undefined) { updateFields.push('discount_type = ?'); updateParams.push(discount_type || 'fixed'); }
    if (discount_reason !== undefined) { updateFields.push('discount_reason = ?'); updateParams.push(discount_reason || ''); }
    if (total_amount !== undefined) { updateFields.push('total_amount = ?'); updateParams.push(total_amount); }
    if (due_date !== undefined) { updateFields.push('due_date = ?'); updateParams.push(due_date); }
    if (payment_terms !== undefined) { updateFields.push('payment_terms = ?'); updateParams.push(payment_terms); }
    if (notes !== undefined) { updateFields.push('notes = ?'); updateParams.push(notes); }

    // Only update status if explicitly provided (for manual overrides)
    if (status !== undefined) {
      const paid_date = status === 'paid' ? new Date() : null;
      updateFields.push('status = ?', 'paid_date = ?');
      updateParams.push(status, paid_date);
    }

    if (updateFields.length > 0) {
      updateFields.push("updated_at = DATETIME('now')");
      updateParams.push(req.params.id);

      await query(`UPDATE invoices SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);
    }

    if (req.auditLogger && oldInvoice.length > 0) {
      await req.auditLogger('UPDATE', 'invoice', req.params.id, oldInvoice[0], {
        amount, tax_amount, total_amount, status
      });
    }

    res.json({ success: true, message: 'Invoice updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update invoice status (enhanced with auto-calculation awareness)
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const invoiceId = req.params.id;
    
    const oldInvoice = await query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    
    // Check current payment status to warn about conflicts
    const paymentCheck = await query(`
      SELECT COALESCE(SUM(amount + COALESCE(discount_amount, 0)), 0) as total_paid,
             i.total_amount
      FROM invoices i
      LEFT JOIN receipts r ON i.id = r.invoice_id
      WHERE i.id = ?
      GROUP BY i.id
    `, [invoiceId]);

    if (paymentCheck.length > 0) {
      const { total_paid, total_amount } = paymentCheck[0];
      const computedStatus = total_paid >= total_amount ? 'paid' : (total_paid > 0 ? 'partially_paid' : 'pending');
      
      if (status !== computedStatus) {
        console.warn(`Status mismatch: Manual status '${status}' vs computed status '${computedStatus}' for invoice ${invoiceId}`);
      }
    }
    
    const paid_date = status === 'paid' ? new Date() : null;
    
    await query("UPDATE invoices SET status = ?, paid_date = ?, updated_at = DATETIME('now') WHERE id = ?", 
                [status, paid_date, invoiceId]);
    
    if (req.auditLogger && oldInvoice.length > 0) {
      await req.auditLogger('UPDATE', 'invoice', invoiceId, 
        { status: oldInvoice[0].status }, 
        { status }
      );
    }
    
    res.json({ success: true, message: 'Invoice status updated' });
  } catch (error) {
    console.error('Error updating invoice status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete Invoice
router.delete('/invoices/:id', authenticateToken, async (req, res) => {
  try {
    const invoiceId = req.params.id;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can delete invoices'
      });
    }

    const receiptCheck = await query('SELECT COUNT(*) as count FROM receipts WHERE invoice_id = ?', [invoiceId]);
    
    if (receiptCheck[0].count > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete invoice with payments' });
    }

    const invoices = await query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (invoices.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    const invoice = invoices[0];

    // Update task status back to completed if it exists
    if (invoice.task_id) {
      await query('UPDATE tasks SET status = ? WHERE id = ?', ['completed', invoice.task_id]);
    }

    await query('DELETE FROM invoices WHERE id = ?', [invoiceId]);

    if (req.auditLogger) {
      await req.auditLogger('DELETE', 'invoice', invoiceId, invoice, {
        deleted_by: req.user.id,
        reason: 'Admin deletion'
      });
    }

    res.json({
      success: true,
      message: `Invoice ${invoice.invoice_number} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enhanced Create receipt with improved status auto-update - FIXED: SQLite compatible
router.post('/invoices/:id/receipts', authenticateToken, async (req, res) => {
  try {
    const { 
      amount, payment_method, receipt_date, payment_reference, 
      notes, discount_amount = 0 
    } = req.body;
    const invoiceId = req.params.id;

    const invoices = await query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    if (invoices.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const invoice = invoices[0];
    const receipts = await query(
      'SELECT COALESCE(SUM(amount + COALESCE(discount_amount, 0)), 0) as total_paid FROM receipts WHERE invoice_id = ?',
      [invoiceId]
    );
    const totalPaid = parseFloat(receipts[0].total_paid);
    const pendingAmount = parseFloat(invoice.total_amount) - totalPaid;
    const receiptAmount = parseFloat(amount);
    const discountValue = parseFloat(discount_amount || 0);

    if (receiptAmount + discountValue > pendingAmount) {
      return res.status(400).json({
        success: false,
        message: `Total (amount + discount) cannot exceed pending amount of ₹${pendingAmount.toFixed(2)}`
      });
    }

    const year = new Date().getFullYear();
    // FIXED: SQLite compatible YEAR function
    const latestReceipt = await query(
      'SELECT receipt_number FROM receipts WHERE strftime(\'%Y\', created_at) = ? ORDER BY id DESC LIMIT 1', 
      [year.toString()]
    );
    let receiptNumber = `RCP-${year}-0001`;
    
    if (latestReceipt.length > 0) {
      const lastNumber = parseInt(latestReceipt[0].receipt_number.split('-')[2]);
      receiptNumber = `RCP-${year}-${String(lastNumber + 1).padStart(4, '0')}`;
    }

    const result = await query(`
      INSERT INTO receipts (
        firm_id, receipt_number, invoice_id, amount, discount_amount, payment_method,
        receipt_date, payment_reference, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      invoice.firm_id, receiptNumber, invoiceId, receiptAmount, discountValue, payment_method,
      receipt_date || new Date(), payment_reference, notes, req.user?.id || 1
    ]);

    // Auto-update invoice status based on payments
    const newTotalPaid = totalPaid + receiptAmount + discountValue;
    const totalAmount = parseFloat(invoice.total_amount);

    let newStatus = 'pending';
    let paidDate = null;

    if (newTotalPaid >= totalAmount) {
      newStatus = 'paid';
      paidDate = new Date();
    } else if (newTotalPaid > 0) {
      newStatus = 'partially_paid';
    }

    await query("UPDATE invoices SET status = ?, paid_date = ?, updated_at = DATETIME('now') WHERE id = ?", 
                [newStatus, paidDate, invoiceId]);

    if (req.auditLogger) {
      await req.auditLogger('CREATE', 'receipt', result.insertId, null, {
        receipt_number: receiptNumber,
        invoice_id: invoiceId,
        amount: receiptAmount,
        discount_amount: discountValue,
        new_invoice_status: newStatus
      });
    }

    res.json({
      success: true,
      message: 'Receipt created successfully',
      receiptId: result.insertId,
      receipt_number: receiptNumber,
      invoice_status: newStatus,
      data: { id: result.insertId, receipt_number: receiptNumber }
    });
  } catch (error) {
    console.error('Error creating receipt:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enhanced Delete Receipt with auto-status update
router.delete('/receipts/:id', authenticateToken, async (req, res) => {
  try {
    const receiptId = req.params.id;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can delete receipts'
      });
    }

    const receipts = await query('SELECT * FROM receipts WHERE id = ?', [receiptId]);
    if (receipts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Receipt not found'
      });
    }

    const receipt = receipts[0];
    const invoiceId = receipt.invoice_id;

    await query('DELETE FROM receipts WHERE id = ?', [receiptId]);

    // Recalculate invoice status after receipt deletion
    const remainingReceipts = await query(
      'SELECT COALESCE(SUM(amount + COALESCE(discount_amount, 0)), 0) as total_paid FROM receipts WHERE invoice_id = ?',
      [invoiceId]
    );

    const invoice = await query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    const totalPaid = parseFloat(remainingReceipts[0].total_paid);
    const totalAmount = parseFloat(invoice[0].total_amount);

    let newStatus = 'pending';
    let paidDate = null;

    if (totalPaid >= totalAmount) {
      newStatus = 'paid';
      paidDate = new Date();
    } else if (totalPaid > 0) {
      newStatus = 'partially_paid';
    }

    await query("UPDATE invoices SET status = ?, paid_date = ?, updated_at = DATETIME('now') WHERE id = ?", 
                [newStatus, paidDate, invoiceId]);

    if (req.auditLogger) {
      await req.auditLogger('DELETE', 'receipt', receiptId, receipt, {
        deleted_by: req.user.id,
        invoice_id: invoiceId,
        new_invoice_status: newStatus
      });
    }

    res.json({
      success: true,
      message: `Receipt ${receipt.receipt_number} deleted successfully. Invoice status updated to: ${newStatus}`
    });
  } catch (error) {
    console.error('Error deleting receipt:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enhanced Get receipts
router.get('/receipts', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, client_id, firm_id, invoice_id, sort_by = 'receipt_date', sort_order = 'DESC' } = req.query;
    
    let sql = `
      SELECT r.*, i.invoice_number, i.total_amount as invoice_amount,
             c.name as client_name, c.company as client_company, f.firm_name
      FROM receipts r 
      LEFT JOIN invoices i ON r.invoice_id = i.id 
      LEFT JOIN clients c ON i.client_id = c.id 
      LEFT JOIN firms f ON r.firm_id = f.id
      WHERE 1=1
    `;
    const params = [];
    
    if (firm_id) { sql += ' AND r.firm_id = ?'; params.push(firm_id); }
    if (invoice_id) { sql += ' AND r.invoice_id = ?'; params.push(invoice_id); }
    if (start_date) { sql += ' AND r.receipt_date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND r.receipt_date <= ?'; params.push(end_date); }
    if (client_id && client_id !== 'all') { sql += ' AND c.id = ?'; params.push(client_id); }
    
    const allowedSortColumns = { 
      'receipt_date': 'r.receipt_date', 
      'amount': 'r.amount', 
      'client_name': 'c.name' 
    };
    const sortColumn = allowedSortColumns[sort_by] || 'r.receipt_date';
    const sortDirection = ['ASC', 'DESC'].includes(sort_order.toUpperCase()) ? sort_order.toUpperCase() : 'DESC';
    sql += ` ORDER BY ${sortColumn} ${sortDirection}`;
    
    const receipts = await query(sql, params);
    res.json({ success: true, receipts, data: receipts });
  } catch (error) {
    console.error('Error fetching receipts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Print Invoice PDF (preserved)
router.get('/invoices/:id/print', authenticateToken, async (req, res) => {
  try {
    const invoices = await query(`
      SELECT 
        i.*,
        c.name as client_name, c.company as client_company,
        c.email as client_email, c.phone as client_phone,
        c.address as client_address, c.gstin as client_gstin,
        c.city as client_city, c.state as client_state,
        c.postal_code as client_postal_code,
        t.title as task_title, t.description as task_description,
        f.firm_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN tasks t ON i.task_id = t.id
      LEFT JOIN firms f ON i.firm_id = f.id
      WHERE i.id = ?
    `, [req.params.id]);

    if (invoices.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const invoice = invoices[0];
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoice_number}.pdf`);
    doc.pipe(res);

    doc.fontSize(24).text('INVOICE', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(12).text(invoice.firm_name || 'CA Office Pro', { align: 'left' });
    doc.fontSize(10).text('Professional CA Services');
    doc.text('Email: admin@ca-office.com | Phone: +91-XXXXXXXXXX');
    doc.moveDown();

    doc.fontSize(10);
    doc.text(`Invoice #: ${invoice.invoice_number}`, { align: 'right' });
    doc.text(`Date: ${new Date(invoice.invoice_date || invoice.created_at).toLocaleDateString()}`, { align: 'right' });
    doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, { align: 'right' });
    doc.text(`Status: ${invoice.status.toUpperCase()}`, { align: 'right' });
    doc.moveDown();

    doc.fontSize(12).text('BILL TO:', { underline: true });
    doc.fontSize(10);
    doc.text(invoice.client_company || invoice.client_name);
    if (invoice.client_address) doc.text(invoice.client_address);
    if (invoice.client_city) doc.text(`${invoice.client_city}${invoice.client_state ? ', ' + invoice.client_state : ''}${invoice.client_postal_code ? ' - ' + invoice.client_postal_code : ''}`);
    if (invoice.client_email) doc.text(`Email: ${invoice.client_email}`);
    if (invoice.client_phone) doc.text(`Phone: ${invoice.client_phone}`);
    if (invoice.client_gstin) doc.text(`GSTIN: ${invoice.client_gstin}`);
    doc.moveDown(2);

    const tableTop = doc.y;
    doc.fontSize(10).text('Description', 50, tableTop, { width: 250 });
    doc.text('Amount', 400, tableTop, { width: 80, align: 'right' });
    doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).stroke();

    let y = tableTop + 30;
    doc.text(invoice.task_title || 'Professional Services', 50, y, { width: 250 });
    doc.text(`₹${parseFloat(invoice.amount).toFixed(2)}`, 400, y, { width: 80, align: 'right' });

    y += 25;
    doc.text('Tax/GST', 50, y);
    doc.text(`₹${parseFloat(invoice.tax_amount).toFixed(2)}`, 400, y, { width: 80, align: 'right' });

    if (invoice.discount_amount > 0) {
      y += 25;
      doc.text(`Discount${invoice.discount_reason ? ' (' + invoice.discount_reason + ')' : ''}`, 50, y);
      doc.text(`-₹${parseFloat(invoice.discount_amount).toFixed(2)}`, 400, y, { width: 80, align: 'right' });
    }

    y += 30;
    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 10;
    doc.fontSize(12).text('TOTAL AMOUNT', 50, y, { bold: true });
    doc.text(`₹${parseFloat(invoice.total_amount).toFixed(2)}`, 400, y, { width: 80, align: 'right', bold: true });

    if (invoice.payment_terms) {
      doc.moveDown(2);
      doc.fontSize(10).text('Payment Terms:', { underline: true });
      doc.text(invoice.payment_terms);
    }

    if (invoice.notes) {
      doc.moveDown(2);
      doc.fontSize(10).text('Notes:', { underline: true });
      doc.text(invoice.notes);
    }

    doc.moveDown(3);
    doc.fontSize(8).text('Thank you for your business!', { align: 'center' });
    doc.end();

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Print Receipt PDF (preserved)
router.get('/receipts/:id/print', authenticateToken, async (req, res) => {
  try {
    const receipts = await query(`
      SELECT 
        r.*, i.invoice_number, i.total_amount as invoice_total,
        c.name as client_name, c.company as client_company,
        c.address as client_address, c.city as client_city,
        c.state as client_state, c.postal_code as client_postal_code,
        f.firm_name
      FROM receipts r
      LEFT JOIN invoices i ON r.invoice_id = i.id
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN firms f ON r.firm_id = f.id
      WHERE r.id = ?
    `, [req.params.id]);

    if (receipts.length === 0) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    const receipt = receipts[0];
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${receipt.receipt_number}.pdf`);
    doc.pipe(res);

    doc.fontSize(24).text('PAYMENT RECEIPT', { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(receipt.firm_name || 'CA Office Pro');
    doc.fontSize(10).text('Professional CA Services');
    doc.text('Email: admin@ca-office.com | Phone: +91-XXXXXXXXXX');
    doc.moveDown();

    doc.fontSize(10);
    doc.text(`Receipt #: ${receipt.receipt_number}`, { align: 'right' });
    doc.text(`Date: ${new Date(receipt.receipt_date).toLocaleDateString()}`, { align: 'right' });
    doc.text(`Invoice #: ${receipt.invoice_number}`, { align: 'right' });
    doc.moveDown();

    doc.fontSize(12).text('RECEIVED FROM:', { underline: true });
    doc.fontSize(10);
    doc.text(receipt.client_company || receipt.client_name);
    if (receipt.client_address) doc.text(receipt.client_address);
    if (receipt.client_city) doc.text(`${receipt.client_city}${receipt.client_state ? ', ' + receipt.client_state : ''}${receipt.client_postal_code ? ' - ' + receipt.client_postal_code : ''}`);
    doc.moveDown(2);

    doc.fontSize(12).text('PAYMENT DETAILS:', { underline: true });
    doc.fontSize(10);
    doc.text(`Amount Received: ₹${parseFloat(receipt.amount).toFixed(2)}`);
    if (receipt.discount_amount > 0) {
      doc.text(`Discount Applied: ₹${parseFloat(receipt.discount_amount).toFixed(2)}`);
      doc.text(`Total: ₹${(parseFloat(receipt.amount) + parseFloat(receipt.discount_amount)).toFixed(2)}`);
    }
    doc.text(`Payment Method: ${receipt.payment_method.toUpperCase().replace('_', ' ')}`);
    if (receipt.payment_reference) doc.text(`Reference: ${receipt.payment_reference}`);
    if (receipt.notes) doc.text(`Notes: ${receipt.notes}`);
    doc.moveDown(3);

    doc.text('_____________________', { align: 'right' });
    doc.text('Authorized Signature', { align: 'right' });
    doc.end();

  } catch (error) {
    console.error('Error generating receipt PDF:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Enhanced Get billing stats - FIXED: SQLite compatible
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { firm_id } = req.query;
    
    let sql = `
      SELECT
        COUNT(DISTINCT i.id) as total_invoices,
        SUM(CASE
          WHEN COALESCE(r_sum.total_received, 0) = 0 THEN i.total_amount
          WHEN COALESCE(r_sum.total_received, 0) < i.total_amount THEN (i.total_amount - COALESCE(r_sum.total_received, 0))
          ELSE 0
        END) as pending_amount,
        SUM(COALESCE(r_sum.total_received, 0)) as paid_amount,
        SUM(i.total_amount) as total_billed,
        COUNT(CASE WHEN i.due_date < DATE('now') AND COALESCE(r_sum.total_received, 0) < i.total_amount THEN 1 END) as overdue_invoices,
        SUM(CASE WHEN i.due_date < DATE('now') AND COALESCE(r_sum.total_received, 0) < i.total_amount THEN (i.total_amount - COALESCE(r_sum.total_received, 0)) ELSE 0 END) as overdue_amount,
        AVG(i.total_amount) as avg_invoice_amount,
        (SELECT SUM(r2.amount) FROM receipts r2 
         INNER JOIN invoices i2 ON r2.invoice_id = i2.id 
         WHERE strftime('%m', r2.receipt_date) = strftime('%m', 'now') 
         AND strftime('%Y', r2.receipt_date) = strftime('%Y', 'now')
         ${firm_id ? 'AND r2.firm_id = ?' : ''}) as period_revenue
      FROM invoices i
      LEFT JOIN (
        SELECT invoice_id, SUM(amount + COALESCE(discount_amount, 0)) as total_received
        FROM receipts GROUP BY invoice_id
      ) r_sum ON i.id = r_sum.invoice_id
      WHERE 1=1
    `;
    
    const params = [];
    if (firm_id) {
      sql += ' AND i.firm_id = ?';
      params.push(firm_id);
      params.push(firm_id);
    }

    const baseStatsResult = await query(sql, params);

    const stats = {
      ...baseStatsResult[0],
      collection_rate: baseStatsResult[0].total_billed > 0
        ? Math.round((baseStatsResult[0].paid_amount * 100) / baseStatsResult[0].total_billed)
        : 0
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching billing stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;