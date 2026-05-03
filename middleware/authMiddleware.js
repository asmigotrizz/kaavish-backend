// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
    try {
        let token;

        // Check if token exists in headers
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            // Get token from header (format: "Bearer TOKEN")
            token = req.headers.authorization.split(' ')[1];
        }

        // Check if token exists
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized, no token provided'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from database
        const [users] = await pool.query(
            'SELECT id, name, email, phone, user_type, is_active FROM users WHERE id = ?',
            [decoded.id]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = users[0];

        // Check if user is active
        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Your account has been deactivated'
            });
        }

        // Add user to request object
        req.user = user;
        next();

    } catch (error) {
        console.error('Auth middleware error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }

        res.status(401).json({
            success: false,
            message: 'Not authorized',
            error: error.message
        });
    }
};

// Restrict to specific user types
const restrictTo = (...userTypes) => {
    return (req, res, next) => {
        if (!userTypes.includes(req.user.user_type)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Only ${userTypes.join(', ')} can access this route`
            });
        }
        next();
    };
};

module.exports = { protect, restrictTo };