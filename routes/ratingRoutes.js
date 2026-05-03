// routes/ratingRoutes.js
const express = require('express');
const router = express.Router();
const {
    createRating,
    getWorkerRatings,
    getRatingByJob,
    updateRating,
    deleteRating
} = require('../controllers/ratingController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Public routes
router.get('/worker/:workerId', getWorkerRatings);

// Protected routes (Customer only)
router.post('/', protect, restrictTo('customer'), createRating);
router.get('/job/:jobId', protect, getRatingByJob);
router.put('/:id', protect, restrictTo('customer'), updateRating);
router.delete('/:id', protect, restrictTo('customer'), deleteRating);

module.exports = router;