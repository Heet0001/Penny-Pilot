let priceRefreshInterval = null

// Modify your initializePage function to include auto-refresh
function initializePage() {
  loadInvestments()
  displayWalletBalance()
  setupStockNameInput()
  setupQuantityInput()

  // Refresh prices every 5 minutes (300000 ms)
  priceRefreshInterval = setInterval(loadInvestments, 300000)
}

// Add this to clean up when the page is unloaded
window.addEventListener("beforeunload", () => {
  if (priceRefreshInterval) {
    clearInterval(priceRefreshInterval)
  }
})

document.addEventListener("DOMContentLoaded", () => {
  // --- MODAL ELEMENTS ---
  // Sell Stock Modal Elements
  const sellStockModal = document.getElementById("entry-modal")
  const sellStockBtn = document.getElementById("add-entry-btn")
  const closeSellModalBtn = document.getElementById("close-modal")
  const saveSellBtn = document.getElementById("save-entry")

  // Buy Stock Modal Elements
  const buyStockModal = document.getElementById("debit-modal")
  const buyStockBtn = document.getElementById("debit-entry-btn")
  const closeBuyModalBtn = document.getElementById("close-debit-modal")
  const saveBuyBtn = document.getElementById("save-debit")

  // Wallet Modal Elements
  const walletModal = document.getElementById("wallet-modal")
  const walletBtn = document.getElementById("wallet-btn")
  const closeWalletBtn = document.getElementById("close-wallet-btn")
  const buyFromWalletBtn = document.getElementById("add-expense-btn")
  const sellFromWalletBtn = document.getElementById("add-funds-btn")

  // Get current user from localStorage
  const currentUser = JSON.parse(localStorage.getItem("currentUser"))

  // Initialize page
  initializePage()

  // --- UTILITY FUNCTIONS ---

  // Show modal with animation
  function showModal(modal) {
    if (modal) {
      modal.style.display = "flex"
      modal.classList.remove("hidden")
    }
  }

  // Hide modal with animation
  function hideModal(modal) {
    if (modal) {
      modal.classList.add("hidden")
      setTimeout(() => {
        modal.style.display = "none"
        modal.classList.remove("hidden") // Reset for next use
      }, 300) // Match animation duration
    }
  }

  // Add this new function to fetch the latest wallet balance from server
  function updateWalletBalanceFromServer() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"))
    if (!currentUser || !currentUser.id) return

    fetch(`http://localhost:3000/get-wallet-balance/${currentUser.id}`)
      .then((response) => {
        if (!response.ok) throw new Error("Network response was not ok")
        return response.json()
      })
      .then((data) => {
        // Update local storage and display
        localStorage.setItem(`wallet_balance_${currentUser.id}`, data.balance)
        displayWalletBalance()
      })
      .catch((error) => {
        console.error("Error fetching wallet balance:", error)
      })
  }

  // --- INVESTMENT FUNCTIONS ---

  // Initialize page - load investments and wallet balance
  function initializePage() {
    loadInvestments()
    updateWalletBalanceFromServer()
    setupStockNameInput()
    setupQuantityInput()

    // Refresh prices every 5 minutes (300000 ms)
    priceRefreshInterval = setInterval(() => {
      loadInvestments()
      updateWalletBalanceFromServer()
    }, 300000)
  }

  // Setup quantity input for selling
  function setupQuantityInput() {
    const stockSelect = document.getElementById("entry-category")
    const quantityInput = document.getElementById("entry-quantity")

    if (stockSelect && quantityInput) {
      // Initially disable quantity input
      quantityInput.disabled = true
      quantityInput.min = "1"
      quantityInput.step = "1"

      stockSelect.addEventListener("change", function () {
        if (this.selectedIndex > 0) {
          const selectedOption = this.options[this.selectedIndex]
          const maxQuantity = selectedOption.dataset.quantity

          // Enable quantity input and set max value
          quantityInput.disabled = false
          quantityInput.max = maxQuantity
          quantityInput.value = "1" // Default to 1 instead of max

          // Set current price as default sell price
          const rateInput = document.getElementById("entry-amount")
          if (rateInput && selectedOption.dataset.currentPrice) {
            rateInput.value = selectedOption.dataset.currentPrice
          }
        } else {
          // Disable quantity input if no stock selected
          quantityInput.disabled = true
          quantityInput.value = ""
        }
      })
    }
  }

  // Load user's investments
  function loadInvestments() {
    if (!currentUser || !currentUser.id) {
      console.error("User not logged in")
      return
    }

    fetch(`http://localhost:3000/get-investments/${currentUser.id}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok")
        }
        return response.json()
      })
      .then((data) => {
        // Filter to only show active investments in the table
        const activeInvestments = data.investments.filter((inv) => inv.status === "active")
        displayInvestments(activeInvestments)
        updateInvestmentSummary(data.summary)
        populateSellStockDropdown(activeInvestments)
      })
      .catch((error) => {
        console.error("Error loading investments:", error)
      })
  }

  // Display investments in a table
  function displayInvestments(investments) {
    // Create investment table if it doesn't exist
    let tableContainer = document.querySelector(".investment-table-container")

    if (!tableContainer) {
      tableContainer = document.createElement("div")
      tableContainer.className = "investment-table-container"
      tableContainer.style.margin = "20px"
      tableContainer.style.padding = "20px"
      tableContainer.style.backgroundColor = "#fff"
      tableContainer.style.borderRadius = "8px"
      tableContainer.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.1)"

      // Insert after swiper
      const swiper = document.querySelector(".swiper")
      swiper.parentNode.insertBefore(tableContainer, swiper.nextSibling)
    }

    // Clear existing content
    tableContainer.innerHTML = "<h2>Your Active Investments</h2>"

    if (!investments || investments.length === 0) {
      tableContainer.innerHTML += '<p>No active investments found. Start investing by clicking "Buy Stocks".</p>'
      return
    }

    // Create table
    const table = document.createElement("table")
    table.style.width = "100%"
    table.style.borderCollapse = "collapse"
    table.style.marginTop = "10px"

    // Create table header
    const thead = document.createElement("thead")
    thead.innerHTML = `
      <tr>
        <th style="padding: 10px;COLOR: black;text-align: left;border-bottom: 1px solid #ddd;">Stock</th>
        <th style="padding: 10px;COLOR: black; text-align: left; border-bottom: 1px solid #ddd;">Buy Price</th>
        <th style="padding: 10px;COLOR: black;text-align: left; border-bottom: 1px solid #ddd;">Current Price</th>
        <th style="padding: 10px; COLOR: black;text-align: left; border-bottom: 1px solid #ddd;">Quantity</th>
        <th style="padding: 10px;COLOR: black; text-align: left; border-bottom: 1px solid #ddd;">Buy Date</th>
        <th style="padding: 10px; COLOR: black;text-align: left; border-bottom: 1px solid #ddd;">Profit/Loss</th>
      </tr>
    `
    table.appendChild(thead)

    // Create table body
    const tbody = document.createElement("tbody")

    investments.forEach((investment) => {
      const tr = document.createElement("tr")

      // Format date
      const buyDate = new Date(investment.buy_date).toLocaleDateString()

      // Calculate profit/loss color
      const profitLossColor = Number.parseFloat(investment.profit_loss) >= 0 ? "green" : "red"

      // Create row content - display quantity as whole number
      tr.innerHTML = `
      <td style="padding: 10px; COLOR: black; border-bottom: 1px solid #ddd;">${investment.stock_name}</td>
      <td style="padding: 10px;COLOR: black; border-bottom: 1px solid #ddd;">$${Number.parseFloat(investment.buy_price).toFixed(2)}</td>
      <td style="padding: 10px;COLOR: black;COLOR: black; border-bottom: 1px solid #ddd;">$${Number.parseFloat(investment.current_price || investment.buy_price).toFixed(2)}</td>
      <td style="padding: 10px; COLOR: black;border-bottom: 1px solid #ddd;">${Number(investment.quantity)}</td>
      <td style="padding: 10px; COLOR: black;border-bottom: 1px solid #ddd;">${buyDate}</td>
      <td style="padding: 10px;COLOR: black; border-bottom: 1px solid #ddd; color: ${profitLossColor};">
        $${Number.parseFloat(investment.profit_loss).toFixed(2)} (${investment.profit_loss_percentage}%)
      </td>
    `

      tbody.appendChild(tr)
    })

    table.appendChild(tbody)
    tableContainer.appendChild(table)
  }

  // Update investment summary
  function updateInvestmentSummary(summary) {
    if (!summary) return

    let summaryContainer = document.querySelector(".investment-summary")

    if (!summaryContainer) {
      summaryContainer = document.createElement("div")
      summaryContainer.className = "investment-summary"
      summaryContainer.style.margin = "20px"
      summaryContainer.style.padding = "20px"
      summaryContainer.style.backgroundColor = "#fff"
      summaryContainer.style.borderRadius = "8px"
      summaryContainer.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.1)"

      // Insert after investment table
      const tableContainer = document.querySelector(".investment-table-container")
      if (tableContainer) {
        tableContainer.parentNode.insertBefore(summaryContainer, tableContainer.nextSibling)
      } else {
        // If table doesn't exist yet, insert after swiper
        const swiper = document.querySelector(".swiper")
        swiper.parentNode.insertBefore(summaryContainer, swiper.nextSibling)
      }
    }

    // Calculate profit/loss color
    const profitLossColor = Number.parseFloat(summary.total_profit_loss) >= 0 ? "green" : "red"

    // Update summary content
    summaryContainer.innerHTML = `
      <h2>Investment Summary</h2>
      <div style="display: flex; justify-content: space-between; margin-top: 10px;">
        <div>
          <p><strong>Total Invested:</strong> $${Number.parseFloat(summary.total_invested).toFixed(2)}</p>
          <p><strong>Current Value:</strong> $${Number.parseFloat(summary.total_current_value).toFixed(2)}</p>
        </div>
        <div>
          <p><strong>Total Profit/Loss:</strong> <span style="color: ${profitLossColor};">$${Number.parseFloat(summary.total_profit_loss).toFixed(2)}</span></p>
          <p><strong>Percentage:</strong> <span style="color: ${profitLossColor};">${summary.total_profit_loss_percentage}%</span></p>
        </div>
      </div>
    `
  }

  // Populate sell stock dropdown with active investments
  function populateSellStockDropdown(investments) {
    const sellStockSelect = document.getElementById("entry-category")

    if (!sellStockSelect) return

    // Clear existing options except the first one
    while (sellStockSelect.options.length > 1) {
      sellStockSelect.remove(1)
    }

    // Add active investments to dropdown
    investments.forEach((investment) => {
      const option = document.createElement("option")
      option.value = investment.id
      option.textContent = `${investment.stock_name} - ${Number(investment.quantity)} units @ $${Number.parseFloat(investment.buy_price).toFixed(2)}`
      option.dataset.currentPrice = investment.current_price
      option.dataset.quantity = investment.quantity
      sellStockSelect.appendChild(option)
    })
  }

  // Setup stock name input to fetch real-time price
  function setupStockNameInput() {
    const stockNameInput = document.getElementById("stock-name")
    const stockRateInput = document.getElementById("debit-amount")

    if (stockNameInput && stockRateInput) {
      // Add debounce to prevent too many API calls
      let debounceTimer
      let lastQuery = ""

      stockNameInput.addEventListener("input", function () {
        clearTimeout(debounceTimer)
        const stockName = this.value.trim()

        // Only proceed if the value has changed and is not empty
        if (stockName && stockName !== lastQuery) {
          // Show "Typing..." while user is typing
          stockRateInput.value = "Typing..."

          debounceTimer = setTimeout(() => {
            lastQuery = stockName
            fetchStockPrice(stockName)
          }, 800) // 800ms delay after typing stops
        }
      })

      stockNameInput.addEventListener("blur", function () {
        const stockName = this.value.trim()
        if (stockName && stockName !== lastQuery) {
          lastQuery = stockName
          fetchStockPrice(stockName)
        }
      })
    }

    async function fetchStockPrice(stockName) {
      // Clear any existing error message
      clearErrorMessage()

      // Show loading indicator
      stockRateInput.value = "Loading..."

      try {
        // Add a timestamp to prevent caching
        const timestamp = new Date().getTime()
        const response = await fetch(
          `http://localhost:3000/get-stock-price/${encodeURIComponent(stockName)}?_=${timestamp}`,
          {
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          },
        )

        const data = await response.json()

        if (response.ok && data.price) {
          stockRateInput.value = data.price
        } else {
          stockRateInput.value = ""
          showErrorMessage(data.error || "Could not fetch price for this stock. Please check the symbol and try again.")
        }
      } catch (error) {
        console.error("Error fetching stock price:", error)
        stockRateInput.value = ""
        showErrorMessage("Network error while fetching stock price. Please check your connection and try again.")
      }
    }

    function showErrorMessage(message) {
      // Create or update error message element
      let errorElement = document.getElementById("stock-price-error")

      if (!errorElement) {
        errorElement = document.createElement("div")
        errorElement.id = "stock-price-error"
        errorElement.style.color = "red"
        errorElement.style.marginTop = "5px"
        errorElement.style.fontSize = "14px"
        errorElement.style.fontWeight = "bold"

        // Insert after the rate input
        stockRateInput.parentNode.insertBefore(errorElement, stockRateInput.nextSibling)
      }

      errorElement.textContent = message

      // Hide the error after 8 seconds
      setTimeout(() => {
        if (errorElement.parentNode) {
          errorElement.textContent = ""
        }
      }, 8000)
    }

    function clearErrorMessage() {
      const errorElement = document.getElementById("stock-price-error")
      if (errorElement) {
        errorElement.textContent = ""
      }
    }
  }

  // Add a helper function to format Indian stock symbols
  function formatIndianStockSymbol(symbol) {
    // Remove any existing exchange suffixes
    const cleanSymbol = symbol.replace(/\.(NSE|BSE)$/i, "")

    // Add BSE suffix by default
    return `${cleanSymbol}.BSE`
  }

  // Function to get current wallet balance
  function getWalletBalance() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"))
    if (!currentUser) return 0

    // Get or initialize wallet balance
    return Number.parseFloat(localStorage.getItem(`wallet_balance_${currentUser.id}`) || 0)
  }

  // Function to display wallet balance
  function displayWalletBalance() {
    const balanceDisplay = document.getElementById("wallet-balance")
    if (balanceDisplay) {
      balanceDisplay.textContent = `$${getWalletBalance().toFixed(2)}`
    }
  }

  // --- EVENT LISTENERS ---

  // Open Sell Stock Modal
  if (sellStockBtn) {
    sellStockBtn.addEventListener("click", () => {
      showModal(sellStockModal)
    })
  }

  // Close Sell Stock Modal
  if (closeSellModalBtn) {
    closeSellModalBtn.addEventListener("click", () => {
      hideModal(sellStockModal)
    })
  }

  // Add a function to validate the sell form before submission
  function validateSellForm() {
    const investmentSelect = document.getElementById("entry-category")
    const rateInput = document.getElementById("entry-amount")
    const quantityInput = document.getElementById("entry-quantity")
    const dateInput = document.getElementById("entry-date")

    if (!investmentSelect || investmentSelect.selectedIndex <= 0) {
      alert("Please select a stock to sell")
      return false
    }

    if (!rateInput || !rateInput.value) {
      alert("Please enter a selling rate")
      return false
    }

    if (!quantityInput || !quantityInput.value) {
      alert("Please enter a quantity to sell")
      return false
    }

    if (!dateInput || !dateInput.value) {
      alert("Please select a selling date")
      return false
    }

    // Validate quantity
    const sellQuantity = Number(quantityInput.value)
    if (isNaN(sellQuantity) || sellQuantity <= 0 || !Number.isInteger(sellQuantity)) {
      alert("Please enter a valid whole number quantity")
      return false
    }

    // Get the maximum available quantity
    const selectedOption = investmentSelect.options[investmentSelect.selectedIndex]
    const maxQuantity = Number(selectedOption.dataset.quantity)

    if (sellQuantity > maxQuantity) {
      alert(`You can only sell up to ${maxQuantity} units`)
      return false
    }

    return true
  }

  // Update the sell stock form submission handler to use the validation function
  if (saveSellBtn) {
    saveSellBtn.addEventListener("click", () => {
      if (!validateSellForm()) {
        return
      }

      const investmentSelect = document.getElementById("entry-category")
      const rateInput = document.getElementById("entry-amount")
      const quantityInput = document.getElementById("entry-quantity")
      const dateInput = document.getElementById("entry-date")

      const investmentId = investmentSelect.value
      const sellPrice = Number.parseFloat(rateInput.value)
      const sellQuantity = Number(quantityInput.value)
      const sellDate = dateInput.value

      // Determine if this is a partial sale
      const selectedOption = investmentSelect.options[investmentSelect.selectedIndex]
      const maxQuantity = Number(selectedOption.dataset.quantity)
      const isPartialSale = sellQuantity < maxQuantity

      // Get current user
      if (!currentUser || !currentUser.id) {
        alert("User not logged in. Please log in again.")
        return
      }

      // Calculate total sale amount
      const totalSaleAmount = sellPrice * sellQuantity

      // Prepare data for submission
      const sellData = {
        user_id: currentUser.id,
        investment_id: investmentId,
        sell_price: sellPrice,
        sell_quantity: sellQuantity,
        sell_date: sellDate,
        partial_sale: isPartialSale,
        total_sale_amount: totalSaleAmount,
      }

      // Disable the button to prevent double submission
      saveSellBtn.disabled = true

      // Send data to server
      fetch("http://localhost:3000/sell-stock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sellData),
      })
        .then((response) => {
          if (!response.ok) {
            return response.json().then((data) => {
              throw new Error(data.message || "Network response was not ok")
            })
          }
          return response.json()
        })
        .then((data) => {
          console.log("Stock sold successfully:", data)

          // Update wallet balance in local storage immediately
          const currentBalance = getWalletBalance()
          const newBalance = currentBalance + data.total_sale_amount
          localStorage.setItem(`wallet_balance_${currentUser.id}`, newBalance.toString())

          // Update UI immediately
          displayWalletBalance()

          // Show success alert
          alert(
            `Stock sold successfully! Total amount: $${data.total_sale_amount.toFixed(2)}, Profit/Loss: $${data.profit.toFixed(2)}`,
          )

          // Reset form
          investmentSelect.selectedIndex = 0
          rateInput.value = ""
          if (quantityInput) {
            quantityInput.value = ""
            quantityInput.disabled = true
          }
          dateInput.value = ""

          // Hide modal
          hideModal(sellStockModal)

          // Reload investments
          loadInvestments()

          // Also fetch the latest balance from server to ensure consistency
          updateWalletBalanceFromServer()
        })
        .catch((error) => {
          console.error("Error selling stock:", error)
          alert("Failed to sell stock: " + error.message)
        })
        .finally(() => {
          // Re-enable the button
          saveSellBtn.disabled = false
        })
    })
  }

  // Open Buy Stock Modal
  if (buyStockBtn) {
    buyStockBtn.addEventListener("click", () => {
      showModal(buyStockModal)
    })
  }

  // Close Buy Stock Modal
  if (closeBuyModalBtn) {
    closeBuyModalBtn.addEventListener("click", () => {
      hideModal(buyStockModal)
    })
  }

  // Handle buy stock form submission
  if (saveBuyBtn) {
    saveBuyBtn.addEventListener("click", () => {
      const stockNameInput = document.getElementById("stock-name")
      const rateInput = document.getElementById("debit-amount")
      const quantityInput = document.getElementById("debit-quantity")
      const dateInput = document.getElementById("debit-date")
      const descriptionInput = document.getElementById("debit-description")

      if (!stockNameInput || !stockNameInput.value) {
        alert("Please enter a stock name")
        return
      }

      if (!rateInput || !rateInput.value) {
        alert("Please enter a buying rate")
        return
      }

      if (!quantityInput || !quantityInput.value) {
        alert("Please enter a quantity")
        return
      }

      if (!dateInput || !dateInput.value) {
        alert("Please select a buying date")
        return
      }

      // Get current user
      if (!currentUser || !currentUser.id) {
        alert("User not logged in. Please log in again.")
        return
      }

      // Validate quantity is a whole number
      const quantity = Number(quantityInput.value)
      if (isNaN(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
        alert("Please enter a valid whole number quantity")
        return
      }

      const rate = Number.parseFloat(rateInput.value)
      const totalCost = rate * quantity

      // Check if user has enough balance
      if (totalCost > getWalletBalance()) {
        alert("Insufficient wallet balance")
        return
      }

      // Prepare data for submission
      const buyData = {
        user_id: currentUser.id,
        stock_name: stockNameInput.value,
        buy_price: rate,
        quantity: quantity,
        buy_date: dateInput.value,
        description: descriptionInput ? descriptionInput.value : "",
      }

      // Send data to server
      fetch("http://localhost:3000/buy-stock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buyData),
      })
        .then((response) => {
          if (!response.ok) {
            return response.json().then((data) => {
              throw new Error(data.message || "Network response was not ok")
            })
          }
          return response.json()
        })
        .then((data) => {
          console.log("Stock purchased successfully:", data)
          alert(`Stock purchased successfully! Total cost: $${data.total_cost.toFixed(2)}`)

          // Reset form
          stockNameInput.value = ""
          rateInput.value = ""
          quantityInput.value = ""
          dateInput.value = ""
          if (descriptionInput) descriptionInput.value = ""

          // Hide modal
          hideModal(buyStockModal)

          loadInvestments()
          updateWalletBalanceFromServer() // Add this new function call
        })
        .catch((error) => {
          console.error("Error buying stock:", error)
          alert("Failed to buy stock: " + error.message)
        })
    })
  }

  // Show Wallet Modal
  if (walletBtn) {
    walletBtn.addEventListener("click", () => {
      showModal(walletModal)
      displayWalletBalance()
    })
  }

  // Close Wallet Modal
  if (closeWalletBtn) {
    closeWalletBtn.addEventListener("click", () => {
      hideModal(walletModal)
    })
  }

  // Buy Stock from Wallet
  if (buyFromWalletBtn) {
    buyFromWalletBtn.addEventListener("click", () => {
      hideModal(walletModal)
      showModal(buyStockModal)
    })
  }

  // Sell Stock from Wallet
  if (sellFromWalletBtn) {
    sellFromWalletBtn.addEventListener("click", () => {
      hideModal(walletModal)
      showModal(sellStockModal)
    })
  }

  // Close modals when clicking outside
  window.addEventListener("click", (event) => {
    if (event.target === sellStockModal) {
      hideModal(sellStockModal)
    } else if (event.target === buyStockModal) {
      hideModal(buyStockModal)
    } else if (event.target === walletModal) {
      hideModal(walletModal)
    }
  })
})

