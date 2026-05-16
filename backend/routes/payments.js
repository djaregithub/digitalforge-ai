const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const cryptoUtils = require('../utils/crypto');

// POST /api/payments/check/:invoiceCode — Check if invoice is paid
router.post('/check/:invoiceCode', async (req, res) => {
    try {
        const [rows] = await req.db.execute(
            'SELECT * FROM invoices WHERE invoice_code = ?',
            [req.params.invoiceCode]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'invoice not found' });
        }

        const invoice = rows[0];

        // If already marked as paid in DB, return early
        if (invoice.status === 'paid') {
            return res.json({
                success: true,
                status: 'paid',
                invoice: {
                    invoice_code: invoice.invoice_code,
                    amount: invoice.amount,
                    token: invoice.token,
                    status: 'paid',
                    paid_at: invoice.paid_at,
                    tx_hash: invoice.tx_hash
                }
            });
        }

        // If expired
        if (new Date(invoice.expires_at) < new Date()) {
            await req.db.execute(
                'UPDATE invoices SET status = ? WHERE id = ?',
                ['expired', invoice.id]
            );
            return res.json({
                success: true,
                status: 'expired',
                invoice: { invoice_code: invoice.invoice_code, status: 'expired' }
            });
        }

        // For MVP: user submits tx_hash to claim payment
        // (Full auto-detection from RPC polling will be a background worker)
        return res.json({
            success: true,
            status: 'pending',
            invoice: {
                invoice_code: invoice.invoice_code,
                merchant_wallet: invoice.merchant_wallet,
                amount: invoice.amount,
                token: invoice.token,
                network: invoice.network,
                expires_at: invoice.expires_at
            }
        });

    } catch (err) {
        console.error('[Payments] Check error:', err);
        res.status(500).json({ error: 'internal server error' });
    }
});

// POST /api/payments/confirm — User submits tx_hash to confirm payment
router.post('/confirm', async (req, res) => {
    try {
        const { invoice_code, tx_hash } = req.body;
        if (!invoice_code || !tx_hash) {
            return res.status(400).json({ error: 'invoice_code and tx_hash required' });
        }

        // Verify the transaction on-chain
        const txReceipt = await cryptoUtils.verifyTransaction(tx_hash);
        if (!txReceipt) {
            return res.status(400).json({ error: 'transaction not found on Polygon' });
        }

        // Check if transaction was successful
        if (txReceipt.status !== '0x1') {
            return res.status(400).json({ error: 'transaction failed' });
        }

        // Get the invoice
        const [rows] = await req.db.execute(
            'SELECT * FROM invoices WHERE invoice_code = ?',
            [invoice_code]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'invoice not found' });
        }

        const invoice = rows[0];

        // Extract from_address from the transaction
        let fromWallet = txReceipt.from.toLowerCase();

        // Validate — check if transfer went to merchant's wallet
        const transferLog = cryptoUtils.extractTransferFromLogs(txReceipt.logs, invoice.merchant_wallet);
        if (!transferLog) {
            return res.status(400).json({ error: 'no valid USDT/USDC transfer to merchant wallet found in this transaction' });
        }

        // Extract from address from topics[1] or use tx.from
        fromWallet = '0x' + transferLog.topics[1].slice(26);

        // Update invoice
        await req.db.execute(
            'UPDATE invoices SET status = ?, paid_at = NOW(), tx_hash = ?, payer_wallet = ? WHERE id = ?',
            ['paid', tx_hash, fromWallet, invoice.id]
        );

        // Log transaction
        await req.db.execute(
            'INSERT INTO transactions (id, invoice_id, tx_hash, from_wallet, to_wallet, amount, token, network, confirmed, confirmed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW())',
            [uuidv4(), invoice.id, tx_hash, fromWallet, invoice.merchant_wallet, invoice.amount, invoice.token, invoice.network]
        );

        // Update merchant stats
        await req.db.execute(
            'UPDATE merchants SET total_invoices = total_invoices + 1, total_received = total_received + ?, last_active = NOW() WHERE wallet_address = ?',
            [invoice.amount, invoice.merchant_wallet]
        );

        res.json({
            success: true,
            status: 'paid',
            invoice: {
                invoice_code: invoice.invoice_code,
                amount: invoice.amount,
                token: invoice.token,
                tx_hash,
                paid_at: new Date()
            }
        });

    } catch (err) {
        console.error('[Payments] Confirm error:', err);
        res.status(500).json({ error: 'internal server error' });
    }
});

// GET /api/payments/tx/:txHash — Check transaction status
router.get('/tx/:txHash', async (req, res) => {
    try {
        const [rows] = await req.db.execute(
            'SELECT * FROM transactions WHERE tx_hash = ?',
            [req.params.txHash]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'transaction not found' });
        }
        res.json({ success: true, transaction: rows[0] });
    } catch (err) {
        console.error('[Payments] Tx lookup error:', err);
        res.status(500).json({ error: 'internal server error' });
    }
});

module.exports = router;
