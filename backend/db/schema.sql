-- DigitalForge AI - Database Schema
-- MySQL for Hostinger

CREATE DATABASE IF NOT EXISTS digitalforge;
USE digitalforge;

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(36) PRIMARY KEY,
    invoice_code VARCHAR(12) UNIQUE NOT NULL,
    merchant_name VARCHAR(255) NOT NULL DEFAULT '',
    merchant_wallet VARCHAR(255) NOT NULL,
    amount DECIMAL(18,8) NOT NULL,
    token VARCHAR(10) NOT NULL DEFAULT 'USDT',
    network VARCHAR(20) NOT NULL DEFAULT 'polygon',
    status ENUM('pending','paid','expired','cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    paid_at TIMESTAMP NULL,
    tx_hash VARCHAR(255) NULL,
    payer_wallet VARCHAR(255) NULL,
    email_merchant VARCHAR(255) NULL,
    email_payer VARCHAR(255) NULL,
    memo TEXT NULL,
    INDEX idx_status (status),
    INDEX idx_invoice_code (invoice_code),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Merchants table (for viral loop — "Mau terima crypto juga?")
CREATE TABLE IF NOT EXISTS merchants (
    id VARCHAR(36) PRIMARY KEY,
    wallet_address VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT '',
    email VARCHAR(255) NULL,
    total_invoices INT DEFAULT 0,
    total_received DECIMAL(18,8) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP NULL,
    INDEX idx_wallet (wallet_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Transactions log
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(36) PRIMARY KEY,
    invoice_id VARCHAR(36) NOT NULL,
    tx_hash VARCHAR(255) UNIQUE NOT NULL,
    from_wallet VARCHAR(255) NOT NULL,
    to_wallet VARCHAR(255) NOT NULL,
    amount DECIMAL(18,8) NOT NULL,
    token VARCHAR(10) NOT NULL DEFAULT 'USDT',
    network VARCHAR(20) NOT NULL DEFAULT 'polygon',
    block_number BIGINT NULL,
    confirmed BOOLEAN DEFAULT FALSE,
    confirmed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id),
    INDEX idx_tx_hash (tx_hash),
    INDEX idx_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
