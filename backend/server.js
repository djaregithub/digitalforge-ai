require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

const invoiceRoutes = require('./routes/invoices');
const paymentRoutes = require('./routes/payments');
const creditRoutes = require('./routes/credits');
const referralRoutes = require('./routes/referral');

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
// Blog routes
app.get('/blog', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'blog', 'index.html'));
});
app.get('/blog/:slug', (req, res) => {
    const blogDir = path.join(__dirname, '..', 'frontend', 'blog', 'posts');
    const file = path.join(blogDir, `${req.params.slug}.html`);
    if (fs.existsSync(file)) return res.sendFile(file);
    // Serve from template (generate on-the-fly)
    const template = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'blog', 'template.html'), 'utf8');
    const posts = JSON.parse(fs.readFileSync(path.join(blogDir, 'posts.json'), 'utf8'));
    const post = posts.find(p => p.slug === req.params.slug);
    if (!post) return res.redirect('/blog');
    let html = template.replace('__TITLE__', post.title)
        .replace('__DESC__', post.desc)
        .replace('__DATE__', post.date)
        .replace('__CONTENT__', post.content);
    res.send(html);
});

// SEO market pages - dynamic catch-all
app.get('/crypto-invoice-*', (req, res) => {
    const slug = req.params[0] ? `crypto-invoice-${req.params[0]}` : '';
    const file = path.join(__dirname, '..', 'frontend', 'markets', `${slug}.html`);
    if (fs.existsSync(file)) return res.sendFile(file);
    // Try partial match (e.g. /crypto-invoice-nigeria-lagos)
    const altFile = path.join(__dirname, '..', 'frontend', 'markets', `${slug.split('-').slice(0,3).join('-')}.html`);
    if (fs.existsSync(altFile)) return res.sendFile(altFile);
    res.redirect('/');
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
app.use('/api/referral', referralRoutes);

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
