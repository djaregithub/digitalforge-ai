const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const CREDIT_PLANS = {
    starter: { usdt: 5, credits: 20, label: 'Starter' },
    pro: { usdt: 12, credits: 200, label: 'Pro' },
    business: { usdt: 49, credits: -1, label: 'Business' } // -1 = unlimited
};

// GET /api/credits/plans — Get pricing plans
router.get('/plans', (req, res) => {
    res.json({ success: true, plans: CREDIT_PLANS });
});

// GET /api/credits/balance/:wallet — Check credits
router.get('/balance/:wallet', async (req, res) => {
    try {
        const [rows] = await req.db.execute(
            'SELECT credits, total_credits_purchased, wallet_address FROM merchants WHERE wallet_address = ?',
            [req.params.wallet]
        );
        if (rows.length === 0) {
            return res.json({ success: true, credits: 3, total_purchased: 0 });
        }
        res.json({ success: true, credits: rows[0].credits, total_purchased: rows[0].total_credits_purchased });
    } catch (err) {
        console.error('[Credits] Balance error:', err);
        res.status(500).json({ error: 'internal server error' });
    }
});

// POST /api/credits/buy — Buy credits (after sending USDT)
router.post('/buy', async (req, res) => {
    try {
        const { wallet_address, plan, tx_hash } = req.body;
        const selectedPlan = CREDIT_PLANS[plan];
        
        if (!wallet_address || !plan || !tx_hash) {
            return res.status(400).json({ error: 'wallet_address, plan, and tx_hash required' });
        }
        if (!selectedPlan) {
            return res.status(400).json({ error: 'invalid plan. choose: starter, pro, or business' });
        }
        if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
            return res.status(400).json({ error: 'invalid wallet address' });
        }

        // For MVP, trust the user-submitted tx_hash
        // In production, verify on-chain that tx_hash sent correct amount to DEFAULT_WALLET
        // This will be implemented when we add auto-verification

        // Check if this tx_hash was already used
        const [existing] = await req.db.execute(
            'SELECT id FROM transactions WHERE tx_hash = ?', [tx_hash]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'transaction hash already used' });
        }

        // Record the purchase transaction
        await req.db.execute(
            'INSERT INTO transactions (id, invoice_id, tx_hash, from_wallet, to_wallet, amount, token, network, confirmed, confirmed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW())',
            [uuidv4(), 'CREDIT-' + uuidv4(), tx_hash, wallet_address, process.env.DEFAULT_WALLET || '', selectedPlan.usdt, 'USDT', 'polygon']
        );

        // Update or insert merchant credits
        const addedCredits = selectedPlan.credits === -1 ? 999999 : selectedPlan.credits;
        await req.db.execute(
            `INSERT INTO merchants (id, wallet_address, credits, total_credits_purchased) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE credits = credits + ?, total_credits_purchased = total_credits_purchased + ?`,
            [uuidv4(), wallet_address, addedCredits, selectedPlan.usdt, addedCredits, selectedPlan.usdt]
        );

        res.json({
            success: true,
            message: `${selectedPlan.label} plan activated!`,
            credits_added: addedCredits,
            plan: selectedPlan.label
        });

    } catch (err) {
        console.error('[Credits] Buy error:', err);
        res.status(500).json({ error: 'internal server error' });
    }
});

module.exports = router;
module.exports.CREDIT_PLANS = CREDIT_PLANS;
