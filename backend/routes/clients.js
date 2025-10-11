const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const fileExtension = file.originalname.toLowerCase().substr(file.originalname.lastIndexOf('.'));
    
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Get all clients (filtered by firm_id)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { firm_id, status, search } = req.query;
    
    let sql = 'SELECT c.*, f.firm_name FROM clients c LEFT JOIN firms f ON c.firm_id = f.id WHERE 1=1';
    const params = [];
    
    if (firm_id) {
      sql += ' AND c.firm_id = ?';
      params.push(firm_id);
    }
    
    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    } else {
      sql += ' AND c.status = "active"';
    }
    
    if (search) {
      sql += ' AND (c.name LIKE ? OR c.email LIKE ? OR c.company LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }
    
    sql += ' ORDER BY c.name ASC';
    
    const clients = await query(sql, params);
    res.json({ success: true, clients, data: clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single client
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const clients = await query('SELECT c.*, f.firm_name FROM clients c LEFT JOIN firms f ON c.firm_id = f.id WHERE c.id = ?', [req.params.id]);
    
    if (clients.length === 0) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    
    res.json({ success: true, client: clients[0], data: clients[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import clients from CSV/Excel
router.post('/import', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const { firm_id } = req.body;
  
  if (!firm_id) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, message: 'Firm ID is required' });
  }

  const filePath = req.file.path;
  const clients = [];
  let imported = 0;
  let errors = [];

  try {
    // Read CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          // Clean up the row data
          const cleanRow = {};
          Object.keys(row).forEach(key => {
            cleanRow[key.trim().toLowerCase()] = row[key]?.trim() || '';
          });
          
          // Map CSV columns to database fields
          const client = {
            name: cleanRow.name || cleanRow.client_name || '',
            email: cleanRow.email || '',
            phone: cleanRow.phone || cleanRow.mobile || cleanRow.contact || '',
            company: cleanRow.company || cleanRow.organization || '',
            address: cleanRow.address || '',
            city: cleanRow.city || '',
            state: cleanRow.state || '',
            postal_code: cleanRow.postal_code || cleanRow.pincode || cleanRow.zip || '',
            pan_number: cleanRow.pan_number || cleanRow.pan || '',
            gstin: cleanRow.gstin || cleanRow.gst || '',
            client_type: cleanRow.client_type || cleanRow.type || 'individual',
            status: 'active'
          };

          if (client.name) {
            clients.push(client);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // Insert clients into database
    for (const client of clients) {
      try {
        // Check if client already exists in this firm
        const existing = await query(
          'SELECT id FROM clients WHERE email = ? AND email != "" AND firm_id = ?', 
          [client.email, firm_id]
        );

        if (existing.length === 0 || !client.email) {
          await query(`
            INSERT INTO clients (
              firm_id, name, email, phone, company, address, city, state,
              postal_code, pan_number, gstin, client_type, status, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            firm_id, client.name, client.email, client.phone, client.company,
            client.address, client.city, client.state, client.postal_code,
            client.pan_number, client.gstin, client.client_type, client.status, req.user.id
          ]);
          imported++;
        } else {
          errors.push(`Client with email ${client.email} already exists`);
        }
      } catch (dbError) {
        errors.push(`Error importing ${client.name}: ${dbError.message}`);
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      imported,
      total: clients.length,
      errors: errors.slice(0, 10) // Only show first 10 errors
    });

  } catch (error) {
    // Clean up uploaded file on error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    console.error('Import error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Import failed', 
      error: error.message 
    });
  }
});

// Create new client
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      firm_id, name, email, phone, company, address, city, state,
      postal_code, pan_number, gstin, client_type, status
    } = req.body;

    if (!firm_id) {
      return res.status(400).json({ success: false, message: 'Firm ID is required' });
    }

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    // Check if email already exists in this firm (if provided)
    if (email) {
      const existing = await query('SELECT id FROM clients WHERE email = ? AND firm_id = ?', [email, firm_id]);
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: 'Client with this email already exists' });
      }
    }

    const result = await query(`
      INSERT INTO clients (
        firm_id, name, email, phone, company, address, city, state,
        postal_code, pan_number, gstin, client_type, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      firm_id, name, email, phone, company, address, city, state,
      postal_code, pan_number, gstin, client_type || 'individual',
      status || 'active', req.user.id
    ]);

    res.json({
      success: true,
      message: 'Client created successfully',
      clientId: result.insertId,
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update client
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      name, email, phone, company, address, city, state,
      postal_code, pan_number, gstin, client_type, status
    } = req.body;

    // Check if email exists for other clients in the same firm (if email is being updated)
    if (email) {
      const [currentClient] = await query('SELECT firm_id FROM clients WHERE id = ?', [req.params.id]);
      
      if (currentClient) {
        const existing = await query(
          'SELECT id FROM clients WHERE email = ? AND id != ? AND firm_id = ?', 
          [email, req.params.id, currentClient.firm_id]
        );
        
        if (existing.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Email already exists for another client'
          });
        }
      }
    }

    await query(`
      UPDATE clients SET
        name = ?, email = ?, phone = ?, company = ?, address = ?,
        city = ?, state = ?, postal_code = ?, pan_number = ?,
        gstin = ?, client_type = ?, status = ?, updated_at = NOW()
      WHERE id = ?
    `, [
      name, email, phone, company, address, city, state,
      postal_code, pan_number, gstin, client_type, status, req.params.id
    ]);

    res.json({ success: true, message: 'Client updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete client
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Check if client has associated tasks
    const tasks = await query('SELECT COUNT(*) as count FROM tasks WHERE client_id = ?', [req.params.id]);
    
    if (tasks[0].count > 0) {
      // Soft delete if has tasks
      await query('UPDATE clients SET status = "inactive" WHERE id = ?', [req.params.id]);
      return res.json({ success: true, message: 'Client marked as inactive' });
    }

    // Hard delete if no tasks
    await query('DELETE FROM clients WHERE id = ?', [req.params.id]);
    
    res.json({ success: true, message: 'Client deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;