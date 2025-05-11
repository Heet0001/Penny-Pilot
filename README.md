Penny Pilot - Personal Finance Management System
Overview
Penny Pilot is a comprehensive personal finance management application that helps users track expenses, manage investments, handle debts, and monitor their financial health. This backend system is built with Node.js, Express, and MySQL, providing RESTful APIs for the frontend application.

Features
Core Features
User Authentication: Signup and login functionality

Financial Tracking: Record credit (income) and debit (expense) entries

Wallet Management: Track current balance with automatic updates

Emergency Fund: Separate tracking for emergency savings

Investment Management
Stock Investments: Buy, sell, and track stock investments

Portfolio Tracking: View current value, profit/loss calculations

Stock Price Integration: Fetch current stock prices (mock implementation)

Debt Management
Debt Tracking: Record both given and received debts

Interest Calculation: Supports simple and compound interest

Payment Processing: Track debt payments with principal/interest breakdown

Reminders: Scheduled reminders for upcoming due dates

Money Transfers
Peer-to-Peer Transfers: Send money to other users

Transfer Requests: Accept/reject pending transfers

Transaction History: View all sent and received transfers

Database Schema
The application uses MySQL with the following key tables:

users - User accounts

credit_entries - Income records

debit_entries - Expense records

wallet - Current balance

emergency_fund - Emergency savings

stock_investments - Stock portfolio

money_transfers - P2P transfers

debts - Debt records

debt_transactions - Debt payments

API Endpoints
Authentication
POST /signup - Register new user

POST /signin - User login

Financial Entries
POST /add-credit - Add income

POST /add-debit - Add expense

GET /get-entries - Get all financial entries

Wallet Management
GET /get-wallet-balance/:userId - Get current balance

POST /update-wallet - Update wallet balance

Emergency Fund
GET /get-emergency-fund/:userId - Get emergency fund balance

POST /update-emergency-fund - Update emergency fund

Investments
POST /api/buy-stock - Purchase stocks

POST /api/sell-stock - Sell stocks

GET /api/get-investments/:userId - Get investment portfolio

GET /api/get-stock-price/:stockName - Get current stock price

Money Transfers
POST /create-money-transfer - Initiate transfer

GET /get-pending-transfers/:userId - Get pending transfers

POST /respond-to-transfer - Accept/reject transfer

GET /get-sent-transfers/:userId - View sent transfers

GET /get-received-transfers/:userId - View received transfers

Debt Management
POST /add-debt - Add new debt

GET /get-debts/:userId - Get all debts

POST /collect-debt - Record debt payment

GET /debt-transactions/:debtId - Get debt transactions

GET /recent-transactions/:userId - Get recent transactions

Setup Instructions
Prerequisites
Node.js (v14+)

MySQL server

npm or yarn

Installation
Clone the repository

Install dependencies:

bash
npm install
Set up MySQL database:

Create a database named penny_pilot

Update the database connection details in the code

Start the server:

bash
node server.js
Environment Variables
Create a .env file with the following variables:

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=penny_pilot
ALPHA_VANTAGE_API_KEY=your_api_key (for stock price integration)
