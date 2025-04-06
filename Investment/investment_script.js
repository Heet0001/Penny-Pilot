let priceRefreshInterval = null

function displayUserProfile() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (currentUser && currentUser.name) {
      // Set first letter of username as avatar
      const userAvatar = document.getElementById('user-avatar');
      if (userAvatar) {
          userAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
      }
      
      // Set username in tooltip
      const userTooltip = document.getElementById('user-tooltip');
      if (userTooltip) {
          userTooltip.textContent = currentUser.name;
      }
  }
}

        // Initialize Swiper
        const swiper = new Swiper('.swiper-container', {
          loop: true,
          navigation: {
              nextEl: '.swiper-button-next',
              prevEl: '.swiper-button-prev',
          },
      });

      // Add Button Functionality
      const addButton = document.getElementById('addButton');
      const addOptions = document.getElementById('addOptions');
      
      
      // Toggle add options menu
      addButton.addEventListener('click', function(e) {
          e.stopPropagation();
          e.preventDefault();
          
          // Toggle display and active state
          const isShowing = addOptions.style.display === 'flex';
          addOptions.style.display = isShowing ? 'none' : 'flex';
          addButton.classList.toggle('active', !isShowing);
      });
      
      // Close options when clicking outside
      document.addEventListener('click', function(e) {
          if (!addButton.contains(e.target) && !addOptions.contains(e.target)) {
              addOptions.style.display = 'none';
              addButton.classList.remove('active');
          }
      });

      // Stacked Scroll Effect
      const slidingSection = document.querySelector('.sliding-section');
      const mainContent = document.querySelector('.main-content');
      const scrollHint = document.querySelector('.scroll-hint');
      
      if (slidingSection && mainContent) {
          let isAnimating = false;
          let lastScrollPosition = 0;
          let isAtTop = true;

          // Initialize position
          slidingSection.style.transform = 'translateY(100%)';
          slidingSection.style.transition = 'transform 0.4s cubic-bezier(0.28, 0.11, 0.32, 1)';

          // Set initial scroll position
          mainContent.scrollTop = 0;

          mainContent.addEventListener('scroll', function() {
              if (isAnimating) return;

              const currentScroll = mainContent.scrollTop;
              const scrollHeight = mainContent.scrollHeight;
              const clientHeight = mainContent.clientHeight;
              const maxScroll = scrollHeight - clientHeight;

              // Hide/show scroll hint
              if (currentScroll > 10) {
                  scrollHint.style.opacity = '0';
                  scrollHint.style.visibility = 'hidden';
              } else {
                  scrollHint.style.opacity = '1';
                  scrollHint.style.visibility = 'visible';
              }

              // Determine if we're at the top
              isAtTop = currentScroll <= 10;

              // Only animate when scrolling up near the top
              if (currentScroll < 100 && currentScroll < lastScrollPosition) {
                  const progress = 1 - (currentScroll / 100);
                  slidingSection.style.transform = `translateY(${100 - (progress * 100)}%)`;
              } else if (currentScroll >= 100 || currentScroll > lastScrollPosition) {
                  slidingSection.style.transform = 'translateY(0)';
              }

              // If user scrolls to bottom, ensure sliding section is fully visible
              if (currentScroll >= maxScroll - 10) {
                  slidingSection.style.transform = 'translateY(0)';
              }

              lastScrollPosition = currentScroll;
          });

          

          // Improved scroll hint click behavior
          scrollHint?.addEventListener('click', function() {
              isAnimating = true;
              slidingSection.style.transform = 'translateY(0)';
              
              const targetScroll = mainContent.scrollHeight - mainContent.clientHeight;
              
              mainContent.scrollTo({
                  top: targetScroll,
                  behavior: 'smooth'
              });

              setTimeout(() => {
                  isAnimating = false;
              }, 1000);
          });

          // Add keyboard scroll support
          document.addEventListener('keydown', function(e) {
              if (e.key === 'ArrowDown' && isAtTop) {
                  mainContent.scrollTo({
                      top: mainContent.scrollHeight - mainContent.clientHeight,
                      behavior: 'smooth'
                  });
              }
          });
      }

      // Connect the new UI elements to the existing functionality
      document.getElementById('buy-stock-option').addEventListener('click', function() {
          document.getElementById('debit-modal').style.display = 'flex';
          addOptions.style.display = 'none';
          addButton.classList.remove('active');
      });

      document.getElementById('sell-stock-option').addEventListener('click', function() {
          document.getElementById('entry-modal').style.display = 'flex';
          addOptions.style.display = 'none';
          addButton.classList.remove('active');
      });

      // Set today's date as default
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('debit-date') && (document.getElementById('debit-date').value = today);
      document.getElementById('entry-date') && (document.getElementById('entry-date').value = today);
      document.getElementById('start-date') && (document.getElementById('start-date').value = today);
      document.getElementById('end-date') && (document.getElementById('end-date').value = today);

// Modify your initializePage function to include auto-refresh
function initializePage() {
  displayUserProfile();
  loadInvestments()
  fetchWalletBalance(); 
  displayWalletBalance()
  setupStockNameInput()
  setupQuantityInput()

  // Refresh prices every 5 minutes (300000 ms)
  priceRefreshInterval = setInterval(loadInvestments, 300000)
}

function fetchWalletBalance() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || !currentUser.id) return;

  fetch(`http://localhost:3000/get-wallet-balance/${currentUser.id}`)
    .then(response => {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    })
    .then(data => {
      localStorage.setItem(`wallet_balance_${currentUser.id}`, data.balance.toFixed(2));
      displayWalletBalance();
    })
    .catch(error => {
      console.error('Error fetching wallet balance:', error);
      // Fallback to localStorage if available
      displayWalletBalance();
    });
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
  const cancelBuyBtn = document.getElementById("cancel-debit")

  // Buy Stock Modal Elements
  const buyStockModal = document.getElementById("debit-modal")
  const buyStockBtn = document.getElementById("debit-entry-btn")
  const closeBuyModalBtn = document.getElementById("close-debit-modal")
  const saveBuyBtn = document.getElementById("save-debit")
  const cancelSellBtn = document.getElementById("cancel-entry")


  // Wallet Modal Elements
  const walletModal = document.getElementById("wallet-modal")
  const walletBtn = document.getElementById("wallet-btn")
  const closeWalletBtn = document.getElementById("close-wallet-btn")
  const buyFromWalletBtn = document.getElementById("add-expense-btn")
  const sellFromWalletBtn = document.getElementById("add-funds-btn")

  // Get current user from localStorage
  const currentUser = JSON.parse(localStorage.getItem("currentUser"))

  const exportPdfBtn = document.getElementById("export-pdf-btn");
  const pdfExportModal = document.getElementById("pdf-export-modal");
  const pdfExportForm = document.getElementById("pdf-export-form");
  const partialReportOptions = document.getElementById("partial-report-options");
  const fullReportRadio = document.getElementById("full-report");
  const partialReportRadio = document.getElementById("partial-report");
  const pdfFromDate = document.getElementById("pdf-from-date");
  const pdfToDate = document.getElementById("pdf-to-date");
  const closePdfModal = document.getElementById("close-pdf-modal");
  const cancelPdfExport = document.getElementById("cancel-pdf-export");

  // Initialize page
  initializePage()
  displayUserProfile();

  // --- UTILITY FUNCTIONS ---

  // Show modal with animation
  function showModal(modal) {
    if (modal) {
      modal.style.display = "flex"
      modal.classList.remove("hidden")
    }
  }

  // Close Buy Stock Modal with Cancel button
if (cancelBuyBtn) {
  cancelBuyBtn.addEventListener("click", () => {
    hideModal(buyStockModal)
  })
}

// Close Sell Stock Modal with Cancel button
if (cancelSellBtn) {
  cancelSellBtn.addEventListener("click", () => {
    hideModal(sellStockModal)
  })
}

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
        showModal(pdfExportModal);
        
        // Set default dates (last 30 days)
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        pdfFromDate.value = thirtyDaysAgo.toISOString().split('T')[0];
        pdfToDate.value = today.toISOString().split('T')[0];
    });
}

if (fullReportRadio && partialReportRadio) {
    fullReportRadio.addEventListener('change', () => {
        partialReportOptions.style.display = 'none';
    });
    
    partialReportRadio.addEventListener('change', () => {
        partialReportOptions.style.display = 'block';
    });
}

if (closePdfModal) {
    closePdfModal.addEventListener('click', () => {
        hideModal(pdfExportModal);
    });
}

if (cancelPdfExport) {
    cancelPdfExport.addEventListener('click', () => {
        hideModal(pdfExportModal);
    });
}

if (pdfExportForm) {
    pdfExportForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const reportType = document.querySelector('input[name="reportType"]:checked').value;
        let fromDate, toDate;
        
        if (reportType === 'partial') {
            fromDate = pdfFromDate.value;
            toDate = pdfToDate.value;
            
            if (!fromDate || !toDate) {
                alert('Please select both start and end dates for partial report');
                return;
            }
            
            if (new Date(fromDate) > new Date(toDate)) {
                alert('End date must be after start date');
                return;
            }
        }
        
        // Here you would implement the actual PDF generation
        //generatePdfReport(reportType, fromDate, toDate);
        
        hideModal(pdfExportModal);
    });
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

  // --- INVESTMENT FUNCTIONS ---

  // Initialize page - load investments and wallet balance
  function initializePage() {
    loadInvestments()
    displayWalletBalance()
    setupStockNameInput()
    setupQuantityInput()
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

  function loadInvestments() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser || !currentUser.id) {
        console.error("User not logged in");
        return;
    }
  
    fetch(`http://localhost:3000/get-investments/${currentUser.id}`)
        .then((response) => {
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            return response.json();
        })
        .then((data) => {
            const activeInvestments = data.investments.filter((inv) => inv.status === "active");
            displayInvestments(activeInvestments);
            updateInvestmentSummary(data.summary);
            populateSellStockDropdown(activeInvestments);
            
            // Also load wallet balance
            return fetch(`http://localhost:3000/get-wallet-balance/${currentUser.id}`);
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            localStorage.setItem(`wallet_balance_${currentUser.id}`, data.balance.toFixed(2));
            displayWalletBalance();
        })
        .catch((error) => {
            console.error("Error loading investments:", error);
        });
}

  // Display investments in a table
// Modify the displayInvestments function to use the new transaction list style
function displayInvestments(investments) {
  const investmentsList = document.getElementById('investments-list');
  
  if (!investmentsList) return;
  
  // Clear existing content
  investmentsList.innerHTML = '';
  
  if (!investments || investments.length === 0) {
      investmentsList.innerHTML = `
          <div class="no-investments" style="text-align: center; padding: 20px; color: #7F8C8D;">
              No active investments found. Start investing by clicking "Buy Stocks".
          </div>
      `;
      return;
  }
  
  investments.forEach((investment) => {
      // Format date
      const buyDate = new Date(investment.buy_date).toLocaleDateString();
      
      // Calculate profit/loss
      const profitLoss = Number.parseFloat(investment.profit_loss);
      const profitLossColor = profitLoss >= 0 ? "#00B894" : "#D63031";
      const profitLossIcon = profitLoss >= 0 ? "fa-arrow-up" : "fa-arrow-down";
      
      // Create transaction item
      const transactionItem = document.createElement('div');
      transactionItem.className = 'transaction-item';
      transactionItem.innerHTML = `
          <div class="transaction-icon" style="background: ${profitLoss >= 0 ? '#00B894' : '#D63031'}">
              <i class="fas ${profitLossIcon}"></i>
          </div>
          <div class="transaction-details">
              <div class="transaction-title">${investment.stock_name}</div>
              <div class="transaction-category">${Number(investment.quantity)} shares • Bought on ${buyDate}</div>
          </div>
          <div class="transaction-amount" style="color: ${profitLossColor}">
              $${profitLoss.toFixed(2)} (${investment.profit_loss_percentage}%)
          </div>
      `;
      
      investmentsList.appendChild(transactionItem);
  });
}

// Update investment summary to use the new balance cards
function updateInvestmentSummary(summary) {
  if (!summary) return;
  
  const totalInvestedElement = document.getElementById('total-invested');
  const currentValueElement = document.getElementById('current-value');
  const profitLossElement = document.getElementById('profit-loss');
  
  if (totalInvestedElement) {
      totalInvestedElement.textContent = `$${Number.parseFloat(summary.total_invested).toFixed(2)}`;
  }
  
  if (currentValueElement) {
      currentValueElement.textContent = `$${Number.parseFloat(summary.total_current_value).toFixed(2)}`;
  }
  
  if (profitLossElement) {
      const profitLoss = Number.parseFloat(summary.total_profit_loss);
      const profitLossPercentage = Number.parseFloat(summary.total_profit_loss_percentage);
      const sign = profitLoss >= 0 ? '+' : '';
      
      profitLossElement.textContent = `${sign}$${profitLoss.toFixed(2)} (${sign}${profitLossPercentage}%)`;
      profitLossElement.style.color = profitLoss >= 0 ? '#00B894' : '#D63031';
  }
}

// Keep all other functions from your original investment_script.js
// They should work with the new modals since we kept the same IDs

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

  // Handle sell stock form submission
  if (saveSellBtn) {
    saveSellBtn.addEventListener("click", async () => {
      try {
        const investmentSelect = document.getElementById("entry-category");
        const rateInput = document.getElementById("entry-amount");
        const quantityInput = document.getElementById("entry-quantity");
        const dateInput = document.getElementById("entry-date");
  
        // Validation checks
        if (!investmentSelect || investmentSelect.selectedIndex <= 0) {
          throw new Error("Please select a stock to sell");
        }
  
        if (!rateInput || !rateInput.value || isNaN(rateInput.value)) {
          throw new Error("Please enter a valid selling price");
        }
  
        if (!quantityInput || !quantityInput.value || isNaN(quantityInput.value)) {
          throw new Error("Please enter a valid quantity");
        }
  
        if (!dateInput || !dateInput.value) {
          throw new Error("Please select a selling date");
        }
  
        const investmentId = investmentSelect.value;
        const sellPrice = Number.parseFloat(rateInput.value);
        const sellQuantity = Number(quantityInput.value);
        const sellDate = dateInput.value;
  
        // Get max quantity
        const selectedOption = investmentSelect.options[investmentSelect.selectedIndex];
        const maxQuantity = Number(selectedOption.dataset.quantity);
  
        if (sellQuantity <= 0 || sellQuantity > maxQuantity) {
          throw new Error(`Quantity must be between 1 and ${maxQuantity}`);
        }
  
        if (!currentUser || !currentUser.id) {
          throw new Error("User not logged in");
        }
  
        const isPartialSale = sellQuantity < maxQuantity;
        const totalSaleAmount = sellPrice * sellQuantity;
  
        const sellData = {
          user_id: currentUser.id,
          investment_id: investmentId,
          sell_price: sellPrice,
          sell_quantity: sellQuantity,
          sell_date: sellDate,
          partial_sale: isPartialSale,
          total_sale_amount: totalSaleAmount
        };
  
        const response = await fetch("http://localhost:3000/sell-stock", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(sellData),
        });
  
        const data = await response.json();
  
        if (!response.ok) {
          throw new Error(data.message || "Failed to sell stock");
        }
  
        // Update UI
        alert(`Sold successfully! Amount: $${data.total_sale_amount.toFixed(2)}`);
        
        // Reset form
        investmentSelect.selectedIndex = 0;
        rateInput.value = "";
        quantityInput.value = "";
        quantityInput.disabled = true;
        dateInput.value = "";
  
        hideModal(sellStockModal);
        loadInvestments();
        displayWalletBalance();
  
      } catch (error) {
        console.error("Sell error:", error);
        alert(`Error: ${error.message}`);
      }
    });
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
// In investment_script.js, modify the buy stock form submission handler
if (saveBuyBtn) {
  saveBuyBtn.addEventListener("click", () => {
    const stockNameInput = document.getElementById("stock-name");
    const rateInput = document.getElementById("debit-amount");
    const quantityInput = document.getElementById("debit-quantity");
    const dateInput = document.getElementById("debit-date");
    const descriptionInput = document.getElementById("debit-description");

    if (!stockNameInput || !stockNameInput.value) {
      alert("Please enter a stock name");
      return;
    }

    if (!rateInput || !rateInput.value) {
      alert("Please enter a buying rate");
      return;
    }

    if (!quantityInput || !quantityInput.value) {
      alert("Please enter a quantity");
      return;
    }

    if (!dateInput || !dateInput.value) {
      alert("Please select a buying date");
      return;
    }

    // Get current user
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser || !currentUser.id) {
      alert("User not logged in. Please log in again.");
      return;
    }

    // Validate quantity is a whole number
    const quantity = Number(quantityInput.value);
    if (isNaN(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      alert("Please enter a valid whole number quantity");
      return;
    }

    const rate = Number.parseFloat(rateInput.value);
    const totalCost = rate * quantity;

    // Prepare data for submission
    const buyData = {
      user_id: currentUser.id,
      stock_name: stockNameInput.value,
      buy_price: rate,
      quantity: quantity,
      buy_date: dateInput.value,
      description: descriptionInput ? descriptionInput.value : "",
    };

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
            throw new Error(data.message || "Network response was not ok");
          });
        }
        return response.json();
      })
      .then((data) => {
        console.log("Stock purchased successfully:", data);
        alert(`Stock purchased successfully! Total cost: $${data.total_cost.toFixed(2)}`);

        // Reset form
        stockNameInput.value = "";
        rateInput.value = "";
        quantityInput.value = "";
        dateInput.value = "";
        if (descriptionInput) descriptionInput.value = "";

        // Hide modal
        hideModal(buyStockModal);

        // Update wallet balance in local storage and UI
        const currentBalance = getWalletBalance();
        const newBalance = currentBalance - totalCost;
        localStorage.setItem(`wallet_balance_${currentUser.id}`, newBalance.toFixed(2));
        
        // Reload investments and update wallet display
        loadInvestments();
        displayWalletBalance();

        // If on dashboard page, update the wallet balance display
        if (document.getElementById("wallet-balance")) {
          document.getElementById("wallet-balance").textContent = `$${newBalance.toFixed(2)}`;
        }
      })
      .catch((error) => {
        console.error("Error buying stock:", error);
        alert("Failed to buy stock: " + error.message);
      });
  });
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

document.querySelector('.logout-btn').addEventListener('click', function() {
    // Clear user data from localStorage
    localStorage.removeItem('currentUser');
    
    // Redirect to login page
    window.location.href = '../LoginPage/Login.html';
});