# DigitalForge AI — Hermes CEO AI Context

## Produk
Crypto Payment Link Generator. Generate invoice USDT/USDC di Polygon.

## Lokasi
- App: /root/digitalforge-app/
- Backend: /root/digitalforge-app/backend/server.js
- Frontend: /root/digitalforge-app/frontend/
- PM2: digitalforge-api (port 3002)
- DB: MySQL digitalforge / user digitalforge_user / pass DigForgeSQL2026

## Wallet Owner
0x47b82a02963CDe4f9625B9C583B41c72956Bc2E8 (Polygon)

## Endpoints
- Health: GET /api/health
- Create invoice: POST /api/invoices/create
- Check payment: POST /api/payments/check/:code
- Confirm: POST /api/payments/confirm {invoice_code, tx_hash}
- Landing: GET / (index.html)
- Create: GET /create (create.html)
- Pay: GET /pay/:code (pay.html)

## Tugas CEO AI
1. Cek health tiap jam — kalo mati, restart: `pm2 restart digitalforge-api`
2. Pantau invoice pending
3. Laporan harian jumlah invoice
4. Alert pembayaran masuk
5. Generate konten marketing crypto

## Perintah Cepat
Cek status: curl -s http://localhost:3002/api/health
Lihat invoices: mysql -u digitalforge_user -pDigForgeSQL2026 digitalforge -e "SELECT invoice_code, amount, token, status, created_at FROM invoices ORDER BY created_at DESC LIMIT 10;"
Cek DB tables: mysql -u digitalforge_user -pDigForgeSQL2026 digitalforge -e "SHOW TABLES;"
