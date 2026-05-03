// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// Generate JWT Token
const generateToken = (userId, userType) => {
    return jwt.sign(
        { id: userId, userType: userType },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
    try {
        const { name, email, phone, password, userType, cnic } = req.body;

        // Basic validation
        if (!name || !phone || !password || !userType) {
            return res.status(400).json({
                success: false,
                message: 'Please provide name, phone, password and user type'
            });
        }

        // Email required for customers only
        if (userType === 'customer' && !email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required for customers'
            });
        }

        // Validate user type
        if (userType !== 'worker' && userType !== 'customer') {
            return res.status(400).json({
                success: false,
                message: 'Invalid user type. Must be worker or customer'
            });
        }

        // Generate placeholder email for workers if not provided
        const finalEmail = email || `${phone}@kaavish.app`;

        // Check if user already exists
        const [existingUser] = await pool.query(
            'SELECT * FROM users WHERE phone = ?',
            [phone]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'User already exists with this phone number'
            });
        }

        // Check email uniqueness only if email provided
        if (email) {
            const [existingEmail] = await pool.query(
                'SELECT * FROM users WHERE email = ?',
                [email]
            );
            if (existingEmail.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'User already exists with this email'
                });
            }
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert user into database
        const [result] = await pool.query(
            'INSERT INTO users (name, email, phone, password, user_type, cnic) VALUES (?, ?, ?, ?, ?, ?)',
            [name, finalEmail, phone, hashedPassword, userType, cnic || null]
        );

        const userId = result.insertId;

        // If worker, create worker profile
        if (userType === 'worker') {
            await pool.query(
                'INSERT INTO workers (user_id, trade, daily_rate, availability) VALUES (?, ?, ?, ?)',
                [userId, 'Not specified', 0, 'available']
            );
        }

        // If customer, create customer profile
        if (userType === 'customer') {
            await pool.query(
                'INSERT INTO customers (user_id) VALUES (?)',
                [userId]
            );
        }

        // Generate token
        const token = generateToken(userId, userType);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                id: userId,
                name,
                email: finalEmail,
                phone,
                userType,
                token
            }
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            error: error.message
        });
    }
};

// @desc    Login user (supports email or phone)
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
    try {
        const { email, phone, password } = req.body;

        if (!password || (!email && !phone)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email or phone and password'
            });
        }

        // Find user by email or phone
        let users;
        if (phone) {
            [users] = await pool.query(
                'SELECT * FROM users WHERE phone = ?',
                [phone]
            );
        } else {
            [users] = await pool.query(
                'SELECT * FROM users WHERE email = ?',
                [email]
            );
        }

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const user = users[0];

        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Your account has been deactivated'
            });
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);

        if (!isPasswordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const token = generateToken(user.id, user.user_type);

        let profileData = {};
        if (user.user_type === 'worker') {
            const [workerData] = await pool.query(
                'SELECT * FROM workers WHERE user_id = ?',
                [user.id]
            );
            profileData = workerData[0] || {};
        } else {
            const [customerData] = await pool.query(
                'SELECT * FROM customers WHERE user_id = ?',
                [user.id]
            );
            profileData = customerData[0] || {};
        }

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                userType: user.user_type,
                profilePhoto: user.profile_photo,
                isVerified: user.is_verified,
                profile: profileData,
                token
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login',
            error: error.message
        });
    }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    try {
        const userId = req.user.id;

        const [users] = await pool.query(
            'SELECT id, name, email, phone, user_type, profile_photo, is_verified, cnic, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = users[0];

        let profileData = {};
        if (user.user_type === 'worker') {
            const [workerData] = await pool.query(
                'SELECT * FROM workers WHERE user_id = ?',
                [userId]
            );
            profileData = workerData[0] || {};
        } else {
            const [customerData] = await pool.query(
                'SELECT * FROM customers WHERE user_id = ?',
                [userId]
            );
            profileData = customerData[0] || {};
        }

        res.status(200).json({
            success: true,
            data: {
                ...user,
                profile: profileData
            }
        });

    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

module.exports = {
    register,
    login,
    getMe
};