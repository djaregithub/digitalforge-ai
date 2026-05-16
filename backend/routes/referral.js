const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const REFERRAL_BONUS = 5; // free credits for both parties

// Generate unique referral code
function generateReferralCode(wallet) {
    const suffix = wallet.slice(-4).toUpperCase();
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code + suffix;
}

// GET /api/referral/:wallet — Get referral info
router.get('/:wallet', async (req, res) => {
    try {
        const [merchant] = await req.db.execute(
            'SELECT referral_code, referral_earnings FROM merchants WHERE wallet_address = ?',
            [req.params.wallet]
        );
        if (merchant.length === 0) {
            // Create referral code for new wallet
            const code = generateReferralCode(req.params.wallet);
            await req.db.execute(
                'INSERT INTO merchants (id, wallet_address, referral_code, credits) VALUES (?, ?, ?, 3) ON DUPLICATE KEY UPDATE referral_code = COALESCE(referral_code, ?)',
                [uuidv4(), req.params.wallet, code, code]
            );
            return res.json({ success: true, referral_code: code, bonus: REFERRAL_BONUS });
        }
        res.json({
            success: true,
            referral_code: merchant[0].referral_code,
            earnings: merchant[0].referral_earnings,
            bonus: REFERRAL_BONUS
        });
    } catch (err) {
        console.error('[Referral] Get error:', err);
        res.status(500).json({ error: 'internal server error' });
    }
});

// POST /api/referral/claim — Claim referral bonus
router.post('/claim', async (req, res) => {
    try {
        const { code, new_wallet } = req.body;
        if (!code || !new_wallet) {
            return res.status(400).json({ error: 'code and new_wallet required' });
        }
        if (!/^0x[a-fA-F0-9]{40}$/.test(new_wallet)) {
            return res.status(400).json({ error: 'invalid wallet' });
        }

        // Find referrer
        const [referrer] = await req.db.execute(
            'SELECT id, wallet_address FROM merchants WHERE referral_code = ?',
            [code]
        );
        if (referrer.length === 0) {
            return res.status(404).json({ error: 'invalid referral code' });
        }

        // Check not self-referral
        if (referrer[0].wallet_address.toLowerCase() === new_wallet.toLowerCase()) {
            return res.status(400).json({ error: 'cannot refer yourself' });
        }

        // Check if already referred
        const [existing] = await req.db.execute(
            'SELECT id FROM referrals WHERE referred_wallet = ?',
            [new_wallet]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'already referred' });
        }

        // Record referral
        await req.db.execute(
            'INSERT INTO referrals (id, referrer_wallet, referred_wallet, bonus_credits) VALUES (?, ?, ?, ?)',
            [uuidv4(), referrer[0].wallet_address, new_wallet, REFERRAL_BONUS]
        );

        // Give bonus credits to both
        await req.db.execute(
            'UPDATE merchants SET credits = credits + ?, referral_earnings = referral_earnings + ? WHERE wallet_address = ?',
            [REFERRAL_BONUS, REFERRAL_BONUS, referrer[0].wallet_address]
        );
        // Create referred user with bonus
        await req.db.execute(
            'INSERT INTO merchants (id, wallet_address, credits, referred_by) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE credits = credits + ?',
            [uuidv4(), new_wallet, REFERRAL_BONUS, referrer[0].wallet_address, REFERRAL_BONUS]
        );

        res.json({
            success: true,
            message: 'Referral bonus claimed!',
            bonus_credits: REFERRAL_BONUS,
            referrer: referrer[0].wallet_address.slice(0, 6) + '...'
        });

    } catch (err) {
        console.error('[Referral] Claim error:', err);
        res.status(500).json({ error: 'internal server error' });
    }
});

module.exports = router;
