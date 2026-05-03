const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const db = require('../config/database');

// Get my notifications
router.get('/my-notifications', protect, async (req, res) => {
  try {
    const [notifications] = await db.query(
      `SELECT * FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [req.user.id]
    );

    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Mark notification as read
router.put('/:id/read', protect, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;