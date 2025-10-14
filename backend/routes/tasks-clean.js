// Create new task - CORRECTED VERSION
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      firm_id, title, description, client_id, assigned_to, priority, task_type,
      due_date, status, estimated_hours, actual_hours, amount
    } = req.body;

    // Auto-assign to first available firm if not provided
    let actualFirmId = firm_id;
    if (!actualFirmId) {
      const defaultFirm = await query('SELECT id FROM firms WHERE status = ? ORDER BY id ASC LIMIT 1', ['active']);
      if (defaultFirm.length > 0) {
        actualFirmId = defaultFirm[0].id;
      } else {
        return res.status(400).json({ success: false, message: 'No active firms found' });
      }
    }

    if (!title || !client_id) {
      return res.status(400).json({
        success: false,
        message: 'Title and client are required'
      });
    }

    // Verify client exists
    const client = await query('SELECT id FROM clients WHERE id = ?', [client_id]);
    if (client.length === 0) {
      return res.status(400).json({ success: false, message: 'Client not found' });
    }

    const result = await query(`
      INSERT INTO tasks (
        firm_id, title, description, client_id, assigned_to, priority, task_type,
        due_date, status, estimated_hours, actual_hours, amount, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      actualFirmId, 
      title, 
      description, 
      client_id, 
      assigned_to || null, 
      priority || 'medium',
      task_type || 'other', 
      due_date || null, 
      status || 'pending',
      estimated_hours || 0, 
      actual_hours || 0, 
      amount || 0, 
      req.user?.id || 1
    ]);

    const taskId = result.lastInsertRowid || result.insertId;

    res.json({
      success: true,
      message: 'Task created successfully',
      taskId: taskId,
      data: { id: taskId }
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});