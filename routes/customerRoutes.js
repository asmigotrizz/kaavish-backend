// routes/customerRoutes.js
const express = require('express');
const router = express.Router();
const {
    getCustomerProfile,
    updateCustomerProfile
} = require('../controllers/customerController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const db = require('../config/database');

// All routes are protected and customer only
router.use(protect, restrictTo('customer'));

//router.get('/profile', getCustomerProfile);
router.get('/profile', protect, restrictTo('customer'), async (req, res) => {
  try {
    const [customers] = await db.query(
      'SELECT * FROM customers WHERE user_id = ?',
      [req.user.id]
    );

    if (customers.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json({ customer: customers[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
//router.put('/profile', updateCustomerProfile);
router.put('/profile', protect, restrictTo('customer'), async (req, res) => {
  try {
    const {
      name,
      phone_number,
      address,
      city,
      emergency_contact_name,
      emergency_contact_phone,
    } = req.body;

    // Update users table
    await db.query(
      'UPDATE users SET name = ?, phone_number = ? WHERE id = ?',
      [name, phone_number, req.user.id]
    );

    // Update customers table
    await db.query(
      `UPDATE customers SET 
        address = ?,
        city = ?,
        emergency_contact_name = ?,
        emergency_contact_phone = ?
      WHERE user_id = ?`,
      [address, city, emergency_contact_name, emergency_contact_phone, req.user.id]
    );

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
router.post('/favorites', protect, restrictTo('customer'), async (req, res) => {
  try {
    const { worker_id } = req.body;

    const [customer] = await db.query(
      'SELECT id FROM customers WHERE user_id = ?',
      [req.user.id]
    );

    if (!customer.length) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    await db.query(
      'INSERT INTO favorite_workers (customer_id, worker_id) VALUES (?, ?)',
      [customer[0].id, worker_id]
    );

    res.status(201).json({ message: 'Added to favorites' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Already in favorites' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove from favorites
router.delete('/favorites/:workerId', protect, restrictTo('customer'), async (req, res) => {
  try {
    const [customer] = await db.query(
      'SELECT id FROM customers WHERE user_id = ?',
      [req.user.id]
    );

    await db.query(
      'DELETE FROM favorite_workers WHERE customer_id = ? AND worker_id = ?',
      [customer[0].id, req.params.workerId]
    );

    res.json({ message: 'Removed from favorites' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get favorites
router.get('/favorites', protect, restrictTo('customer'), async (req, res) => {
  try {
    const [customer] = await db.query(
      'SELECT id FROM customers WHERE user_id = ?',
      [req.user.id]
    );

    const [favorites] = await db.query(
      `SELECT 
        w.id as worker_id,
        u.name,
        u.phone_number,
        w.trade,
        w.daily_rate,
        w.experience,
        w.city,
        w.profile_photo,
        COALESCE(AVG(r.rating), 0) as average_rating,
        COUNT(DISTINCT r.id) as total_reviews
      FROM favorite_workers f
      JOIN workers w ON f.worker_id = w.id
      JOIN users u ON w.user_id = u.id
      LEFT JOIN ratings r ON w.id = r.worker_id
      WHERE f.customer_id = ?
      GROUP BY w.id`,
      [customer[0].id]
    );

    res.json({ favorites });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;