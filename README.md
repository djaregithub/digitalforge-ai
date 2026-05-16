# DigitalForge AI — Crypto Payment Link Generator

## Structure

```
digitalforge-ai/
├── backend/                 # Node.js Express API
│   ├── server.js            # Main entry point
│   ├── routes/
│   │   ├── invoices.js      # Create & get invoices
│   │   └── payments.js      # Check & confirm payments
│   ├── utils/
│   │   └── crypto.js        # QR + Polygon RPC helpers
│   ├── db/
│   │   └── schema.sql       # MySQL schema
│   ├── package.json
│   └── .env
├── frontend/
│   ├── index.html           # Landing page
│   ├── create.html          # Create invoice form
│   └── pay.html             # Pay invoice page
├── agent/
│   └── tasks/               # Hermes CEO AI task definitions
└── deploy.sh                # Deploy script
```

## How It Works

1. **User A** (freelancer) goes to site → enters amount + Polygon wallet → gets payment URL + QR
2. **User A** sends URL to **User B** (client)
3. **User B** opens URL → sees invoice with amount, QR, countdown, wallet address
4. **User B** sends USDT/USDC to the wallet via Polygon network
5. **User B** submits tx_hash → system verifies on-chain → marks paid
6. **Viral loop**: After payment, client sees "Want to accept crypto too?"

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/invoices/create | Create invoice |
| GET | /api/invoices/:code | Get invoice by code |
| GET | /api/invoices/merchant/:wallet | List merchant invoices |
| POST | /api/payments/check/:code | Check payment status |
| POST | /api/payments/confirm | Confirm payment with tx_hash |
| GET | /api/payments/tx/:hash | Lookup transaction |
| GET | /api/health | Health check |

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: MySQL (Hostinger)
- **Frontend**: Static HTML + CSS + JS
- **Blockchain**: Polygon (RPC public)
- **QR**: qrcode npm package
- **AI UI**: Gemini 2.5 Pro (frontend design)

## Deploy to Hostinger

1. SSH into Hostinger: `ssh -p 65002 -i ~/.ssh/id_ed25519_hermes u275168643@153.92.8.139`
2. Create MySQL database + import `backend/db/schema.sql`
3. Upload files to Node.js app directory
4. Set environment variables in Hostinger panel:
   - `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`
   - `PORT` (Hostinger assigns automatically)
   - `BASE_URL`
5. Point `digitalforgeai.space` DNS to Hostinger
6. Start app from Hostinger Node.js panel

## Hermes CEO AI (VPS)

Hermes running on VPS `161.97.125.219` acts as CEO AI:
- Monitor traffic and payments
- Marketing automation
- Maintenance and alerts
- Analytics reporting
