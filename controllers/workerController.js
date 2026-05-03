// controllers/workerController.js
const { pool } = require('../config/database');

// @desc    Get worker profile
// @route   GET /api/workers/profile
// @access  Private (Worker only)
const getWorkerProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const [workers] = await pool.query(`
            SELECT 
                w.*,
                u.name, u.email, u.phone, u.profile_photo, u.cnic, u.is_verified,
                COALESCE(AVG(r.rating), 0) as avg_rating,
                COUNT(DISTINCT r.id) as total_reviews,
                COUNT(DISTINCT jr.id) as total_jobs
            FROM workers w
            INNER JOIN users u ON w.user_id = u.id
            LEFT JOIN ratings r ON w.id = r.worker_id
            LEFT JOIN job_requests jr ON w.id = jr.worker_id AND jr.status = 'completed'
            WHERE w.user_id = ?
            GROUP BY w.id
        `, [userId]);

        if (workers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Worker profile not found'
            });
        }

        res.status(200).json({
            success: true,
            data: workers[0]
        });

    } catch (error) {
        console.error('Get worker profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Update worker profile
// @route   PUT /api/workers/profile
// @access  Private (Worker only)
const updateWorkerProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            trade,
            experience_years,
            daily_rate,
            bio,
            location_address,
            location_lat,
            location_lng,
            city,
            skills
        } = req.body;

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

        // Build update query dynamically
        let updateFields = [];
        let updateValues = [];

        if (trade !== undefined) {
            updateFields.push('trade = ?');
            updateValues.push(trade);
        }
        if (experience_years !== undefined) {
            updateFields.push('experience_years = ?');
            updateValues.push(experience_years);
        }
        if (daily_rate !== undefined) {
            updateFields.push('daily_rate = ?');
            updateValues.push(daily_rate);
        }
        if (bio !== undefined) {
            updateFields.push('bio = ?');
            updateValues.push(bio);
        }
        if (location_address !== undefined) {
            updateFields.push('location_address = ?');
            updateValues.push(location_address);
        }
        if (location_lat !== undefined) {
            updateFields.push('location_lat = ?');
            updateValues.push(location_lat);
        }
        if (location_lng !== undefined) {
            updateFields.push('location_lng = ?');
            updateValues.push(location_lng);
        }
        if (city !== undefined) {
            updateFields.push('city = ?');
            updateValues.push(city);
        }
        if (skills !== undefined) {
            updateFields.push('skills = ?');
            updateValues.push(skills);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        updateValues.push(workerId);

        await pool.query(
            `UPDATE workers SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        // Get updated profile
        const [updatedWorker] = await pool.query(`
            SELECT 
                w.*,
                u.name, u.email, u.phone, u.profile_photo
            FROM workers w
            INNER JOIN users u ON w.user_id = u.id
            WHERE w.id = ?
        `, [workerId]);

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedWorker[0]
        });

    } catch (error) {
        console.error('Update worker profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Update worker availability
// @route   PUT /api/workers/availability
// @access  Private (Worker only)
const updateAvailability = async (req, res) => {
    try {
        const userId = req.user.id;
        const { availability } = req.body;

        // Validate availability
        const validStatuses = ['available', 'busy', 'unavailable'];
        if (!validStatuses.includes(availability)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid availability status. Must be: available, busy, or unavailable'
            });
        }

        await pool.query(
            'UPDATE workers SET availability = ? WHERE user_id = ?',
            [availability, userId]
        );

        res.status(200).json({
            success: true,
            message: 'Availability updated successfully',
            data: { availability }
        });

    } catch (error) {
        console.error('Update availability error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get all workers (with filters)
// @route   GET /api/workers
// @access  Public
const getAllWorkers = async (req, res) => {
    try {
        const { trade, city, availability, min_rate, max_rate, search } = req.query;

        let query = `
            SELECT 
                w.id, w.trade, w.experience_years, w.daily_rate, w.bio,
                w.location_address, w.location_lat, w.location_lng, w.city,
                w.availability, w.skills,
                u.name, u.phone, u.profile_photo, u.is_verified,
                COALESCE(AVG(r.rating), 0) as avg_rating,
                COUNT(DISTINCT r.id) as total_reviews
            FROM workers w
            INNER JOIN users u ON w.user_id = u.id AND u.is_active = 1
            LEFT JOIN ratings r ON w.id = r.worker_id
            WHERE 1=1
        `;

        let queryParams = [];

        // Apply filters
        if (trade) {
            query += ' AND w.trade = ?';
            queryParams.push(trade);
        }

        if (city) {
            query += ' AND w.city LIKE ?';
            queryParams.push(`%${city}%`);
        }

        if (availability) {
            query += ' AND w.availability = ?';
            queryParams.push(availability);
        }

        if (min_rate) {
            query += ' AND w.daily_rate >= ?';
            queryParams.push(min_rate);
        }

        if (max_rate) {
            query += ' AND w.daily_rate <= ?';
            queryParams.push(max_rate);
        }

        if (search) {
            query += ' AND (u.name LIKE ? OR w.trade LIKE ? OR w.skills LIKE ?)';
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ' GROUP BY w.id ORDER BY avg_rating DESC, w.created_at DESC';

        const [workers] = await pool.query(query, queryParams);

        res.status(200).json({
            success: true,
            count: workers.length,
            data: workers
        });

    } catch (error) {
        console.error('Get all workers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get worker by ID
// @route   GET /api/workers/:id
// @access  Public
const getWorkerById = async (req, res) => {
    try {
        const workerId = req.params.id;

        const [workers] = await pool.query(`
            SELECT 
                w.*,
                u.name, u.email, u.phone, u.profile_photo, u.is_verified,
                COALESCE(AVG(r.rating), 0) as avg_rating,
                COUNT(DISTINCT r.id) as total_reviews,
                COUNT(DISTINCT jr.id) as total_jobs
            FROM workers w
            INNER JOIN users u ON w.user_id = u.id
            LEFT JOIN ratings r ON w.id = r.worker_id
            LEFT JOIN job_requests jr ON w.id = jr.worker_id AND jr.status = 'completed'
            WHERE w.id = ?
            GROUP BY w.id
        `, [workerId]);

        if (workers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Worker not found'
            });
        }

        // Get recent reviews
        const [reviews] = await pool.query(`
            SELECT 
                r.rating, r.review, r.created_at,
                u.name as customer_name
            FROM ratings r
            INNER JOIN customers c ON r.customer_id = c.id
            INNER JOIN users u ON c.user_id = u.id
            WHERE r.worker_id = ?
            ORDER BY r.created_at DESC
            LIMIT 5
        `, [workerId]);

        res.status(200).json({
            success: true,
            data: {
                ...workers[0],
                recent_reviews: reviews
            }
        });

    } catch (error) {
        console.error('Get worker by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get all available trades
// @route   GET /api/workers/trades
// @access  Public
const getAllTrades = async (req, res) => {
    try {
        const [trades] = await pool.query('SELECT * FROM trades ORDER BY trade_name');

        res.status(200).json({
            success: true,
            count: trades.length,
            data: trades
        });

    } catch (error) {
        console.error('Get trades error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get worker statistics
// @route   GET /api/workers/stats/:workerId
// @access  Public
const getWorkerStats = async (req, res) => {
    try {
        const workerId = req.params.workerId;

        // Get worker basic info
        const [workers] = await pool.query(`
            SELECT 
                w.*,
                u.name, u.phone, u.profile_photo, u.is_verified
            FROM workers w
            INNER JOIN users u ON w.user_id = u.id
            WHERE w.id = ?
        `, [workerId]);

        if (workers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Worker not found'
            });
        }

        // Get job statistics
        const [jobStats] = await pool.query(`
            SELECT 
                COUNT(*) as total_jobs,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_jobs,
                SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as active_jobs,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_jobs
            FROM job_requests
            WHERE worker_id = ?
        `, [workerId]);

        // Get rating statistics
        const [ratingStats] = await pool.query(`
            SELECT 
                COUNT(*) as total_reviews,
                AVG(rating) as average_rating,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
            FROM ratings
            WHERE worker_id = ?
        `, [workerId]);

        // Get earnings (completed jobs only)
        const [earnings] = await pool.query(`
            SELECT 
                SUM(total_amount) as total_earnings,
                COUNT(*) as paid_jobs
            FROM job_requests
            WHERE worker_id = ? AND status = 'completed'
        `, [workerId]);

        res.status(200).json({
            success: true,
            data: {
                worker: workers[0],
                jobs: jobStats[0],
                ratings: {
                    ...ratingStats[0],
                    average_rating: parseFloat(ratingStats[0].average_rating || 0).toFixed(2)
                },
                earnings: {
                    total: parseFloat(earnings[0].total_earnings || 0),
                    completed_jobs: earnings[0].paid_jobs || 0
                }
            }
        });

    } catch (error) {
        console.error('Get worker stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};
// @desc    Update worker profile photo
// @route   PUT /api/workers/profile-photo
// @access  Private (Worker only)
const updateProfilePhoto = async (req, res) => {
  try {
    const userId = req.user.id;
    const { photoUrl } = req.body;

    if (!photoUrl) {
      return res.status(400).json({
        success: false,
        message: 'Photo URL is required',
      });
    }

    // Update user profile photo
    await pool.query(
      'UPDATE users SET profile_photo = ? WHERE id = ?',
      [photoUrl, userId]
    );

    res.status(200).json({
      success: true,
      message: 'Profile photo updated successfully',
      data: { photoUrl },
    });
  } catch (error) {
    console.error('Update profile photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Add portfolio image
// @route   POST /api/workers/portfolio
// @access  Private (Worker only)
const addPortfolioImage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { imageUrl, caption } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Image URL is required',
      });
    }

    // Get worker ID
    const [workers] = await pool.query(
      'SELECT id FROM workers WHERE user_id = ?',
      [userId]
    );

    if (workers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Worker profile not found',
      });
    }

    const workerId = workers[0].id;

    // Insert into worker_photos table
    await pool.query(
      'INSERT INTO worker_photos (worker_id, photo_url, caption) VALUES (?, ?, ?)',
      [workerId, imageUrl, caption || null]
    );

    // Get all portfolio images
    const [portfolioImages] = await pool.query(
      'SELECT * FROM worker_photos WHERE worker_id = ? ORDER BY created_at DESC',
      [workerId]
    );

    res.status(200).json({
      success: true,
      message: 'Portfolio image added successfully',
      data: { portfolioImages },
    });
  } catch (error) {
    console.error('Add portfolio image error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get worker portfolio images
// @route   GET /api/workers/portfolio
// @access  Private (Worker only)
const getPortfolioImages = async (req, res) => {
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
        message: 'Worker profile not found',
      });
    }

    const workerId = workers[0].id;

    // Get all portfolio images
    const [portfolioImages] = await pool.query(
      'SELECT * FROM worker_photos WHERE worker_id = ? ORDER BY created_at DESC',
      [workerId]
    );

    res.status(200).json({
      success: true,
      data: portfolioImages,
    });
  } catch (error) {
    console.error('Get portfolio images error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete portfolio image
// @route   DELETE /api/workers/portfolio/:photoId
// @access  Private (Worker only)
const deletePortfolioImage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { photoId } = req.params;

    // Verify ownership
    const [photos] = await pool.query(
      `SELECT wp.* FROM worker_photos wp
       INNER JOIN workers w ON wp.worker_id = w.id
       WHERE wp.id = ? AND w.user_id = ?`,
      [photoId, userId]
    );

    if (photos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found or unauthorized',
      });
    }

    // Delete the photo
    await pool.query('DELETE FROM worker_photos WHERE id = ?', [photoId]);

    res.status(200).json({
      success: true,
      message: 'Portfolio image deleted successfully',
    });
  } catch (error) {
    console.error('Delete portfolio image error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
// @desc    Get worker analytics/stats
// @route   GET /api/workers/analytics
// @access  Private (Worker only)
// @desc    Get worker analytics/stats
// @route   GET /api/workers/analytics
// @access  Private (Worker only)
// @desc    Get worker analytics/stats
// @route   GET /api/workers/analytics
// @access  Private (Worker only)
const getWorkerAnalytics = async (req, res) => {
  try {
    console.log('═══════════════════════════════════════');
    console.log('🔍 DEBUG: Full req.user object:', req.user);
    console.log('🔍 DEBUG: req.user.id:', req.user.id);
    console.log('🔍 DEBUG: typeof req.user.id:', typeof req.user.id);
    console.log('═══════════════════════════════════════');
    
    const userId = req.user.id;
    console.log('📊 Getting analytics for user:', userId);

    // Get worker ID
    const [workers] = await pool.query(
      'SELECT id FROM workers WHERE user_id = ?',
      [userId]
    );
    
    console.log('🔍 DEBUG: Workers query result:', workers);
    console.log('🔍 DEBUG: Workers length:', workers.length);

    if (workers.length === 0) {
      console.log('❌ Worker not found for user:', userId);
      return res.status(404).json({
        success: false,
        message: 'Worker profile not found',
      });
    }

    const workerId = workers[0].id;
    console.log('✅ Worker ID:', workerId);

    // Get total jobs by status
    const [jobStats] = await pool.query(
      `SELECT 
        COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_jobs,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_jobs,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_jobs,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_jobs,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_jobs,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) as total_earnings
      FROM job_requests 
      WHERE worker_id = ?`,
      [workerId]
    );

    // Get average rating
    const [ratingStats] = await pool.query(
      `SELECT 
        COALESCE(AVG(rating), 0) as avg_rating,
        COUNT(*) as total_reviews
      FROM ratings 
      WHERE worker_id = ?`,
      [workerId]
    );

    // Get recent jobs (last 10)
    const [recentJobs] = await pool.query(
      `SELECT 
        jr.id,
        jr.job_title,
        jr.status,
        jr.total_amount,
        jr.created_at,
        c.city,
        u.name as customer_name
      FROM job_requests jr
      INNER JOIN customers c ON jr.customer_id = c.id
      INNER JOIN users u ON c.user_id = u.id
      WHERE jr.worker_id = ?
      ORDER BY jr.created_at DESC
      LIMIT 10`,
      [workerId]
    );

    // Get monthly earnings (last 6 months)
    const [monthlyEarnings] = await pool.query(
      `SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COALESCE(SUM(total_amount), 0) as earnings,
        COUNT(*) as jobs_count
      FROM job_requests 
      WHERE worker_id = ? AND status = 'completed'
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month DESC
      LIMIT 6`,
      [workerId]
    );

    console.log('✅ Analytics loaded successfully');

    res.status(200).json({
      success: true,
      data: {
        jobStats: jobStats[0] || {
          total_jobs: 0,
          pending_jobs: 0,
          accepted_jobs: 0,
          completed_jobs: 0,
          rejected_jobs: 0,
          cancelled_jobs: 0,
          total_earnings: 0
        },
        ratingStats: ratingStats[0] || { avg_rating: 0, total_reviews: 0 },
        recentJobs: recentJobs || [],
        monthlyEarnings: monthlyEarnings || [],
      },
    });
  } catch (error) {
    console.error('❌ Get worker analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
// @desc    Get worker jobs
// @route   GET /api/workers/jobs
// @access  Private (Worker only)
const getWorkerJobs = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('📋 Getting jobs for user:', userId);

    // Get worker ID
    const [workers] = await pool.query(
      'SELECT id FROM workers WHERE user_id = ?',
      [userId]
    );

    if (workers.length === 0) {
      console.log('❌ Worker not found for user:', userId);
      return res.status(404).json({
        success: false,
        message: 'Worker profile not found',
      });
    }

    const workerId = workers[0].id;
    console.log('✅ Worker ID:', workerId);

    // Get all jobs for this worker
    const [jobs] = await pool.query(
      `SELECT 
        jr.id,
        jr.job_title,
        jr.description,
        jr.job_date,
        jr.job_time,
        jr.estimated_hours,
        jr.total_amount,
        jr.status,
        jr.created_at,
        jr.location_address,
        jr.location_lat,
        jr.location_lng,
        c.city,
        c.address as customer_address,
        u.name as customer_name,
        u.phone as customer_phone,
        u.email as customer_email
      FROM job_requests jr
      INNER JOIN customers c ON jr.customer_id = c.id
      INNER JOIN users u ON c.user_id = u.id
      WHERE jr.worker_id = ?
      ORDER BY jr.created_at DESC`,
      [workerId]
    );

    console.log('✅ Found', jobs.length, 'jobs');

    res.status(200).json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    console.error('❌ Get worker jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
module.exports = {
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
    getWorkerAnalytics,
    getWorkerJobs,
};