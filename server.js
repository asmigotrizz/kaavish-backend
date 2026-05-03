// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { testConnection } = require('./config/database');

// Initialize express app
const app = express();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', '*');
  next();
});
// Middleware
app.use(cors()); // Allow cross-origin requests
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Import routes
const authRoutes = require('./routes/authRoutes');
const workerRoutes = require('./routes/workerRoutes');
const customerRoutes = require('./routes/customerRoutes');
const jobRoutes = require('./routes/jobRoutes');
const ratingRoutes = require('./routes/ratingRoutes');
const userRoutes = require('./routes/userRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

// Test route
app.get('/', (req, res) => {
    res.json({ 
        message: '🚀 Worker App API is running!',
        status: 'success',
        timestamp: new Date().toISOString()
    });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);

// Health check route
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK',
        database: 'Connected',
        server: 'Running'
    });
});

// Test database route
app.get('/api/test-db', async (req, res) => {
    try {
        const { pool } = require('./config/database');
        const [rows] = await pool.query('SELECT 1 + 1 AS result');
        res.json({ 
            message: 'Database test successful!',
            result: rows[0].result
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Database test failed',
            error: error.message 
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        message: 'Route not found',
        path: req.path
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        // Test database connection first
        await testConnection();
        
        // Start server
        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Server is running on http://0.0.0.0:${PORT}`);
            console.log(`📝 Environment: ${process.env.NODE_ENV}`);
            console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();