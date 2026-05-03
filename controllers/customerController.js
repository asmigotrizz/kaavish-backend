// controllers/customerController.js
const { pool } = require('../config/database');

// @desc    Get customer profile
// @route   GET /api/customers/profile
// @access  Private (Customer only)
const getCustomerProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const [customers] = await pool.query(`
            SELECT 
                c.*,
                u.name, u.email, u.phone, u.profile_photo, u.cnic,
                COUNT(DISTINCT jr.id) as total_requests,
                COUNT(DISTINCT CASE WHEN jr.status = 'completed' THEN jr.id END) as completed_jobs
            FROM customers c
            INNER JOIN users u ON c.user_id = u.id
            LEFT JOIN job_requests jr ON c.id = jr.customer_id
            WHERE c.user_id = ?
            GROUP BY c.id
        `, [userId]);

        if (customers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Customer profile not found'
            });
        }

        res.status(200).json({
            success: true,
            data: customers[0]
        });

    } catch (error) {
        console.error('Get customer profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Update customer profile
// @route   PUT /api/customers/profile
// @access  Private (Customer only)
const updateCustomerProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { address, location_lat, location_lng, city } = req.body;

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

        // Build update query
        let updateFields = [];
        let updateValues = [];

        if (address !== undefined) {
            updateFields.push('address = ?');
            updateValues.push(address);
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

        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        updateValues.push(customerId);

        await pool.query(
            `UPDATE customers SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        // Get updated profile
        const [updatedCustomer] = await pool.query(`
            SELECT 
                c.*,
                u.name, u.email, u.phone, u.profile_photo
            FROM customers c
            INNER JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        `, [customerId]);

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedCustomer[0]
        });

    } catch (error) {
        console.error('Update customer profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

module.exports = {
    getCustomerProfile,
    updateCustomerProfile
};