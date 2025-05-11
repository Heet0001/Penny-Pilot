# Penny Pilot - Personal Finance Management System

**Overview**  
Penny Pilot is a comprehensive personal finance management application that helps users track expenses, manage investments, handle debts, and monitor their financial health.  
The backend is built with **Node.js**, **Express**, and **MySQL**, providing **RESTful APIs** for the frontend application.

---

## 🚀 Core Features

- **User Authentication**: Signup and login functionality  
- **Financial Tracking**: Record credit (income) and debit (expense) entries  
- **Wallet Management**: Track current balance with automatic updates  
- **Emergency Fund**: Separate tracking for emergency savings  
- **Investment Management**:  
  - Buy, sell, and track stock investments  
  - View current value and profit/loss  
  - Fetch stock prices (mock implementation)  
- **Debt Management**:  
  - Record both given and received debts  
  - Track payments with principal/interest breakdown  
  - Interest calculation (simple and compound)  
- **Payment Processing**  
- **Reminders**: Scheduled alerts for due dates  
- **Peer-to-Peer Transfers**:  
  - Send/receive money  
  - Accept/reject requests  
- **Transaction History**: View all transfers

---

## 🗃️ Database Schema (MySQL)

- `users` - User accounts  
- `credit_entries` - Income records  
- `debit_entries` - Expense records  
- `wallet` - Current balance  
- `emergency_fund` - Emergency savings  
- `stock_investments` - Stock portfolio  
- `money_transfers` - P2P transfers  
- `debts` - Debt records  
- `debt_transactions` - Debt payments

---

## 📡 API Endpoints

### Authentication
- `POST /signup` – Register new user  
- `POST /signin` – User login  

### Financial Entries
- `POST /add-credit` – Add income  
- `POST /add-debit` – Add expense  
- `GET /get-entries` – Get all financial entries  

### Wallet Management
- `GET /get-wallet-balance/:userId`  
- `POST /update-wallet`  

### Emergency Fund
- `GET /get-emergency-fund/:userId`  
- `POST /update-emergency-fund`  

### Investments
- `POST /api/buy-stock`  
- `POST /api/sell-stock`  
- `GET /api/get-investments/:userId`  
- `GET /api/get-stock-price/:stockName`  

### Money Transfers
- `POST /create-money-transfer`  
- `GET /get-pending-transfers/:userId`  
- `POST /respond-to-transfer`  
- `GET /get-sent-transfers/:userId`  
- `GET /get-received-transfers/:userId`  

### Debt Management
- `POST /add-debt`  
- `GET /get-debts/:userId`  
- `POST /collect-debt`  
- `GET /debt-transactions/:debtId`  
- `GET /recent-transactions/:userId`  

---

## ⚙️ Setup Instructions

### Prerequisites
- Node.js (v14+)  
- MySQL Server  
- npm or yarn  

### Installation

1. **Clone the repository**  
   ```bash
   git clone https://github.com/your-username/Penny-Pilot.git
   cd Penny-Pilot
Install dependencies

bash
Copy
Edit
npm install
Setup MySQL database

Create a database named penny_pilot

Update DB credentials in .env or config file

Start the server

bash
Copy
Edit
node server.js





🔐 Environment Variables
Create a .env file in the root with:

env
Copy
Edit
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=penny_pilot
ALPHA_VANTAGE_API_KEY=your_api_key
