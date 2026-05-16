const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const cryptoUtils = require('../utils/crypto');

// Generate unique invoice code
function generateInvoiceCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 10; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// POST /api/invoices/create — Create a new invoice
router.post('/create', async (req, res) => {
    try {
        const { amount, token, merchant_wallet, merchant_name, email_merchant, memo, network } = req.body;

        // Validate
        if (!amount || !merchant_wallet) {
            return res.status(400).json({ error: 'amount and merchant_wallet are required' });
        }
        if (amount <= 0) {
            return res.status(400).json({ error: 'amount must be positive' });
        }
        if (!/^0x[a-fA-F0-9]{40}$/.test(merchant_wallet)) {
            return res.status(400).json({ error: 'invalid wallet address' });
        }

        const id = uuidv4();
        const invoiceCode = generateInvoiceCode();
        const selectedToken = token || 'USDT';
        const selectedNetwork = network || 'polygon';
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Generate QR data — payment URL
        const paymentUrl = `${process.env.BASE_URL || 'https://digitalforgeai.space'}/pay/${invoiceCode}`;
        const qrBase64 = await cryptoUtils.generateQR(paymentUrl);

        await req.db.execute(
            `INSERT INTO invoices (id, invoice_code, merchant_name, merchant_wallet, amount, token, network, expires_at, email_merchant, memo)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, invoiceCode, merchant_name || '', merchant_wallet, amount, selectedToken, selectedNetwork, expiresAt, email_merchant || null, memo || null]
        );

        // Register or update merchant
        await req.db.execute(
            `INSERT INTO merchants (id, wallet_address, name, email) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), last_active = NOW()`,
            [uuidv4(), merchant_wallet, merchant_name || '', email_merchant || null]
        );

        res.json({
            success: true,
            invoice: {
                id,
                invoice_code: invoiceCode,
                payment_url: paymentUrl,
                amount,
                token: selectedToken,
                network: selectedNetwork,
                merchant_wallet,
                expires_at: expiresAt,
                qr_base64: qrBase64
            }
        });

    } catch (err) {
        console.error('[Invoices] Create error:', err);
        res.status(500).json({ error: 'internal server error' });
    }
});

// GET /api/invoices/:code — Get invoice by code
router.get('/:code', async (req, res) => {
    try {
        const [rows] = await req.db.execute(
            'SELECT * FROM invoices WHERE invoice_code = ?',
            [req.params.code]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'invoice not found' });
        }
        res.json({ success: true, invoice: rows[0] });
    } catch (err) {
        console.error('[Invoices] Get error:', err);
        res.status(500).json({ error: 'internal server error' });
    }
});

// GET /api/invoices/merchant/:wallet — Get merchant's invoices
router.get('/merchant/:wallet', async (req, res) => {
    try {
        const [rows] = await req.db.execute(
            'SELECT * FROM invoices WHERE merchant_wallet = ? ORDER BY created_at DESC LIMIT 50',
            [req.params.wallet]
        );
        res.json({ success: true, invoices: rows });
    } catch (err) {
        console.error('[Invoices] Merchant list error:', err);
        res.status(500).json({ error: 'internal server error' });
    }
});

module.exports = router;
