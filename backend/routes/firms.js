const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all firms
router.get('/', authenticateToken, async (req, res) => {
  try {
    const firms = await query(`
      SELECT f.*, 
             COUNT(DISTINCT c.id) as client_count,
             COUNT(DISTINCT sf.staff_id) as staff_count
      FROM firms f
      LEFT JOIN clients c ON f.id = c.firm_id AND c.status = 'active'
      LEFT JOIN staff_firms sf ON f.id = sf.firm_id AND sf.status = 'active'
      WHERE f.status = 'active'
      GROUP BY f.id
      ORDER BY f.firm_name
    `);
    
    res.json({ 
      success: true, 
      data: firms,
      firms: firms 
    });
  } catch (error) {
    console.error('Error fetching firms:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get selected/active firm - FIXED VERSION
router.get('/selected', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    let selectedFirm = null;
    
    try {
      const userFirm = await query(`
        SELECT f.*, s.selected_firm_id
        FROM staff s
        LEFT JOIN firms f ON s.selected_firm_id = f.id
        WHERE s.id = ?
      `, [userId]);
      
      if (userFirm[0] && userFirm[0].selected_firm_id && userFirm[0].id) {
        selectedFirm = userFirm[0];
      }
    } catch (columnError) {
      console.warn('selected_firm_id column access error:', columnError.message);
    }
    
    // Get first active firm as default if no selected firm
    if (!selectedFirm) {
      const defaultFirm = await query(`
        SELECT * FROM firms 
        WHERE status = 'active' 
        ORDER BY created_at ASC 
        LIMIT 1
      `);
      
      if (defaultFirm[0]) {
        selectedFirm = defaultFirm[0];
      }
    }

    if (!selectedFirm) {
      return res.status(404).json({
        success: false,
        message: 'No active firms found'
      });
    }

    res.json({ 
      success: true, 
      firm: selectedFirm,
      data: selectedFirm
    });
  } catch (error) {
    console.error('Error fetching selected firm:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get firms accessible by current user
router.get('/my-firms', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let firms;
    if (userRole === 'admin') {
      firms = await query('SELECT * FROM firms WHERE status = "active" ORDER BY firm_name');
    } else {
      firms = await query(`
        SELECT f.*, sf.access_level, sf.is_primary
        FROM firms f
        INNER JOIN staff_firms sf ON f.id = sf.firm_id
        WHERE sf.staff_id = ? AND f.status = 'active' AND sf.status = 'active'
        ORDER BY sf.is_primary DESC, f.firm_name
      `, [userId]);
    }

    res.json({ success: true, data: firms });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single firm
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const firmId = req.params.id;
    
    const firm = await query(`
      SELECT f.*,
        COUNT(DISTINCT c.id) as client_count,
        COUNT(DISTINCT sf.staff_id) as staff_count,
        COUNT(DISTINCT t.id) as task_count,
        SUM(DISTINCT i.total_amount) as total_revenue
      FROM firms f
      LEFT JOIN clients c ON f.id = c.firm_id
      LEFT JOIN staff_firms sf ON f.id = sf.firm_id AND sf.status = 'active'
      LEFT JOIN tasks t ON f.id = t.firm_id
      LEFT JOIN invoices i ON f.id = i.firm_id AND i.status = 'paid'
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
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { firm_name, firm_code, firm_address, firm_city, firm_state, firm_pincode, 
            firm_phone, firm_email, firm_pan, firm_gstin, firm_tan } = req.body;

    if (!firm_name || !firm_code) {
      return res.status(400).json({
        success: false,
        message: 'Firm name and code are required'
      });
    }

    const existingFirm = await query(
      'SELECT id FROM firms WHERE firm_code = ?',
      [firm_code]
    );

    if (existingFirm.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Firm code already exists'
      });
    }

    const result = await query(`
      INSERT INTO firms (firm_name, firm_code, firm_address, firm_city, firm_state, 
                        firm_pincode, firm_phone, firm_email, firm_pan, firm_gstin, 
                        firm_tan, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `, [firm_name, firm_code, firm_address, firm_city, firm_state, firm_pincode, 
        firm_phone, firm_email, firm_pan, firm_gstin, firm_tan, req.user.id]);

    if (req.auditLogger) {
      await req.auditLogger('CREATE', 'firms', result.insertId, null, {
        firm_name, firm_code
      });
    }

    res.json({ 
      success: true, 
      data: { id: result.insertId }, 
      firm_id: result.insertId,
      message: 'Firm created successfully' 
    });
  } catch (error) {
    console.error('Error creating firm:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Switch selected firm
router.post('/:id/switch', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

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

    try {
      await query('UPDATE staff SET selected_firm_id = ? WHERE id = ?', [id, userId]);
    } catch (updateError) {
      console.error('Error updating selected firm:', updateError);
    }

    if (req.auditLogger) {
      await req.auditLogger('UPDATE', 'user_firm_switch', userId, null, {
        switched_to_firm_id: id,
        firm_name: firm[0].firm_name
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
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const firmId = req.params.id;
    const { firm_name, firm_address, firm_city, firm_state, firm_pincode, 
            firm_phone, firm_email, firm_pan, firm_gstin, firm_tan, status } = req.body;

    const currentFirm = await query('SELECT * FROM firms WHERE id = ?', [firmId]);
    
    if (currentFirm.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found'
      });
    }

    await query(`
      UPDATE firms 
      SET firm_name = ?, firm_address = ?, firm_city = ?, firm_state = ?, 
          firm_pincode = ?, firm_phone = ?, firm_email = ?, firm_pan = ?, 
          firm_gstin = ?, firm_tan = ?, status = ?, updated_at = NOW()
      WHERE id = ?
    `, [firm_name, firm_address, firm_city, firm_state, firm_pincode, 
        firm_phone, firm_email, firm_pan, firm_gstin, firm_tan, status, firmId]);

    if (req.auditLogger) {
      await req.auditLogger('UPDATE', 'firms', firmId, currentFirm[0], {
        firm_name, status
      });
    }

    res.json({ success: true, message: 'Firm updated successfully' });
  } catch (error) {
    console.error('Error updating firm:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete firm
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const firmId = req.params.id;
    
    const firm = await query('SELECT * FROM firms WHERE id = ?', [firmId]);
    
    if (firm.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found'
      });
    }

    const [clientCheck] = await query('SELECT COUNT(*) as count FROM clients WHERE firm_id = ?', [firmId]);
    
    if (clientCheck.count > 0) {
      await query('UPDATE firms SET status = "inactive" WHERE id = ?', [firmId]);
      
      if (req.auditLogger) {
        await req.auditLogger('UPDATE', 'firms', firmId, firm[0], { status: 'inactive' });
      }

      res.json({ 
        success: true, 
        message: 'Firm deactivated successfully (has active clients)'
      });
    } else {
      await query('DELETE FROM firms WHERE id = ?', [firmId]);
      
      if (req.auditLogger) {
        await req.auditLogger('DELETE', 'firms', firmId, firm[0], null);
      }

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