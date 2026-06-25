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
    category ENUM('Food', 'Transport', 'Entertainment', 'Bills', 'Emergency', 'Other', 'Debt Given', 'Debt Taken', 'Payroll', 'Inventory Purchase') NOT NULL,
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

-- ============================
-- TEAM MANAGEMENT & PAYROLL
-- ============================

-- Team members (extended with full HR fields - replaces older slimmer version)
CREATE TABLE IF NOT EXISTS team_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(100) NOT NULL,
    monthly_payroll DECIMAL(10, 2) NOT NULL,
    department VARCHAR(100),
    notes TEXT,
    status ENUM('active', 'inactive') DEFAULT 'active',
    -- Extended HR profile
    employee_code VARCHAR(20),
    email VARCHAR(160),
    phone VARCHAR(40),
    joining_date DATE,
    bank_account VARCHAR(40),
    ifsc VARCHAR(20),
    pan VARCHAR(20),
    tax_regime ENUM('old','new') DEFAULT 'new',
    basic_salary DECIMAL(12,2) DEFAULT 0,
    hra DECIMAL(12,2) DEFAULT 0,
    allowances DECIMAL(12,2) DEFAULT 0,
    pf_percent DECIMAL(5,2) DEFAULT 12,
    work_mode ENUM('onsite','remote','hybrid') DEFAULT 'onsite',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_team_members_user (user_id)
);

-- Payroll payment history (legacy - kept for back-compat with the old Team page)
CREATE TABLE IF NOT EXISTS payroll_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_member_id INT NOT NULL,
    user_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    description TEXT,
    debit_entry_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
    FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (debit_entry_id) REFERENCES debit_entries(id),
    INDEX idx_payroll_history_member (team_member_id),
    INDEX idx_payroll_history_user (user_id),
    INDEX idx_payroll_history_date (payment_date)
);

-- ============================
-- HR & PAYROLL (extended modules)
-- ============================

-- Per-day attendance for each team member
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_member_id INT NOT NULL,
    user_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    status ENUM('present','absent','leave','remote','holiday') NOT NULL,
    hours_worked DECIMAL(4,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_member_date (team_member_id, attendance_date),
    INDEX idx_att_user (user_id),
    FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Leave requests
CREATE TABLE IF NOT EXISTS leaves (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_member_id INT NOT NULL,
    user_id INT NOT NULL,
    leave_type ENUM('casual','sick','earned','unpaid','maternity','paternity') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status ENUM('pending','approved','rejected') DEFAULT 'pending',
    approved_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_leaves_user (user_id),
    INDEX idx_leaves_member (team_member_id),
    FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Performance appraisals
CREATE TABLE IF NOT EXISTS appraisals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_member_id INT NOT NULL,
    user_id INT NOT NULL,
    review_period VARCHAR(20),
    goals TEXT,
    rating DECIMAL(3,2),
    comments TEXT,
    promotion_to_role VARCHAR(120),
    salary_increment DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_appraisal_user (user_id),
    FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Recruitment - Job postings
CREATE TABLE IF NOT EXISTS job_postings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(160) NOT NULL,
    department VARCHAR(80),
    description TEXT,
    status ENUM('open','closed') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_jp_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Recruitment - Applicants
CREATE TABLE IF NOT EXISTS applicants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_posting_id INT NOT NULL,
    user_id INT NOT NULL,
    name VARCHAR(160) NOT NULL,
    email VARCHAR(160),
    phone VARCHAR(40),
    resume_url VARCHAR(500),
    stage ENUM('applied','shortlisted','interview','offer','hired','rejected') DEFAULT 'applied',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_applicant_jp (job_posting_id),
    INDEX idx_applicant_user (user_id),
    FOREIGN KEY (job_posting_id) REFERENCES job_postings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Detailed monthly payslips with full breakdown
CREATE TABLE IF NOT EXISTS payslips (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_member_id INT NOT NULL,
    user_id INT NOT NULL,
    pay_period VARCHAR(7) NOT NULL,           -- YYYY-MM
    working_days INT,
    days_present INT,
    basic DECIMAL(12,2) DEFAULT 0,
    hra DECIMAL(12,2) DEFAULT 0,
    allowances DECIMAL(12,2) DEFAULT 0,
    overtime DECIMAL(12,2) DEFAULT 0,
    bonus DECIMAL(12,2) DEFAULT 0,
    gross_salary DECIMAL(12,2) DEFAULT 0,
    pf_deduction DECIMAL(12,2) DEFAULT 0,
    tax_deduction DECIMAL(12,2) DEFAULT 0,
    other_deductions DECIMAL(12,2) DEFAULT 0,
    net_salary DECIMAL(12,2) DEFAULT 0,
    payment_status ENUM('pending','paid') DEFAULT 'pending',
    payment_date DATE,
    debit_entry_id INT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_member_period (team_member_id, pay_period),
    INDEX idx_payslip_user (user_id),
    INDEX idx_payslip_member (team_member_id),
    FOREIGN KEY (team_member_id) REFERENCES team_members(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (debit_entry_id) REFERENCES debit_entries(id)
);

-- ============================
-- INVENTORY & PROCUREMENT
-- ============================

-- Suppliers / vendors
CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(160) NOT NULL,
    contact_person VARCHAR(120),
    email VARCHAR(160),
    phone VARCHAR(40),
    address TEXT,
    gst_number VARCHAR(40),
    payment_terms VARCHAR(120),
    status ENUM('active','inactive') DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_supplier_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Products / inventory items
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    sku VARCHAR(60),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(80),
    unit VARCHAR(20) DEFAULT 'pcs',
    cost_price DECIMAL(12,2) DEFAULT 0,
    selling_price DECIMAL(12,2) DEFAULT 0,
    quantity_in_stock INT DEFAULT 0,
    reorder_level INT DEFAULT 10,
    supplier_id INT NULL,
    status ENUM('active','discontinued') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_product_user (user_id),
    INDEX idx_product_supplier (supplier_id),
    UNIQUE KEY uniq_user_sku (user_id, sku),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- Audit trail of every quantity change
CREATE TABLE IF NOT EXISTS stock_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    user_id INT NOT NULL,
    movement_type ENUM('in','out','adjust') NOT NULL,
    quantity INT NOT NULL,
    reference_type ENUM('purchase_order','manual','sale','return','adjustment') NOT NULL,
    reference_id INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_movement_product (product_id),
    INDEX idx_movement_user (user_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Purchase orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    po_number VARCHAR(40) NOT NULL,
    supplier_id INT NOT NULL,
    status ENUM('draft','pending_approval','approved','received','cancelled') DEFAULT 'draft',
    total_amount DECIMAL(12,2) DEFAULT 0,
    expected_date DATE,
    received_date DATE,
    approved_by INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_po_number (user_id, po_number),
    INDEX idx_po_user (user_id),
    INDEX idx_po_supplier (supplier_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Purchase order line items
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    received_qty INT DEFAULT 0,
    INDEX idx_po_items_po (po_id),
    INDEX idx_po_items_product (product_id),
    FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================
-- NOTIFICATIONS & REMINDERS
-- ============================

-- Scheduled reminders for upcoming due dates (debts, invoices, POs, etc.)
CREATE TABLE IF NOT EXISTS reminders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    ref_type ENUM('debt','invoice','payroll','purchase_order') NOT NULL,
    ref_id INT NOT NULL,
    remind_at DATETIME NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    status ENUM('pending','sent','dismissed') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP NULL,
    UNIQUE KEY uniq_reminder (user_id, ref_type, ref_id, remind_at),
    INDEX idx_user_status (user_id, status),
    INDEX idx_remind_at (remind_at),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- In-app notifications surfaced via the bell icon
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    ref_type VARCHAR(40),
    ref_id INT,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    severity ENUM('info','warning','danger','success') DEFAULT 'info',
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_created (user_id, created_at),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
