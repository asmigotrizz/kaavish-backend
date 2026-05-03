// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const {
    updateUserProfile,
    getWorkerDashboard,
    getCustomerDashboard
} = require('../controllers/userController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

// Update user profile (any user)
router.put('/profile', updateUserProfile);

// Dashboard routes
router.get('/dashboard/worker', restrictTo('worker'), getWorkerDashboard);
router.get('/dashboard/customer', restrictTo('customer'), getCustomerDashboard);

module.exports = router;