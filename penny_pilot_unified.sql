-- PENNY PILOT UNIFIED DATABASE SCHEMA
-- This file contains all the necessary tables for the Penny Pilot application
-- including client management functionality

CREATE DATABASE IF NOT EXISTS penny_pilot;
USE penny_pilot;

-- ============================
-- USER MANAGEMENT
-- ============================

-- Main users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================
-- FINANCIAL ENTRIES
-- ============================

-- Credit entries (income)
CREATE TABLE IF NOT EXISTS credit_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    category ENUM('Salary', 'Debt Taken', 'Investments Relieved', 'From Emergency', 'Other') NOT NULL,
    entry_date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Debit entries (expenses)
CREATE TABLE IF NOT EXISTS debit_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    recipient_id INT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    category ENUM('Food', 'Transport', 'Entertainment', 'Bills', 'Emergency', 'Other') NOT NULL,
    entry_date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (recipient_id) REFERENCES users(id)
);

-- ============================
-- WALLET AND EMERGENCY FUND
-- ============================

-- Wallet balance
CREATE TABLE IF NOT EXISTS wallet (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Emergency fund
CREATE TABLE IF NOT EXISTS emergency_fund (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================
-- DEBT MANAGEMENT
-- ============================

-- Debts
CREATE TABLE IF NOT EXISTS debts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL, 
    amount DECIMAL(10, 2) NOT NULL,
    interest_rate DECIMAL(5, 2) DEFAULT 0,
    interest_type ENUM('simple', 'compound') DEFAULT 'simple',
    start_date DATE NOT NULL,
    due_date DATE NOT NULL,
    description TEXT,
    counterparty VARCHAR(255),
    status ENUM('active', 'partially_paid', 'fully_paid') DEFAULT 'active',
    debt_type ENUM('given', 'received') NOT NULL,
    remaining_amount DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Debt transactions
CREATE TABLE IF NOT EXISTS debt_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    debt_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    principal_payment DECIMAL(10, 2) DEFAULT 0,
    interest_payment DECIMAL(10, 2) DEFAULT 0,
    transaction_date DATE NOT NULL,
    transaction_type ENUM('payment', 'collection') NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (debt_id) REFERENCES debts(id)
);

-- ============================
-- INVESTMENT MANAGEMENT
-- ============================

-- Stock investments
CREATE TABLE IF NOT EXISTS stock_investments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    stock_name VARCHAR(100) NOT NULL,
    buy_price DECIMAL(10, 2) NOT NULL,
    current_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    sell_price DECIMAL(10, 2) NULL,
    quantity INT NOT NULL,
    buy_date DATE NOT NULL,
    sell_date DATE NULL,
    description TEXT,
    status ENUM('active', 'sold') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================
-- MONEY TRANSFER
-- ============================

-- Money transfers
CREATE TABLE IF NOT EXISTS money_transfers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    recipient_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT,
    transfer_type ENUM('debt', 'expense') NOT NULL,
    status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
    due_date DATE,
    interest_rate DECIMAL(5, 2),
    repayment_terms TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (recipient_id) REFERENCES users(id)
);

-- ============================
-- CLIENT MANAGEMENT (CRM)
-- ============================

-- Customers/Clients
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_type ENUM('individual', 'business') DEFAULT 'individual',
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company_name VARCHAR(255),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'India',
    customer_status ENUM('prospect', 'active', 'inactive', 'churned') DEFAULT 'prospect',
    credit_limit DECIMAL(12, 2) DEFAULT 0,
    payment_terms VARCHAR(100),
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Client transactions
CREATE TABLE IF NOT EXISTS client_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    transaction_type ENUM('income', 'expense') NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT,
    transaction_date DATE NOT NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES customers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    status ENUM('draft', 'sent', 'paid', 'overdue') DEFAULT 'draft',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES customers(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================
-- INDEXES FOR PERFORMANCE
-- ============================

-- Add indexes for frequently queried columns
CREATE INDEX idx_credit_entries_user_date ON credit_entries(user_id, entry_date);
CREATE INDEX idx_debit_entries_user_date ON debit_entries(user_id, entry_date);
CREATE INDEX idx_debts_user_status ON debts(user_id, status);
CREATE INDEX idx_stock_investments_user_status ON stock_investments(user_id, status);
CREATE INDEX idx_money_transfers_sender ON money_transfers(sender_id);
CREATE INDEX idx_money_transfers_recipient ON money_transfers(recipient_id);
CREATE INDEX idx_customers_created_by ON customers(created_by);
CREATE INDEX idx_client_transactions_client ON client_transactions(client_id);
CREATE INDEX idx_invoices_client ON invoices(client_id);

-- ============================
-- SAMPLE DATA (OPTIONAL)
-- ============================

-- Insert a sample user for testing
INSERT IGNORE INTO users (name, email, password) VALUES 
('John Doe', 'john@example.com', 'password123'),
('Jane Smith', 'jane@example.com', 'password456');

-- Insert sample wallet and emergency fund records
INSERT IGNORE INTO wallet (user_id, balance) VALUES 
(1, 50000.00),
(2, 25000.00);

INSERT IGNORE INTO emergency_fund (user_id, balance) VALUES 
(1, 10000.00),
(2, 5000.00);

-- Insert sample clients
INSERT IGNORE INTO customers (
    customer_type, company_name, email, phone, address, city, state, 
    customer_status, credit_limit, payment_terms, created_by
) VALUES 
(
    'business', 'TechCorp Solutions', 'contact@techcorp.com', '+91-9876543210', 
    '123 Tech Street', 'Bangalore', 'Karnataka', 'active', 100000, 'Net 30', 1
),
(
    'individual', NULL, 'rajesh.kumar@email.com', '+91-8765432109', 
    '456 Business Lane', 'Mumbai', 'Maharashtra', 'active', 50000, 'Net 15', 1
);

-- Update customers table to add first_name and last_name for individual client
UPDATE customers SET first_name = 'Rajesh', last_name = 'Kumar' WHERE id = 2;

-- Insert sample client transactions
INSERT IGNORE INTO client_transactions (client_id, transaction_type, amount, description, transaction_date, created_by) VALUES 
(1, 'income', 50000.00, 'Web development project', '2024-01-15', 1),
(2, 'income', 25000.00, 'Consulting services', '2024-01-20', 1);

-- Insert sample invoices
INSERT IGNORE INTO invoices (client_id, amount, description, due_date, status, created_by) VALUES 
(1, 75000.00, 'Monthly maintenance contract', '2024-02-15', 'sent', 1),
(2, 15000.00, 'Additional consulting hours', '2024-02-10', 'draft', 1);
