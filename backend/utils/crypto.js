const QRCode = require('qrcode');

// Generate QR code as base64 data URL
async function generateQR(data) {
    try {
        const qr = await QRCode.toDataURL(data, {
            width: 400,
            margin: 2,
            color: { dark: '#111111', light: '#ffffff' }
        });
        return qr;
    } catch (err) {
        console.error('[QR] Generation error:', err);
        throw err;
    }
}

// Token contract addresses on Polygon (mainnet)
const TOKEN_CONTRACTS = {
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',  // USDT on Polygon
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'   // USDC.e on Polygon
};

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3eb';

// Get block number from Polygon
async function getBlockNumber(rpcUrl = 'https://polygon-rpc.com') {
    try {
        const { ethers } = require('ethers');
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        return await provider.getBlockNumber();
    } catch (err) {
        console.error('[Crypto] getBlockNumber error:', err);
        return null;
    }
}

// Verify a transaction receipt on Polygon
async function verifyTransaction(txHash, rpcUrl = 'https://polygon-rpc.com') {
    try {
        const { ethers } = require('ethers');
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const receipt = await provider.getTransactionReceipt(txHash);
        return receipt;
    } catch (err) {
        console.error('[Crypto] verifyTransaction error:', err);
        return null;
    }
}

// Check if a transaction transferred tokens to the expected wallet
function extractTransferFromLogs(logs, expectedToWallet) {
    if (!logs) return null;
    for (const log of logs) {
        if (log.topics[0] === TRANSFER_TOPIC) {
            const toAddress = '0x' + log.topics[2].slice(26).toLowerCase();
            if (toAddress === expectedToWallet.toLowerCase()) {
                return log;
            }
        }
    }
    return null;
}

module.exports = { generateQR, getBlockNumber, verifyTransaction, extractTransferFromLogs, TOKEN_CONTRACTS, TRANSFER_TOPIC };
