// controllers/userController.js
const { pool } = require('../config/database');

// @desc    Update user basic info (name, phone)
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, phone, profile_photo } = req.body;

        // Build update query
        let updateFields = [];
        let updateValues = [];

        if (name !== undefined) {
            updateFields.push('name = ?');
            updateValues.push(name);
        }
        if (phone !== undefined) {
            updateFields.push('phone = ?');
            updateValues.push(phone);
        }
        if (profile_photo !== undefined) {
            updateFields.push('profile_photo = ?');
            updateValues.push(profile_photo);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        updateValues.push(userId);

        await pool.query(
            `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        // Get updated user
        const [users] = await pool.query(
            'SELECT id, name, email, phone, user_type, profile_photo, is_verified, created_at FROM users WHERE id = ?',
            [userId]
        );

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: users[0]
        });

    } catch (error) {
        console.error('Update user profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get dashboard data for worker
// @route   GET /api/users/dashboard/worker
// @access  Private (Worker only)
const getWorkerDashboard = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get worker ID
        const [workers] = await pool.query(
            'SELECT id FROM workers WHERE user_id = ?',
            [userId]
        );

        if (workers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Worker profile not found'
            });
        }

        const workerId = workers[0].id;

        // Get pending job requests
        const [pendingJobs] = await pool.query(`
            SELECT 
                jr.*,
                u.name as customer_name,
                u.phone as customer_phone
            FROM job_requests jr
            INNER JOIN customers c ON jr.customer_id = c.id
            INNER JOIN users u ON c.user_id = u.id
            WHERE jr.worker_id = ? AND jr.status = 'pending'
            ORDER BY jr.created_at DESC
            LIMIT 5
        `, [workerId]);

        // Get active jobs
        const [activeJobs] = await pool.query(`
            SELECT 
                jr.*,
                u.name as customer_name,
                u.phone as customer_phone
            FROM job_requests jr
            INNER JOIN customers c ON jr.customer_id = c.id
            INNER JOIN users u ON c.user_id = u.id
            WHERE jr.worker_id = ? AND jr.status = 'accepted'
            ORDER BY jr.job_date ASC
        `, [workerId]);

        // Get statistics
        const [stats] = await pool.query(`
            SELECT 
                COUNT(*) as total_jobs,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as active_count
            FROM job_requests
            WHERE worker_id = ?
        `, [workerId]);

        // Get rating info
        const [ratings] = await pool.query(`
            SELECT 
                COUNT(*) as total_reviews,
                AVG(rating) as average_rating
            FROM ratings
            WHERE worker_id = ?
        `, [workerId]);

        res.status(200).json({
            success: true,
            data: {
                pendingJobs: pendingJobs,
                activeJobs: activeJobs,
                statistics: {
                    ...stats[0],
                    total_reviews: ratings[0].total_reviews,
                    average_rating: parseFloat(ratings[0].average_rating || 0).toFixed(2)
                }
            }
        });

    } catch (error) {
        console.error('Get worker dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get dashboard data for customer
// @route   GET /api/users/dashboard/customer
// @access  Private (Customer only)
const getCustomerDashboard = async (req, res) => {
    try {
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

        // Get pending job requests
        const [pendingJobs] = await pool.query(`
            SELECT 
                jr.*,
                w.trade,
                u.name as worker_name,
                u.phone as worker_phone,
                u.profile_photo as worker_photo
            FROM job_requests jr
            INNER JOIN workers w ON jr.worker_id = w.id
            INNER JOIN users u ON w.user_id = u.id
            WHERE jr.customer_id = ? AND jr.status = 'pending'
            ORDER BY jr.created_at DESC
        `, [customerId]);

        // Get accepted jobs
        const [acceptedJobs] = await pool.query(`
            SELECT 
                jr.*,
                w.trade,
                u.name as worker_name,
                u.phone as worker_phone,
                u.profile_photo as worker_photo
            FROM job_requests jr
            INNER JOIN workers w ON jr.worker_id = w.id
            INNER JOIN users u ON w.user_id = u.id
            WHERE jr.customer_id = ? AND jr.status = 'accepted'
            ORDER BY jr.job_date ASC
        `, [customerId]);

        // Get completed jobs (recent)
        const [completedJobs] = await pool.query(`
            SELECT 
                jr.*,
                w.trade,
                u.name as worker_name,
                r.rating,
                r.review
            FROM job_requests jr
            INNER JOIN workers w ON jr.worker_id = w.id
            INNER JOIN users u ON w.user_id = u.id
            LEFT JOIN ratings r ON jr.id = r.job_id
            WHERE jr.customer_id = ? AND jr.status = 'completed'
            ORDER BY jr.updated_at DESC
            LIMIT 5
        `, [customerId]);

        // Get statistics
        const [stats] = await pool.query(`
            SELECT 
                COUNT(*) as total_requests,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as active_count
            FROM job_requests
            WHERE customer_id = ?
        `, [customerId]);

        res.status(200).json({
            success: true,
            data: {
                pendingJobs: pendingJobs,
                acceptedJobs: acceptedJobs,
                completedJobs: completedJobs,
                statistics: stats[0]
            }
        });

    } catch (error) {
        console.error('Get customer dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

module.exports = {
    updateUserProfile,
    getWorkerDashboard,
    getCustomerDashboard
};