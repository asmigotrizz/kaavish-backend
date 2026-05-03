// routes/jobRoutes.js
const express = require('express');
const router = express.Router();
const {
    createJobRequest,
    getCustomerJobRequests,
    getWorkerJobRequests,
    getJobRequestById,
    updateJobStatus
} = require('../controllers/jobController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Create job request (customer only)
router.post('/', protect, restrictTo('customer'), createJobRequest);

// Get job requests
router.get('/customer', protect, restrictTo('customer'), getCustomerJobRequests);
router.get('/worker', protect, getWorkerJobRequests);  // FIXED THIS LINE

// Get single job and update status (both customer and worker)
router.get('/:id', protect, getJobRequestById);
router.put('/:id/status', protect, updateJobStatus);

module.exports = router;