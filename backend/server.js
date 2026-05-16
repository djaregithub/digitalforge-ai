require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');

const invoiceRoutes = require('./routes/invoices');
const paymentRoutes = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// SPA-style routes — serve HTML for clean URLs
app.get('/create', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'create.html'));
});
app.get('/pay/:code', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'pay.html'));
});

// Database pool
let db;
async function initDB() {
    db = await mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'digitalforge',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
    console.log('[DB] Connected');
    return db;
}

// Make db available to routes
app.use((req, res, next) => {
    req.db = db;
    next();
});

// Routes
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'digitalforge-ai', version: '1.0.0' });
});

async function start() {
    try {
        await initDB();
        app.listen(PORT, () => {
            console.log(`[Server] DigitalForge AI running on port ${PORT}`);
        });
    } catch (err) {
        console.error('[Server] Failed to start:', err.message);
        process.exit(1);
    }
}

start();
