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
  
  // Filter out sold investments to show only active ones
  const activeInvestments = investments ? investments.filter(investment => investment.status === 'active') : [];
  
  if (!activeInvestments || activeInvestments.length === 0) {
    investmentsList.innerHTML = `
      <div class="no-investments" style="text-align: center; padding: 20px; color: #7F8C8D;">
        No active investments found. Start investing by clicking "Buy Stocks".
      </div>
    `;
    return;
  }
  
  activeInvestments.forEach((investment) => {
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
    transactionItem.dataset.investmentId = investment.id;
    
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
        <button class="sell-btn" onclick="openSellModal('${investment.stock_name}', ${investment.quantity}, ${investment.current_price}, ${investment.id})">
          <i class="fas fa-money-bill-wave"></i> Sell
        </button>
      </div>
    `;
    
    investmentsList.appendChild(transactionItem);
  });
}

// Function to open sell modal with pre-filled data
function openSellModal(stockName, maxQuantity, currentPrice, investmentId) {
  console.log('Opening sell modal for:', { stockName, maxQuantity, currentPrice, investmentId });
  
  const modal = document.getElementById('entry-modal');
  const stockInput = document.getElementById('sell-stock-input');
  const quantityInput = document.getElementById('sell-quantity');
  const sellPriceInput = document.getElementById('sell-price');
  const expectedReturnSpan = document.getElementById('expected-return');
  const dateInput = document.getElementById('sell-date');
  
  if (!modal || !stockInput || !quantityInput || !sellPriceInput || !expectedReturnSpan || !dateInput) {
    console.error('Missing modal elements:', {
      modal: !!modal,
      stockInput: !!stockInput,
      quantityInput: !!quantityInput,
      sellPriceInput: !!sellPriceInput,
      expectedReturnSpan: !!expectedReturnSpan,
      dateInput: !!dateInput
    });
    return;
  }

  // Set stock name
  stockInput.value = stockName;
  
  // Set today's date as default
  dateInput.value = new Date().toISOString().split('T')[0];
  
  // Store investment ID in form dataset for later use
  const form = document.getElementById('sell-stock-form');
  if (form && investmentId) {
    form.dataset.investmentId = investmentId;
  }
  
  // Trigger stock details fetch
  fetchStockDetails(stockName).then(() => {
    // After fetching details, set the initial quantity
    if (quantityInput) {
      quantityInput.value = "1";
    }
    
    // Update expected return
    updateExpectedReturnForSell(currentPrice, 1);
  });
  
  // Show the modal
  showModal(modal);
}

// Function to update investment summary
function updateInvestmentSummary(summary) {
  const totalInvestedElement = document.getElementById("total-invested");
  const currentValueElement = document.getElementById("current-value");
  const profitLossElement = document.getElementById("profit-loss");

  // Calculate summary only for active investments
  const activeInvestments = summary.investments ? summary.investments.filter(investment => investment.status === 'active') : [];
  
  let totalInvested = 0;
  let totalCurrentValue = 0;
  
  activeInvestments.forEach(investment => {
    const investedAmount = Number(investment.buy_price) * Number(investment.quantity);
    const currentValue = Number(investment.current_value);
    
    totalInvested += investedAmount;
    totalCurrentValue += currentValue;
  });
  
  const totalProfitLoss = totalCurrentValue - totalInvested;
  const totalProfitLossPercentage = totalInvested > 0 ? ((totalProfitLoss / totalInvested) * 100) : 0;

  if (totalInvestedElement) {
    totalInvestedElement.textContent = `₹${totalInvested.toFixed(2)}`;
  }

  if (currentValueElement) {
    currentValueElement.textContent = `₹${totalCurrentValue.toFixed(2)}`;
  }

  if (profitLossElement) {
    const isPositive = totalProfitLoss >= 0;
    profitLossElement.textContent = `${isPositive ? "+" : ""}₹${totalProfitLoss.toFixed(2)} (${totalProfitLossPercentage.toFixed(2)}%)`;
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
  
  // Only process active investments for charts
  const activeInvestments = investments.filter(investment => investment.status === 'active');
  
  activeInvestments.forEach(investment => {
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
  const barChartPlaceholder = chartPlaceholders[1];
  
  // Handle portfolio pie chart
  if (pieChartPlaceholder) {
    // Remove placeholder content
    pieChartPlaceholder.innerHTML = '';
    pieChartPlaceholder.classList.remove('chart-placeholder');
    
    // Create canvas element for the chart - reduced by 20%
    const canvas = document.createElement('canvas');
    canvas.id = 'portfolioChart';
    canvas.width = 640;  // 800 * 0.8 = 640
    canvas.height = 480; // 600 * 0.8 = 480
    canvas.style.maxWidth = '100%';
    canvas.style.height = 'auto';
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
      // Create pie chart with enhanced styling
      const ctx = canvas.getContext('2d');
      new Chart(ctx, {
        type: 'pie',
        data: {
          labels: stockNames,
          datasets: [{
            data: currentValues,
            backgroundColor: [
              'rgba(255, 99, 132, 0.8)', 'rgba(54, 162, 235, 0.8)', 'rgba(255, 206, 86, 0.8)', 
              'rgba(75, 192, 192, 0.8)', 'rgba(153, 102, 255, 0.8)', 'rgba(255, 159, 64, 0.8)',
              'rgba(138, 194, 74, 0.8)', 'rgba(96, 125, 139, 0.8)', 'rgba(231, 76, 60, 0.8)',
              'rgba(52, 152, 219, 0.8)', 'rgba(241, 196, 15, 0.8)', 'rgba(26, 188, 156, 0.8)'
            ],
            borderColor: [
              '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
              '#9966FF', '#FF9F40', '#8AC24A', '#607D8B',
              '#E74C3C', '#3498DB', '#F1C40F', '#1ABC9C'
            ],
            borderWidth: 3,
            hoverBorderWidth: 5,
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            animateRotate: true,
            animateScale: true,
            duration: 1500,
            easing: 'easeOutQuart'
          },
          plugins: {
            title: { 
              display: true, 
              text: 'Portfolio Allocation', 
              font: { size: 20, weight: 'bold' }, 
              padding: { top: 15, bottom: 20 },
              color: '#1F2937'
            },
            legend: { 
              position: 'right', 
              labels: { 
                boxWidth: 15, 
                padding: 15,
                font: { size: 12, weight: '500' },
                usePointStyle: true,
                pointStyle: 'circle'
              }
            },
            tooltip: {
              backgroundColor: 'rgba(17, 24, 39, 0.95)',
              titleColor: '#F9FAFB',
              bodyColor: '#F9FAFB',
              borderColor: '#6B7280',
              borderWidth: 1,
              cornerRadius: 8,
              displayColors: true,
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.raw || 0;
                  const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                  const percentage = ((value / total) * 100).toF
                  return `${label}: ₹${value.toFixed(2)} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }
  }
  
  // Handle investment bar chart (second slide)
  if (barChartPlaceholder) {
    // Remove placeholder content
    barChartPlaceholder.innerHTML = '';
    barChartPlaceholder.classList.remove('chart-placeholder');
    
    // Create canvas element for the bar chart - same size as pie chart
    const barCanvas = document.createElement('canvas');
    barCanvas.id = 'investmentBarChart';
    barCanvas.width = 640;  // Same as pie chart
    barCanvas.height = 480; // Same as pie chart
    barCanvas.style.maxWidth = '100%';
    barCanvas.style.height = 'auto';
    barChartPlaceholder.appendChild(barCanvas);
    
    // Process data for bar chart
    const { stockNames, currentValues } = processInvestmentData(investments);
    
    if (!investments || !Array.isArray(investments) || investments.length === 0 || stockNames.length === 0) {
      barChartPlaceholder.innerHTML = `
        <i class="fas fa-chart-bar"></i>
        <p>No investment performance data to display. Start investing by clicking "Buy Stocks".</p>
      `;
      barChartPlaceholder.classList.add('chart-placeholder');
    } else {
      // Create bar chart with enhanced styling
      const barCtx = barCanvas.getContext('2d');
      new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: stockNames,
          datasets: [{
            label: 'Current Value (₹)',
            data: currentValues,
            backgroundColor: [
              'rgba(59, 130, 246, 0.8)', 'rgba(16, 185, 129, 0.8)', 'rgba(245, 158, 11, 0.8)',
              'rgba(239, 68, 68, 0.8)', 'rgba(139, 92, 246, 0.8)', 'rgba(236, 72, 153, 0.8)',
              'rgba(34, 197, 94, 0.8)', 'rgba(251, 146, 60, 0.8)', 'rgba(168, 85, 247, 0.8)',
              'rgba(14, 165, 233, 0.8)', 'rgba(132, 204, 22, 0.8)', 'rgba(244, 63, 94, 0.8)'
            ],
            borderColor: [
              '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
              '#8B5CF6', '#EC4899', '#22C55E', '#FB923C',
              '#A855F7', '#0EA5E9', '#84CC16', '#F43F5E'
            ],
            borderWidth: 2,
            borderRadius: 8,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 1500,
            easing: 'easeOutQuart'
          },
          plugins: {
            title: {
              display: true,
              text: 'Investment Performance',
              font: { size: 20, weight: 'bold' },
              padding: { top: 15, bottom: 20 },
              color: '#1F2937'
            },
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(17, 24, 39, 0.95)',
              titleColor: '#F9FAFB',
              bodyColor: '#F9FAFB',
              borderColor: '#6B7280',
              borderWidth: 1,
              cornerRadius: 8,
              callbacks: {
                label: function(context) {
                  return `${context.label}: ₹${context.raw.toFixed(2)}`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(156, 163, 175, 0.2)'
              },
              ticks: {
                callback: function(value) {
                  return '₹' + value.toLocaleString('en-IN');
                },
                color: '#6B7280',
                font: { size: 12 }
              },
              title: {
                display: true,
                text: 'Value (₹)',
                color: '#374151',
                font: { size: 14, weight: '600' }
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                color: '#6B7280',
                font: { size: 12 }
              },
              title: {
                display: true,
                text: 'Stock Holdings',
                color: '#374151',
                font: { size: 14, weight: '600' }
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
  
  // Only process active investments for growth chart
  const activeInvestments = investments.filter(investment => investment.status === 'active');
  
  // Sort investments by current value (descending)
  const sortedInvestments = [...activeInvestments].sort((a, b) => 
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

  // Filter to only show active investments
  const activeInvestments = investments ? investments.filter(investment => investment.status === 'active') : [];

  // Add active investments to dropdown
  activeInvestments.forEach((investment) => {
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
        // Add loading states - disable input and show loading on button
        stockPriceInput.disabled = true;
        stockPriceInput.placeholder = "Fetching price...";
        stockPriceInput.classList.add('fetching');
        fetchPriceBtn.classList.add('loading');
        fetchPriceBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching...';
        
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
          
          // Show success message with source info
          if (data.source === 'alphavantage') {
            showToastSuccess(`Stock price fetched successfully from Alpha Vantage: ₹${price.toFixed(2)}`);
          } else {
            showToastInfo(`Mock price generated for ${stockName}: ₹${price.toFixed(2)} (Configure Alpha Vantage API for real prices)`);
          }
        } else {
          throw new Error("Price not available");
        }
      } catch (error) {
        console.error("Error fetching stock price:", error);
        showToastError("Could not fetch stock price. Please enter the price manually.");
        stockPriceInput.value = ""; // Clear any existing value
        stockPriceInput.focus(); // Focus on input for manual entry
      } finally {
        // Remove loading states
        stockPriceInput.disabled = false;
        stockPriceInput.placeholder = "Enter stock price";
        stockPriceInput.classList.remove('fetching');
        fetchPriceBtn.classList.remove('loading');
        fetchPriceBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Fetch Price';
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
          showToastError("Please enter a stock symbol first");
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
function setupSellForm() {
  const stockSelect = document.getElementById("sell-stock-input");
  const quantityInput = document.getElementById("sell-quantity");
  const sellPriceInput = document.getElementById("stock-price");
  const expectedReturnSpan = document.getElementById("expected-return");
  const fetchStockBtn = document.getElementById('fetch-stock-btn');

  const updateReturn = () => {
    const quantity = Number(quantityInput.value);
    const price = Number(sellPriceInput.value);
    const total = quantity * price;
    expectedReturnSpan.value = `₹${total.toFixed(2)}`;
  };

  if (quantityInput && sellPriceInput) {
    quantityInput.addEventListener('input', updateReturn);
    sellPriceInput.addEventListener('input', updateReturn);
  }

  if (stockSelect && fetchStockBtn) {
    fetchStockBtn.addEventListener('click', () => {
      const stockName = stockSelect.value.trim().toUpperCase();
      if (stockName) fetchStockDetails(stockName);
      else showToastError("Please enter a stock name");
    });
  }

  const form = document.getElementById('sell-stock-form');
  if (form) {
    form.addEventListener('submit', handleSellStock);
  }
}

setupSellForm(); // Initialize sell form setup

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

// Show error message function (using Toastify)
function showErrorMessage(message) {
  // Use Toastify if available, otherwise fallback to alert
  if (typeof showToastError === 'function') {
    showToastError(message);
  } else {
    alert('❌ ' + message);
  }
}

// Function to reset sell stock form
function resetSellStockForm() {
  const form = document.getElementById('sell-stock-form');
  if (form) {
    form.reset();
    // Clear all dataset attributes
    delete form.dataset.investmentId;
    delete form.dataset.buyPrice;
    delete form.dataset.currentPrice;
    delete form.dataset.maxQuantity;
    delete form.dataset.stockName;
  }
  
  // Hide stock details section
  const stockDetails = document.querySelector('.stock-details');
  if (stockDetails) {
    stockDetails.style.display = 'none';
  }
  
  // Reset form inputs
  const stockInput = document.getElementById('sell-stock-input');
  const quantityInput = document.getElementById('sell-quantity');
  const sellPriceInput = document.getElementById('sell-price');
  const expectedReturn = document.getElementById('expected-return');
  const holdingsDetails = document.getElementById('current-holdings-details');
  
  if (stockInput) stockInput.value = '';
  if (quantityInput) {
    quantityInput.value = '';
    quantityInput.disabled = true;
  }
  if (sellPriceInput) {
    sellPriceInput.value = '';
    sellPriceInput.readOnly = true;
  }
  if (expectedReturn) expectedReturn.value = '₹0.00';
  if (holdingsDetails) holdingsDetails.innerHTML = '';
}

// Function to refresh charts after data updates
function refreshChartsAndUI() {
  // Destroy existing charts to prevent canvas reuse issues
  const existingPieChart = document.getElementById('portfolioChart');
  const existingGrowthChart = document.getElementById('growthChart');
  
  if (existingPieChart) {
    const pieChartParent = existingPieChart.parentElement;
    pieChartParent.innerHTML = `
      <i class="fas fa-chart-pie"></i>
      <p>Loading portfolio allocation...</p>
    `;
    pieChartParent.classList.add('chart-placeholder');
  }
  
  if (existingGrowthChart) {
    const growthChartParent = existingGrowthChart.parentElement;
    growthChartParent.innerHTML = `
      <i class="fas fa-chart-line"></i>
      <p>Loading investment growth...</p>
    `;
    growthChartParent.classList.add('chart-placeholder');
  }
  
  // Reload investments to trigger chart recreation
  loadInvestments();
}

// Modal utility functions
function showModal(modal) {
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }
}

function closeModal(modal) {
  if (modal) {
    modal.classList.add('hidden');
    setTimeout(() => {
      modal.style.display = 'none';
      modal.classList.remove('hidden'); // Reset for next use
      document.body.style.overflow = 'auto'; // Restore scrolling
    }, 300); // Match animation duration
  }
}

// Show success message function (using Toastify)
function showSuccessMessage(message) {
  // Use Toastify if available, otherwise fallback to alert
  if (typeof showToastSuccess === 'function') {
    showToastSuccess(message);
  } else {
    alert('✅ ' + message);
  }
}


// Reset sell stock form
function resetSellStockForm() {
  const stockInput = document.getElementById("sell-stock-input");
  const quantityInput = document.getElementById("sell-quantity");
  const sellPriceInput = document.getElementById("sell-price");
  const dateInput = document.getElementById("sell-date");
  const expectedReturnSpan = document.getElementById("expected-return");
  const stockDetails = document.querySelector('.stock-details');
  const holdingsDetails = document.getElementById('current-holdings-details');
  const manualPriceBtn = document.getElementById('manual-price-btn');
  const form = document.getElementById('sell-stock-form');

  // Reset stock input
  if (stockInput) {
    stockInput.value = "";
  }

  // Reset and disable quantity input
  if (quantityInput) {
    quantityInput.value = "";
    quantityInput.disabled = true;
    quantityInput.max = "";
  }

  // Reset sell price input
  if (sellPriceInput) {
    sellPriceInput.value = "";
    sellPriceInput.readOnly = true;
    sellPriceInput.removeAttribute('data-fetched');
  }

  // Reset manual price button
  if (manualPriceBtn) {
    manualPriceBtn.innerHTML = '<i class="fas fa-edit"></i> Manual';
    manualPriceBtn.title = 'Enter price manually';
  }

  // Reset date to today
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  // Reset expected return
  if (expectedReturnSpan) {
    expectedReturnSpan.value = "₹0.00";
  }

  // Hide stock details
  if (stockDetails) {
    stockDetails.style.display = 'none';
  }

  // Clear holdings details
  if (holdingsDetails) {
    holdingsDetails.innerHTML = '';
  }

  // Clear form dataset
  if (form) {
    delete form.dataset.investmentId;
    delete form.dataset.buyPrice;
    delete form.dataset.currentPrice;
    delete form.dataset.maxQuantity;
    delete form.dataset.stockName;
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
  console.log('Fetching stock details for:', stockName);
  
  try {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser || !currentUser.id) {
      showErrorMessage("❌ Please log in to fetch stock details");
      return false;
    }

    // Show loading state
    const fetchBtn = document.getElementById('fetch-stock-btn');
    if (fetchBtn) {
      fetchBtn.disabled = true;
      fetchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    }

    const response = await fetch(`${BASE_URL}/api/get-investments/${currentUser.id}`);
    if (!response.ok) {
      throw new Error("Failed to fetch investments");
    }

    const data = await response.json();
    console.log('Available investments:', data.investments);
    
    const matchingInvestment = data.investments.find(inv => 
      inv.stock_name.toUpperCase() === stockName.toUpperCase() && 
      inv.status === 'active'
    );

    console.log('Matching investment:', matchingInvestment);

    if (!matchingInvestment) {
      showErrorMessage(`❌ No active investment found for ${stockName}. Please check the stock name.`);
      return false;
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
        <p><strong>Buy Price:</strong> ₹${Number(matchingInvestment.buy_price).toFixed(2)}</p>
        <p><strong>Current Price:</strong> ₹${Number(matchingInvestment.current_price).toFixed(2)}</p>
        <p><strong>Investment Value:</strong> ₹${(Number(matchingInvestment.buy_price) * Number(matchingInvestment.quantity)).toFixed(2)}</p>
      `;
    }

    // Enable and set up quantity input
    const quantityInput = document.getElementById('sell-quantity');
    if (quantityInput) {
      quantityInput.disabled = false;
      quantityInput.max = matchingInvestment.quantity;
      quantityInput.min = 1;
      quantityInput.step = 1;
      quantityInput.value = 1;
    }

    // Set up sell date to today
    const dateInput = document.getElementById('sell-date');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    // Set up sell price
    let currentPrice = Number(matchingInvestment.current_price);
    const sellPriceInput = document.getElementById('sell-price');
    
    if (sellPriceInput) {
      sellPriceInput.value = currentPrice.toFixed(2);
      sellPriceInput.readOnly = true;
      sellPriceInput.setAttribute('data-fetched', 'true');
    }

    // Set up manual price input button
    const manualPriceBtn = document.getElementById('manual-price-btn');
    if (manualPriceBtn && sellPriceInput) {
      manualPriceBtn.onclick = () => {
        if (sellPriceInput.readOnly) {
          sellPriceInput.readOnly = false;
          sellPriceInput.focus();
          sellPriceInput.select();
          manualPriceBtn.innerHTML = '<i class="fas fa-lock"></i> Lock';
          manualPriceBtn.title = 'Lock price input';
          manualPriceBtn.classList.add('btn-warning');
        } else {
          sellPriceInput.readOnly = true;
          manualPriceBtn.innerHTML = '<i class="fas fa-edit"></i> Manual';
          manualPriceBtn.title = 'Enter price manually';
          manualPriceBtn.classList.remove('btn-warning');
        }
      };
    }

    // Calculate initial expected return
    updateExpectedReturnForSell(currentPrice, 1);

    // Store investment details for later use
    const form = document.getElementById('sell-stock-form');
    if (form) {
      form.dataset.investmentId = matchingInvestment.id;
      form.dataset.buyPrice = matchingInvestment.buy_price;
      form.dataset.currentPrice = currentPrice;
      form.dataset.maxQuantity = matchingInvestment.quantity;
      form.dataset.stockName = matchingInvestment.stock_name;
    }

    showSuccessMessage(`✅ Stock details loaded for ${matchingInvestment.stock_name}`);
    console.log('Stock details successfully loaded and form populated');
    return true;

  } catch (error) {
    console.error("Error fetching stock details:", error);
    showErrorMessage(error.message || "Failed to fetch stock details");
    return false;
  } finally {
    // Reset button state
    const fetchBtn = document.getElementById('fetch-stock-btn');
    if (fetchBtn) {
      fetchBtn.disabled = false;
      fetchBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Fetch Details';
    }
  }
}

// Function to update expected return for sell form
function updateExpectedReturnForSell(currentPrice, quantity) {
  const expectedReturn = document.getElementById('expected-return');
  if (expectedReturn && currentPrice > 0 && quantity > 0) {
    const total = currentPrice * quantity;
    expectedReturn.value = `₹${total.toFixed(2)}`;
  }
}

// Function to update expected return (legacy)
function updateExpectedReturn(currentPrice, quantity) {
  const expectedReturn = document.getElementById('expected-return');
  if (expectedReturn && currentPrice > 0 && quantity > 0) {
    const total = currentPrice * quantity;
    expectedReturn.value = `₹${total.toFixed(2)}`;
  }
}

// Function to handle stock selling
async function handleSellStock(event) {
  event.preventDefault();
  
  console.log('handleSellStock called');

  const form = document.getElementById('sell-stock-form');
  const stockInput = document.getElementById('sell-stock-input');
  const quantityInput = document.getElementById('sell-quantity');
  const dateInput = document.getElementById('sell-date');
  const sellPriceInput = document.getElementById('sell-price');
  const sellBtn = form ? form.querySelector('button[type="submit"], .save-btn') : null;

  // Enhanced validation with better error messages
  if (!form) {
    console.error('Sell stock form not found');
    showErrorMessage("❌ Sell form not found. Please refresh the page and try again.");
    return;
  }

  if (!stockInput || !quantityInput || !dateInput || !sellPriceInput) {
    console.error('Required form elements missing:', {
      stockInput: !!stockInput,
      quantityInput: !!quantityInput,
      dateInput: !!dateInput,
      sellPriceInput: !!sellPriceInput
    });
    showErrorMessage("❌ Form elements missing. Please refresh the page and try again.");
    return;
  }

  // Get form values
  const stockName = stockInput.value.trim().toUpperCase();
  const sellQuantity = parseInt(quantityInput.value);
  const maxQuantity = parseInt(form.dataset.maxQuantity || quantityInput.max);
  const sellPrice = parseFloat(sellPriceInput.value);
  const sellDate = dateInput.value;

  console.log('Form values:', { stockName, sellQuantity, maxQuantity, sellPrice, sellDate });

  // Validation checks with more specific error messages
  if (!stockName) {
    showErrorMessage("🔍 Please enter a stock name and fetch stock details first.");
    stockInput.focus();
    return;
  }

  if (!sellQuantity || isNaN(sellQuantity) || sellQuantity <= 0) {
    showErrorMessage("📊 Please enter a valid quantity (must be a positive number).");
    quantityInput.focus();
    return;
  }

  if (maxQuantity && sellQuantity > maxQuantity) {
    showErrorMessage(`⚠️ You can only sell up to ${maxQuantity} shares. You currently own ${maxQuantity} shares of ${stockName}.`);
    quantityInput.focus();
    return;
  }

  if (!sellPrice || isNaN(sellPrice) || sellPrice <= 0) {
    showErrorMessage("💰 Please enter a valid sell price (must be a positive number).");
    sellPriceInput.focus();
    return;
  }

  if (!sellDate) {
    showErrorMessage("📅 Please select a sell date.");
    dateInput.focus();
    return;
  }

  // Check if sell date is not in the future
  const today = new Date();
  const sellDateObj = new Date(sellDate);
  if (sellDateObj > today) {
    showErrorMessage("📅 Sell date cannot be in the future.");
    dateInput.focus();
    return;
  }

  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  if (!currentUser || !currentUser.id) {
    showErrorMessage("Please log in to sell stocks.");
    return;
  }

  // Check if we have investment ID
  const investmentId = form.dataset.investmentId;
  if (!investmentId) {
    showErrorMessage("🔍 Investment details not found. Please fetch stock details first by clicking 'Fetch Details' button.");
    return;
  }

  console.log('Investment ID:', investmentId);

  try {
    if (sellBtn) {
      sellBtn.disabled = true;
      sellBtn.textContent = "Selling...";
    }

    // Prepare data for API
    const sellData = {
      user_id: currentUser.id,
      investment_id: investmentId,
      sell_price: sellPrice,
      sell_quantity: sellQuantity,
      sell_date: sellDate,
      partial_sale: maxQuantity ? sellQuantity < maxQuantity : false
    };

    console.log("Selling stock with data:", sellData);

    // Call API to sell stock
    const response = await fetch(`${BASE_URL}/api/sell-stock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sellData),
    });

    if (!response.ok) {
      // Handle different HTTP error codes
      if (response.status === 400) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Invalid request data");
      } else if (response.status === 404) {
        throw new Error("Investment not found. It may have already been sold.");
      } else if (response.status === 500) {
        throw new Error("Server error. Please try again later.");
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Sale was not successful");
    }

    // Show success message with proper null checks
    const totalAmount = data.data?.total_sale_amount || 0;
    const profit = data.data?.profit || 0;
    const profitText = profit >= 0 ? `Profit: ₹${profit.toFixed(2)}` : `Loss: ₹${Math.abs(profit).toFixed(2)}`;
    
    showSuccessMessage(
      `✅ Successfully sold ${sellQuantity} shares of ${stockName} at ₹${sellPrice.toFixed(2)} each! Total: ₹${totalAmount.toFixed(2)} (${profitText})`
    );

    // Reset form and close modal
    resetSellStockForm();
    closeModal(document.getElementById("entry-modal"));

    // Refresh data and charts
    setTimeout(async () => {
      try {
        await loadInvestments();
        await fetchWalletBalance();
        displayWalletBalance();
        refreshChartsAndUI();
        console.log("Data refreshed after stock sale");
      } catch (refreshError) {
        console.error("Error refreshing data:", refreshError);
      }
    }, 500);

  } catch (error) {
    console.error("Error selling stock:", error);
    showErrorMessage(`❌ ${error.message || "Failed to sell stock. Please try again."}`);
  } finally {
    if (sellBtn) {
      sellBtn.disabled = false;
      sellBtn.textContent = "Sell Stock";
    }
  }
}

// Automatically initialize price input changes
const stockPriceInput = document.getElementById("stock-price");
const quantityInput = document.getElementById("sell-quantity");
const totalCostSpan = document.getElementById("expected-return");

if (stockPriceInput && quantityInput && totalCostSpan) {
  stockPriceInput.addEventListener('input', () => {
    const price = Number(stockPriceInput.value);
    const quantity = Number(quantityInput.value);
    const total = price * quantity;
    totalCostSpan.value = `₹${total.toFixed(2)}`;
  });

  quantityInput.addEventListener('input', () => {
    const price = Number(stockPriceInput.value);
    const quantity = Number(quantityInput.value);
    const total = price * quantity;
    totalCostSpan.value = `₹${total.toFixed(2)}`;
  });
}
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

  // Add cancel button functionality for buy stock modal
  const cancelBuyBtn = document.getElementById("close-debit-btn");
  if (cancelBuyBtn) {
    cancelBuyBtn.addEventListener("click", () => {
      // Reset the form before closing
      const buyForm = document.getElementById("debit-form");
      if (buyForm) {
        buyForm.reset();
        document.getElementById("total-cost").textContent = "₹0.00";
      }
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
          showToastError('Please select both start and end dates for partial report');
          return;
        }
        
        if (new Date(fromDate) > new Date(toDate)) {
          showToastError('End date must be after start date');
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
          
          // Reload data and refresh charts
          loadInvestments();
          fetchWalletBalance();
          displayWalletBalance();
          
          // Refresh charts after brief delay to ensure data is loaded
          setTimeout(() => {
            refreshChartsAndUI();
          }, 300);
          
          // Show success message
          showSuccessMessage(`✅ Successfully bought ${quantity} shares of ${stockName} at ₹${buyPrice.toFixed(2)} each!`);
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
  const sellPriceInput = document.getElementById('sell-price');
  
  if (quantityInput) {
    quantityInput.addEventListener('input', () => {
      const quantity = parseInt(quantityInput.value) || 0;
      const price = parseFloat(sellPriceInput?.value) || 0;
      if (quantity > 0 && price > 0) {
        updateExpectedReturnForSell(price, quantity);
      }
    });
  }

  if (sellPriceInput) {
    sellPriceInput.addEventListener('input', () => {
      const quantity = parseInt(quantityInput?.value) || 0;
      const price = parseFloat(sellPriceInput.value) || 0;
      if (quantity > 0 && price > 0) {
        updateExpectedReturnForSell(price, quantity);
      }
    });
  }
});

// Make openSellModal globally available for onclick handlers
window.openSellModal = openSellModal;

console.log("Investment script loaded successfully!");