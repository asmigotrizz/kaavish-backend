// controllers/ratingController.js
const { pool } = require('../config/database');

// @desc    Create rating and review
// @route   POST /api/ratings
// @access  Private (Customer only)
const createRating = async (req, res) => {
    try {
        const userId = req.user.id;
        const { job_id, worker_id, rating, review } = req.body;

        // Validation
        if (!job_id || !worker_id || !rating) {
            return res.status(400).json({
                success: false,
                message: 'Please provide job_id, worker_id, and rating'
            });
        }

        // Validate rating value (1-5)
        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        // Get customer ID
        const [customers] = await pool.query(
            'SELECT id FROM customers WHERE user_id = ?',
            [userId]
        );

        if (customers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Customer profile not found'
            });
        }

        const customerId = customers[0].id;

        // Check if job exists and belongs to this customer
        const [jobs] = await pool.query(
            'SELECT * FROM job_requests WHERE id = ? AND customer_id = ?',
            [job_id, customerId]
        );

        if (jobs.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Job not found or does not belong to you'
            });
        }

        const job = jobs[0];

        // Check if job is completed
        if (job.status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Can only rate completed jobs'
            });
        }

        // Check if already rated
        const [existingRating] = await pool.query(
            'SELECT * FROM ratings WHERE job_id = ? AND customer_id = ?',
            [job_id, customerId]
        );

        if (existingRating.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'You have already rated this job'
            });
        }

        // Insert rating
        const [result] = await pool.query(
            'INSERT INTO ratings (job_id, customer_id, worker_id, rating, review) VALUES (?, ?, ?, ?, ?)',
            [job_id, customerId, worker_id, rating, review || null]
        );

        // Get created rating with details
        const [newRating] = await pool.query(`
            SELECT 
                r.*,
                u.name as customer_name,
                wu.name as worker_name
            FROM ratings r
            INNER JOIN customers c ON r.customer_id = c.id
            INNER JOIN users u ON c.user_id = u.id
            INNER JOIN workers w ON r.worker_id = w.id
            INNER JOIN users wu ON w.user_id = wu.id
            WHERE r.id = ?
        `, [result.insertId]);

        res.status(201).json({
            success: true,
            message: 'Rating submitted successfully',
            data: newRating[0]
        });

    } catch (error) {
        console.error('Create rating error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get all ratings for a worker
// @route   GET /api/ratings/worker/:workerId
// @access  Public
const getWorkerRatings = async (req, res) => {
    try {
        const workerId = req.params.workerId;

        const [ratings] = await pool.query(`
            SELECT 
                r.*,
                u.name as customer_name,
                jr.job_title
            FROM ratings r
            INNER JOIN customers c ON r.customer_id = c.id
            INNER JOIN users u ON c.user_id = u.id
            INNER JOIN job_requests jr ON r.job_id = jr.id
            WHERE r.worker_id = ?
            ORDER BY r.created_at DESC
        `, [workerId]);

        // Calculate average rating
        let avgRating = 0;
        if (ratings.length > 0) {
            const sum = ratings.reduce((acc, curr) => acc + curr.rating, 0);
            avgRating = (sum / ratings.length).toFixed(2);
        }

        res.status(200).json({
            success: true,
            count: ratings.length,
            averageRating: parseFloat(avgRating),
            data: ratings
        });

    } catch (error) {
        console.error('Get worker ratings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get rating by job ID
// @route   GET /api/ratings/job/:jobId
// @access  Private
const getRatingByJob = async (req, res) => {
    try {
        const jobId = req.params.jobId;

        const [ratings] = await pool.query(`
            SELECT 
                r.*,
                cu.name as customer_name,
                wu.name as worker_name
            FROM ratings r
            INNER JOIN customers c ON r.customer_id = c.id
            INNER JOIN users cu ON c.user_id = cu.id
            INNER JOIN workers w ON r.worker_id = w.id
            INNER JOIN users wu ON w.user_id = wu.id
            WHERE r.job_id = ?
        `, [jobId]);

        if (ratings.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No rating found for this job'
            });
        }

        res.status(200).json({
            success: true,
            data: ratings[0]
        });

    } catch (error) {
        console.error('Get rating by job error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Update rating
// @route   PUT /api/ratings/:id
// @access  Private (Customer only)
const updateRating = async (req, res) => {
    try {
        const ratingId = req.params.id;
        const userId = req.user.id;
        const { rating, review } = req.body;

        // Validate rating value
        if (rating && (rating < 1 || rating > 5)) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        // Get customer ID
        const [customers] = await pool.query(
            'SELECT id FROM customers WHERE user_id = ?',
            [userId]
        );

        if (customers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Customer profile not found'
            });
        }

        const customerId = customers[0].id;

        // Check if rating exists and belongs to customer
        const [existingRatings] = await pool.query(
            'SELECT * FROM ratings WHERE id = ? AND customer_id = ?',
            [ratingId, customerId]
        );

        if (existingRatings.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Rating not found or does not belong to you'
            });
        }

        // Build update query
        let updateFields = [];
        let updateValues = [];

        if (rating !== undefined) {
            updateFields.push('rating = ?');
            updateValues.push(rating);
        }
        if (review !== undefined) {
            updateFields.push('review = ?');
            updateValues.push(review);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        updateValues.push(ratingId);

        await pool.query(
            `UPDATE ratings SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        // Get updated rating
        const [updatedRating] = await pool.query(`
            SELECT 
                r.*,
                cu.name as customer_name,
                wu.name as worker_name
            FROM ratings r
            INNER JOIN customers c ON r.customer_id = c.id
            INNER JOIN users cu ON c.user_id = cu.id
            INNER JOIN workers w ON r.worker_id = w.id
            INNER JOIN users wu ON w.user_id = wu.id
            WHERE r.id = ?
        `, [ratingId]);

        res.status(200).json({
            success: true,
            message: 'Rating updated successfully',
            data: updatedRating[0]
        });

    } catch (error) {
        console.error('Update rating error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Delete rating
// @route   DELETE /api/ratings/:id
// @access  Private (Customer only)
const deleteRating = async (req, res) => {
    try {
        const ratingId = req.params.id;
        const userId = req.user.id;

        // Get customer ID
        const [customers] = await pool.query(
            'SELECT id FROM customers WHERE user_id = ?',
            [userId]
        );

        if (customers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Customer profile not found'
            });
        }

        const customerId = customers[0].id;

        // Check if rating exists and belongs to customer
        const [existingRatings] = await pool.query(
            'SELECT * FROM ratings WHERE id = ? AND customer_id = ?',
            [ratingId, customerId]
        );

        if (existingRatings.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Rating not found or does not belong to you'
            });
        }

        // Delete rating
        await pool.query('DELETE FROM ratings WHERE id = ?', [ratingId]);

        res.status(200).json({
            success: true,
            message: 'Rating deleted successfully'
        });

    } catch (error) {
        console.error('Delete rating error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

module.exports = {
    createRating,
    getWorkerRatings,
    getRatingByJob,
    updateRating,
    deleteRating
};