// routes/workerRoutes.js
const express = require('express');
const router = express.Router();
const {
    getWorkerProfile,
    updateWorkerProfile,
    updateAvailability,
    getAllWorkers,
    getWorkerById,
    getAllTrades,
    getWorkerStats,
    updateProfilePhoto,
    addPortfolioImage,
    getPortfolioImages,
    deletePortfolioImage,
} = require('../controllers/workerController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Public routes
router.get('/', getAllWorkers);
router.get('/trades', getAllTrades);
router.get('/:id', getWorkerById);
router.get('/:workerId/stats', getWorkerStats);

// Protected routes (Worker only)
router.get('/profile/me', protect, restrictTo('worker'), getWorkerProfile);
router.put('/profile', protect, restrictTo('worker'), updateWorkerProfile);
router.put('/availability', protect, restrictTo('worker'), updateAvailability);

// Portfolio routes
router.put('/profile-photo', protect, updateProfilePhoto);
router.get('/portfolio', protect, getPortfolioImages);
router.post('/portfolio', protect, addPortfolioImage);
router.delete('/portfolio/:photoId', protect, deletePortfolioImage);

// Get dashboard stats
router.get('/dashboard-stats', protect, restrictTo('worker'), async (req, res) => {
  try {
    const [worker] = await db.query(
      'SELECT id FROM workers WHERE user_id = ?',
      [req.user.id]
    );

    if (!worker.length) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    const workerId = worker[0].id;

    // Total earnings
    const [totalEarnings] = await db.query(
      `SELECT SUM(estimated_cost) as total 
       FROM job_requests 
       WHERE worker_id = ? AND status = 'completed'`,
      [workerId]
    );

    // Monthly earnings
    const [monthlyEarnings] = await db.query(
      `SELECT SUM(estimated_cost) as total 
       FROM job_requests 
       WHERE worker_id = ? 
       AND status = 'completed' 
       AND MONTH(job_date) = MONTH(CURRENT_DATE())
       AND YEAR(job_date) = YEAR(CURRENT_DATE())`,
      [workerId]
    );

    // Weekly earnings
    const [weeklyEarnings] = await db.query(
      `SELECT SUM(estimated_cost) as total 
       FROM job_requests 
       WHERE worker_id = ? 
       AND status = 'completed' 
       AND WEEK(job_date) = WEEK(CURRENT_DATE())
       AND YEAR(job_date) = YEAR(CURRENT_DATE())`,
      [workerId]
    );

    // Job counts
    const [jobCounts] = await db.query(
      `SELECT 
        COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_jobs
       FROM job_requests 
       WHERE worker_id = ?`,
      [workerId]
    );

    // Average rating
    const [ratings] = await db.query(
      `SELECT 
        COALESCE(AVG(rating), 0) as average_rating,
        COUNT(*) as total_reviews
       FROM ratings 
       WHERE worker_id = ?`,
      [workerId]
    );

    // Weekly earnings data for chart (last 7 days)
    const [earningsData] = await db.query(
      `SELECT 
        DATE_FORMAT(job_date, '%a') as day,
        COALESCE(SUM(estimated_cost), 0) as amount
       FROM job_requests
       WHERE worker_id = ? 
       AND status = 'completed'
       AND job_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
       GROUP BY DATE(job_date)
       ORDER BY job_date ASC`,
      [workerId]
    );

    res.json({
      stats: {
        totalEarnings: totalEarnings[0].total || 0,
        monthlyEarnings: monthlyEarnings[0].total || 0,
        weeklyEarnings: weeklyEarnings[0].total || 0,
        totalJobs: jobCounts[0].total_jobs || 0,
        completedJobs: jobCounts[0].completed_jobs || 0,
        pendingJobs: jobCounts[0].pending_jobs || 0,
        averageRating: parseFloat(ratings[0].average_rating) || 0,
        totalReviews: ratings[0].total_reviews || 0,
      },
      earningsData,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;