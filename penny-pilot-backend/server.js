import express from "express"
import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2"
import bodyParser from "body-parser"
import cors from "cors"

// Create __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// Middleware
app.use(cors())
app.use(bodyParser.json())

// Define the base directory for your project
const projectBaseDir = __dirname
const loginPageDir = path.join(__dirname, "../LoginPage")

// Serve static files from the LoginPage directory
app.use(express.static(loginPageDir))

// MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Mysql@101010",
  database: "penny_pilot",
})

db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err)
    return
  }
  console.log("MySQL connected successfully")
})

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
  // First check if user has an emergency fund record
  const checkSql = "SELECT * FROM emergency_fund WHERE user_id = ?"

  db.query(checkSql, [userId], (err, results) => {
    if (err) {
      return callback(err)
    }

    let query, params
    let currentBalance = 0

    if (results.length === 0) {
      // Create new emergency fund record
      currentBalance = operation === "add" ? Number.parseFloat(amount) : 0
      query = "INSERT INTO emergency_fund (user_id, balance) VALUES (?, ?)"
      params = [userId, currentBalance]
    } else {
      // Update existing emergency fund record
      currentBalance = results[0].balance

      if (operation === "add") {
        currentBalance += Number.parseFloat(amount)
      } else {
        currentBalance -= Number.parseFloat(amount)
        if (currentBalance < 0) currentBalance = 0 // Prevent negative balance
      }

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

// Helper function to fetch stock price (mock implementation)
async function fetchStockPrice(stockName) {
  try {
    // Alpha Vantage API key - replace with your actual key
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY || "YOUR_API_KEY"

    // For Indian stocks, we need to append .BSE or .NSE to the symbol
    // This assumes the user enters the stock symbol without the exchange suffix
    const symbol = stockName.includes(".") ? stockName : `${stockName}.BSE`

    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`

    const response = await fetch(url)
    const data = await response.json()

    // Check if we got valid data
    if (data["Global Quote"] && data["Global Quote"]["05. price"]) {
      return Number.parseFloat(data["Global Quote"]["05. price"])
    }

    // If BSE doesn't work, try NSE
    if (!data["Global Quote"] || !data["Global Quote"]["05. price"]) {
      const nseSymbol = stockName.includes(".") ? stockName : `${stockName}.NSE`
      const nseUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${nseSymbol}&apikey=${apiKey}`

      const nseResponse = await fetch(nseUrl)
      const nseData = await nseResponse.json()

      if (nseData["Global Quote"] && nseData["Global Quote"]["05. price"]) {
        return Number.parseFloat(nseData["Global Quote"]["05. price"])
      }
    }

    // If we still don't have a price, log an error and return a fallback price
    console.error("Could not fetch stock price for:", stockName, data)
    return null
  } catch (error) {
    console.error("Error fetching stock price:", error)
    return null
  }
}

// Routes
// Basic Navigation Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(loginPageDir, "Login.html"))
})

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(projectBaseDir, "dashboard.html"))
})

// Authentication Routes
app.post("/signup", (req, res) => {
  const { name, email, password } = req.body

  // Validate inputs
  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required" })
  }

  const sql = "INSERT INTO users (name, email, password) VALUES (?, ?, ?)"
  db.query(sql, [name, email, password], (err, result) => {
    if (err) {
      console.error("Database error during signup:", err)
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(400).json({ error: "Email already exists" })
      }
      return res.status(500).json({ error: "Database error occurred" })
    }
    res.status(200).json({ message: "User registered successfully. Please sign in." })
  })
})

app.post("/signin", (req, res) => {
  const { email, password } = req.body

  // Validate inputs
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" })
  }

  const sql = "SELECT * FROM users WHERE email = ? AND password = ?"
  db.query(sql, [email, password], (err, result) => {
    if (err) {
      console.error("Database error during signin:", err)
      return res.status(500).json({ error: "Database error occurred" })
    }

    if (result.length > 0) {
      // Don't send password back to client
      const user = { ...result[0] }
      delete user.password

      res.status(200).json({ message: "Login successful", user })
    } else {
      res.status(400).json({ error: "Invalid email or password" })
    }
  })
})

// Financial Entry Routes
app.post("/add-credit", (req, res) => {
  const { user_id, amount, category, entry_date, description } = req.body

  // Validate inputs
  if (!user_id || !amount || !category || !entry_date) {
    return res.status(400).json({ error: "Required fields are missing" })
  }

  const sql = "INSERT INTO credit_entries (user_id, amount, category, entry_date, description) VALUES (?, ?, ?, ?, ?)"
  db.query(sql, [user_id, amount, category, entry_date, description], (err, result) => {
    if (err) {
      console.error("Database error adding credit entry:", err)
      return res.status(500).json({ error: "Database error occurred" })
    }

    // Update wallet balance (add to wallet)
    updateWalletBalance(user_id, amount, "add", (walletErr) => {
      if (walletErr) {
        console.error("Error updating wallet balance:", walletErr)
        return res.status(200).json({
          message: "Credit entry added but wallet balance update failed",
          entry_id: result.insertId,
        })
      }

      // If the category is "From Emergency", update emergency fund balance
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

  // Log received data for debugging
  console.log("Sending debit data:", req.body)

  // Validate required fields
  if (!user_id || !amount || !category || !entry_date) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
    })
  }

  // Insert into database
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

    // Update wallet balance (subtract from wallet)
    updateWalletBalance(user_id, amount, "subtract", (walletErr) => {
      if (walletErr) {
        console.error("Error updating wallet balance:", walletErr)
        return res.status(201).json({
          success: true,
          message: "Debit entry added but wallet balance update failed",
          id: result.insertId,
        })
      }

      // Check if category is "Emergency" to update emergency fund
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

          console.log("Debit Entry Saved Successfully:", {
            id: result.insertId,
            message: "Debit entry added and emergency fund updated successfully",
            emergency_balance: newBalance,
          })

          res.status(201).json({
            success: true,
            message: "Debit entry added and emergency fund updated successfully",
            id: result.insertId,
            emergency_balance: newBalance,
          })
        })
      } else {
        console.log("Debit Entry Saved Successfully:", {
          id: result.insertId,
          message: "Debit entry added successfully",
        })

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

  // Get both credit and debit entries
  const creditSql = "SELECT * FROM credit_entries WHERE user_id = ? ORDER BY entry_date DESC"
  const debitSql = "SELECT * FROM debit_entries WHERE user_id = ? ORDER BY entry_date DESC"

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

  // Check if wallet entry exists for this user
  const checkQuery = "SELECT * FROM wallet WHERE user_id = ?"
  db.query(checkQuery, [user_id], (err, results) => {
    if (err) {
      console.error("Error checking wallet:", err)
      return res.status(500).json({ error: "Database error" })
    }

    let query
    let params

    if (results.length === 0) {
      // Create new wallet entry
      query = "INSERT INTO wallet (user_id, balance) VALUES (?, ?)"
      params = [user_id, balance]
    } else {
      // Update existing wallet entry
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

// Emergency Fund Routes
app.post("/update-emergency-fund", (req, res) => {
  const { user_id, amount, operation_type } = req.body

  if (!user_id || !amount || !operation_type) {
    return res.status(400).json({ error: "Missing required fields" })
  }

  updateEmergencyFundBalance(user_id, amount, operation_type === "add" ? "add" : "subtract", (err, newBalance) => {
    if (err) {
      console.error("Error updating emergency fund:", err)
      return res.status(500).json({ error: "Database error" })
    }

    res.json({ success: true, balance: newBalance })
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

// Stock Investment Routes
app.post("/buy-stock", async (req, res) => {
  const { user_id, stock_name, buy_price, quantity, buy_date, description } = req.body

  // Validate required fields
  if (!user_id || !stock_name || !buy_price || !quantity || !buy_date) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
    })
  }

  // Calculate total cost
  const totalCost = Number.parseFloat(buy_price) * Number.parseFloat(quantity)

  // Check if user has enough balance in wallet
  const walletQuery = "SELECT balance FROM wallet WHERE user_id = ?"

  db.query(walletQuery, [user_id], (walletErr, walletResults) => {
    if (walletErr) {
      console.error("Error checking wallet balance:", walletErr)
      return res.status(500).json({
        success: false,
        message: "Failed to check wallet balance",
      })
    }

    // If user doesn't have a wallet or insufficient balance
    if (walletResults.length === 0 || walletResults[0].balance < totalCost) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
      })
    }

    // Insert stock purchase into database
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

        // Update wallet balance (subtract the total cost)
        updateWalletBalance(user_id, totalCost, "subtract", (walletUpdateErr) => {
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

app.post("/sell-stock", async (req, res) => {
  const { user_id, investment_id, sell_price, sell_date } = req.body

  // Validate required fields
  if (!user_id || !investment_id || !sell_price || !sell_date) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
    })
  }

  // Get investment details
  const getInvestmentQuery = "SELECT * FROM stock_investments WHERE id = ? AND user_id = ?"

  db.query(getInvestmentQuery, [investment_id, user_id], (err, results) => {
    if (err) {
      console.error("Error getting investment details:", err)
      return res.status(500).json({
        success: false,
        message: "Failed to get investment details",
      })
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Investment not found",
      })
    }

    const investment = results[0]

    // Check if investment is already sold
    if (investment.status === "sold") {
      return res.status(400).json({
        success: false,
        message: "Investment already sold",
      })
    }

    // Calculate total sale amount
    const totalSaleAmount = Number.parseFloat(sell_price) * Number.parseFloat(investment.quantity)

    // Update investment status to sold
    const updateQuery = `
            UPDATE stock_investments 
            SET status = 'sold', sell_price = ?, sell_date = ? 
            WHERE id = ?
        `

    db.query(updateQuery, [sell_price, sell_date, investment_id], (updateErr) => {
      if (updateErr) {
        console.error("Error updating investment status:", updateErr)
        return res.status(500).json({
          success: false,
          message: "Failed to update investment status",
        })
      }

      // Update wallet balance (add the sale amount)
      updateWalletBalance(user_id, totalSaleAmount, "add", (walletErr) => {
        if (walletErr) {
          console.error("Error updating wallet balance:", walletErr)
          return res.status(500).json({
            success: false,
            message: "Failed to update wallet balance",
          })
        }

        // Calculate profit/loss
        const buyAmount = Number.parseFloat(investment.buy_price) * Number.parseFloat(investment.quantity)
        const profit = totalSaleAmount - buyAmount

        res.status(200).json({
          success: true,
          message: "Stock sold successfully",
          total_sale_amount: totalSaleAmount,
          profit: profit,
        })
      })
    })
  })
})

app.get("/get-investments/:userId", async (req, res) => {
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

    // Update current prices for active investments
    const updatedInvestments = []
    let totalInvested = 0
    let totalCurrentValue = 0

    for (const investment of results) {
      if (investment.status === "active") {
        // Fetch current price (in a real app, this would be from an API)
        const currentPrice = await fetchStockPrice(investment.stock_name)

        if (currentPrice) {
          // Update current price in database
          const updateQuery = "UPDATE stock_investments SET current_price = ? WHERE id = ?"
          db.query(updateQuery, [currentPrice, investment.id])

          investment.current_price = currentPrice
        }

        // Calculate invested amount and current value
        const investedAmount = Number.parseFloat(investment.buy_price) * Number.parseFloat(investment.quantity)
        const currentValue = Number.parseFloat(investment.current_price) * Number.parseFloat(investment.quantity)

        totalInvested += investedAmount
        totalCurrentValue += currentValue

        // Add profit/loss calculation
        investment.invested_amount = investedAmount
        investment.current_value = currentValue
        investment.profit_loss = currentValue - investedAmount
        investment.profit_loss_percentage = (((currentValue - investedAmount) / investedAmount) * 100).toFixed(2)
      } else if (investment.status === "sold") {
        // For sold investments, calculate profit/loss
        const investedAmount = Number.parseFloat(investment.buy_price) * Number.parseFloat(investment.quantity)
        const saleAmount = Number.parseFloat(investment.sell_price) * Number.parseFloat(investment.quantity)

        investment.invested_amount = investedAmount
        investment.sale_amount = saleAmount
        investment.profit_loss = saleAmount - investedAmount
        investment.profit_loss_percentage = (((saleAmount - investedAmount) / investedAmount) * 100).toFixed(2)
      }

      updatedInvestments.push(investment)
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
    })
  })
})

app.get("/get-stock-price/:stockName", async (req, res) => {
  const stockName = req.params.stockName

  if (!stockName) {
    return res.status(400).json({ error: "Stock name is required" })
  }

  try {
    const price = await fetchStockPrice(stockName)

    if (price) {
      res.json({ price })
    } else {
      res.status(404).json({ error: "Stock price not found" })
    }
  } catch (error) {
    console.error("Error fetching stock price:", error)
    res.status(500).json({ error: "Failed to fetch stock price" })
  }
})

// Start the server
const PORT = 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Access the application at http://localhost:${PORT}`)
})