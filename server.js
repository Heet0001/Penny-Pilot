import express from "express"
import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2"
import bodyParser from "body-parser"
import cors from "cors"
import fetch from 'node-fetch'
import dotenv from 'dotenv';

// Configure dotenv to look for .env in the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express()

const ALPHA_VANTAGE_API_KEY =  process.env.ALPHA_VANTAGE_API_KEY

// Middleware
app.use(cors())
app.use(bodyParser.json())
app.use(express.urlencoded({ extended: true }))

// Define the base directory for your project
const projectBaseDir = __dirname
// Update these paths
const LoginpageDir = path.join(__dirname, "frontend/Loginpage")
const dashboardDir = path.join(__dirname, "frontend/Dashboard")
const debtsDir = path.join(__dirname, "frontend/Debts")
const investmentDir = path.join(__dirname, "frontend/Investment")
const moneyTransferDir = path.join(__dirname, "frontend/MoneyTransfer")
const utilsDir = path.join(__dirname, "frontend/utils")


// Serve static files from different directories
app.use("/Loginpage", express.static(LoginpageDir))
app.use("/Dashboard", express.static(dashboardDir))
app.use("/Debts", express.static(debtsDir))
app.use("/Investment", express.static(investmentDir))
app.use("/MoneyTransfer", express.static(moneyTransferDir))
app.use("/utils", express.static(utilsDir)) // Serve utils directory
app.use(express.static(path.join(__dirname, "public")))

// MySQL connection
const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
});


db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err)
    console.error("Database configuration:", {
      host: process.env.MYSQLHOST,
      user: process.env.MYSQLUSER,
      database: process.env.MYSQLDATABASE,
      // Don't log the password for security
    })
    return
  }
  console.log("MySQL connected successfully")
})

// Protected Routes - Add authentication check middleware
const checkAuth = (req, res, next) => {
  // For static file requests, we'll check if the request has a valid session
  const authHeader = req.headers.authorization;
  const sessionData = req.headers['x-session-data'];
  
  if (!authHeader && !sessionData) {
    return res.redirect('/Loginpage/index.html');
  }

  try {
    let user;
    if (sessionData) {
      user = JSON.parse(sessionData);
    } else {
      user = JSON.parse(authHeader);
    }
    
    if (!user || !user.id) {
      throw new Error("Invalid user data");
    }
    req.user = user;
    next();
  } catch (error) {
    return res.redirect('/Loginpage/index.html');
  }
}

// Apply authentication check to protected routes
app.use("/dashboard", checkAuth);
app.use("/Dashboard", checkAuth);
app.use("/add-credit", checkAuth);
app.use("/add-debit", checkAuth);
app.use("/add-emergency", checkAuth);
app.use("/get-transactions", checkAuth);
app.use("/get-balances", checkAuth);

// Helper function to update wallet balance
function updateWalletBalance(userId, amount, operation, callback) {
  // First check if user has a wallet record
  const checkSql = "SELECT * FROM wallet WHERE user_id = ?"

  db.query(checkSql, [userId], (err, results) => {
    if (err) {
      return callback(err)
    }

    let query, params

    if (results.length === 0) {
      // Create new wallet record
      const initialBalance = operation === "add" ? Number.parseFloat(amount) : -Number.parseFloat(amount)
      query = "INSERT INTO wallet (user_id, balance) VALUES (?, ?)"
      params = [userId, initialBalance]
    } else {
      // Update existing wallet record
      let newBalance
      if (operation === "add") {
        newBalance = results[0].balance + Number.parseFloat(amount)
      } else {
        newBalance = results[0].balance - Number.parseFloat(amount)
      }

      query = "UPDATE wallet SET balance = ? WHERE user_id = ?"
      params = [newBalance, userId]
    }

    db.query(query, params, (updateErr) => {
      callback(updateErr)
    })
  })
}

// Helper function to update emergency fund balance
function updateEmergencyFundBalance(userId, amount, operation, callback) {
  const checkSql = "SELECT * FROM emergency_fund WHERE user_id = ?"

  db.query(checkSql, [userId], (err, results) => {
    if (err) {
      return callback(err)
    }

    let query, params
    let currentBalance = 0

    if (results.length === 0) {
      currentBalance = operation === "add" ? Math.round(Number.parseFloat(amount) * 100) / 100 : 0
      query = "INSERT INTO emergency_fund (user_id, balance) VALUES (?, ?)"
      params = [userId, currentBalance]
    } else {
      currentBalance = Number.parseFloat(results[0].balance)

      if (operation === "add") {
        currentBalance += Number.parseFloat(amount)
      } else {
        currentBalance -= Number.parseFloat(amount)
        if (currentBalance < 0) currentBalance = 0
      }
      // Always round to 2 decimal places
      currentBalance = Math.round(currentBalance * 100) / 100
      query = "UPDATE emergency_fund SET balance = ? WHERE user_id = ?"
      params = [currentBalance, userId]
    }

    db.query(query, params, (updateErr) => {
      if (updateErr) {
        return callback(updateErr)
      }
      callback(null, currentBalance)
    })
  })
}

// for the investment page

// Add this with other routes
app.get("/api/stock-price/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const response = await fetch(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}.BSE&apikey=${ALPHA_VANTAGE_API_KEY}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch stock price');
    }

    const data = await response.json();
    
    if (data['Global Quote'] && data['Global Quote']['05. price']) {
      res.json({ price: data['Global Quote']['05. price'] });
    } else {
      res.status(404).json({ error: 'Stock price not available' });
    }
  } catch (error) {
    console.error('Error fetching stock price:', error);
    res.status(500).json({ error: 'Failed to fetch stock price' });
  }
});

// Routes
// Basic Navigation Routes - FIXED
app.get("/", (req, res) => {
  // Check if user is authenticated via session or token
  // For now, we'll just redirect to login page
  res.redirect("/Loginpage/index.html");
});

app.get("/Loginpage/index.html", (req, res) => {
  res.sendFile(path.join(LoginpageDir, "index.html"))
})

app.get("/Loginpage/index.html", (req, res) => {
  res.sendFile(path.join(LoginpageDir, "index.html"));
})

app.get("/dashboard", checkAuth, (req, res) => {
  res.sendFile(path.join(dashboardDir, "dashboard.html"))
})

app.get("/Dashboard/dashboard.html", checkAuth, (req, res) => {
  res.sendFile(path.join(dashboardDir, "dashboard.html"))
})

app.get("/debts", (req, res) => {
  res.sendFile(path.join(debtsDir, "debts.html"))
})

app.get("/Debts/debts.html", (req, res) => {
  res.sendFile(path.join(debtsDir, "debts.html"))
})

app.get("/investment", (req, res) => {
  res.sendFile(path.join(investmentDir, "investment.html"))
})

app.get("/Investment/investment.html", (req, res) => {
  res.sendFile(path.join(investmentDir, "investment.html"))
})

app.get("/money-transfer", (req, res) => {
  res.sendFile(path.join(moneyTransferDir, "money-transfer.html"))
})

app.get("/MoneyTransfer/money-transfer.html", (req, res) => {
  res.sendFile(path.join(moneyTransferDir, "money-transfer.html"))
})



app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => res.status(204).end());


// Authentication Routes
app.post("/signup", (req, res) => {
  const { name, email, password } = req.body

  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required" })
  }

  // Check if email already exists
  const checkSql = "SELECT * FROM users WHERE email = ?"
  db.query(checkSql, [email], (checkErr, checkResult) => {
    if (checkErr) {
      console.error("Database error checking email:", checkErr)
      return res.status(500).json({ error: "Database error occurred" })
    }

    if (checkResult.length > 0) {
      return res.status(400).json({ error: "Email already exists" })
    }

    // If email doesn't exist, proceed with signup
    const sql = "INSERT INTO users (name, email, password) VALUES (?, ?, ?)"
    db.query(sql, [name, email, password], (err, result) => {
      if (err) {
        console.error("Database error during signup:", err)
        return res.status(500).json({ error: "Database error occurred" })
      }
      res.status(200).json({ message: "User registered successfully. Please sign in." })
    })
  })
})

app.post("/signin", (req, res) => {
  const { email, password } = req.body
  
  console.log("Attempting signin for email:", email) // Log the attempt

  if (!email || !password) {
    console.log("Missing email or password")
    return res.status(400).json({ error: "Email and password are required" })
  }

  const sql = "SELECT * FROM users WHERE email = ? AND password = ?"
  db.query(sql, [email, password], (err, results) => {
    if (err) {
      console.error("Database error during sign in:", err)
      return res.status(500).json({ error: "Database error occurred during sign in" })
    }

    if (results.length === 0) {
      console.log("No user found with provided credentials")
      return res.status(401).json({ error: "Invalid email or password" })
    }

    const user = {
      id: results[0].id,
      name: results[0].name,
      email: results[0].email
    }

    console.log("Successful signin for user:", user.email)
    res.json({ user })
  })
})

// LOGOUT ROUTE
app.post("/logout", (req, res) => {
  res.status(200).json({
    message: "Logout successful",
    isAuthenticated: false,
  })
})

// Financial Entry Routes
app.post("/add-credit", (req, res) => {
  const { user_id, amount, category, entry_date, description } = req.body

  if (!user_id || !amount || !category || !entry_date) {
    return res.status(400).json({ error: "Required fields are missing" })
  }

  const sql = "INSERT INTO credit_entries (user_id, amount, category, entry_date, description) VALUES (?, ?, ?, ?, ?)"
  db.query(sql, [user_id, amount, category, entry_date, description], (err, result) => {
    if (err) {
      console.error("Database error adding credit entry:", err)
      return res.status(500).json({ error: "Database error occurred" })
    }

    updateWalletBalance(user_id, amount, "add", (walletErr) => {
      if (walletErr) {
        console.error("Error updating wallet balance:", walletErr)
        return res.status(200).json({
          message: "Credit entry added but wallet balance update failed",
          entry_id: result.insertId,
        })
      }

      if (category === "From Emergency") {
        updateEmergencyFundBalance(user_id, amount, "subtract", (emergencyErr, newBalance) => {
          if (emergencyErr) {
            console.error("Error updating emergency fund:", emergencyErr)
            return res.status(200).json({
              message: "Credit entry added but emergency fund update failed",
              entry_id: result.insertId,
            })
          }

          res.status(200).json({
            message: "Credit entry added and emergency fund updated successfully",
            entry_id: result.insertId,
            emergency_balance: newBalance,
          })
        })
      } else {
        res.status(200).json({
          message: "Credit entry added successfully",
          entry_id: result.insertId,
        })
      }
    })
  })
})

app.post("/add-debit", (req, res) => {
  const { user_id, amount, category, entry_date, description } = req.body

  console.log("Received debit data:", req.body)

  if (!user_id || !amount || !category || !entry_date) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
    })
  }

  const query = `
    INSERT INTO debit_entries 
    (user_id, amount, category, entry_date, description) 
    VALUES (?, ?, ?, ?, ?)
  `

  db.query(query, [user_id, amount, category, entry_date, description || ""], (err, result) => {
    if (err) {
      console.error("Database error:", err)
      return res.status(500).json({
        success: false,
        message: "Failed to save debit entry",
        error: err.message,
      })
    }

    updateWalletBalance(user_id, amount, "subtract", (walletErr) => {
      if (walletErr) {
        console.error("Error updating wallet balance:", walletErr)
        return res.status(201).json({
          success: true,
          message: "Debit entry added but wallet balance update failed",
          id: result.insertId,
        })
      }

      if (category === "Emergency") {
        updateEmergencyFundBalance(user_id, amount, "add", (emergencyErr, newBalance) => {
          if (emergencyErr) {
            console.error("Error updating emergency fund:", emergencyErr)
            return res.status(201).json({
              success: true,
              message: "Debit entry added but emergency fund update failed",
              id: result.insertId,
            })
          }

          console.log("Debit Entry Saved Successfully with Emergency Fund Update")
          res.status(201).json({
            success: true,
            message: "Debit entry added and emergency fund updated successfully",
            id: result.insertId,
            emergency_balance: newBalance,
          })
        })
      } else {
        console.log("Debit Entry Saved Successfully")
        res.status(201).json({
          success: true,
          message: "Debit entry added successfully",
          id: result.insertId,
        })
      }
    })
  })
})

// Financial Information Routes
app.get("/get-entries", (req, res) => {
  const { user_id } = req.query

  if (!user_id) {
    return res.status(400).json({ error: "User ID is required" })
  }

  const creditSql = "SELECT * FROM credit_entries WHERE user_id = ? ORDER BY entry_date DESC, created_at DESC"
  const debitSql = "SELECT * FROM debit_entries WHERE user_id = ? ORDER BY entry_date DESC, created_at DESC"

  db.query(creditSql, [user_id], (creditErr, creditResults) => {
    if (creditErr) {
      console.error("Database error fetching credit entries:", creditErr)
      return res.status(500).json({ error: "Database error occurred" })
    }

    db.query(debitSql, [user_id], (debitErr, debitResults) => {
      if (debitErr) {
        console.error("Database error fetching debit entries:", debitErr)
        return res.status(500).json({ error: "Database error occurred" })
      }

      res.status(200).json({
        entries: {
          credit: creditResults,
          debit: debitResults,
        },
      })
    })
  })
})

// Wallet Management Routes
app.post("/update-wallet", (req, res) => {
  const { user_id, balance } = req.body

  if (!user_id || balance === undefined) {
    return res.status(400).json({ error: "Missing required fields" })
  }

  const checkQuery = "SELECT * FROM wallet WHERE user_id = ?"
  db.query(checkQuery, [user_id], (err, results) => {
    if (err) {
      console.error("Error checking wallet:", err)
      return res.status(500).json({ error: "Database error" })
    }

    let query, params

    if (results.length === 0) {
      query = "INSERT INTO wallet (user_id, balance) VALUES (?, ?)"
      params = [user_id, balance]
    } else {
      query = "UPDATE wallet SET balance = ? WHERE user_id = ?"
      params = [balance, user_id]
    }

    db.query(query, params, (err, result) => {
      if (err) {
        console.error("Error updating wallet:", err)
        return res.status(500).json({ error: "Database error" })
      }

      res.json({ success: true, balance })
    })
  })
})

app.get("/get-wallet-balance/:userId", (req, res) => {
  const userId = req.params.userId

  db.query("SELECT balance FROM wallet WHERE user_id = ?", [userId], (err, results) => {
    if (err) {
      console.error("Error getting wallet balance:", err)
      return res.status(500).json({ error: "Database error" })
    }

    // Ensure balance is always a number
    const balance = results.length > 0 ? Number(results[0].balance) : 0
    res.json({ balance: balance })
  })
})

// Emergency Fund Routes
app.post("/update-emergency-fund", (req, res) => {
  const { user_id, amount, operation_type } = req.body

  if (!user_id || !amount || !operation_type) {
    return res.status(400).json({ error: "Missing required fields" })
  }

  const checkSql = "SELECT * FROM emergency_fund WHERE user_id = ?"

  db.query(checkSql, [user_id], (err, results) => {
    if (err) {
      console.error("Error checking emergency fund:", err)
      return res.status(500).json({ error: "Database error" })
    }

    let query, params
    let newBalance

    if (results.length === 0) {
      newBalance = operation_type === "add" ? Math.round(Number.parseFloat(amount) * 100) / 100 : 0
      query = "INSERT INTO emergency_fund (user_id, balance) VALUES (?, ?)"
      params = [user_id, newBalance]
    } else {
      const currentBalance = Number.parseFloat(results[0].balance)
      if (operation_type === "add") {
        newBalance = currentBalance + Number.parseFloat(amount)
      } else {
        newBalance = currentBalance - Number.parseFloat(amount)
        if (newBalance < 0) newBalance = 0
      }
      // Always round to 2 decimal places
      newBalance = Math.round(newBalance * 100) / 100
      query = "UPDATE emergency_fund SET balance = ? WHERE user_id = ?"
      params = [newBalance, user_id]
    }

    db.query(query, params, (updateErr) => {
      if (updateErr) {
        console.error("Error updating emergency fund:", updateErr)
        return res.status(500).json({ error: "Database error" })
      }
      res.json({ success: true, balance: newBalance })
    })
  })
})

app.get("/get-emergency-fund/:userId", (req, res) => {
  const userId = req.params.userId

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" })
  }

  const query = "SELECT balance FROM emergency_fund WHERE user_id = ?"

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Error getting emergency fund:", err)
      return res.status(500).json({ error: "Database error" })
    }

    if (results.length === 0) {
      return res.json({ balance: 0 })
    }

    res.json({ balance: results[0].balance })
  })
})

// --------------------------------Investments--------------------------------

const router = express.Router()

// Helper function to update wallet balance for investments
function updateWalletBalanceInvestment(userId, amount, operation, callback) {
  const operationMap = {
    add: "+",
    subtract: "-",
  }

  const query = `UPDATE wallet SET balance = balance ${operationMap[operation]} ? WHERE user_id = ?`

  db.query(query, [amount, userId], (err, results) => {
    if (err) {
      console.error(`Error updating wallet balance (${operation}):`, err)
      return callback(err)
    }
    callback(null)
  })
}

router.post("/buy-stock", async (req, res) => {
  const { user_id, stock_name, buy_price, quantity, buy_date, description } = req.body

  if (!user_id || !stock_name || !buy_price || !quantity || !buy_date) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
    })
  }

  const totalCost = Number.parseFloat(buy_price) * Number.parseFloat(quantity)
  const walletQuery = "SELECT balance FROM wallet WHERE user_id = ?"

  db.query(walletQuery, [user_id], (walletErr, walletResults) => {
    if (walletErr) {
      console.error("Error checking wallet balance:", walletErr)
      return res.status(500).json({
        success: false,
        message: "Failed to check wallet balance",
      })
    }

    if (walletResults.length === 0 || walletResults[0].balance < totalCost) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
      })
    }

    const insertQuery = `
          INSERT INTO stock_investments 
          (user_id, stock_name, buy_price, current_price, quantity, buy_date, description, status) 
          VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
      `

    db.query(
      insertQuery,
      [user_id, stock_name, buy_price, buy_price, quantity, buy_date, description || ""],
      (insertErr, insertResult) => {
        if (insertErr) {
          console.error("Error inserting stock investment:", insertErr)
          return res.status(500).json({
            success: false,
            message: "Failed to save stock investment",
          })
        }

        updateWalletBalanceInvestment(user_id, totalCost, "subtract", (walletUpdateErr) => {
          if (walletUpdateErr) {
            console.error("Error updating wallet balance:", walletUpdateErr)
            return res.status(500).json({
              success: false,
              message: "Failed to update wallet balance",
            })
          }

          res.status(201).json({
            success: true,
            message: "Stock purchased successfully",
            id: insertResult.insertId,
            total_cost: totalCost,
          })
        })
      },
    )
  })
})

router.post("/sell-stock", async (req, res) => {
  const { user_id, investment_id, sell_price, sell_quantity, sell_date, partial_sale } = req.body

  if (!user_id || !investment_id || !sell_price || !sell_quantity || !sell_date) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
    })
  }

  db.beginTransaction(async (err) => {
    if (err) {
      console.error("Error starting transaction:", err)
      return res.status(500).json({
        success: false,
        message: "Database error",
      })
    }

    try {
      const [investment] = await db
        .promise()
        .query("SELECT * FROM stock_investments WHERE id = ? AND user_id = ? FOR UPDATE", [investment_id, user_id])

      if (!investment || investment.length === 0) {
        throw new Error("Investment not found")
      }

      const currentInvestment = investment[0]

      if (currentInvestment.status === "sold") {
        throw new Error("Investment already sold")
      }

      if (sell_quantity > currentInvestment.quantity) {
        throw new Error("Cannot sell more shares than owned")
      }

      const totalSaleAmount = Number(sell_price) * Number(sell_quantity)
      const buyAmount = Number(currentInvestment.buy_price) * Number(sell_quantity)
      const profit = totalSaleAmount - buyAmount

      if (partial_sale) {
        const remainingQuantity = currentInvestment.quantity - sell_quantity

        await db
          .promise()
          .query("UPDATE stock_investments SET quantity = ?, current_price = ? WHERE id = ?", [
            remainingQuantity,
            sell_price,
            investment_id,
          ])

        await db.promise().query(
          `INSERT INTO stock_investments 
          (user_id, stock_name, buy_price, current_price, quantity, buy_date, sell_price, sell_date, status, description) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'sold', ?)`,
          [
            user_id,
            currentInvestment.stock_name,
            currentInvestment.buy_price,
            sell_price,
            sell_quantity,
            currentInvestment.buy_date,
            sell_price,
            sell_date,
            currentInvestment.description,
          ],
        )
      } else {
        await db.promise().query(
          `UPDATE stock_investments 
          SET status = 'sold', sell_price = ?, sell_date = ?, current_price = ? 
          WHERE id = ?`,
          [sell_price, sell_date, sell_price, investment_id],
        )
      }

      await db.promise().query("UPDATE wallet SET balance = balance + ? WHERE user_id = ?", [totalSaleAmount, user_id])

      await db.promise().query(
        `INSERT INTO credit_entries (user_id, amount, category, entry_date, description) 
        VALUES (?, ?, 'Investments Relieved', ?, ?)`,
        [
          user_id,
          totalSaleAmount,
          sell_date,
          `Sold ${sell_quantity} shares of ${currentInvestment.stock_name} @ ₹${sell_price}`,
        ],
      )

      await db.promise().commit()

      res.status(200).json({
        success: true,
        message: "Stock sold successfully",
        total_sale_amount: totalSaleAmount,
        profit: profit,
        remaining_quantity: partial_sale ? currentInvestment.quantity - sell_quantity : 0,
      })
    } catch (error) {
      await db.promise().rollback()
      console.error("Error in sell stock transaction:", error)
      res.status(400).json({
        success: false,
        message: error.message || "Failed to sell stock",
      })
    }
  })
})

router.get("/get-investments/:userId", async (req, res) => {
  const userId = req.params.userId

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" })
  }

  const query = "SELECT * FROM stock_investments WHERE user_id = ? ORDER BY buy_date DESC"

  db.query(query, [userId], async (err, results) => {
    if (err) {
      console.error("Error getting investments:", err)
      return res.status(500).json({ error: "Database error" })
    }

    const updatedInvestments = []
    let totalInvested = 0
    let totalCurrentValue = 0

    for (const investment of results) {
      const investedAmount = Number(investment.buy_price) * Number(investment.quantity)

      if (investment.status === "active") {
        try {
          // Fetch real-time stock price from Alpha Vantage API
          const response = await fetch(
            `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${investment.stock_name}.BSE&apikey=${ALPHA_VANTAGE_API_KEY}`
          );

          if (!response.ok) {
            throw new Error('Failed to fetch stock price');
          }

          const data = await response.json();
          let currentPrice;

          if (data['Global Quote'] && data['Global Quote']['05. price']) {
            currentPrice = Number(data['Global Quote']['05. price']);
            
            // Update the current_price in the database
            await db.promise().query(
              "UPDATE stock_investments SET current_price = ? WHERE id = ?",
              [currentPrice, investment.id]
            );
          } else {
            // If API fails, use the last known price
            currentPrice = Number(investment.current_price);
          }

          const currentValue = currentPrice * Number(investment.quantity);
          totalInvested += investedAmount;
          totalCurrentValue += currentValue;

          investment.current_price = currentPrice;
          investment.invested_amount = investedAmount;
          investment.current_value = currentValue;
          investment.profit_loss = currentValue - investedAmount;
          investment.profit_loss_percentage = (((currentValue - investedAmount) / investedAmount) * 100).toFixed(2);
        } catch (error) {
          console.error(`Error fetching price for ${investment.stock_name}:`, error);
          // Use last known price if API fails
          const currentValue = Number(investment.current_price) * Number(investment.quantity);
          totalInvested += investedAmount;
          totalCurrentValue += currentValue;

          investment.invested_amount = investedAmount;
          investment.current_value = currentValue;
          investment.profit_loss = currentValue - investedAmount;
          investment.profit_loss_percentage = (((currentValue - investedAmount) / investedAmount) * 100).toFixed(2);
        }
      } else if (investment.status === "sold") {
        const saleAmount = Number(investment.sell_price) * Number(investment.quantity);
        investment.invested_amount = investedAmount;
        investment.sale_amount = saleAmount;
        investment.profit_loss = saleAmount - investedAmount;
        investment.profit_loss_percentage = (((saleAmount - investedAmount) / investedAmount) * 100).toFixed(2);
      }

      updatedInvestments.push(investment);
    }

    res.json({
      investments: updatedInvestments,
      summary: {
        total_invested: totalInvested,
        total_current_value: totalCurrentValue,
        total_profit_loss: totalCurrentValue - totalInvested,
        total_profit_loss_percentage:
          totalInvested > 0 ? (((totalCurrentValue - totalInvested) / totalInvested) * 100).toFixed(2) : 0,
      },
    });
  });
})

router.get("/get-stock-price/:stockName", async (req, res) => {
  const stockName = req.params.stockName

  if (!stockName) {
    return res.status(400).json({ error: "Stock name is required" })
  }

  try {
    const mockPrice = generateMockPrice(stockName)
    res.json({ price: mockPrice })
  } catch (error) {
    console.error("Error fetching stock price:", error)
    res.status(500).json({ error: "Failed to fetch stock price" })
  }
})

function generateMockPrice(stockName) {
  const basePrice = stockName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const randomFactor = Math.sin(Date.now() / 10000) * 10
  return (basePrice + randomFactor).toFixed(2)
}

app.use("/api", router)

// -------------------- Money Transfer ----------------------

const createMoneyTransferTable = `
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
)`

function updateWalletBalanceMoneyTransfer(userId, amount, operation, callback) {
  const query = `
    UPDATE wallet 
    SET balance = balance ${operation === "add" ? "+" : "-"} ? 
    WHERE user_id = ?`

  db.query(query, [amount, userId], (err, results) => {
    if (err) {
      console.error(`Error updating wallet for user ${userId}:`, err)
      return callback(err)
    }
    callback(null, results)
  })
}

app.get("/check-user-exists", (req, res) => {
  const { email } = req.query
  if (!email) {
    return res.status(400).json({ error: "Email is required" })
  }

  db.query("SELECT id FROM users WHERE email = ?", [email], (err, results) => {
    if (err) {
      console.error("Database error checking user:", err)
      return res.status(500).json({ error: "Database error" })
    }
    res.json({ exists: results.length > 0 })
  })
})

app.post("/create-money-transfer", async (req, res) => {
  const {
    sender_id,
    recipient_email,
    amount,
    description,
    transfer_type,
    due_date,
    interest_rate,
    repayment_terms,
    is_recurring,
  } = req.body

  console.log(
    `[TRANSFER] Creating transfer from user ${sender_id} to ${recipient_email} for $${amount} as ${transfer_type}`,
  )

  try {
    const recipientQuery = "SELECT id FROM users WHERE email = ?"
    const walletQuery = "SELECT balance FROM wallet WHERE user_id = ?"

    db.query(recipientQuery, [recipient_email], (err, results) => {
      if (err) {
        console.error("[TRANSFER] Database error finding recipient:", err)
        return res.status(500).json({
          success: false,
          message: "Database error occurred",
        })
      }

      if (results.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Recipient not found",
        })
      }

      if (transfer_type === "debt") {
        if (!due_date) {
          return res.status(400).json({
            success: false,
            message: "Due date is required for debt transfers",
          })
        }

        if (new Date(due_date) < new Date()) {
          return res.status(400).json({
            success: false,
            message: "Due date must be in the future",
          })
        }
      }

      const recipient_id = results[0].id

      if (recipient_id === Number.parseInt(sender_id)) {
        return res.status(400).json({
          success: false,
          message: "You cannot send money to yourself",
        })
      }

      const duplicateCheckQuery = `
        SELECT * FROM money_transfers 
        WHERE sender_id = ? 
        AND recipient_id = ? 
        AND amount = ? 
        AND transfer_type = ?
        AND status = 'pending'
        AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE)
      `

      db.query(duplicateCheckQuery, [sender_id, recipient_id, amount, transfer_type], (dupErr, dupResults) => {
        if (dupErr) {
          console.error("[TRANSFER] Error checking for duplicates:", dupErr)
        } else if (dupResults && dupResults.length > 0) {
          console.log("[TRANSFER] Duplicate transfer detected:", dupResults[0])
          return res.status(400).json({
            success: false,
            message: "A similar transfer was already initiated in the last minute. Please wait before trying again.",
          })
        }

        db.query(walletQuery, [sender_id], (walletErr, walletResults) => {
          if (walletErr) {
            console.error("[TRANSFER] Database error checking wallet:", walletErr)
            return res.status(500).json({
              success: false,
              message: "Database error occurred",
            })
          }

          const senderBalance = walletResults.length > 0 ? Number.parseFloat(walletResults[0].balance) : 0
          const transferAmount = Number.parseFloat(amount)

          if (senderBalance < transferAmount) {
            return res.status(400).json({
              success: false,
              message: "Insufficient wallet balance",
            })
          }

          const insertQuery = `
              INSERT INTO money_transfers 
              (sender_id, recipient_id, amount, description, transfer_type, 
              due_date, interest_rate, repayment_terms, is_recurring, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            `

          db.query(
            insertQuery,
            [
              sender_id,
              recipient_id,
              amount,
              description,
              transfer_type,
              transfer_type === "debt" ? due_date : null,
              transfer_type === "debt" ? interest_rate || 0 : null,
              transfer_type === "debt" ? repayment_terms || "" : "",
              transfer_type === "debt" ? is_recurring || false : false,
            ],
            (insertErr, insertResult) => {
              if (insertErr) {
                console.error("[TRANSFER] Database error creating transfer:", insertErr)
                return res.status(500).json({
                  success: false,
                  message: "Failed to create transfer",
                })
              }

              console.log(
                `[TRANSFER] Created transfer #${insertResult.insertId} from user ${sender_id} to ${recipient_id}`,
              )

              const senderQuery = "SELECT name FROM users WHERE id = ?"
              db.query(senderQuery, [sender_id], (senderErr, senderResults) => {
                if (senderErr || senderResults.length === 0) {
                  console.error("[TRANSFER] Error getting sender name:", senderErr)
                  return res.status(201).json({
                    success: true,
                    message: "Transfer created successfully",
                    transfer_id: insertResult.insertId,
                  })
                }

                const sender_name = senderResults[0].name

                res.status(201).json({
                  success: true,
                  message: "Transfer created successfully",
                  transfer_id: insertResult.insertId,
                  sender_name: sender_name,
                })
              })
            },
          )
        })
      })
    })
  } catch (error) {
    console.error("[TRANSFER] Error creating transfer:", error)
    res.status(500).json({
      success: false,
      message: "Server error occurred",
    })
  }
})

app.get("/get-pending-transfers/:userId", (req, res) => {
  const userId = req.params.userId

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" })
  }

  const query = `
    SELECT mt.*, u.name as sender_name 
    FROM money_transfers mt 
    JOIN users u ON mt.sender_id = u.id 
    WHERE mt.recipient_id = ? AND mt.status = 'pending'
    ORDER BY mt.created_at DESC
  `

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Error getting pending transfers:", err)
      return res.status(500).json({ error: "Database error" })
    }

    res.json({ transfers: results })
  })
})

app.post("/respond-to-transfer", (req, res) => {
  const { transfer_id, response } = req.body

  if (!transfer_id || !response) {
    return res.status(400).json({
      success: false,
      message: "Transfer ID and response are required",
    })
  }

  // First, get the transfer details
  db.query("SELECT * FROM money_transfers WHERE id = ?", [transfer_id], (err, transfers) => {
    if (err) {
      console.error("Error getting transfer details:", err)
      return res.status(500).json({
        success: false,
        error: "Database error occurred",
      })
    }

    if (transfers.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Transfer not found",
      })
    }

    const transferData = transfers[0]

    // Check if transfer is already processed
    if (transferData.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: "Transfer has already been processed",
      })
    }

    // Update transfer status
    db.query("UPDATE money_transfers SET status = ? WHERE id = ?", [response, transfer_id], (updateErr) => {
      if (updateErr) {
        console.error("Error updating transfer status:", updateErr)
        return res.status(500).json({
          success: false,
          error: "Failed to update transfer status",
        })
      }

      // If rejected, just return success
      if (response !== "accepted") {
        return res.json({
          success: true,
          message: `Transfer ${response} successfully`,
          transfer_id: transfer_id,
        })
      }

      // If accepted, update wallets
      const transferAmount = Number(transferData.amount)
      const sender_id = transferData.sender_id
      const recipient_id = transferData.recipient_id
      const transferDate = new Date().toISOString().slice(0, 10)

      // Check sender's wallet balance
      db.query("SELECT balance FROM wallet WHERE user_id = ?", [sender_id], (senderErr, senderResults) => {
        if (senderErr) {
          console.error("Error checking sender wallet:", senderErr)
          return res.status(500).json({
            success: false,
            error: "Database error occurred",
          })
        }

        if (senderResults.length === 0) {
          return res.status(400).json({
            success: false,
            error: "Sender wallet not found",
          })
        }

        const senderBalance = Number(senderResults[0].balance)

        if (senderBalance < transferAmount) {
          return res.status(400).json({
            success: false,
            error: "Sender has insufficient balance",
          })
        }

        // Update sender's wallet (subtract amount)
        db.query(
          "UPDATE wallet SET balance = balance - ? WHERE user_id = ?",
          [transferAmount, sender_id],
          (senderUpdateErr) => {
            if (senderUpdateErr) {
              console.error("Error updating sender wallet:", senderUpdateErr)
              return res.status(500).json({
                success: false,
                error: "Failed to update sender wallet",
              })
            }

            // Check if recipient has a wallet
            db.query("SELECT * FROM wallet WHERE user_id = ?", [recipient_id], (recipientErr, recipientResults) => {
              if (recipientErr) {
                console.error("Error checking recipient wallet:", recipientErr)
                return res.status(500).json({
                  success: false,
                  error: "Database error occurred",
                })
              }

              let recipientQuery, recipientParams

              if (recipientResults.length === 0) {
                // Create new wallet for recipient
                recipientQuery = "INSERT INTO wallet (user_id, balance) VALUES (?, ?)"
                recipientParams = [recipient_id, transferAmount]
              } else {
                // Update existing wallet
                recipientQuery = "UPDATE wallet SET balance = balance + ? WHERE user_id = ?"
                recipientParams = [transferAmount, recipient_id]
              }

              db.query(recipientQuery, recipientParams, (recipientUpdateErr) => {
                if (recipientUpdateErr) {
                  console.error("Error updating recipient wallet:", recipientUpdateErr)
                  // Rollback sender's wallet update
                  db.query(
                    "UPDATE wallet SET balance = balance + ? WHERE user_id = ?",
                    [transferAmount, sender_id],
                    () => {
                      return res.status(500).json({
                        success: false,
                        error: "Failed to update recipient wallet",
                      })
                    },
                  )
                  return
                }

                // Record debit entry for sender
                const debitQuery = `
                  INSERT INTO debit_entries 
                  (user_id, amount, category, entry_date, description, recipient_id) 
                  VALUES (?, ?, 'Money Transfer', ?, ?, ?)
                `
                db.query(
                  debitQuery,
                  [
                    sender_id,
                    transferAmount,
                    transferDate,
                    `Transfer to user ID ${recipient_id}: ${transferData.description || "No description"}`,
                    recipient_id,
                  ],
                  (debitErr) => {
                    if (debitErr) {
                      console.error("Error creating debit entry:", debitErr)
                      // Continue anyway, wallet updates are more important
                    }

                    // Record credit entry for recipient
                    const creditQuery = `
                      INSERT INTO credit_entries 
                      (user_id, amount, category, entry_date, description) 
                      VALUES (?, ?, 'Money Transfer', ?, ?)
                    `
                    db.query(
                      creditQuery,
                      [
                        recipient_id,
                        transferAmount,
                        transferDate,
                        `Received from user ID ${sender_id}: ${transferData.description || "No description"}`,
                      ],
                      (creditErr) => {
                        if (creditErr) {
                          console.error("Error creating credit entry:", creditErr)
                          // Continue anyway, wallet updates are more important
                        }

                        console.log(`[TRANSFER] Successfully processed transfer #${transfer_id}:
                          Amount: ${transferAmount}
                          From: ${sender_id}
                          To: ${recipient_id}
                          Status: ${response}`)

                        res.json({
                          success: true,
                          message: `Transfer ${response} successfully`,
                          transfer_id: transfer_id,
                        })
                      },
                    )
                  },
                )
              })
            })
          },
        )
      })
    })
  })
})

app.get("/get-sent-transfers/:userId", (req, res) => {
  const userId = req.params.userId

  const query = `
    SELECT mt.*, u.name as recipient_name 
    FROM money_transfers mt 
    JOIN users u ON mt.recipient_id = u.id 
    WHERE mt.sender_id = ? 
    ORDER BY mt.created_at DESC`

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Error getting sent transfers:", err)
      return res.status(500).json({ error: "Database error" })
    }
    res.json({ transfers: results })
  })
})

app.get("/get-received-transfers/:userId", (req, res) => {
  const userId = req.params.userId

  const query = `
    SELECT mt.*, u.name as sender_name 
    FROM money_transfers mt 
    JOIN users u ON mt.sender_id = u.id 
    WHERE mt.recipient_id = ? AND mt.status != 'pending'
    ORDER BY mt.created_at DESC`

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Error getting received transfers:", err)
      return res.status(500).json({ error: "Database error" })
    }
    res.json({ transfers: results })
  })
})

// ---------------- Debt Management ---------------------------

function updateWalletBalanceDebt(userId, amount, operation, callback) {
  const operationSign = operation === "add" ? "+" : "-"
  const query = `UPDATE wallet SET balance = balance ${operationSign} ? WHERE user_id = ?`

  db.query(query, [amount, userId], (err, result) => {
    if (err) {
      console.error("Error updating wallet balance:", err)
      return callback(err)
    }
    callback(null)
  })
}

app.post("/add-debt", (req, res) => {
  const { user_id, amount, interest_rate, interest_type, start_date, due_date, description, counterparty, debt_type } =
    req.body

  if (!user_id || !amount || !start_date || !due_date || !debt_type) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
    })
  }

  const remaining_amount = amount

  const query = `
      INSERT INTO debts 
      (user_id, amount, interest_rate, interest_type, start_date, due_date, description, counterparty, debt_type, remaining_amount) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `

  db.query(
    query,
    [
      user_id,
      amount,
      interest_rate || 0,
      interest_type || "simple",
      start_date,
      due_date,
      description || "",
      counterparty || "",
      debt_type,
      remaining_amount,
    ],
    (err, result) => {
      if (err) {
        console.error("Database error:", err)
        return res.status(500).json({
          success: false,
          message: "Failed to save debt entry",
          error: err.message,
        })
      }

      const operation = debt_type === "given" ? "subtract" : "add"

      updateWalletBalanceDebt(user_id, amount, operation, (walletErr) => {
        if (walletErr) {
          console.error("Error updating wallet balance:", walletErr)
          return res.status(201).json({
            success: true,
            message: "Debt entry added but wallet balance update failed",
            id: result.insertId,
          })
        }

        res.status(201).json({
          success: true,
          message: "Debt entry added successfully",
          id: result.insertId,
        })
      })
    },
  )
})

app.get("/get-debts/:userId", (req, res) => {
  const userId = req.params.userId

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" })
  }

  const query = "SELECT * FROM debts WHERE user_id = ? ORDER BY due_date ASC"

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Error getting debts:", err)
      return res.status(500).json({ error: "Database error" })
    }

    const debtsWithInterest = results.map((debt) => {
      const currentDate = new Date()
      const startDate = new Date(debt.start_date)
      const dueDate = new Date(debt.due_date)

      const timeDiff = Math.max(0, (currentDate - startDate) / (1000 * 60 * 60 * 24))

      let currentInterest = 0

      if (debt.interest_rate > 0) {
        if (debt.interest_type === "simple") {
          currentInterest = debt.amount * (debt.interest_rate / 100) * (timeDiff / 365)
        } else {
          currentInterest = debt.amount * Math.pow(1 + debt.interest_rate / 100, timeDiff / 365) - debt.amount
        }
      }

      return {
        ...debt,
        current_interest: Number.parseFloat(currentInterest.toFixed(2)),
        total_amount: Number.parseFloat(
          (Number.parseFloat(debt.remaining_amount) + Number.parseFloat(currentInterest)).toFixed(2),
        ),
        days_remaining: Math.max(0, Math.ceil((dueDate - currentDate) / (1000 * 60 * 60 * 24))),
        is_overdue: currentDate > dueDate && debt.status !== "fully_paid",
      }
    })

    res.json({
      success: true,
      debts: debtsWithInterest,
      statistics: {
        total_given: debtsWithInterest
          .filter((d) => d.debt_type === "given")
          .reduce((sum, d) => sum + d.total_amount, 0)
          .toFixed(2),
        total_received: debtsWithInterest
          .filter((d) => d.debt_type === "received")
          .reduce((sum, d) => sum + d.total_amount, 0)
          .toFixed(2),
        active_debts: debtsWithInterest.filter((d) => d.status === "active").length,
        overdue_debts: debtsWithInterest.filter((d) => d.is_overdue).length,
      },
    })
  })
})

app.post("/collect-debt", (req, res) => {
  const { debt_id, amount, transaction_date, description } = req.body

  if (!debt_id || !amount || !transaction_date) {
    return res.status(400).json({ error: "Missing required fields" })
  }

  const getDebtQuery = "SELECT * FROM debts WHERE id = ?"
  db.query(getDebtQuery, [debt_id], (err, results) => {
    if (err) {
      console.error("Error getting debt details:", err)
      return res.status(500).json({ error: "Database error" })
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Debt not found" })
    }

    const debt = results[0]
    const user_id = debt.user_id
    const debt_type = debt.debt_type
    const principal_amount = Number.parseFloat(debt.amount)
    const remaining_principal = Number.parseFloat(debt.remaining_amount || debt.amount)
    const interest_rate = Number.parseFloat(debt.interest_rate || 0)
    const interest_type = debt.interest_type || "simple"

    const currentDate = new Date(transaction_date)
    const startDate = new Date(debt.start_date)

    const timeDiff = Math.max(0, (currentDate - startDate) / (1000 * 60 * 60 * 24))
    let totalInterest = 0

    if (interest_rate > 0) {
      if (interest_type === "simple") {
        totalInterest = principal_amount * (interest_rate / 100) * (timeDiff / 365)
      } else {
        totalInterest = principal_amount * Math.pow(1 + interest_rate / 100, timeDiff / 365) - principal_amount
      }
    }
    totalInterest = Math.round(totalInterest * 100) / 100
    const totalDue = Math.round((remaining_principal + totalInterest) * 100) / 100
    const reqAmount = Math.round(Number.parseFloat(amount) * 100) / 100
    if (reqAmount > totalDue) {
      return res.status(400).json({ error: "Payment amount exceeds total due amount" })
    }

    let interestPayment = Math.min(reqAmount, totalInterest)
    let principalPayment = reqAmount - interestPayment
    interestPayment = Math.round(interestPayment * 100) / 100
    principalPayment = Math.round(principalPayment * 100) / 100

    const new_remaining_principal = Math.max(0, Math.round((remaining_principal - principalPayment) * 100) / 100)
    const new_remaining_interest = Math.max(0, Math.round((totalInterest - interestPayment) * 100) / 100)
    const new_remaining_total = Math.round((new_remaining_principal + new_remaining_interest) * 100) / 100

    const new_status =
      new_remaining_principal <= 0.009 ? "fully_paid" : principalPayment > 0 ? "partially_paid" : debt.status

    const updateDebtQuery = "UPDATE debts SET remaining_amount = ?, status = ? WHERE id = ?"
    db.query(updateDebtQuery, [new_remaining_principal, new_status, debt_id], (updateErr) => {
      if (updateErr) {
        console.error("Error updating debt:", updateErr)
        return res.status(500).json({ error: "Database error" })
      }

      const transactionType = debt_type === "given" ? "collection" : "payment"
      const addTransactionQuery = `
              INSERT INTO debt_transactions 
              (debt_id, amount, principal_payment, interest_payment, transaction_date, transaction_type, description) 
              VALUES (?, ?, ?, ?, ?, ?, ?)
          `

      db.query(
        addTransactionQuery,
        [debt_id, reqAmount, principalPayment, interestPayment, transaction_date, transactionType, description || ""],
        (transErr) => {
          if (transErr) {
            console.error("Error recording transaction:", transErr)
            return res.status(500).json({ error: "Database error" })
          }

          const walletOperation = debt_type === "given" ? "add" : "subtract"
          updateWalletBalanceDebt(user_id, reqAmount, walletOperation, (walletErr) => {
            if (walletErr) {
              console.error("Error updating wallet balance:", walletErr)
              return res.status(200).json({
                success: true,
                message: "Debt updated but wallet balance update failed",
              })
            }

            res.status(200).json({
              success: true,
              message: "Debt collection/payment processed successfully",
              new_status,
              remaining_principal: new_remaining_principal,
              remaining_interest: new_remaining_interest,
              remaining_total: new_remaining_total,
              interest_paid: interestPayment,
              principal_paid: principalPayment,
            })
          })
        },
      )
    })
  })
})

app.get("/debt-transactions/:debtId", (req, res) => {
  const debtId = req.params.debtId

  if (!debtId) {
    return res.status(400).json({ error: "Debt ID is required" })
  }

  const query = "SELECT * FROM debt_transactions WHERE debt_id = ? ORDER BY transaction_date DESC"
  db.query(query, [debtId], (err, results) => {
    if (err) {
      console.error("Error getting debt transactions:", err)
      return res.status(500).json({ error: "Database error" })
    }

    res.json({
      success: true,
      transactions: results,
    })
  })
})

app.get("/recent-transactions/:userId", (req, res) => {
  const userId = req.params.userId
  const limit = req.query.limit || 10

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" })
  }

  const query = `
      SELECT dt.* 
      FROM debt_transactions dt
      JOIN debts d ON dt.debt_id = d.id
      WHERE d.user_id = ?
      ORDER BY dt.transaction_date DESC
      LIMIT ?
  `

  db.query(query, [userId, Number.parseInt(limit)], (err, results) => {
    if (err) {
      console.error("Error getting recent transactions:", err)
      return res.status(500).json({ error: "Database error" })
    }

    res.json({
      success: true,
      transactions: results,
    })
  })
})

// Endpoint to get backend-calculated total due for a debt on a given date
app.get("/get-debt-due/:debtId", (req, res) => {
  const debtId = req.params.debtId
  const dateStr = req.query.date
  if (!debtId || !dateStr) {
    return res.status(400).json({ error: "Missing debtId or date" })
  }
  const getDebtQuery = "SELECT * FROM debts WHERE id = ?"
  db.query(getDebtQuery, [debtId], (err, results) => {
    if (err) {
      console.error("Error getting debt details:", err)
      return res.status(500).json({ error: "Database error" })
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Debt not found" })
    }
    const debt = results[0]
    const principal = Number.parseFloat(debt.amount)
    const remainingPrincipal = Number.parseFloat(debt.remaining_amount || debt.amount)
    const interestRate = Number.parseFloat(debt.interest_rate || 0)
    const interestType = debt.interest_type || "simple"
    const startDate = new Date(debt.start_date)
    const targetDate = new Date(dateStr)
    const timeDiff = Math.max(0, (targetDate - startDate) / (1000 * 60 * 60 * 24))
    let currentInterest = 0
    if (interestRate > 0) {
      if (interestType === "simple") {
        currentInterest = principal * (interestRate / 100) * (timeDiff / 365)
      } else {
        currentInterest = principal * Math.pow(1 + interestRate / 100, timeDiff / 365) - principal
      }
    }
    currentInterest = Math.round(currentInterest * 100) / 100
    const totalDue = Math.round((remainingPrincipal + currentInterest) * 100) / 100
    res.json({ total_due: totalDue, principal: remainingPrincipal, interest: currentInterest })
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err)
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  })
})

// 404 handler for undefined routes
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.url}`)
  res.status(404).json({
    error: "Route not found",
    method: req.method,
    url: req.url,
  })
})

// Start the server
const PORT = process.env.PORT
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Access the application at http://localhost:${PORT}`)
})
