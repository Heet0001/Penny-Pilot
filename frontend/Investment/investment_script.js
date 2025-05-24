const BASE_URL = window.location.hostname === "localhost"
  ? "http://localhost:3000"
  : "https://penny-pilot-production.up.railway.app";

let priceRefreshInterval = null;

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

// Function to initialize page
function initializePage() {
  displayUserProfile();
  loadInvestments();
  fetchWalletBalance(); 
  displayWalletBalance();
  setupStockNameInput();
  setupQuantityInput();

  // Refresh prices every 5 minutes (300000 ms)
  if (priceRefreshInterval) {
    clearInterval(priceRefreshInterval);
  }
  priceRefreshInterval = setInterval(loadInvestments, 300000);
}

function fetchWalletBalance() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || !currentUser.id) return;

  fetch(`${BASE_URL}/get-wallet-balance/${currentUser.id}`)
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

// Function to get current wallet balance
function getWalletBalance() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser) return 0;

  // Get or initialize wallet balance
  return Number.parseFloat(localStorage.getItem(`wallet_balance_${currentUser.id}`) || 0);
}

// Function to display wallet balance
function displayWalletBalance() {
  const balanceDisplay = document.getElementById("wallet-balance");
  if (balanceDisplay) {
    balanceDisplay.textContent = `₹${getWalletBalance().toFixed(2)}`;
  }
}

// Function to load investments
function loadInvestments() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || !currentUser.id) return;

  fetch(`${BASE_URL}/api/get-investments/${currentUser.id}`)
    .then((response) => {
      if (!response.ok) throw new Error("Network response was not ok");
      return response.json();
    })
    .then((data) => {
      displayInvestments(data.investments);
      updateInvestmentSummary({
        ...data.summary,
        investments: data.investments
      });
      // Also populate the sell stock dropdown
      populateSellStockDropdown(data.investments);
    })
    .catch((error) => {
      console.error("Error loading investments:", error);
    });
}

// Function to display investments in a table
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
    transactionItem.dataset.stockName = investment.stock_name;
    transactionItem.dataset.quantity = investment.quantity;
    transactionItem.dataset.currentPrice = investment.current_price;
    
    transactionItem.innerHTML = `
      <div class="transaction-icon" style="background: ${profitLoss >= 0 ? '#00B894' : '#D63031'}">
        <i class="fas ${profitLossIcon}"></i>
      </div>
      <div class="transaction-details">
        <div class="transaction-title">
          ${investment.stock_name}
          <span class="current-price-badge">
            Current: ₹${Number(investment.current_price).toFixed(2)}
          </span>
        </div>
        <div class="transaction-category">
          ${Number(investment.quantity)} shares • Bought at ₹${Number(investment.buy_price).toFixed(2)} • ${buyDate}
        </div>
      </div>
      <div class="transaction-actions">
        <div class="transaction-amount" style="color: ${profitLossColor}">
          ₹${profitLoss.toFixed(2)} (${investment.profit_loss_percentage}%)
        </div>
        <button class="sell-btn" onclick="openSellModal('${investment.stock_name}', ${investment.quantity}, ${investment.current_price})">
          <i class="fas fa-money-bill-wave"></i> Sell
        </button>
      </div>
    `;
    
    investmentsList.appendChild(transactionItem);
  });
}

// Function to open sell modal with pre-filled data
function openSellModal(stockName, maxQuantity, currentPrice) {
  const modal = document.getElementById('entry-modal');
  const stockSelect = document.getElementById('entry-category');
  const quantityInput = document.getElementById('entry-amount');
  const sellPriceInput = document.getElementById('sell-price');
  const expectedReturnSpan = document.getElementById('expected-return');
  const dateInput = document.getElementById('entry-date');
  
  if (!modal || !stockSelect || !quantityInput || !sellPriceInput || !expectedReturnSpan || !dateInput) return;

  // Find the option with matching stock name
  for (let i = 0; i < stockSelect.options.length; i++) {
    const option = stockSelect.options[i];
    if (option.dataset.stockName === stockName) {
      stockSelect.selectedIndex = i;
      break;
    }
  }

  // Enable inputs
  quantityInput.disabled = false;
  sellPriceInput.disabled = false;
  
  // Set values
  quantityInput.max = maxQuantity;
  quantityInput.min = "1";
  quantityInput.value = "1";
  sellPriceInput.value = currentPrice;
  sellPriceInput.min = "0.01";
  sellPriceInput.step = "0.01";
  dateInput.value = new Date().toISOString().split('T')[0];
  
  // Show max quantity in the label
  const quantityLabel = document.querySelector('label[for="entry-amount"]');
  if (quantityLabel) {
    quantityLabel.textContent = `Quantity to Sell (Max: ${maxQuantity})`;
  }
  
  // Update expected return
  const total = 1 * currentPrice;
  expectedReturnSpan.textContent = `₹${total.toFixed(2)}`;
  
  // Show the modal
  showModal(modal);
}

// Function to update investment summary
function updateInvestmentSummary(summary) {
  const totalInvestedElement = document.getElementById("total-invested");
  const currentValueElement = document.getElementById("current-value");
  const profitLossElement = document.getElementById("profit-loss");

  if (totalInvestedElement) {
    totalInvestedElement.textContent = `₹${Number.parseFloat(summary.total_invested).toFixed(2)}`;
  }

  if (currentValueElement) {
    currentValueElement.textContent = `₹${Number.parseFloat(summary.total_current_value).toFixed(2)}`;
  }

  if (profitLossElement) {
    const profitLoss = Number.parseFloat(summary.total_profit_loss);
    const profitLossPercentage = Number.parseFloat(summary.total_profit_loss_percentage);
    const isPositive = profitLoss >= 0;
    profitLossElement.textContent = `${isPositive ? "+" : ""}₹${profitLoss.toFixed(2)} (${profitLossPercentage}%)`;
    profitLossElement.style.color = isPositive ? "#00B894" : "#D63031";
  }
  
  // Create portfolio allocation pie chart
  createPortfolioChart(summary);
}

// Function to process investment data for charts
function processInvestmentData(investments) {
  const stockMap = {};
  
  if (!investments || !Array.isArray(investments)) {
    return { stockNames: [], currentValues: [] };
  }
  
  investments.forEach(investment => {
    if (!stockMap[investment.stock_name]) {
      stockMap[investment.stock_name] = 0;
    }
    stockMap[investment.stock_name] += parseFloat(investment.current_value);
  });
  
  const stockNames = Object.keys(stockMap);
  const currentValues = stockNames.map(stock => stockMap[stock]);
  
  return { stockNames, currentValues };
}

// Create portfolio allocation pie chart
function createPortfolioChart(summary) {
  // Check if Chart.js is loaded
  if (typeof Chart === 'undefined') {
    // Load Chart.js if not already loaded
    const chartScript = document.createElement('script');
    chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    document.head.appendChild(chartScript);
    
    chartScript.onload = function() {
      renderPortfolioChart(summary.investments);
    };
  } else {
    renderPortfolioChart(summary.investments);
  }
  
  // Create the growth chart separately for the second slide
  createInvestmentGrowthChart(summary.investments);
}

// Function to render the portfolio allocation pie chart
function renderPortfolioChart(investments) {
  // Get both chart placeholders
  const chartPlaceholders = document.querySelectorAll('.chart-placeholder');
  if (!chartPlaceholders || chartPlaceholders.length === 0) return;
  
  const pieChartPlaceholder = chartPlaceholders[0];
  
  // Handle portfolio pie chart
  if (pieChartPlaceholder) {
    // Remove placeholder content
    pieChartPlaceholder.innerHTML = '';
    pieChartPlaceholder.classList.remove('chart-placeholder');
    
    // Create canvas element for the chart
    const canvas = document.createElement('canvas');
    canvas.id = 'portfolioChart';
    pieChartPlaceholder.appendChild(canvas);
    
    // Process data for chart
    const { stockNames, currentValues } = processInvestmentData(investments);
    
    if (!investments || !Array.isArray(investments) || investments.length === 0 || stockNames.length === 0) {
      pieChartPlaceholder.innerHTML = `
        <i class="fas fa-chart-pie"></i>
        <p>No investments to display. Start investing by clicking "Buy Stocks".</p>
      `;
      pieChartPlaceholder.classList.add('chart-placeholder');
    } else {
      // Create pie chart
      const ctx = canvas.getContext('2d');
      new Chart(ctx, {
        type: 'pie',
        data: {
          labels: stockNames,
          datasets: [{
            data: currentValues,
            backgroundColor: [
              '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
              '#9966FF', '#FF9F40', '#8AC24A', '#607D8B',
              '#E74C3C', '#3498DB', '#F1C40F', '#1ABC9C'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: { 
              display: true, 
              text: 'Portfolio Allocation', 
              font: { size: 16 }, 
              padding: { top: 10, bottom: 10 } 
            },
            legend: { 
              position: 'right', 
              labels: { boxWidth: 12, padding: 12 } 
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.raw || 0;
                  const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                  const percentage = ((value / total) * 100).toFixed(1);
                  return `${label}: ₹${value.toFixed(2)} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }
  }
}

// Process investment data for growth chart
function processInvestmentGrowthData(investments) {
  if (!investments || !Array.isArray(investments)) {
    return { stockNames: [], investedValues: [], currentValues: [] };
  }
  
  // Sort investments by current value (descending)
  const sortedInvestments = [...investments].sort((a, b) => 
    parseFloat(b.current_value) - parseFloat(a.current_value)
  );
  
  // Take top 5 investments for readability
  const topInvestments = sortedInvestments.slice(0, 5);
  
  const stockNames = topInvestments.map(inv => inv.stock_name);
  const investedValues = topInvestments.map(inv => parseFloat(inv.buy_price) * parseFloat(inv.quantity));
  const currentValues = topInvestments.map(inv => parseFloat(inv.current_value));
  
  return { stockNames, investedValues, currentValues };
}

// Create investment growth bar chart
function createInvestmentGrowthChart(investments) {
  // Find the chart placeholder in the second slide
  const swiperSlides = document.querySelectorAll('.swiper-slide');
  if (swiperSlides.length < 2) return;
  
  const secondSlide = swiperSlides[1];
  let growthChartPlaceholder;
  
  // Look for chart-placeholder in the second slide
  if (secondSlide) {
    growthChartPlaceholder = secondSlide.querySelector('.chart-placeholder');
  }
  
  if (!growthChartPlaceholder) return;
  
  // Remove placeholder content
  growthChartPlaceholder.innerHTML = '';
  growthChartPlaceholder.classList.remove('chart-placeholder');
  
  // Create chart container with fixed height to ensure proper bar display
  const chartContainer = document.createElement('div');
  chartContainer.style.height = '300px'; // Set a fixed height for better visualization
  chartContainer.style.width = '100%';
  chartContainer.style.position = 'relative';
  growthChartPlaceholder.appendChild(chartContainer);
  
  // Create canvas element for the chart
  const canvas = document.createElement('canvas');
  canvas.id = 'growthChart';
  chartContainer.appendChild(canvas);
  
  // Process data for chart
  const { stockNames, investedValues, currentValues } = processInvestmentGrowthData(investments);
  
  if (!investments || !Array.isArray(investments) || investments.length === 0 || stockNames.length === 0) {
    growthChartPlaceholder.innerHTML = `
      <i class="fas fa-chart-line"></i>
      <p>No investments to display. Start investing by clicking "Buy Stocks".</p>
    `;
    growthChartPlaceholder.classList.add('chart-placeholder');
    return;
  }
  
  // Find the max value to set proper y-axis scale
  const maxValue = Math.max(
    ...investedValues, 
    ...currentValues
  );
  
  // Add 20% padding to the max value for better visualization
  const yAxisMax = maxValue * 1.2;
  
  // Create bar chart
  const ctx = canvas.getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: stockNames,
      datasets: [
        {
          label: 'Invested Amount',
          data: investedValues,
          backgroundColor: '#FF9F40',
          borderColor: '#FF9F40',
          borderWidth: 1,
          barPercentage: 0.7, // Make bars wider
          categoryPercentage: 0.8
        },
        {
          label: 'Current Value',
          data: currentValues,
          backgroundColor: '#4BC0C0',
          borderColor: '#4BC0C0',
          borderWidth: 1,
          barPercentage: 0.7, // Make bars wider
          categoryPercentage: 0.8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // Important for proper sizing
      layout: {
        padding: {
          top: 20,
          right: 20,
          bottom: 20,
          left: 20
        }
      },
      plugins: {
        title: { 
          display: true, 
          text: 'Investment Growth', 
          font: { size: 18 }, 
          padding: { top: 10, bottom: 20 } 
        },
        legend: { 
          position: 'top', 
          labels: { boxWidth: 12, padding: 12 },
          display: true
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.dataset.label || '';
              const value = context.raw || 0;
              return `${label}: ₹${value.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: yAxisMax, // Use the calculated max value
          title: {
            display: true,
            text: 'Amount (₹)',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            padding: 5
          }
        },
        x: {
          title: {
            display: true,
            text: 'Stocks',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            padding: 5
          }
        }
      }
    }
  });
}

// Populate sell stock dropdown with active investments
function populateSellStockDropdown(investments) {
  const sellStockSelect = document.getElementById("entry-category");

  if (!sellStockSelect) return;

  // Clear existing options except the first one
  while (sellStockSelect.options.length > 1) {
    sellStockSelect.remove(1);
  }

  // Add active investments to dropdown
  investments.forEach((investment) => {
    const option = document.createElement("option");
    option.value = investment.id;
    option.textContent = `${investment.stock_name} - ${Number(investment.quantity)} units @ ₹${Number.parseFloat(investment.buy_price).toFixed(2)}`;
    option.dataset.currentPrice = investment.current_price;
    option.dataset.quantity = investment.quantity;
    option.dataset.stockName = investment.stock_name;
    option.dataset.buyPrice = investment.buy_price;
    sellStockSelect.appendChild(option);
  });
}

// Setup stock name input to fetch real-time price
function setupStockNameInput() {
  const stockNameInput = document.getElementById("debit-category");
  const stockPriceInput = document.getElementById("stock-price");
  const quantityInput = document.getElementById("debit-amount");
  const totalCostSpan = document.getElementById("total-cost");
  const fetchPriceBtn = document.getElementById("fetch-price-btn");

  if (stockNameInput && stockPriceInput) {
    // Enable manual price input
    stockPriceInput.disabled = false;
    
    // Add input event listener for manual price updates
    stockPriceInput.addEventListener("input", function() {
      const price = Number(this.value);
      if (price && quantityInput.value) {
        const total = price * Number(quantityInput.value);
        totalCostSpan.textContent = `₹${total.toFixed(2)}`;
      }
    });

    // Add debounce for auto-fetch
    let debounceTimer;

    // Function to fetch stock price
    const fetchStockPrice = async (stockName) => {
      try {
        // Add loading states
        stockPriceInput.value = "Fetching...";
        stockPriceInput.classList.add('fetching');
        fetchPriceBtn.classList.add('loading');
        
        // Call our server endpoint instead of Alpha Vantage directly
        const response = await fetch(`${BASE_URL}/api/stock-price/${stockName}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error("Failed to fetch stock price");
        }

        const data = await response.json();
        if (data.price) {
          const price = parseFloat(data.price);
          stockPriceInput.value = price.toFixed(2);
          // Update total cost if quantity is already entered
          if (quantityInput.value) {
            const total = price * Number(quantityInput.value);
            totalCostSpan.textContent = `₹${total.toFixed(2)}`;
          }
        } else {
          throw new Error("Price not available");
        }
      } catch (error) {
        console.error("Error fetching stock price:", error);
        showErrorMessage("Could not fetch stock price as the API limit has been reached. You can enter the price manually.");
        stockPriceInput.value = ""; // Clear the "Fetching..." text
      } finally {
        // Remove loading states
        stockPriceInput.classList.remove('fetching');
        fetchPriceBtn.classList.remove('loading');
      }
    };

    // Auto-fetch on stock name input
    stockNameInput.addEventListener("input", function () {
      clearTimeout(debounceTimer);
      const stockName = this.value.trim().toUpperCase();

      if (stockName) {
        debounceTimer = setTimeout(() => fetchStockPrice(stockName), 800);
      }
    });

    // Manual fetch button click
    if (fetchPriceBtn) {
      fetchPriceBtn.addEventListener("click", () => {
        const stockName = stockNameInput.value.trim().toUpperCase();
        if (stockName) {
          fetchStockPrice(stockName);
        } else {
          showErrorMessage("Please enter a stock symbol first");
        }
      });
    }
  }

  // Update total cost when quantity changes
  if (quantityInput) {
    quantityInput.addEventListener("input", function() {
      const price = Number(stockPriceInput.value);
      const quantity = Number(this.value);
      if (price && quantity) {
        const total = price * quantity;
        totalCostSpan.textContent = `₹${total.toFixed(2)}`;
      } else {
        totalCostSpan.textContent = "₹0.00";
      }
    });
  }
}

// Setup quantity input for selling
function setupQuantityInput() {
  const stockSelect = document.getElementById("entry-category");
  const quantityInput = document.getElementById("entry-amount");
  const sellPriceInput = document.getElementById("sell-price");
  const expectedReturnSpan = document.getElementById("expected-return");

  if (stockSelect && quantityInput && sellPriceInput && expectedReturnSpan) {
    // Initially disable quantity input and price input
    quantityInput.disabled = true;
    sellPriceInput.disabled = true;

    stockSelect.addEventListener("change", function () {
      if (this.selectedIndex > 0) {
        const selectedOption = this.options[this.selectedIndex];
        const maxQuantity = selectedOption.dataset.quantity;
        const currentPrice = selectedOption.dataset.currentPrice;

        // Enable inputs
        quantityInput.disabled = false;
        sellPriceInput.disabled = false;

        // Set quantity input attributes
        quantityInput.max = maxQuantity;
        quantityInput.min = "1";
        quantityInput.step = "1";
        quantityInput.value = "1";

        // Set current price as default sell price
        if (sellPriceInput && currentPrice) {
          sellPriceInput.value = currentPrice;
          sellPriceInput.min = "0.01";
          sellPriceInput.step = "0.01";
        }

        // Show max quantity in the label
        const quantityLabel = document.querySelector('label[for="entry-amount"]');
        if (quantityLabel) {
          quantityLabel.textContent = `Quantity to Sell (Max: ${maxQuantity})`;
        }

        updateExpectedReturn();
      } else {
        // Disable inputs if no stock selected
        quantityInput.disabled = true;
        sellPriceInput.disabled = true;
        quantityInput.value = "";
        sellPriceInput.value = "";
        
        // Reset label
        const quantityLabel = document.querySelector('label[for="entry-amount"]');
        if (quantityLabel) {
          quantityLabel.textContent = "Quantity to Sell";
        }

        if (expectedReturnSpan) {
          expectedReturnSpan.textContent = "₹0.00";
        }
      }
    });

    // Function to update expected return
    function updateExpectedReturn() {
      const quantity = Number(quantityInput.value);
      const price = Number(sellPriceInput.value);
      if (quantity && price && expectedReturnSpan) {
        const total = quantity * price;
        expectedReturnSpan.textContent = `₹${total.toFixed(2)}`;

        // Validate quantity
        const maxQuantity = Number(stockSelect.options[stockSelect.selectedIndex].dataset.quantity);
        if (quantity > maxQuantity) {
          quantityInput.value = maxQuantity;
          updateExpectedReturn();
        }
      }
    }

    // Add event listeners for real-time updates
    quantityInput.addEventListener("input", updateExpectedReturn);
    sellPriceInput.addEventListener("input", updateExpectedReturn);
  }
}

// Show error message function
function showErrorMessage(message) {
  const errorDiv = document.getElementById("error-message");
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = "block";
    errorDiv.style.backgroundColor = "#ff7675"; // Error color
    setTimeout(() => {
      errorDiv.style.display = "none";
    }, 5000);
  }
}

// Show success message function
function showSuccessMessage(message) {
  const errorDiv = document.getElementById("error-message");
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.backgroundColor = "#00b894"; // Success color
    errorDiv.style.display = "block";
    setTimeout(() => {
      errorDiv.style.display = "none";
      errorDiv.style.backgroundColor = "#ff7675"; // Reset to error color
    }, 5000);
  }
}

// Show modal with animation
function showModal(modal) {
  if (modal) {
    modal.style.display = "flex";
    modal.classList.remove("hidden");
  }
}

// Hide modal with animation
function closeModal(modal) {
  if (modal) {
    modal.classList.add("hidden");
    setTimeout(() => {
      modal.style.display = "none";
      modal.classList.remove("hidden"); // Reset for next use
    }, 300); // Match animation duration
  }
}

// Reset sell stock form
function resetSellStockForm() {
  const sellStockSelect = document.getElementById("entry-category");
  const quantityInput = document.getElementById("entry-amount");
  const sellPriceInput = document.getElementById("sell-price");
  const dateInput = document.getElementById("entry-date");
  const expectedReturnSpan = document.getElementById("expected-return");
  const quantityLabel = document.querySelector('label[for="entry-amount"]');

  // Reset dropdown
  if (sellStockSelect) {
    sellStockSelect.selectedIndex = 0;
  }

  // Reset and disable quantity input
  if (quantityInput) {
    quantityInput.value = "";
    quantityInput.disabled = true;
  }

  // Reset and disable sell price input
  if (sellPriceInput) {
    sellPriceInput.value = "";
    sellPriceInput.disabled = true;
  }

  // Reset date to today
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  // Reset expected return
  if (expectedReturnSpan) {
    expectedReturnSpan.textContent = "₹0.00";
  }

  // Reset quantity label
  if (quantityLabel) {
    quantityLabel.textContent = "Quantity to Sell";
  }
}

// Helper function to format dates for PDF
function formatDateForPdf(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Function to generate PDF report for investments
function generateInvestmentPdfReport(reportType, fromDate, toDate) {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser) {
    alert("User not logged in. Please log in again.");
    return;
  }

  // Create loading indicator
  const loadingOverlay = document.createElement("div");
  loadingOverlay.style.position = "fixed";
  loadingOverlay.style.top = "0";
  loadingOverlay.style.left = "0";
  loadingOverlay.style.width = "100%";
  loadingOverlay.style.height = "100%";
  loadingOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  loadingOverlay.style.display = "flex";
  loadingOverlay.style.justifyContent = "center";
  loadingOverlay.style.alignItems = "center";
  loadingOverlay.style.zIndex = "9999";

  const loadingSpinner = document.createElement("div");
  loadingSpinner.innerHTML = '<i class="fas fa-spinner fa-spin" style="color: white; font-size: 48px;"></i>';
  loadingOverlay.appendChild(loadingSpinner);

  document.body.appendChild(loadingOverlay);

  // Prepare query parameters
  let queryParams = `user_id=${currentUser.id}`;
  if (reportType === "partial" && fromDate && toDate) {
    queryParams += `&from_date=${fromDate}&to_date=${toDate}`;
  }

  // Fetch investment data
  fetch(`${BASE_URL}/api/get-investments/${currentUser.id}`)
    .then((response) => {
      if (!response.ok) throw new Error("Network response was not ok");
      return response.json();
    })
    .then((data) => {
      // Filter investments by date range if needed
      let filteredData = { ...data };
      
      if (reportType === "partial" && fromDate && toDate) {
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999); // Include the entire end date
        
        // Filter investments by date
        const filteredInvestments = data.investments.filter(investment => {
          const buyDate = new Date(investment.buy_date);
          return buyDate >= startDate && buyDate <= endDate;
        });
        
        // Recalculate summary values
        let totalInvested = 0;
        let totalCurrentValue = 0;
        
        filteredInvestments.forEach(inv => {
          totalInvested += parseFloat(inv.buy_price) * parseFloat(inv.quantity);
          totalCurrentValue += parseFloat(inv.current_value);
        });
        
        const totalProfitLoss = totalCurrentValue - totalInvested;
        const totalProfitLossPercentage = totalInvested > 0 ? ((totalProfitLoss / totalInvested) * 100).toFixed(2) : 0;
        
        filteredData = {
          investments: filteredInvestments,
          summary: {
            total_invested: totalInvested,
            total_current_value: totalCurrentValue,
            total_profit_loss: totalProfitLoss,
            total_profit_loss_percentage: totalProfitLossPercentage
          }
        };
      }
      
      // Generate PDF
      if (typeof jsPDF === "undefined") {
        // Load jsPDF if not already loaded
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        document.head.appendChild(script);
        
        // Also add jspdf-autotable for better tables
        const autoTableScript = document.createElement("script");
        autoTableScript.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js";
        document.head.appendChild(autoTableScript);
        
        // Wait for scripts to load
        autoTableScript.onload = function() {
          createInvestmentPdf(filteredData, reportType, fromDate, toDate, currentUser);
          document.body.removeChild(loadingOverlay);
        };
      } else {
        createInvestmentPdf(filteredData, reportType, fromDate, toDate, currentUser);
        document.body.removeChild(loadingOverlay);
      }
    })
    .catch((error) => {
      console.error("Error generating report:", error);
      document.body.removeChild(loadingOverlay);
      alert("Error generating report. Please try again.");
    });
}

// Function to create the actual PDF document
function createInvestmentPdf(data, reportType, fromDate, toDate, currentUser) {
  // Get the jsPDF instance
  let jsPDF;
  if (window.jspdf && window.jspdf.jsPDF) {
    jsPDF = window.jspdf.jsPDF;
  } else if (window.jsPDF) {
    jsPDF = window.jsPDF;
  } else {
    console.error("jsPDF library not found.");
    alert("PDF generation library not loaded. Please try again.");
    return;
  }
  
  // Create new PDF document
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(20);
  doc.setTextColor(40, 40, 40);
  doc.text("Penny Pilot Investment Report", 105, 20, { align: "center" });
  
  // Add report period
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  if (reportType === "partial") {
    doc.text(`Report Period: ${formatDateForPdf(fromDate)} to ${formatDateForPdf(toDate)}`, 105, 30, {
      align: "center",
    });
  } else {
    doc.text("Complete Investment Portfolio", 105, 30, { align: "center" });
  }
  
  // Add user info
  doc.setFontSize(12);
  doc.text(`User: ${currentUser.name}`, 20, 40);
  doc.text(`Generated on: ${formatDateForPdf(new Date())}`, 20, 46);
  
  // Add investment summary
  doc.setFontSize(14);
  doc.setTextColor(40, 40, 40);
  doc.text("Investment Summary", 20, 56);
  
  doc.setFontSize(12);
  doc.text(`Total Invested: ₹${Number.parseFloat(data.summary.total_invested).toFixed(2)}`, 30, 64);
  doc.text(`Current Value: ₹${Number.parseFloat(data.summary.total_current_value).toFixed(2)}`, 30, 70);
  
  const profitLoss = Number.parseFloat(data.summary.total_profit_loss);
  const profitLossPercentage = Number.parseFloat(data.summary.total_profit_loss_percentage);
  const profitLossText = `Overall Profit/Loss: ${profitLoss >= 0 ? "+" : ""}₹${profitLoss.toFixed(2)} (${profitLossPercentage}%)`;
  
  doc.setTextColor(profitLoss >= 0 ? 0 : 214, profitLoss >= 0 ? 184 : 48, profitLoss >= 0 ? 148 : 49);
  doc.text(profitLossText, 30, 76);
  doc.setTextColor(40, 40, 40);
  
  // Add charts if investments exist
  if (data.investments && data.investments.length > 0) {
    // Add pie chart
    const pieCanvas = document.getElementById('portfolioChart');
    if (pieCanvas) {
      try {
        const pieChartImg = pieCanvas.toDataURL('image/png');
        doc.text("Portfolio Allocation", 105, 90, { align: "center" });
        doc.addImage(pieChartImg, 'PNG', 20, 95, 170, 80);
        
        // Add growth chart on a new page
        doc.addPage();
        const growthCanvas = document.getElementById('growthChart');
        if (growthCanvas) {
          try {
            const growthChartImg = growthCanvas.toDataURL('image/png');
            doc.text("Investment Growth", 105, 20, { align: "center" });
            doc.addImage(growthChartImg, 'PNG', 20, 25, 170, 80);
          } catch (e) {
            console.error("Error capturing growth chart:", e);
            doc.text("Investment Growth chart could not be displayed", 105, 20, { align: "center" });
          }
        }
      } catch (e) {
        console.error("Error capturing pie chart:", e);
        doc.text("Portfolio Allocation chart could not be displayed", 105, 90, { align: "center" });
      }
    }
  } else {
    doc.setFontSize(12);
    doc.text("No investments found in the specified period.", 20, 85);
  }
  
  // Add investment details table
  doc.addPage();
  
  doc.setFontSize(14);
  doc.text("Investment Details", 20, 20);
  
  if (data.investments && data.investments.length > 0) {
    // Create table
    const investmentTableData = data.investments.map((investment) => [
      investment.stock_name,
      investment.quantity.toString(),
      `₹${Number.parseFloat(investment.buy_price).toFixed(2)}`,
      `₹${Number.parseFloat(investment.current_price).toFixed(2)}`,
      formatDateForPdf(investment.buy_date),
      `₹${Number.parseFloat(investment.buy_price * investment.quantity).toFixed(2)}`,
      `₹${Number.parseFloat(investment.current_value).toFixed(2)}`,
      `${investment.profit_loss >= 0 ? "+" : ""}₹${Number.parseFloat(investment.profit_loss).toFixed(2)}`,
      `${investment.profit_loss_percentage}%`
    ]);
    
    doc.autoTable({
      startY: 24,
      head: [["Stock", "Quantity", "Buy Price", "Current Price", "Buy Date", "Cost Basis", "Current Value", "Profit/Loss", "Return %"]],
      body: investmentTableData,
      theme: "striped",
      headStyles: { fillColor: [108, 92, 231] },
      styles: { fontSize: 8 }, // Smaller font to fit all columns
      columnStyles: {
        0: { cellWidth: 20 }, // Stock name
        4: { cellWidth: 20 }, // Date
      }
    });
  } else {
    doc.setFontSize(12);
    doc.text("No investments found in the specified period.", 20, 30);
  }
  
  // Add footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(`Penny Pilot - Page ${i} of ${pageCount}`, 105, doc.internal.pageSize.height - 10, { align: "center" });
  }
  
  // Save the PDF
  const fileName = `PennyPilot_Investment_Report_${currentUser.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(fileName);
  
  // Show success message
  alert("PDF report generated successfully!");
}

// Add a helper function to format Indian stock symbols
function formatIndianStockSymbol(symbol) {
  // Remove any existing exchange suffixes
  const cleanSymbol = symbol.replace(/\.(NSE|BSE)$/i, "");

  // Add BSE suffix by default
  return `${cleanSymbol}.BSE`;
}

// Function to fetch stock details
async function fetchStockDetails(stockName) {
  try {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser || !currentUser.id) {
      showErrorMessage("Please log in to fetch stock details");
      return;
    }

    const response = await fetch(`${BASE_URL}/api/get-investments/${currentUser.id}`);
    if (!response.ok) {
      throw new Error("Failed to fetch investments");
    }

    const data = await response.json();
    const matchingInvestment = data.investments.find(inv => 
      inv.stock_name.toUpperCase() === stockName.toUpperCase() && 
      inv.status === 'active'
    );

    if (!matchingInvestment) {
      showErrorMessage(`No active investment found for ${stockName}`);
      return;
    }

    // Show stock details section
    const stockDetails = document.querySelector('.stock-details');
    if (stockDetails) {
      stockDetails.style.display = 'block';
    }

    // Update current holdings display
    const holdingsDetails = document.getElementById('current-holdings-details');
    if (holdingsDetails) {
      holdingsDetails.innerHTML = `
        <p><strong>Stock:</strong> ${matchingInvestment.stock_name}</p>
        <p><strong>Current Holdings:</strong> ${matchingInvestment.quantity} shares</p>
        <p><strong>Buy Price:</strong> ₹${matchingInvestment.buy_price}</p>
        <p><strong>Current Price:</strong> ₹${matchingInvestment.current_price}</p>
      `;
    }

    // Enable and set up quantity input
    const quantityInput = document.getElementById('sell-quantity');
    if (quantityInput) {
      quantityInput.disabled = false;
      quantityInput.max = matchingInvestment.quantity;
      quantityInput.min = 1;
      quantityInput.value = 1;
    }

    // Set up sell date
    const dateInput = document.getElementById('sell-date');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    // Calculate initial expected return
    updateExpectedReturn(matchingInvestment.current_price, 1);

    // Store investment details for later use
    document.getElementById('sell-stock-form').dataset.investmentId = matchingInvestment.id;
    document.getElementById('sell-stock-form').dataset.buyPrice = matchingInvestment.buy_price;
    document.getElementById('sell-stock-form').dataset.currentPrice = matchingInvestment.current_price;

  } catch (error) {
    console.error("Error fetching stock details:", error);
    showErrorMessage(error.message || "Failed to fetch stock details");
  }
}

// Function to update expected return
function updateExpectedReturn(currentPrice, quantity) {
  const expectedReturn = document.getElementById('expected-return');
  if (expectedReturn) {
    const total = currentPrice * quantity;
    expectedReturn.value = `₹${total.toFixed(2)}`;
  }
}

// Function to handle stock selling
async function handleSellStock(event) {
  event.preventDefault();

  const form = document.getElementById('sell-stock-form');
  const stockName = document.getElementById('sell-stock-input').value.trim().toUpperCase();
  const quantityInput = document.getElementById('sell-quantity');
  const dateInput = document.getElementById('sell-date');
  const sellBtn = form.querySelector('button[type="submit"], .save-btn');

  if (!form || !stockName || !quantityInput || !dateInput) return;

  // Validation checks
  if (!stockName) {
    showErrorMessage("Please enter a stock name");
    return;
  }

  const sellQuantity = parseInt(quantityInput.value);
  const maxQuantity = parseInt(quantityInput.max);
  const currentPrice = parseFloat(form.dataset.currentPrice);
  const sellDate = dateInput.value;

  if (!sellQuantity || isNaN(sellQuantity) || sellQuantity <= 0) {
    showErrorMessage("Please enter a valid quantity");
    return;
  }

  if (sellQuantity > maxQuantity) {
    showErrorMessage(`You can only sell up to ${maxQuantity} shares`);
    return;
  }

  if (!sellDate) {
    showErrorMessage("Please select a sell date");
    return;
  }

  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || !currentUser.id) {
    showErrorMessage("Please log in to sell stocks");
    return;
  }

  try {
    if (sellBtn) sellBtn.disabled = true;

    // Prepare data for API
    const sellData = {
      user_id: currentUser.id,
      investment_id: form.dataset.investmentId,
      stock_name: stockName,
      sell_price: currentPrice,
      sell_quantity: sellQuantity,
      sell_date: sellDate,
      partial_sale: sellQuantity < maxQuantity
    };

    // Call API to sell stock
    const response = await fetch(`${BASE_URL}/api/sell-stock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sellData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to sell stock");
    }

    const data = await response.json();

    // Show success message
    showSuccessMessage(
      `Successfully sold ${sellQuantity} shares of ${stockName}! Amount: ₹${(currentPrice * sellQuantity).toFixed(2)}`
    );

    // Reset form and close modal
    resetSellStockForm();
    closeModal(document.getElementById("entry-modal"));

    // --- FORCE UI REFRESH ---
    // 1. Reload investments and wallet balance
    await loadInvestments();
    await fetchWalletBalance();

    // 2. Force wallet display update
    displayWalletBalance();

    // 3. Log for debugging
    console.log("Sell complete. Investments and wallet should be updated.");

  } catch (error) {
    console.error("Error selling stock:", error);
    showErrorMessage(error.message || "Failed to sell stock. Please try again.");
  } finally {
    if (sellBtn) sellBtn.disabled = false;
  }
}

// Document ready function
document.addEventListener("DOMContentLoaded", () => {
  // Initialize Swiper
  const swiperContainer = document.querySelector('.swiper-container');
  if (swiperContainer) {
    const swiper = new Swiper('.swiper-container', {
      loop: true,
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
    });
  }

  // Add Button Functionality
  const addButton = document.getElementById('addButton');
  const addOptions = document.getElementById('addOptions');
  
  if (addButton && addOptions) {
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
  }

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
    if (scrollHint) {
      scrollHint.addEventListener('click', function() {
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
    }

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
  const buyStockOption = document.getElementById('buy-stock-option');
  const sellStockOption = document.getElementById('sell-stock-option');
  
  if (buyStockOption) {
    buyStockOption.addEventListener('click', function() {
      const debitModal = document.getElementById('debit-modal');
      if (debitModal) {
        debitModal.style.display = 'flex';
      }
      if (addOptions) {
        addOptions.style.display = 'none';
      }
      if (addButton) {
        addButton.classList.remove('active');
      }
    });
  }

  if (sellStockOption) {
    sellStockOption.addEventListener('click', function() {
      const entryModal = document.getElementById('entry-modal');
      if (entryModal) {
        entryModal.style.display = 'flex';
      }
      if (addOptions) {
        addOptions.style.display = 'none';
      }
      if (addButton) {
        addButton.classList.remove('active');
      }
    });
  }

  // Set today's date as default
  const today = new Date().toISOString().split('T')[0];
  if (document.getElementById('debit-date')) document.getElementById('debit-date').value = today;
  if (document.getElementById('entry-date')) document.getElementById('entry-date').value = today;
  if (document.getElementById('start-date')) document.getElementById('start-date').value = today;
  if (document.getElementById('end-date')) document.getElementById('end-date').value = today;

  // --- MODAL ELEMENTS ---
  // Sell Stock Modal Elements
  const sellStockModal = document.getElementById("entry-modal");
  const sellStockBtn = document.getElementById("add-entry-btn");
  const closeSellModalBtn = document.getElementById("close-modal");
  const saveSellBtn = document.getElementById("save-entry");

  // Buy Stock Modal Elements
  const buyStockModal = document.getElementById("debit-modal");
  const buyStockBtn = document.getElementById("debit-entry-btn");
  const closeBuyModalBtn = document.getElementById("close-debit-modal");
  const saveBuyBtn = document.getElementById("save-debit");

  // Wallet Modal Elements
  const walletModal = document.getElementById("wallet-modal");
  const walletBtn = document.getElementById("wallet-btn");
  const closeWalletBtn = document.getElementById("close-wallet-btn");
  const buyFromWalletBtn = document.getElementById("add-expense-btn");
  const sellFromWalletBtn = document.getElementById("add-funds-btn");

  // PDF Export Elements
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
  initializePage();

  // Open Sell Stock Modal
  if (sellStockBtn) {
    sellStockBtn.addEventListener("click", () => {
      // Fetch current investments before showing modal
      loadInvestments();
      showModal(sellStockModal);
    });
  }

  // Close Sell Stock Modal
  if (closeSellModalBtn) {
    closeSellModalBtn.addEventListener("click", () => {
      resetSellStockForm();
      closeModal(sellStockModal);
    });
  }

  // Add cancel button event listener
  const cancelSellBtn = document.getElementById("cancel-sell");
  if (cancelSellBtn) {
    cancelSellBtn.addEventListener("click", () => {
      resetSellStockForm();
      closeModal(sellStockModal);
    });
  }

  // Handle sell stock form submission
  if (saveSellBtn) {
    saveSellBtn.addEventListener("click", handleSellStock);
  }

  // Open Buy Stock Modal
  if (buyStockBtn) {
    buyStockBtn.addEventListener("click", () => {
      showModal(buyStockModal);
    });
  }

  // Close Buy Stock Modal
  if (closeBuyModalBtn) {
    closeBuyModalBtn.addEventListener("click", () => {
      closeModal(buyStockModal);
    });
  }

  // Show Wallet Modal
  if (walletBtn) {
    walletBtn.addEventListener("click", () => {
      showModal(walletModal);
      displayWalletBalance();
    });
  }

  // Close Wallet Modal
  if (closeWalletBtn) {
    closeWalletBtn.addEventListener("click", () => {
      closeModal(walletModal);
    });
  }

  // Buy Stock from Wallet
  if (buyFromWalletBtn) {
    buyFromWalletBtn.addEventListener("click", () => {
      closeModal(walletModal);
      showModal(buyStockModal);
    });
  }

  // Sell Stock from Wallet
  if (sellFromWalletBtn) {
    sellFromWalletBtn.addEventListener("click", () => {
      closeModal(walletModal);
      showModal(sellStockModal);
    });
  }

  // PDF Export functionality
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      // Set default dates (last 30 days)
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      
      if (pdfFromDate) pdfFromDate.value = thirtyDaysAgo.toISOString().split('T')[0];
      if (pdfToDate) pdfToDate.value = today.toISOString().split('T')[0];
      
      showModal(pdfExportModal);
    });
  }

  if (fullReportRadio && partialReportRadio && partialReportOptions) {
    fullReportRadio.addEventListener('change', () => {
      partialReportOptions.style.display = 'none';
    });
    
    partialReportRadio.addEventListener('change', () => {
      partialReportOptions.style.display = 'block';
    });
  }

  if (closePdfModal) {
    closePdfModal.addEventListener('click', () => {
      closeModal(pdfExportModal);
    });
  }

  if (cancelPdfExport) {
    cancelPdfExport.addEventListener('click', () => {
      closeModal(pdfExportModal);
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
      
      // Generate the PDF report
      generateInvestmentPdfReport(reportType, fromDate, toDate);
      
      closeModal(pdfExportModal);
    });
  }

  // Close modals when clicking outside
  window.addEventListener("click", (event) => {
    if (event.target === sellStockModal) {
      closeModal(sellStockModal);
    } else if (event.target === buyStockModal) {
      closeModal(buyStockModal);
    } else if (event.target === walletModal) {
      closeModal(walletModal);
    } else if (event.target === pdfExportModal) {
      closeModal(pdfExportModal);
    }
  });

  // Buy stock form submission
  const debitForm = document.getElementById("debit-form");
  if (debitForm) {
    debitForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const currentUser = JSON.parse(localStorage.getItem("currentUser"));
      if (!currentUser || !currentUser.id) {
        showErrorMessage("Please log in to buy stocks");
        return;
      }

      const stockName = document.getElementById("debit-category").value.trim().toUpperCase();
      const quantity = Number(document.getElementById("debit-amount").value);
      const buyDate = document.getElementById("debit-date").value;
      const description = document.getElementById("debit-description").value;
      const buyPrice = Number(document.getElementById("stock-price").value);

      if (!stockName || !quantity || !buyDate || !buyPrice) {
        showErrorMessage("Please fill in all required fields");
        return;
      }

      try {
        const response = await fetch(`${BASE_URL}/api/buy-stock`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: currentUser.id,
            stock_name: stockName,
            buy_price: buyPrice,
            quantity: quantity,
            buy_date: buyDate,
            description: description,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to buy stock");
        }

        const data = await response.json();
        if (data.success) {
          // Reset form
          e.target.reset();
          document.getElementById("total-cost").textContent = "₹0.00";
          
          // Hide modal
          closeModal(document.getElementById("debit-modal"));
          
          // Reload data
          loadInvestments();
          fetchWalletBalance();
          
          // Show success message
          showSuccessMessage(`Successfully bought ${quantity} shares of ${stockName}`);
        } else {
          showErrorMessage(data.message || "Failed to buy stock");
        }
      } catch (error) {
        showErrorMessage(error.message);
      }
    });
  }

  // Add logout button event listener
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      // Clear user data from localStorage
      localStorage.removeItem('currentUser');
      
      // Redirect to login page
      window.location.href = '../Loginpage/Index.html';
    });
  }

  // Clean up when the page is unloaded
  window.addEventListener("beforeunload", () => {
    if (priceRefreshInterval) {
      clearInterval(priceRefreshInterval);
    }
  });

  // Add fetch stock details button event listener
  const fetchStockBtn = document.getElementById('fetch-stock-btn');
  if (fetchStockBtn) {
    fetchStockBtn.addEventListener('click', () => {
      const stockInput = document.getElementById('sell-stock-input');
      if (stockInput && stockInput.value.trim()) {
        fetchStockDetails(stockInput.value.trim());
      } else {
        showErrorMessage("Please enter a stock name");
      }
    });
  }

  // Add quantity input event listener for real-time calculations
  const quantityInput = document.getElementById('sell-quantity');
  if (quantityInput) {
    quantityInput.addEventListener('input', () => {
      const form = document.getElementById('sell-stock-form');
      if (form && form.dataset.currentPrice) {
        updateExpectedReturn(
          parseFloat(form.dataset.currentPrice),
          parseInt(quantityInput.value) || 0
        );
      }
    });
  }
});

// Make openSellModal globally available for onclick handlers
window.openSellModal = openSellModal;

console.log("Investment script loaded successfully!");