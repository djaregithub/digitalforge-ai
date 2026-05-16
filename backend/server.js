require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

const invoiceRoutes = require('./routes/invoices');
const paymentRoutes = require('./routes/payments');
const creditRoutes = require('./routes/credits');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// SPA-style routes — serve HTML for clean URLs
app.get('/create', (req, res) => {
    let html = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'create.html'), 'utf8');
    html = html.replace('__DEFAULT_WALLET__', process.env.DEFAULT_WALLET || '');
    res.send(html);
});
app.get('/pay/:code', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'pay.html'));
});
app.get('/buy-credits', (req, res) => {
    let html = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'buy-credits.html'), 'utf8');
    html = html.replace('__DEFAULT_WALLET__', process.env.DEFAULT_WALLET || '');
    res.send(html);
});

// Database pool
let db;
async function initDB() {
    // Force IPv4 — Hostinger resolves localhost to ::1 which breaks MySQL auth
    let dbHost = process.env.DB_HOST || 'localhost';
    if (dbHost === 'localhost' || dbHost === '127.0.0.1') dbHost = '127.0.0.1';

    db = await mysql.createPool({
        host: dbHost,
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
app.use('/api/credits', creditRoutes);

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
