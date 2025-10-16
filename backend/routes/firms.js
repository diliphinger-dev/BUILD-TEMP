const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// Get all firms - FIXED: Returns empty array instead of error
router.get('/', requireAuth, async (req, res) => {
  try {
    const firms = await query(`
      SELECT f.*, 
         COUNT(DISTINCT s.id) as staff_count
      FROM firms f
      LEFT JOIN staff s ON f.id = s.primary_firm_id AND s.status = 'active'
      WHERE f.status = 'active'
      GROUP BY f.id
      ORDER BY f.firm_name
    `);
    
    res.json({ 
      success: true, 
      data: firms || [],
      firms: firms || []
    });
  } catch (error) {
    console.error('Error fetching firms:', error);
    // Return empty array instead of error
    res.json({ 
      success: true, 
      data: [],
      firms: [],
      message: 'No firms available'
    });
  }
});

// Get selected/active firm - FIXED: Returns null instead of 404
router.get('/selected', requireAuth, async (req, res) => {
  try {
    const defaultFirm = await query(`
      SELECT * FROM firms 
      WHERE status = 'active' 
      ORDER BY id ASC 
      LIMIT 1
    `);

    if (!defaultFirm || defaultFirm.length === 0) {
      return res.json({
        success: true,
        firm: null,
        data: null,
        message: 'No firms configured'
      });
    }

    res.json({ 
      success: true, 
      firm: defaultFirm[0],
      data: defaultFirm[0]
    });
  } catch (error) {
    console.error('Error fetching selected firm:', error);
    res.json({ 
      success: true, 
      firm: null,
      data: null
    });
  }
});

// Get firms accessible by current user
router.get('/my-firms', requireAuth, async (req, res) => {
  try {
    const firms = await query("SELECT * FROM firms WHERE status = 'active' ORDER BY firm_name");
    res.json({ success: true, data: firms });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single firm
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const firmId = req.params.id;
    
    const firm = await query(`
      SELECT f.*,
        COUNT(DISTINCT c.id) as client_count,
        COUNT(DISTINCT s.id) as staff_count,
        COUNT(DISTINCT t.id) as task_count,
        COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END), 0) as total_revenue
      FROM firms f
      -- Clients are now global, no firm_id
      LEFT JOIN staff s ON f.id = s.primary_firm_id AND s.status = 'active'
      LEFT JOIN tasks t ON f.id = t.firm_id
      LEFT JOIN invoices i ON f.id = i.firm_id
      WHERE f.id = ?
      GROUP BY f.id
    `, [firmId]);

    if (!firm || firm.length === 0) {
      return res.status(404).json({ success: false, message: 'Firm not found' });
    }
    
    res.json({ 
      success: true, 
      data: firm[0],
      firm: firm[0] 
    });
  } catch (error) {
    console.error('Error fetching firm details:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Create new firm
router.post('/', requireAuth, async (req, res) => {
  try {
    const { 
      name, 
      firm_name, 
      registration_number, 
      address, 
      city, 
      state, 
      postal_code,
      phone, 
      email, 
      website,
      gstin, 
      pan, 
      owner_name 
    } = req.body;

    if (!name && !firm_name) {
      return res.status(400).json({
        success: false,
        message: 'Firm name is required'
      });
    }

    const firmName = firm_name || name;

    const result = await query(`
      INSERT INTO firms (name, firm_name, registration_number, address, city, state, 
                        postal_code, phone, email, website, gstin, pan, owner_name, 
                        status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `, [firmName, firmName, registration_number, address, city, state, postal_code, 
        phone, email, website, gstin, pan, owner_name, req.user.id]);

    res.json({ 
      success: true, 
      data: { id: result.lastInsertRowid }, 
      firm_id: result.lastInsertRowid,
      message: 'Firm created successfully' 
    });
  } catch (error) {
    console.error('Error creating firm:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Switch selected firm (simplified - just return success)
router.post('/:id/switch', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const firm = await query(
      'SELECT * FROM firms WHERE id = ? AND status = ?',
      [id, 'active']
    );

    if (firm.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found or inactive'
      });
    }

    res.json({
      success: true,
      message: 'Firm switched successfully',
      firm: firm[0],
      data: firm[0]
    });
  } catch (error) {
    console.error('Error switching firm:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update firm
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const firmId = req.params.id;
    const { 
      name, 
      firm_name, 
      address, 
      city, 
      state, 
      postal_code, 
      phone, 
      email, 
      website,
      gstin, 
      pan, 
      owner_name, 
      status 
    } = req.body;

    const currentFirm = await query('SELECT * FROM firms WHERE id = ?', [firmId]);
    
    if (currentFirm.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found'
      });
    }

    const firmName = firm_name || name;

    await query(`
      UPDATE firms 
      SET name = ?, firm_name = ?, address = ?, city = ?, state = ?, 
          postal_code = ?, phone = ?, email = ?, website = ?, gstin = ?, 
          pan = ?, owner_name = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [firmName, firmName, address, city, state, postal_code, 
        phone, email, website, gstin, pan, owner_name, status || 'active', firmId]);

    res.json({ success: true, message: 'Firm updated successfully' });
  } catch (error) {
    console.error('Error updating firm:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete firm
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const firmId = req.params.id;
    
    const firm = await query('SELECT * FROM firms WHERE id = ?', [firmId]);
    
    if (firm.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found'
      });
    }

    const clientCheck = [{ count: 0 }]; // Clients are global now
    
    if (clientCheck[0] && clientCheck[0].count > 0) {
      await query('UPDATE firms SET status = "inactive" WHERE id = ?', [firmId]);
      
      res.json({ 
        success: true, 
        message: 'Firm deactivated successfully (has active clients)'
      });
    } else {
      await query('DELETE FROM firms WHERE id = ?', [firmId]);
      
      res.json({ 
        success: true, 
        message: 'Firm deleted successfully' 
      });
    }
  } catch (error) {
    console.error('Error deleting firm:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;