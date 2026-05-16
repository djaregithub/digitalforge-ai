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
        const { amount, token, merchant_wallet: mw, merchant_name, email_merchant, memo, network } = req.body;
        let merchant_wallet = mw || process.env.DEFAULT_WALLET || '';

        if (!amount || !merchant_wallet) {
            if (!amount) return res.status(400).json({ error: 'amount is required' });
            if (!merchant_wallet) return res.status(400).json({ error: 'merchant_wallet required or set DEFAULT_WALLET' });
        }
        if (amount <= 0) return res.status(400).json({ error: 'amount must be positive' });
        if (!/^0x[a-fA-F0-9]{40}$/.test(merchant_wallet)) {
            return res.status(400).json({ error: 'invalid wallet address' });
        }

        // Check credit balance
        const [merchant] = await req.db.execute(
            'SELECT credits FROM merchants WHERE wallet_address = ?', [merchant_wallet]
        );
        let credits = merchant.length > 0 ? merchant[0].credits : 3;
        if (credits <= 0) {
            return res.status(402).json({ error: 'no credits remaining', payment_required: true, buy_url: '/buy-credits' });
        }

        const id = uuidv4();
        const invoiceCode = generateInvoiceCode();
        const selectedToken = token || 'USDT';
        const selectedNetwork = network || 'polygon';
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const paymentUrl = `${process.env.BASE_URL || 'https://digitalforgeai.space'}/pay/${invoiceCode}`;
        const qrBase64 = await cryptoUtils.generateQR(paymentUrl);

        await req.db.execute(
            `INSERT INTO invoices (id, invoice_code, merchant_name, merchant_wallet, amount, token, network, expires_at, email_merchant, memo)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, invoiceCode, merchant_name || '', merchant_wallet, amount, selectedToken, selectedNetwork, expiresAt, email_merchant || null, memo || null]
        );

        // Deduct credit (unless default owner wallet)
        if (merchant_wallet !== (process.env.DEFAULT_WALLET || '')) {
            await req.db.execute(
                'UPDATE merchants SET credits = credits - 1 WHERE wallet_address = ? AND credits > 0',
                [merchant_wallet]
            );
        }

        await req.db.execute(
            `INSERT INTO merchants (id, wallet_address, name, email) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), last_active = NOW()`,
            [uuidv4(), merchant_wallet, merchant_name || '', email_merchant || null]
        );

        res.json({
            success: true,
            invoice: {
                id, invoice_code: invoiceCode, payment_url: paymentUrl,
                amount, token: selectedToken, network: selectedNetwork,
                merchant_wallet, expires_at: expiresAt, qr_base64: qrBase64
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
            'SELECT * FROM invoices WHERE invoice_code = ?', [req.params.code]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'invoice not found' });
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

// POST /api/invoices/register-merchant — Viral loop: register as merchant
router.post('/register-merchant', async (req, res) => {
    try {
        const { wallet_address, name, email } = req.body;
        if (!wallet_address || !/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
            return res.status(400).json({ error: 'valid polygon wallet address required' });
        }

        await req.db.execute(
            `INSERT INTO merchants (id, wallet_address, name, email, last_active) VALUES (?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), last_active = NOW()`,
            [uuidv4(), wallet_address, name || '', email || null]
        );

        res.json({
            success: true,
            message: 'Welcome! You are now a DigitalForge AI merchant.',
            merchant: { wallet_address, name: name || '' },
            create_url: `${process.env.BASE_URL || 'https://digitalforgeai.space'}/create?wallet=${wallet_address}`
        });
    } catch (err) {
        console.error('[Invoices] Register merchant error:', err);
        res.status(500).json({ error: 'internal server error' });
    }
});

module.exports = router;
