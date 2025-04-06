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
  password: "Vrut@475",
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
  const { user_id } = req.query;

  if (!user_id) {
      return res.status(400).json({ error: "User ID is required" });
  }

  // Get both credit and debit entries sorted by date (newest first)
  const creditSql = "SELECT * FROM credit_entries WHERE user_id = ? ORDER BY entry_date DESC, created_at DESC";
  const debitSql = "SELECT * FROM debit_entries WHERE user_id = ? ORDER BY entry_date DESC, created_at DESC";

  db.query(creditSql, [user_id], (creditErr, creditResults) => {
      if (creditErr) {
          console.error("Database error fetching credit entries:", creditErr);
          return res.status(500).json({ error: "Database error occurred" });
      }

      db.query(debitSql, [user_id], (debitErr, debitResults) => {
          if (debitErr) {
              console.error("Database error fetching debit entries:", debitErr);
              return res.status(500).json({ error: "Database error occurred" });
          }

          res.status(200).json({
              entries: {
                  credit: creditResults,
                  debit: debitResults,
              },
          });
      });
  });
});
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
  const { user_id, amount, operation_type } = req.body;

  if (!user_id || !amount || !operation_type) {
      return res.status(400).json({ error: "Missing required fields" });
  }

  // First check if user has an emergency fund record
  const checkSql = "SELECT * FROM emergency_fund WHERE user_id = ?";

  db.query(checkSql, [user_id], (err, results) => {
      if (err) {
          console.error("Error checking emergency fund:", err);
          return res.status(500).json({ error: "Database error" });
      }

      let query, params;
      let newBalance;

      if (results.length === 0) {
          // Create new record if doesn't exist
          newBalance = operation_type === "add" ? parseFloat(amount) : 0;
          query = "INSERT INTO emergency_fund (user_id, balance) VALUES (?, ?)";
          params = [user_id, newBalance];
      } else {
          // Update existing record
          const currentBalance = parseFloat(results[0].balance);
          if (operation_type === "add") {
              newBalance = currentBalance + parseFloat(amount);
          } else {
              newBalance = currentBalance - parseFloat(amount);
              if (newBalance < 0) newBalance = 0; // Prevent negative balance
          }
          query = "UPDATE emergency_fund SET balance = ? WHERE user_id = ?";
          params = [newBalance, user_id];
      }

      db.query(query, params, (updateErr) => {
          if (updateErr) {
              console.error("Error updating emergency fund:", updateErr);
              return res.status(500).json({ error: "Database error" });
          }
          res.json({ success: true, balance: newBalance });
      });
  });
});
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

async function fetchStockPrice(stockName) {
  try {
      // Alpha Vantage API key - replace with your actual key
      const apiKey = process.env.ALPHA_VANTAGE_API_KEY || "YOUR_API_KEY";
  
      // For Indian stocks, append .BSE or .NSE to the symbol
      const symbol = stockName.includes(".") ? stockName : `${stockName}.BSE`;
  
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
  
      const response = await fetch(url);
      const data = await response.json();
  
      // Check if we got valid data
      if (data["Global Quote"] && data["Global Quote"]["05. price"]) {
          return Number.parseFloat(data["Global Quote"]["05. price"]);
      }
  
      // If BSE doesn't work, try NSE
      if (!data["Global Quote"] || !data["Global Quote"]["05. price"]) {
          const nseSymbol = stockName.includes(".") ? stockName : `${stockName}.NSE`;
          const nseUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${nseSymbol}&apikey=${apiKey}`;
  
          const nseResponse = await fetch(nseUrl);
          const nseData = await nseResponse.json();
  
          if (nseData["Global Quote"] && nseData["Global Quote"]["05. price"]) {
              return Number.parseFloat(nseData["Global Quote"]["05. price"]);
          }
      }
  
      // If we still don't have a price, log an error
      console.error("Could not fetch stock price for:", stockName, data);
      return null;
  } catch (error) {
      console.error("Error fetching stock price:", error);
      return null;
  }
}

// Helper function to update wallet balance
function updateWalletBalanceInvestment(userId, amount, operation, callback) {
  const operationMap = {
      'add': '+',
      'subtract': '-'
  };
  
  const query = `UPDATE wallet SET balance = balance ${operationMap[operation]} ? WHERE user_id = ?`;
  
  db.query(query, [amount, userId], (err, results) => {
      if (err) {
          console.error(`Error updating wallet balance (${operation}):`, err);
          return callback(err);
      }
      callback(null);
  });
}

const router = express.Router(); 

// OR change all router. to app. since you're using app directly elsewhere
// Buy stock endpoint
router.post("/buy-stock", async (req, res) => {
  const { user_id, stock_name, buy_price, quantity, buy_date, description } = req.body;

  // Validate required fields
  if (!user_id || !stock_name || !buy_price || !quantity || !buy_date) {
      return res.status(400).json({
          success: false,
          message: "Missing required fields",
      });
  }

  // Calculate total cost
  const totalCost = Number.parseFloat(buy_price) * Number.parseFloat(quantity);

  // Check if user has enough balance
  const walletQuery = "SELECT balance FROM wallet WHERE user_id = ?";

  db.query(walletQuery, [user_id], (walletErr, walletResults) => {
      if (walletErr) {
          console.error("Error checking wallet balance:", walletErr);
          return res.status(500).json({
              success: false,
              message: "Failed to check wallet balance",
          });
      }

      // If user doesn't have a wallet or insufficient balance
      if (walletResults.length === 0 || walletResults[0].balance < totalCost) {
          return res.status(400).json({
              success: false,
              message: "Insufficient wallet balance",
          });
      }

      // Insert stock purchase
      const insertQuery = `
          INSERT INTO stock_investments 
          (user_id, stock_name, buy_price, current_price, quantity, buy_date, description, status) 
          VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
      `;

      db.query(
          insertQuery,
          [user_id, stock_name, buy_price, buy_price, quantity, buy_date, description || ""],
          (insertErr, insertResult) => {
              if (insertErr) {
                  console.error("Error inserting stock investment:", insertErr);
                  return res.status(500).json({
                      success: false,
                      message: "Failed to save stock investment",
                  });
              }

              // Update wallet balance
              updateWalletBalanceInvestment(user_id, totalCost, "subtract", (walletUpdateErr) => {
                  if (walletUpdateErr) {
                      console.error("Error updating wallet balance:", walletUpdateErr);
                      return res.status(500).json({
                          success: false,
                          message: "Failed to update wallet balance",
                      });
                  }

                  res.status(201).json({
                      success: true,
                      message: "Stock purchased successfully",
                      id: insertResult.insertId,
                      total_cost: totalCost,
                  });
              });
          }
      );
  });
});

// Sell stock endpoint
router.post("/sell-stock", async (req, res) => {
  const { user_id, investment_id, sell_price, sell_quantity, sell_date, partial_sale, total_sale_amount } = req.body;

  // Validate required fields
  if (!user_id || !investment_id || !sell_price || !sell_quantity || !sell_date) {
      return res.status(400).json({
          success: false,
          message: "Missing required fields",
      });
  }

  // Get investment details
  const getInvestmentQuery = "SELECT * FROM stock_investments WHERE id = ? AND user_id = ?";

  db.query(getInvestmentQuery, [investment_id, user_id], (err, results) => {
      if (err) {
          console.error("Error getting investment details:", err);
          return res.status(500).json({
              success: false,
              message: "Failed to get investment details",
          });
      }

      if (results.length === 0) {
          return res.status(404).json({
              success: false,
              message: "Investment not found",
          });
      }

      const investment = results[0];

      // Check if already sold
      if (investment.status === "sold") {
          return res.status(400).json({
              success: false,
              message: "Investment already sold",
          });
      }

      // Validate sell quantity
      const sellQuantity = Number(sell_quantity);
      if (sellQuantity <= 0 || sellQuantity > investment.quantity) {
          return res.status(400).json({
              success: false,
              message: "Invalid sell quantity",
          });
      }

      // Calculate total sale amount
      const totalSaleAmount = total_sale_amount || Number(sell_price) * sellQuantity;

      if (partial_sale) {
          // Handle partial sale
          const remainingQuantity = investment.quantity - sellQuantity;

          const updateQuery = `
              UPDATE stock_investments 
              SET quantity = ?
              WHERE id = ?
          `;

          db.query(updateQuery, [remainingQuantity, investment_id], (updateErr) => {
              if (updateErr) {
                  console.error("Error updating investment quantity:", updateErr);
                  return res.status(500).json({
                      success: false,
                      message: "Failed to update investment quantity",
                  });
              }

              // Create record for sold portion
              const insertQuery = `
                  INSERT INTO stock_investments 
                  (user_id, stock_name, buy_price, quantity, buy_date, sell_price, sell_date, status) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, 'sold')
              `;

              db.query(
                  insertQuery,
                  [
                      user_id,
                      investment.stock_name,
                      investment.buy_price,
                      sellQuantity,
                      investment.buy_date,
                      sell_price,
                      sell_date,
                  ],
                  (insertErr, insertResult) => {
                      if (insertErr) {
                          console.error("Error creating sold investment record:", insertErr);
                          return res.status(500).json({
                              success: false,
                              message: "Failed to create sold investment record",
                          });
                      }

                      // Update wallet balance
                      updateWalletBalanceInvestment(user_id, totalSaleAmount, "add", (walletErr) => {
                          if (walletErr) {
                              console.error("Error updating wallet balance:", walletErr);
                              return res.status(500).json({
                                  success: false,
                                  message: "Failed to update wallet balance",
                              });
                          }

                          // Calculate profit/loss
                          const buyAmount = Number(investment.buy_price) * sellQuantity;
                          const profit = totalSaleAmount - buyAmount;

                          res.status(200).json({
                              success: true,
                              message: "Stock sold successfully",
                              total_sale_amount: totalSaleAmount,
                              profit: profit,
                          });
                      });
                  }
              );
          });
      } else {
          // Handle full sale
          const updateQuery = `
              UPDATE stock_investments 
              SET status = 'sold', sell_price = ?, sell_date = ? 
              WHERE id = ?
          `;

          db.query(updateQuery, [sell_price, sell_date, investment_id], (updateErr) => {
              if (updateErr) {
                  console.error("Error updating investment status:", updateErr);
                  return res.status(500).json({
                      success: false,
                      message: "Failed to update investment status",
                  });
              }

              // Update wallet balance
              updateWalletBalanceInvestment(user_id, totalSaleAmount, "add", (walletErr) => {
                  if (walletErr) {
                      console.error("Error updating wallet balance:", walletErr);
                      return res.status(500).json({
                          success: false,
                          message: "Failed to update wallet balance",
                      });
                  }

                  // Calculate profit/loss
                  const buyAmount = Number(investment.buy_price) * Number(investment.quantity);
                  const profit = totalSaleAmount - buyAmount;

                  res.status(200).json({
                      success: true,
                      message: "Stock sold successfully",
                      total_sale_amount: totalSaleAmount,
                      profit: profit,
                  });
              });
          });
      }
  });
});

// Get investments endpoint
router.get("/get-investments/:userId", async (req, res) => {
  const userId = req.params.userId;

  if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
  }

  const query = "SELECT * FROM stock_investments WHERE user_id = ? ORDER BY buy_date DESC";

  db.query(query, [userId], async (err, results) => {
      if (err) {
          console.error("Error getting investments:", err);
          return res.status(500).json({ error: "Database error" });
      }

      // Update current prices for active investments
      const updatedInvestments = [];
      let totalInvested = 0;
      let totalCurrentValue = 0;

      for (const investment of results) {
          if (investment.status === "active") {
              // Fetch current price
              const currentPrice = await fetchStockPrice(investment.stock_name);

              if (currentPrice) {
                  // Update current price in database
                  const updateQuery = "UPDATE stock_investments SET current_price = ? WHERE id = ?";
                  db.query(updateQuery, [currentPrice, investment.id]);

                  investment.current_price = currentPrice;
              }

              // Calculate invested amount and current value
              const investedAmount = Number.parseFloat(investment.buy_price) * Number.parseFloat(investment.quantity);
              const currentValue = Number.parseFloat(investment.current_price) * Number.parseFloat(investment.quantity);

              totalInvested += investedAmount;
              totalCurrentValue += currentValue;

              // Add profit/loss calculation
              investment.invested_amount = investedAmount;
              investment.current_value = currentValue;
              investment.profit_loss = currentValue - investedAmount;
              investment.profit_loss_percentage = (((currentValue - investedAmount) / investedAmount) * 100).toFixed(2);
          } else if (investment.status === "sold") {
              // For sold investments
              const investedAmount = Number.parseFloat(investment.buy_price) * Number.parseFloat(investment.quantity);
              const saleAmount = Number.parseFloat(investment.sell_price) * Number.parseFloat(investment.quantity);

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
});

// Get stock price endpoint
router.get("/get-stock-price/:stockName", async (req, res) => {
  const stockName = req.params.stockName;

  if (!stockName) {
      return res.status(400).json({ error: "Stock name is required" });
  }

  try {
      const price = await fetchStockPrice(stockName);

      if (price) {
          res.json({ price });
      } else {
          res.status(404).json({ error: "Stock price not found" });
      }
  } catch (error) {
      console.error("Error fetching stock price:", error);
      res.status(500).json({ error: "Failed to fetch stock price" });
  }
});
app.use('/api', router); // Mount the investment router at /api
// module.exports = router;

// --------------------Debts----------------------

// Email transporter configuration
// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//       user: "your-email@gmail.com", // your email
//       pass: "your-app-password" // your app password
//   }
// });

// // Function to send email notifications
// function sendDebtReminderEmail(userEmail, userName, debtDetails) {
//   const mailOptions = {
//       from: "your-email@gmail.com",
//       to: userEmail,
//       subject: "Penny Pilot: Debt Reminder",
//       html: `
//           <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
//               <h2 style="color: #4054ab;">Penny Pilot: Debt Reminder</h2>
//               <p>Hello ${userName},</p>
//               <p>This is a reminder about your upcoming debt:</p>
//               <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
//                   <p><strong>Type:</strong> ${debtDetails.debt_type === "given" ? "Given" : "Received"}</p>
//                   <p><strong>Amount:</strong> $${parseFloat(debtDetails.remaining_amount).toFixed(2)}</p>
//                   <p><strong>Due Date:</strong> ${new Date(debtDetails.due_date).toLocaleDateString()}</p>
//                   <p><strong>Days Remaining:</strong> ${debtDetails.days_remaining}</p>
//                   ${debtDetails.counterparty ? `<p><strong>Counterparty:</strong> ${debtDetails.counterparty}</p>` : ""}
//               </div>
//               <p>Please make arrangements to ${debtDetails.debt_type === "given" ? "collect" : "pay"} this debt before the due date.</p>
//               <p>Thank you for using Penny Pilot for your financial management.</p>
//           </div>
//       `
//   };

//   transporter.sendMail(mailOptions, (error, info) => {
//       if (error) {
//           console.error("Error sending email:", error);
//       } else {
//           console.log("Email sent:", info.response);
//       }
//   });
// }

// Function to update wallet balance
function updateWalletBalanceDebt(userId, amount, operation, callback) {
  const operationSign = operation === 'add' ? '+' : '-';
  const query = `UPDATE wallet SET balance = balance ${operationSign} ? WHERE user_id = ?`;
  
  db.query(query, [amount, userId], (err, result) => {
      if (err) {
          console.error("Error updating wallet balance:", err);
          return callback(err);
      }
      callback(null);
  });
}

// Debt Management Routes

// Add a new debt
app.post("/add-debt", (req, res) => {
  const {
      user_id,
      amount,
      interest_rate,
      interest_type,
      start_date,
      due_date,
      description,
      counterparty,
      debt_type,
  } = req.body;

  // Validate required fields
  if (!user_id || !amount || !start_date || !due_date || !debt_type) {
      return res.status(400).json({
          success: false,
          message: "Missing required fields",
      });
  }

  // Set remaining amount equal to the initial amount
  const remaining_amount = amount;

  // Insert into database
  const query = `
      INSERT INTO debts 
      (user_id, amount, interest_rate, interest_type, start_date, due_date, description, counterparty, debt_type, remaining_amount) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

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
              console.error("Database error:", err);
              return res.status(500).json({
                  success: false,
                  message: "Failed to save debt entry",
                  error: err.message,
              });
          }

          // Update wallet balance based on debt type
          const operation = debt_type === "given" ? "subtract" : "add";

          updateWalletBalanceDebt(user_id, amount, operation, (walletErr) => {
              if (walletErr) {
                  console.error("Error updating wallet balance:", walletErr);
                  return res.status(201).json({
                      success: true,
                      message: "Debt entry added but wallet balance update failed",
                      id: result.insertId,
                  });
              }

              res.status(201).json({
                  success: true,
                  message: "Debt entry added successfully",
                  id: result.insertId,
              });
          });
      }
  );
});

// Get all debts for a user
app.get("/get-debts/:userId", (req, res) => {
  const userId = req.params.userId;

  if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
  }

  const query = "SELECT * FROM debts WHERE user_id = ? ORDER BY due_date ASC";

  db.query(query, [userId], (err, results) => {
      if (err) {
          console.error("Error getting debts:", err);
          return res.status(500).json({ error: "Database error" });
      }

      // Calculate current interest for each debt
      const debtsWithInterest = results.map((debt) => {
          const currentDate = new Date();
          const startDate = new Date(debt.start_date);
          const dueDate = new Date(debt.due_date);

          // Calculate time difference in days
          const timeDiff = Math.max(
              0,
              (currentDate - startDate) / (1000 * 60 * 60 * 24)
          );

          let currentInterest = 0;

          if (debt.interest_rate > 0) {
              if (debt.interest_type === "simple") {
                  // Simple interest: P * r * t
                  currentInterest = debt.amount * (debt.interest_rate / 100) * (timeDiff / 365);
              } else {
                  // Compound interest: P * (1 + r)^t - P
                  currentInterest = debt.amount * Math.pow(1 + debt.interest_rate / 100, timeDiff / 365) - debt.amount;
              }
          }

          return {
              ...debt,
              current_interest: parseFloat(currentInterest.toFixed(2)),
              total_amount: parseFloat((parseFloat(debt.remaining_amount) + parseFloat(currentInterest)).toFixed(2)),
              days_remaining: Math.max(0, Math.ceil((dueDate - currentDate) / (1000 * 60 * 60 * 24))),
              is_overdue: currentDate > dueDate && debt.status !== "fully_paid",
          };
      });

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
      });
  });
});

// Collect or pay a debt
app.post("/collect-debt", (req, res) => {
  const { debt_id, amount, transaction_date, description } = req.body;

  if (!debt_id || !amount || !transaction_date) {
      return res.status(400).json({ error: "Missing required fields" });
  }

  // First get the debt details
  const getDebtQuery = "SELECT * FROM debts WHERE id = ?";
  db.query(getDebtQuery, [debt_id], (err, results) => {
      if (err) {
          console.error("Error getting debt details:", err);
          return res.status(500).json({ error: "Database error" });
      }

      if (results.length === 0) {
          return res.status(404).json({ error: "Debt not found" });
      }

      const debt = results[0];
      const user_id = debt.user_id;
      const debt_type = debt.debt_type;
      const remaining_amount = parseFloat(debt.remaining_amount);

      // Validate amount
      if (amount > remaining_amount) {
          return res.status(400).json({ error: "Collection amount exceeds remaining debt amount" });
      }

      // Calculate new remaining amount
      const new_remaining = remaining_amount - amount;

      // Determine new status
      const new_status = new_remaining <= 0 ? "fully_paid" : 
                        new_remaining < remaining_amount ? "partially_paid" : 
                        debt.status;

      // Update debt record
      const updateDebtQuery = "UPDATE debts SET remaining_amount = ?, status = ? WHERE id = ?";
      db.query(updateDebtQuery, [new_remaining, new_status, debt_id], (updateErr) => {
          if (updateErr) {
              console.error("Error updating debt:", updateErr);
              return res.status(500).json({ error: "Database error" });
          }

          // Record the transaction
          const transactionType = debt_type === "given" ? "collection" : "payment";
          const addTransactionQuery = `
              INSERT INTO debt_transactions 
              (debt_id, amount, transaction_date, transaction_type, description) 
              VALUES (?, ?, ?, ?, ?)
          `;

          db.query(
              addTransactionQuery,
              [debt_id, amount, transaction_date, transactionType, description || ""],
              (transErr) => {
                  if (transErr) {
                      console.error("Error recording transaction:", transErr);
                      return res.status(500).json({ error: "Database error" });
                  }

                  // Update wallet balance
                  const walletOperation = debt_type === "given" ? "add" : "subtract";
                  updateWalletBalanceDebt(user_id, amount, walletOperation, (walletErr) => {
                      if (walletErr) {
                          console.error("Error updating wallet balance:", walletErr);
                          return res.status(200).json({
                              success: true,
                              message: "Debt updated but wallet balance update failed",
                          });
                      }

                      res.status(200).json({
                          success: true,
                          message: "Debt collection/payment processed successfully",
                          new_status,
                          remaining_amount: new_remaining,
                      });
                  });
              }
          );
      });
  });
});

// Get transactions for a specific debt
app.get("/debt-transactions/:debtId", (req, res) => {
  const debtId = req.params.debtId;

  if (!debtId) {
      return res.status(400).json({ error: "Debt ID is required" });
  }

  const query = "SELECT * FROM debt_transactions WHERE debt_id = ? ORDER BY transaction_date DESC";
  db.query(query, [debtId], (err, results) => {
      if (err) {
          console.error("Error getting debt transactions:", err);
          return res.status(500).json({ error: "Database error" });
      }

      res.json({
          success: true,
          transactions: results,
      });
  });
});

// Get recent transactions for a user
app.get("/recent-transactions/:userId", (req, res) => {
  const userId = req.params.userId;
  const limit = req.query.limit || 10;

  if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
  }

  const query = `
      SELECT dt.* 
      FROM debt_transactions dt
      JOIN debts d ON dt.debt_id = d.id
      WHERE d.user_id = ?
      ORDER BY dt.transaction_date DESC
      LIMIT ?
  `;

  db.query(query, [userId, parseInt(limit)], (err, results) => {
      if (err) {
          console.error("Error getting recent transactions:", err);
          return res.status(500).json({ error: "Database error" });
      }

      res.json({
          success: true,
          transactions: results,
      });
  });
});

// Check for upcoming due dates and send email notifications
app.get("/send-debt-reminders", (req, res) => {
  const today = new Date();
  const threeDaysLater = new Date(today);
  threeDaysLater.setDate(today.getDate() + 3);

  const todayStr = today.toISOString().split("T")[0];
  const threeDaysLaterStr = threeDaysLater.toISOString().split("T")[0];

  const query = `
      SELECT d.*, u.email, u.name 
      FROM debts d
      JOIN users u ON d.user_id = u.id
      WHERE d.status != 'fully_paid' 
      AND d.due_date BETWEEN ? AND ?
  `;

  db.query(query, [todayStr, threeDaysLaterStr], (err, results) => {
      if (err) {
          console.error("Error checking due dates:", err);
          return res.status(500).json({ error: "Database error" });
      }

      // Send email notifications for each upcoming debt
      let emailsSent = 0;
      results.forEach((debt) => {
          const dueDate = new Date(debt.due_date);
          const daysRemaining = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
          debt.days_remaining = daysRemaining;
          sendDebtReminderEmail(debt.email, debt.name, debt);
          emailsSent++;
      });

      res.json({
          success: true,
          message: `${emailsSent} reminder emails sent`,
          reminders: results,
      });
  });
});

// Schedule daily reminders
function scheduleDailyReminders() {
  const now = new Date();
  const targetTime = new Date(now);
  targetTime.setHours(8, 0, 0, 0); // 8:00 AM

  if (now > targetTime) {
      targetTime.setDate(targetTime.getDate() + 1);
  }

  const timeUntilTarget = targetTime - now;

  setTimeout(() => {
      fetch("http://localhost:3000/send-debt-reminders")
          .then((response) => response.json())
          .then((data) => console.log("Daily reminders sent:", data))
          .catch((error) => console.error("Error sending reminders:", error));

      setInterval(() => {
          fetch("http://localhost:3000/send-debt-reminders")
              .then((response) => response.json())
              .then((data) => console.log("Daily reminders sent:", data))
              .catch((error) => console.error("Error sending reminders:", error));
      }, 24 * 60 * 60 * 1000);
  }, timeUntilTarget);
}




//---------------------Money Transfer----------------------------------------




// Create money_transfers table if it doesn't exist
const createMoneyTransferTable = `
CREATE TABLE IF NOT EXISTS money_transfers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  recipient_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  transfer_type ENUM('debt', 'expense') NOT NULL,
  status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id),
  FOREIGN KEY (recipient_id) REFERENCES users(id)
)`;

db.query(createMoneyTransferTable, (err) => {
  if (err) {
    console.error("Error creating money_transfers table:", err);
  } else {
    console.log("Money transfers table ready");
  }
});

// Helper function to update wallet balance
function updateWalletBalanceMoneyTransfer(userId, amount, operation, callback) {
  const query = `
    UPDATE wallet 
    SET balance = balance ${operation === 'add' ? '+' : '-'} ? 
    WHERE user_id = ?`;
  
  db.query(query, [amount, userId], (err, results) => {
    if (err) {
      console.error(`Error updating wallet for user ${userId}:`, err);
      return callback(err);
    }
    callback(null, results);
  });
}

// Check if user exists by email
app.get('/check-user-exists', (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  db.query('SELECT id FROM users WHERE email = ?', [email], (err, results) => {
    if (err) {
      console.error("Database error checking user:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json({ exists: results.length > 0 });
  });
});

// Create a new money transfer
// In your create-money-transfer endpoint
app.post('/create-money-transfer', async (req, res) => {
  // ... existing validation code ...
  
  try {
    // Create the transfer record with pending status
    const [result] = await db.query(
      `INSERT INTO money_transfers 
      (sender_id, recipient_id, amount, description, transfer_type, status) 
      VALUES (?, ?, ?, ?, ?, 'pending')`,
      [sender_id, recipient_id, amount, description, transfer_type]
    );

    // Get the full transfer details with sender name
    const [transfer] = await db.query(`
      SELECT mt.*, u.name as sender_name 
      FROM money_transfers mt
      JOIN users u ON mt.sender_id = u.id
      WHERE mt.id = ?`, [result.insertId]);

    // Emit real-time notification (if using Socket.io)
    // io.to(recipient_id).emit('new-transfer', transfer[0]);

    res.status(201).json({
      success: true,
      message: "Transfer request created",
      transfer: transfer[0]
    });

  } catch (error) {
    console.error("Error creating transfer:", error);
    res.status(500).json({ success: false, message: "Database error" });
  }
});

// Get pending transfers for a user
app.get('/pending-transfers/:userId', async (req, res) => {
  try {
    const [transfers] = await db.query(`
      SELECT mt.*, u.name as sender_name 
      FROM money_transfers mt
      JOIN users u ON mt.sender_id = u.id
      WHERE mt.recipient_id = ? AND mt.status = 'pending'
      ORDER BY mt.created_at DESC`, 
      [req.params.userId]
    );
    
    res.json({ success: true, transfers });
  } catch (error) {
    res.status(500).json({ success: false, message: "Database error" });
  }
});

// Respond to a transfer (accept/reject)
app.post('/respond-to-transfer', (req, res) => {
  const { transfer_id, response } = req.body;

  if (!transfer_id || !response || !['accepted', 'rejected'].includes(response)) {
    return res.status(400).json({
      success: false,
      message: "Invalid request parameters"
    });
  }

  // First get the transfer details
  db.query('SELECT * FROM money_transfers WHERE id = ?', [transfer_id], (err, results) => {
    if (err) {
      console.error("Database error getting transfer:", err);
      return res.status(500).json({
        success: false,
        message: "Database error occurred"
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Transfer not found"
      });
    }

    const transfer = results[0];

    // Update transfer status
    db.query('UPDATE money_transfers SET status = ? WHERE id = ?', 
      [response, transfer_id], 
      (updateErr) => {
        if (updateErr) {
          console.error("Database error updating transfer:", updateErr);
          return res.status(500).json({
            success: false,
            message: "Database error occurred"
          });
        }

        if (response === 'accepted') {
          // Process the transfer - deduct from sender, add to recipient
          updateWalletBalanceMoneyTransfer(transfer.sender_id, transfer.amount, 'subtract', (senderErr) => {
            if (senderErr) {
              return res.status(500).json({
                success: false,
                message: "Failed to deduct from sender's wallet"
              });
            }

            updateWalletBalanceMoneyTransfer(transfer.recipient_id, transfer.amount, 'add', (recipientErr) => {
              if (recipientErr) {
                // Refund sender if recipient update fails
                updateWalletBalanceMoneyTransfer(transfer.sender_id, transfer.amount, 'add', () => {});
                return res.status(500).json({
                  success: false,
                  message: "Failed to add to recipient's wallet"
                });
              }

              // For debt transfers, create a credit entry for recipient
              if (transfer.transfer_type === 'debt') {
                const creditQuery = `
                  INSERT INTO credit_entries 
                  (user_id, amount, category, entry_date, description) 
                  VALUES (?, ?, 'Debt Received', CURDATE(), ?)`;
                
                db.query(creditQuery, [
                  transfer.recipient_id,
                  transfer.amount,
                  `Received from user ID ${transfer.sender_id}: ${transfer.description || 'No description'}`
                ], (creditErr) => {
                  if (creditErr) {
                    console.error("Error creating credit entry:", creditErr);
                  }
                  
                  // Get updated balance to return to client
                  db.query('SELECT balance FROM wallet WHERE user_id = ?', 
                    [transfer.recipient_id], 
                    (balanceErr, balanceResults) => {
                      const newBalance = balanceResults.length > 0 ? balanceResults[0].balance : 0;
                      
                      res.json({
                        success: true,
                        message: "Transfer accepted and processed successfully",
                        new_balance: newBalance
                      });
                  });
                });
              } else {
                // For expense transfers, just return success
                res.json({
                  success: true,
                  message: "Transfer processed successfully"
                });
              }
            });
          });
        } else {
          // For rejected transfers, no wallet updates needed
          res.json({
            success: true,
            message: "Transfer rejected successfully"
          });
        }
      }
    );
  });
});

// Get sent transfers for a user
app.get('/get-sent-transfers/:userId', (req, res) => {
  const userId = req.params.userId;

  const query = `
    SELECT mt.*, u.name as recipient_name 
    FROM money_transfers mt 
    JOIN users u ON mt.recipient_id = u.id 
    WHERE mt.sender_id = ? 
    ORDER BY mt.created_at DESC`;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Error getting sent transfers:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json({ transfers: results });
  });
});

// Get received transfers for a user
app.get('/get-received-transfers/:userId', (req, res) => {
  const userId = req.params.userId;

  const query = `
    SELECT mt.*, u.name as sender_name 
    FROM money_transfers mt 
    JOIN users u ON mt.sender_id = u.id 
    WHERE mt.recipient_id = ? AND mt.status != 'pending'
    ORDER BY mt.created_at DESC`;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("Error getting received transfers:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json({ transfers: results });
  });
});

// Get wallet balance
app.get('/get-wallet-balance/:userId', (req, res) => {
  const userId = req.params.userId;

  db.query('SELECT balance FROM wallet WHERE user_id = ?', [userId], (err, results) => {
    if (err) {
      console.error("Error getting wallet balance:", err);
      return res.status(500).json({ error: "Database error" });
    }
    
    const balance = results.length > 0 ? results[0].balance : 0;
    res.json({ balance });
  });
});


// Start the server
const PORT = 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Access the application at http://localhost:${PORT}`)
})
