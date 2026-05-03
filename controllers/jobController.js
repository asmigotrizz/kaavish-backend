// controllers/jobController.js
const { pool } = require('../config/database');
const notificationController = require('./notificationController');

// @desc    Create job request
// @route   POST /api/jobs
// @access  Private (Customer only)
const createJobRequest = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            worker_id,
            job_title,
            description,
            job_date,
            job_time,
            location_address,
            location_lat,
            location_lng,
            estimated_hours
        } = req.body;

        // Validation
        if (!worker_id || !job_title || !job_date) {
            return res.status(400).json({
                success: false,
                message: 'Please provide worker_id, job_title, and job_date'
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
        
        // Check if worker exists and get worker_user_id
        const [workers] = await pool.query(
            'SELECT id, daily_rate, user_id FROM workers WHERE id = ?',
            [worker_id]
        );

        if (workers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Worker not found'
            });
        }

        const workerUserId = workers[0].user_id;

        // Calculate total amount
        const dailyRate = workers[0].daily_rate;
        const totalAmount = estimated_hours ? (dailyRate / 8) * estimated_hours : dailyRate;

        // Insert job request
        const [result] = await pool.query(
            `INSERT INTO job_requests 
            (customer_id, worker_id, job_title, description, job_date, job_time, 
            location_address, location_lat, location_lng, estimated_hours, total_amount, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                customerId, worker_id, job_title, description || null,
                job_date, job_time || null, location_address || null,
                location_lat || null, location_lng || null,
                estimated_hours || null, totalAmount, 'pending'
            ]
        );

        const jobId = result.insertId;

        // ✅ Send notification to worker
        try {
            await notificationController.sendNotificationToUser(
                workerUserId,
                'worker',
                {
                    title: '🔔 New Job Request',
                    body: `You have a new job request: ${job_title}`,
                    data: {
                        type: 'job_request',
                        jobId: jobId.toString(),
                        screen: 'MyJobsScreen'
                    }
                }
            );
            console.log('✅ Notification sent to worker');
        } catch (notifError) {
            console.error('⚠️ Failed to send notification:', notifError);
            // Don't fail the request if notification fails
        }

        // Get created job request
        const [jobRequest] = await pool.query(`
            SELECT 
                jr.*,
                c.id as customer_id,
                cu.name as customer_name,
                cu.phone as customer_phone,
                w.id as worker_id,
                wu.name as worker_name,
                wu.phone as worker_phone,
                w.trade as worker_trade
            FROM job_requests jr
            INNER JOIN customers c ON jr.customer_id = c.id
            INNER JOIN users cu ON c.user_id = cu.id
            INNER JOIN workers w ON jr.worker_id = w.id
            INNER JOIN users wu ON w.user_id = wu.id
            WHERE jr.id = ?
        `, [jobId]);

        res.status(201).json({
            success: true,
            message: 'Job request created successfully',
            data: jobRequest[0]
        });

    } catch (error) {
        console.error('Create job request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get all job requests for customer
// @route   GET /api/jobs/customer
// @access  Private (Customer only)
const getCustomerJobRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status } = req.query;

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

        let query = `
            SELECT 
                jr.*,
                w.trade, w.daily_rate,
                u.name as worker_name,
                u.phone as worker_phone,
                u.profile_photo as worker_photo
            FROM job_requests jr
            INNER JOIN workers w ON jr.worker_id = w.id
            INNER JOIN users u ON w.user_id = u.id
            WHERE jr.customer_id = ?
        `;

        let queryParams = [customerId];

        if (status) {
            query += ' AND jr.status = ?';
            queryParams.push(status);
        }

        query += ' ORDER BY jr.created_at DESC';

        const [jobRequests] = await pool.query(query, queryParams);

        res.status(200).json({
            success: true,
            count: jobRequests.length,
            data: jobRequests
        });

    } catch (error) {
        console.error('Get customer job requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get all job requests for worker
// @route   GET /api/jobs/worker
// @access  Private (Worker only)
const getWorkerJobRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status } = req.query;

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

        let query = `
            SELECT 
                jr.*,
                c.address, c.city,
                u.name as customer_name,
                u.phone as customer_phone,
                u.profile_photo as customer_photo
            FROM job_requests jr
            INNER JOIN customers c ON jr.customer_id = c.id
            INNER JOIN users u ON c.user_id = u.id
            WHERE jr.worker_id = ?
        `;

        let queryParams = [workerId];

        if (status) {
            query += ' AND jr.status = ?';
            queryParams.push(status);
        }

        query += ' ORDER BY jr.created_at DESC';

        const [jobRequests] = await pool.query(query, queryParams);

        res.status(200).json({
            success: true,
            count: jobRequests.length,
            data: jobRequests
        });

    } catch (error) {
        console.error('Get worker job requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get job request by ID
// @route   GET /api/jobs/:id
// @access  Private
const getJobRequestById = async (req, res) => {
    try {
        const jobId = req.params.id;

        const [jobRequests] = await pool.query(`
            SELECT 
                jr.*,
                c.address as customer_address, c.city as customer_city,
                cu.name as customer_name, cu.phone as customer_phone,
                cu.profile_photo as customer_photo,
                w.trade, w.experience_years, w.daily_rate,
                wu.name as worker_name, wu.phone as worker_phone,
                wu.profile_photo as worker_photo
            FROM job_requests jr
            INNER JOIN customers c ON jr.customer_id = c.id
            INNER JOIN users cu ON c.user_id = cu.id
            INNER JOIN workers w ON jr.worker_id = w.id
            INNER JOIN users wu ON w.user_id = wu.id
            WHERE jr.id = ?
        `, [jobId]);

        if (jobRequests.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Job request not found'
            });
        }

        res.status(200).json({
            success: true,
            data: jobRequests[0]
        });

    } catch (error) {
        console.error('Get job request by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Update job status (accept/reject/complete/cancel)
// @route   PUT /api/jobs/:id/status
// @access  Private
const updateJobStatus = async (req, res) => {
    try {
        const jobId = req.params.id;
        const userId = req.user.id;
        const { status } = req.body;

        // Validate status
        const validStatuses = ['pending', 'accepted', 'rejected', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        // Get job request with job_title
        const [jobRequests] = await pool.query(`
            SELECT 
                jr.*,
                c.user_id as customer_user_id,
                w.user_id as worker_user_id
            FROM job_requests jr
            INNER JOIN customers c ON jr.customer_id = c.id
            INNER JOIN workers w ON jr.worker_id = w.id
            WHERE jr.id = ?
        `, [jobId]);

        if (jobRequests.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Job request not found'
            });
        }

        const jobRequest = jobRequests[0];

        // Check authorization
        const isCustomer = jobRequest.customer_user_id === userId;
        const isWorker = jobRequest.worker_user_id === userId;

        if (!isCustomer && !isWorker) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this job'
            });
        }

        // Business logic for status updates
        if (status === 'accepted' || status === 'rejected') {
            if (!isWorker) {
                return res.status(403).json({
                    success: false,
                    message: 'Only worker can accept or reject job requests'
                });
            }
        }

        if (status === 'cancelled') {
            if (!isCustomer) {
                return res.status(403).json({
                    success: false,
                    message: 'Only customer can cancel job requests'
                });
            }
        }

        // Update status
        await pool.query(
            'UPDATE job_requests SET status = ? WHERE id = ?',
            [status, jobId]
        );

        // ✅ Send notification based on status change
        try {
            let notificationTitle = '';
            let notificationBody = '';
            let notificationType = '';
            let recipientUserId = null;
            let recipientUserType = '';

            if (status === 'accepted') {
                // Notify customer
                notificationTitle = '✅ Job Accepted';
                notificationBody = `Your job "${jobRequest.job_title}" has been accepted!`;
                notificationType = 'job_accepted';
                recipientUserId = jobRequest.customer_user_id;
                recipientUserType = 'customer';
            } else if (status === 'rejected') {
                // Notify customer
                notificationTitle = '❌ Job Declined';
                notificationBody = `Your job "${jobRequest.job_title}" was declined`;
                notificationType = 'job_rejected';
                recipientUserId = jobRequest.customer_user_id;
                recipientUserType = 'customer';
            } else if (status === 'completed') {
                // Notify customer
                notificationTitle = '🎉 Job Completed';
                notificationBody = `The job "${jobRequest.job_title}" has been completed. Please rate the worker.`;
                notificationType = 'job_completed';
                recipientUserId = jobRequest.customer_user_id;
                recipientUserType = 'customer';
            } else if (status === 'cancelled') {
                // Notify worker
                notificationTitle = '🚫 Job Cancelled';
                notificationBody = `The job "${jobRequest.job_title}" has been cancelled by the customer`;
                notificationType = 'job_cancelled';
                recipientUserId = jobRequest.worker_user_id;
                recipientUserType = 'worker';
            }

            // Send notification if applicable
            if (recipientUserId && notificationTitle) {
                await notificationController.sendNotificationToUser(
                    recipientUserId,
                    recipientUserType,
                    {
                        title: notificationTitle,
                        body: notificationBody,
                        data: {
                            type: notificationType,
                            jobId: jobId.toString(),
                            screen: 'MyJobsScreen'
                        }
                    }
                );
                console.log(`✅ Notification sent: ${status} to ${recipientUserType}`);
            }
        } catch (notifError) {
            console.error('⚠️ Failed to send notification:', notifError);
            // Don't fail the request if notification fails
        }

        // Get updated job request
        const [updatedJob] = await pool.query(`
            SELECT 
                jr.*,
                cu.name as customer_name,
                wu.name as worker_name
            FROM job_requests jr
            INNER JOIN customers c ON jr.customer_id = c.id
            INNER JOIN users cu ON c.user_id = cu.id
            INNER JOIN workers w ON jr.worker_id = w.id
            INNER JOIN users wu ON w.user_id = wu.id
            WHERE jr.id = ?
        `, [jobId]);

        res.status(200).json({
            success: true,
            message: `Job ${status} successfully`,
            data: updatedJob[0]
        });

    } catch (error) {
        console.error('Update job status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

module.exports = {
    createJobRequest,
    getCustomerJobRequests,
    getWorkerJobRequests,
    getJobRequestById,
    updateJobStatus
};