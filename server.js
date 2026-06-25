import express from "express"
import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2"
import bodyParser from "body-parser"
import cors from "cors"
import fetch from 'node-fetch'
import dotenv from 'dotenv'
import bcrypt from 'bcrypt'
import { createInventoryRouter } from './routes/inventory.js'
import { createHRRouter } from './routes/hr.js'
import { createNotificationsRouter } from './routes/notifications.js'
import { startReminderScheduler } from './services/reminderScheduler.js'
import { startPayrollScheduler } from './services/payrollScheduler.js'

// Configure dotenv to look for .env in the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express()

const ALPHA_VANTAGE_API_KEY =  process.env.ALPHA_VANTAGE_API_KEY

// In-memory cache for stock prices (TTL based) - reduces Alpha Vantage hits
// Keyed by raw symbol uppercase. Value: { price, source, expiresAt }
const stockPriceCache = new Map();
const STOCK_PRICE_TTL_MS = 60 * 1000; // 60 seconds

// Tracks the last known rate-limit hit so we don't keep retrying within the minute
let alphaVantageRateLimitedUntil = 0;

async function fetchAlphaVantageQuote(symbol) {
  if (!ALPHA_VANTAGE_API_KEY || ALPHA_VANTAGE_API_KEY === 'your_alpha_vantage_api_key_here') {
    return { price: null, source: 'no_key' };
  }
  if (Date.now() < alphaVantageRateLimitedUntil) {
    return { price: null, source: 'rate_limited' };
  }
  try {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return { price: null, source: 'http_error' };
    const data = await response.json();

    // Rate limit responses
    if (data && (data.Note || data.Information)) {
      console.warn('[ALPHA-VANTAGE] Rate limit / info:', data.Note || data.Information);
      alphaVantageRateLimitedUntil = Date.now() + 60 * 1000; // back off 60s
      return { price: null, source: 'rate_limited' };
    }
    if (data && data['Error Message']) {
      return { price: null, source: 'invalid_symbol' };
    }
    const priceStr = data && data['Global Quote'] && data['Global Quote']['05. price'];
    if (priceStr) {
      const price = parseFloat(priceStr);
      if (!isNaN(price) && price > 0) {
        return { price, source: 'alphavantage', resolvedSymbol: symbol };
      }
    }
    return { price: null, source: 'empty_response' };
  } catch (err) {
    console.error('[ALPHA-VANTAGE] Fetch error for', symbol, ':', err.message);
    return { price: null, source: 'fetch_error' };
  }
}

// Resolve a stock price by trying .BSE -> .NSE -> raw symbol, with caching.
async function resolveStockPrice(rawSymbol) {
  const symbol = String(rawSymbol || '').trim().toUpperCase();
  if (!symbol) return { price: null, source: 'invalid_symbol' };

  // Cache lookup
  const cached = stockPriceCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) {
    return { price: cached.price, source: cached.source, cached: true, resolvedSymbol: cached.resolvedSymbol };
  }

  const candidates = symbol.includes('.')
    ? [symbol]
    : [`${symbol}.BSE`, `${symbol}.NSE`, symbol];

  let lastSource = 'no_data';
  for (const candidate of candidates) {
    const result = await fetchAlphaVantageQuote(candidate);
    if (result.price && result.price > 0) {
      stockPriceCache.set(symbol, {
        price: result.price,
        source: result.source,
        resolvedSymbol: result.resolvedSymbol || candidate,
        expiresAt: Date.now() + STOCK_PRICE_TTL_MS,
      });
      return { price: result.price, source: result.source, resolvedSymbol: result.resolvedSymbol || candidate, cached: false };
    }
    lastSource = result.source;
    if (result.source === 'rate_limited') break; // no point trying more
  }

  return { price: null, source: lastSource };
}

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
const clientsDir = path.join(__dirname, "frontend/Clients")
const teamDir = path.join(__dirname, "frontend/Team")
const inventoryDir = path.join(__dirname, "frontend/Inventory")
const hrDir = path.join(__dirname, "frontend/HR")


// Serve static files from different directories
app.use("/Loginpage", express.static(LoginpageDir))
app.use("/Dashboard", express.static(dashboardDir))
app.use("/Debts", express.static(debtsDir))
app.use("/Investment", express.static(investmentDir))
app.use("/MoneyTransfer", express.static(moneyTransferDir))
app.use("/utils", express.static(utilsDir)) // Serve utils directory
app.use("/Clients", express.static(clientsDir)) // Serve clients directory
app.use("/Team", express.static(teamDir)) // Serve team directory
app.use("/Inventory", express.static(inventoryDir)) // Serve inventory directory
app.use("/HR", express.static(hrDir)) // Serve HR & Payroll directory
app.use(express.static(path.join(__dirname, "public")))

// MySQL connection pool
// MYSQLPORT defaults to 3306 (Railway internal MySQL); set explicitly for
// providers like TiDB Cloud / Aiven / PlanetScale that use custom ports.
// MYSQLSSL=true enables TLS, required by most managed providers other than
// Railway's internal network.
const db = mysql.createPool({
  host: process.env.MYSQLHOST,
  port: process.env.MYSQLPORT ? Number(process.env.MYSQLPORT) : 3306,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  ssl: process.env.MYSQLSSL === 'true' ? { rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Test the connection
db.getConnection(async (err, connection) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    console.error("Database configuration:", {
      host: process.env.MYSQLHOST,
      user: process.env.MYSQLUSER,
      database: process.env.MYSQLDATABASE,
    });
    return;
  }
  console.log("MySQL connected successfully");
  connection.release();

  // NOTE: All schema lives in penny_pilot_unified.sql (single source of truth).
  // Run that SQL file once to provision / update the database. We do NOT create or
  // alter tables from inside the application.

  // Kick off reminder cron (runs in-process, polls hourly).
  // It only reads/writes data; never touches schema.
  try {
    startReminderScheduler(db);
  } catch (schedErr) {
    console.error('Reminder scheduler failed to start:', schedErr);
  }

  // Kick off automatic monthly payroll (pays active employees from the wallet).
  try {
    startPayrollScheduler(db);
  } catch (payErr) {
    console.error('Payroll scheduler failed to start:', payErr);
  }
});

// Handle connection errors
db.on('error', (err) => {
  console.error('Database error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST' || 
      err.code === 'ECONNRESET' || 
      err.code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR') {
    console.log('Attempting to reconnect to database...');
  }
});

// Protected Routes - Add authentication check middleware
const checkAuth = (req, res, next) => {
  // For static file requests, we'll check if the request has a valid session
  const authHeader = req.headers.authorization;
  const sessionData = req.headers['x-session-data'];
  
  if (!authHeader && !sessionData) {
    return res.status(401).json({ error: 'Authentication required' });
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
    return res.status(401).json({ error: 'Invalid authentication data' });
  }
}

// Apply authentication check to protected API routes
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

// Real-time stock price endpoint with .BSE/.NSE/raw fallback and caching
app.get("/api/stock-price/:symbol", async (req, res) => {
  try {
    const symbol = String(req.params.symbol || '').trim().toUpperCase();
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const result = await resolveStockPrice(symbol);

    if (result.price && result.price > 0) {
      return res.json({
        price: result.price,
        symbol,
        resolved_symbol: result.resolvedSymbol || symbol,
        timestamp: new Date().toISOString(),
        source: result.source,
        cached: !!result.cached,
      });
    }

    // Real fetch failed - fall back to mock so the UI keeps working,
    // but tell the client exactly *why* via the `source` field so the toast can be accurate.
    const mockPrice = generateMockPrice(symbol);
    return res.json({
      price: mockPrice,
      symbol,
      timestamp: new Date().toISOString(),
      source: 'mock',
      reason: result.source, // 'rate_limited' | 'invalid_symbol' | 'no_key' | 'fetch_error' | 'empty_response'
      note: result.source === 'rate_limited'
        ? 'Alpha Vantage rate limit hit (free tier = 25 requests/day). Showing mock price.'
        : result.source === 'no_key'
          ? 'ALPHA_VANTAGE_API_KEY not configured. Showing mock price.'
          : 'Real-time price not available. Showing mock price.'
    });
  } catch (error) {
    console.error('Error fetching stock price:', error);
    res.status(500).json({ error: 'Failed to fetch stock price' });
  }
});

// Generate a realistic mock price for testing
function generateMockPrice(symbol) {
  // Common Indian stock symbols with realistic base prices
  const stockPrices = {
    'RELIANCE': 2800,
    'TCS': 3600,
    'INFY': 1450,
    'HDFCBANK': 1650,
    'ICICIBANK': 950,
    'ITC': 420,
    'SBIN': 580,
    'BHARTIARTL': 850,
    'ASIANPAINT': 3200,
    'MARUTI': 9800,
    'WIPRO': 420,
    'TECHM': 1200,
    'ULTRACEMCO': 8500,
    'TITAN': 3100,
    'POWERGRID': 220,
    'NESTLEIND': 21000,
    'HCLTECH': 1180,
    'BAJFINANCE': 6800,
    'COALINDIA': 280,
    'NTPC': 180
  };
  
  // Check if it's a known stock symbol
  let basePrice = stockPrices[symbol.toUpperCase()];
  
  if (!basePrice) {
    // Generate price based on symbol hash for unknown stocks
    const hash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    basePrice = (hash % 1000) + 100; // Price between 100-1100
  }
  
  // Add small random variation (±2%)
  const variation = (Math.random() - 0.5) * 0.04; // ±2%
  const finalPrice = basePrice * (1 + variation);
  
  return Number(finalPrice.toFixed(2));
}

// Routes
// Basic Navigation Routes - FIXED
app.get("/", (req, res) => {
  // Always start at the login page
  res.redirect("/Loginpage/index.html");
});

app.get("/Loginpage/index.html", (req, res) => {
  res.sendFile(path.join(LoginpageDir, "index.html"))
})

// Dashboard routes - the frontend script will handle authentication
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(dashboardDir, "dashboard.html"))
})

app.get("/Dashboard/dashboard.html", (req, res) => {
  res.sendFile(path.join(dashboardDir, "dashboard.html"))
})

app.get("/debts", (req, res) => {
  res.sendFile(path.join(debtsDir, "debts.html"))
})

app.get("/Debts/debts.html", (req, res) => {
  res.sendFile(path.join(debtsDir, "debts.html"))
})

app.get("/investment", (req, res) => {
  res.sendFile(path.join(investmentDir, "Investments.html"))
})

app.get("/Investment/investment.html", (req, res) => {
  res.sendFile(path.join(investmentDir, "Investments.html"))
})

app.get("/Investment/Investments.html", (req, res) => {
  res.sendFile(path.join(investmentDir, "Investments.html"))
})

app.get("/money-transfer", (req, res) => {
  res.sendFile(path.join(moneyTransferDir, "money-transfer.html"))
})

app.get("/MoneyTransfer/money-transfer.html", (req, res) => {
  res.sendFile(path.join(moneyTransferDir, "money-transfer.html"))
})

app.get("/clients", (req, res) => {
  res.sendFile(path.join(clientsDir, "clients.html"))
})

app.get("/Clients/clients.html", (req, res) => {
  res.sendFile(path.join(clientsDir, "clients.html"))
})

app.get("/client-management", (req, res) => {
  res.sendFile(path.join(clientsDir, "clients.html"))
})

app.get("/team", (req, res) => {
  res.sendFile(path.join(teamDir, "team.html"))
})

app.get("/Team/team.html", (req, res) => {
  res.sendFile(path.join(teamDir, "team.html"))
})

app.get("/inventory", (req, res) => {
  res.sendFile(path.join(inventoryDir, "inventory.html"))
})

app.get("/Inventory/inventory.html", (req, res) => {
  res.sendFile(path.join(inventoryDir, "inventory.html"))
})

app.get("/hr", (req, res) => {
  res.sendFile(path.join(hrDir, "hr.html"))
})

app.get("/HR/hr.html", (req, res) => {
  res.sendFile(path.join(hrDir, "hr.html"))
})



app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => res.status(204).end());


// Authentication Routes
app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body

  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required" })
  }

  // Check if email already exists
  const checkSql = "SELECT * FROM users WHERE email = ?"
  db.query(checkSql, [email], async (checkErr, checkResult) => {
    if (checkErr) {
      console.error("Database error checking email:", checkErr)
      return res.status(500).json({ error: "Database error occurred" })
    }

    if (checkResult.length > 0) {
      return res.status(400).json({ error: "Email already exists" })
    }

    try {
      // Hash the password using bcrypt
      const saltRounds = 10
      const hashedPassword = await bcrypt.hash(password, saltRounds)

      // If email doesn't exist, proceed with signup
      const sql = "INSERT INTO users (name, email, password) VALUES (?, ?, ?)"
      db.query(sql, [name, email, hashedPassword], (err, result) => {
        if (err) {
          console.error("Database error during signup:", err)
          return res.status(500).json({ error: "Database error occurred" })
        }
        res.status(200).json({ message: "User registered successfully. Please sign in." })
      })
    } catch (hashError) {
      console.error("Error hashing password:", hashError)
      return res.status(500).json({ error: "Error processing password" })
    }
  })
})

app.post("/signin", (req, res) => {
  const { email, password } = req.body
  
  console.log("Attempting signin for email:", email)

  if (!email || !password) {
    console.log("Missing email or password")
    return res.status(400).json({ error: "Email and password are required" })
  }

  // Get a connection from the pool
  db.getConnection((err, connection) => {
    if (err) {
      console.error("Error getting connection from pool:", err);
      return res.status(500).json({ error: "Database connection error" });
    }

    const sql = "SELECT * FROM users WHERE email = ?"
    connection.query(sql, [email], async (err, results) => {
      // Release the connection back to the pool
      connection.release();

      if (err) {
        console.error("Database error during sign in:", err)
        return res.status(500).json({ error: "Database error occurred during sign in" })
      }

      if (results.length === 0) {
        console.log("No user found with provided credentials")
        return res.status(401).json({ error: "Invalid email or password" })
      }

      // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
      const storedPassword = results[0].password
      const isHashed = storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')
      
      let passwordMatch = false
      
      try {
        if (isHashed) {
          // Password is already hashed, use bcrypt.compare
          passwordMatch = await bcrypt.compare(password, storedPassword)
        } else {
          // Password is plain text (legacy), compare directly
          passwordMatch = password === storedPassword
          
          // If login succeeds with plain text, automatically hash and update the password
          if (passwordMatch) {
            console.log("Migrating plain text password to bcrypt hash for user:", email)
            const saltRounds = 10
            const hashedPassword = await bcrypt.hash(password, saltRounds)
            
            // Update the password in the database
            const updateSql = "UPDATE users SET password = ? WHERE email = ?"
            db.query(updateSql, [hashedPassword, email], (updateErr) => {
              if (updateErr) {
                console.error("Error updating password hash:", updateErr)
                // Don't fail the login if hash update fails, just log it
              } else {
                console.log("Successfully migrated password to bcrypt hash for user:", email)
              }
            })
          }
        }
        
        if (!passwordMatch) {
          console.log("Password mismatch for user:", email)
          return res.status(401).json({ error: "Invalid email or password" })
        }

        const user = {
          id: results[0].id,
          name: results[0].name,
          email: results[0].email
        }

        console.log("Successful signin for user:", user.email)
        res.json({ user })
      } catch (compareError) {
        console.error("Error comparing passwords:", compareError)
        return res.status(500).json({ error: "Error verifying password" })
      }
    });
  });
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

router.post("/sell-stock", (req, res) => {
  const { user_id, investment_id, sell_price, sell_quantity, sell_date, partial_sale } = req.body;

  // Validate required fields
  if (!user_id || !investment_id || !sell_price || !sell_quantity || !sell_date) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
    });
  }

  // Validate numeric values
  const sellPrice = Number(sell_price);
  const sellQuantity = Number(sell_quantity);
  
  if (isNaN(sellPrice) || isNaN(sellQuantity) || sellPrice <= 0 || sellQuantity <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid price or quantity",
    });
  }

  console.log(`[SELL-STOCK] Processing sell request for user ${user_id}, investment ${investment_id}`);

  // Get investment details
  const getInvestmentQuery = "SELECT * FROM stock_investments WHERE id = ? AND user_id = ? AND status = 'active'";
  db.query(getInvestmentQuery, [investment_id, user_id], (investmentErr, investmentResults) => {
    if (investmentErr) {
      console.error("Error fetching investment:", investmentErr);
      return res.status(500).json({
        success: false,
        message: "Database error fetching investment",
      });
    }

    if (investmentResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Investment not found or already sold",
      });
    }

    const currentInvestment = investmentResults[0];
    
    // Validate quantity
    if (sellQuantity > currentInvestment.quantity) {
      return res.status(400).json({
        success: false,
        message: `Cannot sell more shares than owned. You own ${currentInvestment.quantity} shares.`,
      });
    }

    const totalSaleAmount = sellPrice * sellQuantity;
    const buyAmount = Number(currentInvestment.buy_price) * sellQuantity;
    const profit = totalSaleAmount - buyAmount;
    const remainingQuantity = currentInvestment.quantity - sellQuantity;

    console.log(`[SELL-STOCK] Selling ${sellQuantity} shares at ₹${sellPrice} each. Total: ₹${totalSaleAmount}`);

    // Determine if this is a partial sale
    const isPartialSale = remainingQuantity > 0;

    let updateQuery;
    let updateParams;

    if (isPartialSale) {
      // Partial sale - update quantity and current price
      updateQuery = "UPDATE stock_investments SET quantity = ?, current_price = ? WHERE id = ?";
      updateParams = [remainingQuantity, sellPrice, investment_id];
    } else {
      // Full sale - mark as sold
      updateQuery = "UPDATE stock_investments SET status = 'sold', sell_price = ?, sell_date = ?, current_price = ? WHERE id = ?";
      updateParams = [sellPrice, sell_date, sellPrice, investment_id];
    }

    // Update the investment
    db.query(updateQuery, updateParams, (updateErr) => {
      if (updateErr) {
        console.error("Error updating investment:", updateErr);
        return res.status(500).json({
          success: false,
          message: "Failed to update investment",
        });
      }

      // For partial sales, create a new sold record
      const createSoldRecord = (cb) => {
        if (isPartialSale) {
          const soldRecordQuery = `
            INSERT INTO stock_investments 
            (user_id, stock_name, buy_price, current_price, quantity, buy_date, sell_price, sell_date, status, description) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'sold', ?)`;
          
          const soldRecordParams = [
            user_id,
            currentInvestment.stock_name,
            currentInvestment.buy_price,
            sellPrice,
            sellQuantity,
            currentInvestment.buy_date,
            sellPrice,
            sell_date,
            currentInvestment.description || `Partial sale of ${currentInvestment.stock_name}`
          ];

          db.query(soldRecordQuery, soldRecordParams, (soldErr) => {
            if (soldErr) {
              console.error("Error creating sold record:", soldErr);
              return res.status(500).json({
                success: false,
                message: "Failed to create sold record",
              });
            }
            cb();
          });
        } else {
          cb();
        }
      };

      createSoldRecord(() => {
        // Update wallet balance
        const walletUpdateQuery = "UPDATE wallet SET balance = balance + ? WHERE user_id = ?";
        db.query(walletUpdateQuery, [totalSaleAmount, user_id], (walletErr) => {
          if (walletErr) {
            console.error("Error updating wallet:", walletErr);
            return res.status(500).json({
              success: false,
              message: "Failed to update wallet balance",
            });
          }

          // Create credit entry
          const creditEntryQuery = `
            INSERT INTO credit_entries (user_id, amount, category, entry_date, description) 
            VALUES (?, ?, 'Investments Relieved', ?, ?)`;
          const creditDescription = `Sold ${sellQuantity} shares of ${currentInvestment.stock_name} @ ₹${sellPrice.toFixed(2)} each`;
          db.query(creditEntryQuery, [user_id, totalSaleAmount, sell_date, creditDescription], (creditErr) => {
            if (creditErr) {
              console.error("Error creating credit entry:", creditErr);
              return res.status(500).json({
                success: false,
                message: "Failed to create credit entry",
              });
            }

            // Success response
            console.log(`[SELL-STOCK] Successfully sold ${sellQuantity} shares of ${currentInvestment.stock_name}`);
            res.status(200).json({
              success: true,
              message: "Stock sold successfully",
              data: {
                total_sale_amount: totalSaleAmount,
                profit: profit,
                remaining_quantity: remainingQuantity,
                stock_name: currentInvestment.stock_name,
                sell_price: sellPrice,
                sell_quantity: sellQuantity,
                is_partial_sale: isPartialSale
              }
            });
          });
        });
      });
    });
  });
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
          const stockSymbol = investment.stock_name.toUpperCase();
          let currentPrice = null;

          const priceResult = await resolveStockPrice(stockSymbol);
          if (priceResult.price && priceResult.price > 0) {
            currentPrice = priceResult.price;
            // Persist the freshly fetched price for next load
            await db.promise().query(
              "UPDATE stock_investments SET current_price = ? WHERE id = ?",
              [currentPrice, investment.id]
            );
          } else {
            // Use last known price from DB (don't fall back to mock for portfolio valuation)
            currentPrice = Number(investment.current_price) || Number(investment.buy_price);
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
    res.json({ 
      price: mockPrice,
      symbol: stockName,
      timestamp: new Date().toISOString(),
      source: 'mock'
    })
  } catch (error) {
    console.error("Error fetching stock price:", error)
    res.status(500).json({ error: "Failed to fetch stock price" })
  }
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use("/api", router)

// ============================
// INVENTORY & PROCUREMENT MODULE
// ============================
app.use('/api/inventory', createInventoryRouter({ db, checkAuth, updateWalletBalance }));

// ============================
// HR & PAYROLL MODULE
// ============================
app.use('/api/hr', createHRRouter({ db, checkAuth }));

// ============================
// NOTIFICATIONS / REMINDERS
// ============================
app.use('/api/notifications', createNotificationsRouter({ db, checkAuth }));

// ============================
// CLIENT MANAGEMENT ERP MODULE
// ============================

// Client Routes

// Get all clients for a user
app.get('/api/clients', checkAuth, (req, res) => {
  const userId = req.user.id;
  
  // For development, we'll use the customers table from the ERP database
  const query = `
    SELECT c.*, 
           COALESCE(SUM(CASE WHEN ct.transaction_type = 'income' THEN ct.amount ELSE 0 END), 0) as revenue_collected,
           COALESCE(SUM(CASE WHEN ct.transaction_type = 'expense' THEN ct.amount ELSE 0 END), 0) as total_expenses,
           COALESCE(SUM(CASE WHEN ct.transaction_type = 'income' THEN ct.amount ELSE 0 END), 0) - 
           COALESCE(SUM(CASE WHEN ct.transaction_type = 'expense' THEN ct.amount ELSE 0 END), 0) as total_revenue,
           COUNT(CASE WHEN i.status IN ('draft', 'sent') THEN 1 END) as pending_invoices
    FROM customers c
    LEFT JOIN client_transactions ct ON c.id = ct.client_id
    LEFT JOIN invoices i ON c.id = i.client_id
    WHERE c.created_by = ?
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `;
  
  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching clients:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({
      success: true,
      clients: results
    });
  });
});

// Create new client
app.post('/api/clients', checkAuth, (req, res) => {
  const userId = req.user.id;
  const {
    customer_type,
    first_name,
    last_name,
    company_name,
    email,
    phone,
    address,
    city,
    state,
    postal_code,
    country,
    customer_status,
    credit_limit,
    payment_terms,
    notes
  } = req.body;
  
  // Validate required fields
  if (!customer_type || !email || !phone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (customer_type === 'business' && !company_name) {
    return res.status(400).json({ error: 'Company name is required for business clients' });
  }
  
  if (customer_type === 'individual' && (!first_name || !last_name)) {
    return res.status(400).json({ error: 'First name and last name are required for individual clients' });
  }
  
  // Check if email already exists
  db.query('SELECT id FROM customers WHERE email = ?', [email], (err, existing) => {
    if (err) {
      console.error('Error checking existing email:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    const insertQuery = `
      INSERT INTO customers (
        customer_type, first_name, last_name, company_name, email, phone, 
        address, city, state, postal_code, country, customer_status, 
        credit_limit, payment_terms, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      customer_type,
      first_name || null,
      last_name || null,
      company_name || null,
      email,
      phone,
      address || null,
      city || null,
      state || null,
      postal_code || null,
      country || 'India',
      customer_status || 'prospect',
      credit_limit || 0,
      payment_terms || null,
      notes || null,
      userId
    ];
    
    db.query(insertQuery, values, (err, result) => {
      if (err) {
        console.error('Error creating client:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.status(201).json({
        success: true,
        message: 'Client created successfully',
        client_id: result.insertId
      });
    });
  });
});

// Update client
app.put('/api/clients/:id', checkAuth, (req, res) => {
  const userId = req.user.id;
  const clientId = req.params.id;
  const {
    customer_type,
    first_name,
    last_name,
    company_name,
    email,
    phone,
    address,
    city,
    state,
    postal_code,
    country,
    customer_status,
    credit_limit,
    payment_terms,
    notes
  } = req.body;
  
  // Validate required fields
  if (!customer_type || !email || !phone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Check if client exists and belongs to user
  db.query('SELECT id FROM customers WHERE id = ? AND created_by = ?', [clientId, userId], (err, existing) => {
    if (err) {
      console.error('Error checking client ownership:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const updateQuery = `
      UPDATE customers SET 
        customer_type = ?, first_name = ?, last_name = ?, company_name = ?, 
        email = ?, phone = ?, address = ?, city = ?, state = ?, postal_code = ?, 
        country = ?, customer_status = ?, credit_limit = ?, payment_terms = ?, 
        notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND created_by = ?
    `;
    
    const values = [
      customer_type,
      first_name || null,
      last_name || null,
      company_name || null,
      email,
      phone,
      address || null,
      city || null,
      state || null,
      postal_code || null,
      country || 'India',
      customer_status || 'prospect',
      credit_limit || 0,
      payment_terms || null,
      notes || null,
      clientId,
      userId
    ];
    
    db.query(updateQuery, values, (err, result) => {
      if (err) {
        console.error('Error updating client:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({
        success: true,
        message: 'Client updated successfully'
      });
    });
  });
});

// Delete client
app.delete('/api/clients/:id', checkAuth, (req, res) => {
  const userId = req.user.id;
  const clientId = req.params.id;
  
  // Check if client exists and belongs to user
  db.query('SELECT id FROM customers WHERE id = ? AND created_by = ?', [clientId, userId], (err, existing) => {
    if (err) {
      console.error('Error checking client ownership:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    db.query('DELETE FROM customers WHERE id = ? AND created_by = ?', [clientId, userId], (err, result) => {
      if (err) {
        console.error('Error deleting client:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({
        success: true,
        message: 'Client deleted successfully'
      });
    });
  });
});

// Client Transactions

// Create client transaction
app.post('/api/client-transactions', checkAuth, (req, res) => {
  const userId = req.user.id;
  const {
    client_id,
    transaction_type,
    amount,
    description,
    transaction_date
  } = req.body;
  
  if (!client_id || !transaction_type || !amount || !description || !transaction_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Verify client belongs to user
  db.query('SELECT id FROM customers WHERE id = ? AND created_by = ?', [client_id, userId], (err, client) => {
    if (err) {
      console.error('Error verifying client:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (client.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const insertQuery = `
      INSERT INTO client_transactions (client_id, transaction_type, amount, description, transaction_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    db.query(insertQuery, [client_id, transaction_type, amount, description, transaction_date, userId], (err, result) => {
      if (err) {
        console.error('Error creating transaction:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Update wallet balance based on transaction type
      if (transaction_type === 'income') {
        updateWalletBalance(userId, amount, 'add', (walletErr) => {
          if (walletErr) {
            console.error('Error updating wallet balance for income:', walletErr);
          }
        });
      } else if (transaction_type === 'expense') {
        // Subtract from wallet for expense transactions
        updateWalletBalance(userId, amount, 'subtract', (walletErr) => {
          if (walletErr) {
            console.error('Error updating wallet balance for expense:', walletErr);
          }
        });
      }
      
      res.status(201).json({
        success: true,
        message: 'Transaction created successfully',
        transaction_id: result.insertId
      });
    });
  });
});

// Get client transactions
app.get('/api/client-transactions/:clientId', checkAuth, (req, res) => {
  const userId = req.user.id;
  const clientId = req.params.clientId;
  
  // Verify client belongs to user
  db.query('SELECT id FROM customers WHERE id = ? AND created_by = ?', [clientId, userId], (err, client) => {
    if (err) {
      console.error('Error verifying client:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (client.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const query = `
      SELECT * FROM client_transactions 
      WHERE client_id = ? 
      ORDER BY transaction_date DESC, created_at DESC
    `;
    
    db.query(query, [clientId], (err, results) => {
      if (err) {
        console.error('Error fetching transactions:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({
        success: true,
        transactions: results
      });
    });
  });
});

// Invoice Management

// Create invoice
app.post('/api/invoices', checkAuth, (req, res) => {
  const userId = req.user.id;
  const {
    client_id,
    amount,
    description,
    due_date,
    status
  } = req.body;
  
  if (!client_id || !amount || !description || !due_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Verify client belongs to user
  db.query('SELECT id FROM customers WHERE id = ? AND created_by = ?', [client_id, userId], (err, client) => {
    if (err) {
      console.error('Error verifying client:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (client.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const insertQuery = `
      INSERT INTO invoices (client_id, amount, description, due_date, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    db.query(insertQuery, [client_id, amount, description, due_date, status || 'draft', userId], (err, result) => {
      if (err) {
        console.error('Error creating invoice:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        invoice_id: result.insertId
      });
    });
  });
});

// Get client invoices
app.get('/api/invoices/:clientId', checkAuth, (req, res) => {
  const userId = req.user.id;
  const clientId = req.params.clientId;
  
  // Verify client belongs to user
  db.query('SELECT id FROM customers WHERE id = ? AND created_by = ?', [clientId, userId], (err, client) => {
    if (err) {
      console.error('Error verifying client:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (client.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const query = `
      SELECT * FROM invoices 
      WHERE client_id = ? 
      ORDER BY created_at DESC
    `;
    
    db.query(query, [clientId], (err, results) => {
      if (err) {
        console.error('Error fetching invoices:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({
        success: true,
        invoices: results
      });
    });
  });
});

// Update invoice status
app.put('/api/invoices/:id/status', checkAuth, (req, res) => {
  const userId = req.user.id;
  const invoiceId = req.params.id;
  const { status } = req.body;
  
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }
  
  // Verify invoice belongs to user
  db.query('SELECT id FROM invoices WHERE id = ? AND created_by = ?', [invoiceId, userId], (err, invoice) => {
    if (err) {
      console.error('Error verifying invoice:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (invoice.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    db.query('UPDATE invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [status, invoiceId], (err, result) => {
      if (err) {
        console.error('Error updating invoice status:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({
        success: true,
        message: 'Invoice status updated successfully'
      });
    });
  });
});

// Client Analytics
app.get('/api/client-analytics', checkAuth, (req, res) => {
  const userId = req.user.id;
  
  const analyticsQuery = `
    SELECT 
      COUNT(*) as total_clients,
      COUNT(CASE WHEN customer_status = 'active' THEN 1 END) as active_clients,
      COUNT(CASE WHEN customer_status = 'inactive' THEN 1 END) as inactive_clients,
      COUNT(CASE WHEN customer_status = 'prospect' THEN 1 END) as prospect_clients,
      COALESCE(SUM(CASE WHEN ct.transaction_type = 'income' THEN ct.amount ELSE 0 END), 0) as total_revenue,
      COUNT(CASE WHEN i.status IN ('draft', 'sent') THEN 1 END) as pending_invoices
    FROM customers c
    LEFT JOIN client_transactions ct ON c.id = ct.client_id
    LEFT JOIN invoices i ON c.id = i.client_id
    WHERE c.created_by = ?
  `;
  
  db.query(analyticsQuery, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching analytics:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({
      success: true,
      analytics: results[0]
    });
  });
});

// -------------------- Money Transfer ----------------------
// Schema for money_transfers lives in penny_pilot_unified.sql.

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

// Get all debt transactions for a user (no limit) - placed before /debt-transactions/:debtId to avoid route conflict
app.get("/user-debt-transactions/:userId", (req, res) => {
  const userId = req.params.userId

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" })
  }

  const query = `
      SELECT dt.* 
      FROM debt_transactions dt
      JOIN debts d ON dt.debt_id = d.id
      WHERE d.user_id = ?
      ORDER BY dt.transaction_date DESC
  `

  db.query(query, [userId], (err, results) => {
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

// ============================
// TEAM MANAGEMENT & PAYROLL
// ============================

// Get all team members for a user
app.get('/api/team-members', checkAuth, (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT tm.*,
           (SELECT payment_date 
            FROM payroll_history 
            WHERE team_member_id = tm.id 
            ORDER BY payment_date DESC 
            LIMIT 1) as last_paid_at
    FROM team_members tm
    WHERE tm.user_id = ? AND tm.status = 'active'
    ORDER BY tm.created_at DESC
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching team members:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({
      success: true,
      team_members: results
    });
  });
});

// Create new team member
app.post('/api/team-members', checkAuth, (req, res) => {
  const userId = req.user.id;
  const { name, role, monthly_payroll, department, notes } = req.body;

  if (!name || !role || !monthly_payroll) {
    return res.status(400).json({ error: 'Name, role, and monthly payroll are required' });
  }

  const monthlyPayroll = parseFloat(monthly_payroll);
  if (isNaN(monthlyPayroll) || monthlyPayroll <= 0) {
    return res.status(400).json({ error: 'Monthly payroll must be a positive number' });
  }

  const insertQuery = `
    INSERT INTO team_members (user_id, name, role, monthly_payroll, department, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(insertQuery, [userId, name, role, monthlyPayroll, department || null, notes || null], (err, result) => {
    if (err) {
      console.error('Error creating team member:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.status(201).json({
      success: true,
      message: 'Team member created successfully',
      team_member_id: result.insertId
    });
  });
});

// Update team member
app.put('/api/team-members/:id', checkAuth, (req, res) => {
  const userId = req.user.id;
  const memberId = req.params.id;
  const { name, role, monthly_payroll, department, notes } = req.body;

  if (!name || !role || !monthly_payroll) {
    return res.status(400).json({ error: 'Name, role, and monthly payroll are required' });
  }

  const monthlyPayroll = parseFloat(monthly_payroll);
  if (isNaN(monthlyPayroll) || monthlyPayroll <= 0) {
    return res.status(400).json({ error: 'Monthly payroll must be a positive number' });
  }

  // Verify ownership
  db.query('SELECT id FROM team_members WHERE id = ? AND user_id = ?', [memberId, userId], (err, existing) => {
    if (err) {
      console.error('Error checking team member ownership:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const updateQuery = `
      UPDATE team_members 
      SET name = ?, role = ?, monthly_payroll = ?, department = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `;

    db.query(updateQuery, [name, role, monthlyPayroll, department || null, notes || null, memberId, userId], (err, result) => {
      if (err) {
        console.error('Error updating team member:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        success: true,
        message: 'Team member updated successfully'
      });
    });
  });
});

// Delete team member
app.delete('/api/team-members/:id', checkAuth, (req, res) => {
  const userId = req.user.id;
  const memberId = req.params.id;

  // Verify ownership and soft delete (set status to inactive)
  db.query('SELECT id FROM team_members WHERE id = ? AND user_id = ?', [memberId, userId], (err, existing) => {
    if (err) {
      console.error('Error checking team member ownership:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Soft delete by setting status to inactive
    db.query('UPDATE team_members SET status = "inactive", updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', 
      [memberId, userId], (err, result) => {
      if (err) {
        console.error('Error deleting team member:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        success: true,
        message: 'Team member deleted successfully'
      });
    });
  });
});

// Process payroll payment (legacy route - kept for backwards compatibility with old Team page)
// All three writes (debit_entry + wallet decrement + payroll_history insert) are wrapped in
// a single MySQL transaction so a failure mid-way doesn't leave the books inconsistent.
app.post('/api/team-members/:id/pay', checkAuth, (req, res) => {
  const userId = req.user.id;
  const memberId = req.params.id;
  const { payment_date, description } = req.body;

  db.getConnection((connErr, conn) => {
    if (connErr) {
      console.error('Could not get DB connection for payroll:', connErr);
      return res.status(500).json({ error: 'Database error' });
    }

    conn.beginTransaction((txErr) => {
      if (txErr) {
        conn.release();
        return res.status(500).json({ error: 'Could not start payroll transaction' });
      }

      conn.query(
        `SELECT * FROM team_members WHERE id = ? AND user_id = ? AND status = 'active' FOR UPDATE`,
        [memberId, userId],
        (mErr, members) => {
          if (mErr || members.length === 0) {
            return conn.rollback(() => {
              conn.release();
              res.status(mErr ? 500 : 404).json({ error: mErr ? 'Database error' : 'Team member not found' });
            });
          }

          const member = members[0];
          const amount = parseFloat(member.monthly_payroll);
          const payDate = payment_date || new Date().toISOString().split('T')[0];
          const debitDescription = description || `Payroll · ${member.name} (${member.role})`;

          conn.query('SELECT balance FROM wallet WHERE user_id = ? FOR UPDATE', [userId], (wErr, wRows) => {
            if (wErr) {
              return conn.rollback(() => { conn.release(); res.status(500).json({ error: 'Wallet check failed' }); });
            }
            const walletBalance = wRows.length > 0 ? parseFloat(wRows[0].balance) : 0;
            if (walletBalance < amount) {
              return conn.rollback(() => {
                conn.release();
                res.status(400).json({ error: 'Insufficient wallet balance', available: walletBalance, required: amount });
              });
            }

            conn.query(
              `INSERT INTO debit_entries (user_id, amount, category, entry_date, description)
               VALUES (?, ?, 'Payroll', ?, ?)`,
              [userId, amount, payDate, debitDescription],
              (deErr, debitResult) => {
                if (deErr) {
                  return conn.rollback(() => { conn.release(); res.status(500).json({ error: 'Failed to create debit entry' }); });
                }
                const debitEntryId = debitResult.insertId;

                conn.query(
                  'UPDATE wallet SET balance = balance - ? WHERE user_id = ?',
                  [amount, userId],
                  (walUpdErr) => {
                    if (walUpdErr) {
                      return conn.rollback(() => { conn.release(); res.status(500).json({ error: 'Wallet update failed' }); });
                    }

                    conn.query(
                      `INSERT INTO payroll_history (team_member_id, user_id, amount, payment_date, description, debit_entry_id)
                       VALUES (?, ?, ?, ?, ?, ?)`,
                      [memberId, userId, amount, payDate, debitDescription, debitEntryId],
                      (phErr, payrollResult) => {
                        if (phErr) {
                          return conn.rollback(() => {
                            conn.release();
                            res.status(500).json({ error: 'Failed to record payroll history' });
                          });
                        }

                        conn.commit((cErr) => {
                          conn.release();
                          if (cErr) return res.status(500).json({ error: 'Commit failed' });
                          const newBalance = walletBalance - amount;
                          res.status(201).json({
                            success: true,
                            message: 'Payroll processed successfully',
                            payroll_id: payrollResult.insertId,
                            debit_entry_id: debitEntryId,
                            amount,
                            new_wallet_balance: newBalance,
                          });
                        });
                      }
                    );
                  }
                );
              }
            );
          });
        }
      );
    });
  });
});

// Get payroll payment history
app.get('/api/payroll-history', checkAuth, (req, res) => {
  const userId = req.user.id;
  const { team_member_id, limit } = req.query;

  let query = `
    SELECT ph.*, tm.name as member_name, tm.role as member_role
    FROM payroll_history ph
    JOIN team_members tm ON ph.team_member_id = tm.id
    WHERE ph.user_id = ?
  `;
  const params = [userId];

  if (team_member_id) {
    query += ' AND ph.team_member_id = ?';
    params.push(team_member_id);
  }

  query += ' ORDER BY ph.payment_date DESC, ph.created_at DESC';

  if (limit) {
    query += ' LIMIT ?';
    params.push(parseInt(limit));
  } else {
    query += ' LIMIT 100';
  }

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Error fetching payroll history:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({
      success: true,
      payroll_history: results,
      total_count: results.length
    });
  });
});

// Get payroll statistics
app.get('/api/payroll-stats', checkAuth, (req, res) => {
  const userId = req.user.id;

  const statsQuery = `
    SELECT 
      COUNT(DISTINCT tm.id) as total_team_members,
      COALESCE(SUM(tm.monthly_payroll), 0) as total_monthly_payroll,
      COALESCE(SUM(CASE 
        WHEN ph.payment_date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH) 
        THEN ph.amount ELSE 0 END), 0) as last_month_paid
    FROM team_members tm
    LEFT JOIN payroll_history ph ON tm.id = ph.team_member_id AND ph.user_id = ?
    WHERE tm.user_id = ? AND tm.status = 'active'
  `;

  db.query(statsQuery, [userId, userId], (err, results) => {
    if (err) {
      console.error('Error fetching payroll stats:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({
      success: true,
      stats: results[0] || {
        total_team_members: 0,
        total_monthly_payroll: 0,
        last_month_paid: 0
      }
    });
  });
});

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

// Add process error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // In production, you might want to restart the server
  // process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // In production, you might want to restart the server
  // process.exit(1);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access the application at http://localhost:${PORT}`);
  console.log('Server is ready to handle requests');
});
