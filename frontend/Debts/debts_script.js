//------------------------------------------------------------------------------
//<!-- Add these before your script.js file -->

const BASE_URL = window.location.hostname === "localhost"
  ? "http://localhost:3000"
  : "https://penny-pilot-production.up.railway.app";

//------------------------------------------------------------------------------

// Initialize Swiper with correct parameters
const swiper = new Swiper('.swiper-container', {
    loop: true,
    navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
    },
    slidesPerView: 1,
    spaceBetween: 0,
    observer: true,
    observeParents: true
});

// Add Button Functionality
const addButton = document.getElementById('addButton');
const addOptions = document.getElementById('addOptions');
const addOptionsItems = document.querySelectorAll('.add-option');

const exportPdfBtn = document.getElementById("export-pdf-btn");
const pdfExportModal = document.getElementById("pdf-export-modal");
const pdfExportForm = document.getElementById("pdf-export-form");
const partialReportOptions = document.getElementById("partial-report-options");
const fullReportRadio = document.getElementById("full-report");
const partialReportRadio = document.getElementById("partial-report");
const pdfFromDate = document.getElementById("pdf-from-date");
const pdfToDate = document.getElementById("pdf-to-date");

exportPdfBtn.addEventListener('click', () => {
    showModal(pdfExportModal);
    
    // Set default dates (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    pdfFromDate.value = thirtyDaysAgo.toISOString().split('T')[0];
    pdfToDate.value = today.toISOString().split('T')[0];
});

fullReportRadio.addEventListener('change', () => {
    partialReportOptions.style.display = 'none';
});

partialReportRadio.addEventListener('change', () => {
    partialReportOptions.style.display = 'block';
});

function generateDebtPdfReport(reportType, fromDate, toDate) {
    try {
        setTimeout(() => {
            if (window.PdfExport) {
                window.PdfExport.generateDebtsPdf(reportType, fromDate, toDate);
            } else {
                alert("PDF export module not loaded. Please try again.");
            }
            closeModal();
        }, 500);
    } catch (error) {
        console.error("PDF generation failed:", error);
        alert("Failed to generate PDF. Please try again.");
        closeModal();
    }
}

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
    generateDebtPdfReport(reportType, fromDate, toDate);
    closeModal();
});


// Toggle add options menu
addButton.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    
    // Toggle display and active state
    const isShowing = addOptions.style.display === 'flex';
    addOptions.style.display = isShowing ? 'none' : 'flex';
    addButton.classList.toggle('active', !isShowing);
    
    // Animate options
    if (!isShowing) {
        addOptionsItems.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            setTimeout(() => {
                item.style.transition = 'all 0.3s ease';
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }
});

// Close options when clicking outside
document.addEventListener('click', function(e) {
    if (!addButton.contains(e.target) && !addOptions.contains(e.target)) {
        addOptions.style.display = 'none';
        addButton.classList.remove('active');
    }
});

// Modal functions
function showModal(modalId) {
    addOptions.style.display = 'none';
    addButton.classList.remove('active');
    
    // Close any open modals first
    closeModal();
    
    setTimeout(() => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            // Force reflow to enable animation
            void modal.offsetWidth;
            modal.style.opacity = '1';
            modal.querySelector('.modal-content').style.transform = 'translateY(0)';
        }
    }, 10);
}

function closeModal() {
    const modals = document.querySelectorAll('.modal-overlay');
    
    modals.forEach(modal => {
        if (modal.style.display === 'flex') {
            modal.style.opacity = '0';
            modal.querySelector('.modal-content').style.transform = 'translateY(-20px)';
            setTimeout(() => {
                modal.style.display = 'none';
                // Reset form when closing
                if (modal.id === 'pdf-export-modal') {
                    pdfExportForm.reset();
                    partialReportOptions.style.display = 'none';
                }
            }, 300);
        }
    });
}

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    const modals = document.querySelectorAll('.modal-overlay');
    
    modals.forEach(modal => {
        if (modal.style.display === 'flex' && !e.target.closest('.modal-content')) {
            closeModal();
        }
    });
});

// Set today's date as default for all date inputs
const today = new Date().toISOString().split('T')[0];
document.querySelectorAll('input[type="date"]').forEach(input => {
    input.value = today;
});

// Menu items
document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', function() {
        document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
    });
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

// Function to update wallet balance in localStorage
function updateWalletBalanceLocal(amount, isAddition = true) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return;

    // Get current balance
    let currentBalance = parseFloat(
        localStorage.getItem(`wallet_balance_${currentUser.id}`) || 0
    );

    // Update the balance
    if (isAddition) {
        currentBalance += parseFloat(amount);
    } else {
        currentBalance -= parseFloat(amount);
    }

    // Save to localStorage
    localStorage.setItem(
        `wallet_balance_${currentUser.id}`,
        currentBalance.toFixed(2)
    );

    // Update display if wallet is open
    const balanceDisplay = document.getElementById("wallet-balance");
    if (balanceDisplay) {
        balanceDisplay.textContent = `₹${currentBalance.toFixed(2)}`;
    }
}

// Function to get wallet balance from localStorage
function getWalletBalance() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return 0;

    // Get or initialize wallet balance
    return parseFloat(
        localStorage.getItem(`wallet_balance_${currentUser.id}`) || 0
    );
}

// Function to display wallet balance
function displayWalletBalance() {
    const balanceDisplay = document.getElementById("wallet-balance");
    if (balanceDisplay) {
        balanceDisplay.textContent = `₹${getWalletBalance().toFixed(2)}`;
    }
}

// Format date to YYYY-MM-DD
function formatDate(date) {
    const d = new Date(date);
    let month = "" + (d.getMonth() + 1);
    let day = "" + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = "0" + month;
    if (day.length < 2) day = "0" + day;

    return [year, month, day].join("-");
}

// Get current user from localStorage
function getCurrentUser() {
    return JSON.parse(localStorage.getItem("currentUser"));
}

// Function to load debts from server
// Replace your current loadDebts function with:
function loadDebts() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
  
    // Load debts
    fetch(`${BASE_URL}/get-debts/${currentUser.id}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          window.loadedDebts = data.debts;
          updateBalanceCards(data.statistics);
          checkOverdueDebts(data.debts);
          
          //----------------------------------------------------------------------------------------

          // Create charts with the debt data
          createDebtCharts(data.debts);
  
          //----------------------------------------------------------------------------------------
          
          // Then load transactions
          fetch(`${BASE_URL}/debt-transactions/${currentUser.id}`)
            .then((response) => response.json())
            .then((txnData) => {
              if (txnData.success) {
                displayCombinedDebtList(data.debts, txnData.transactions);
                checkOverdueDebts(data.debts);
              }
            });
        }
      })
      .catch((error) => {
        console.error("Error loading data:", error);
      });
  }

//----------------------------------------------------------------------------------------

// Function to create debt charts
function createDebtCharts(debts) {
    // Clear any existing charts
    const chartContainers = document.querySelectorAll('.chart-container');
    chartContainers.forEach(container => {
      container.innerHTML = '';
    });
  
    if (!debts || debts.length === 0) {
      return;
    }
  
    // Create canvas elements for charts
    const debtListContainer = document.getElementById('debt-list-container');
    const debtStatsContainer = document.getElementById('debt-stats-container');
    
    if (!debtListContainer || !debtStatsContainer) {
      console.error('Chart containers not found');
      return;
    }
    
    debtListContainer.innerHTML = '<div class="chart-row"><canvas id="givenPieChart"></canvas><canvas id="takenPieChart"></canvas></div>';
    debtStatsContainer.innerHTML = '<div class="chart-row"><canvas id="givenBarChart"></canvas><canvas id="takenBarChart"></canvas></div>';
  
    // Separate debts by type
    const givenDebts = debts.filter(debt => debt.debt_type === 'given');
    const takenDebts = debts.filter(debt => debt.debt_type === 'received');
  
    // Create pie charts
    createDebtPieCharts(givenDebts, takenDebts);
    
    // Create bar charts
    createDebtBarCharts(givenDebts, takenDebts);
  }
  
  function createDebtPieCharts(givenDebts, takenDebts) {
    // Given Debts Pie Chart
    if (givenDebts.length > 0) {
      const givenByCounterparty = {};
      
      givenDebts.forEach(debt => {
        const counterparty = debt.counterparty || 'Unknown';
        if (!givenByCounterparty[counterparty]) {
          givenByCounterparty[counterparty] = 0;
        }
        givenByCounterparty[counterparty] += Number(debt.remaining_amount);
      });
      
      const givenLabels = Object.keys(givenByCounterparty);
      const givenData = givenLabels.map(label => givenByCounterparty[label]);
      
      const givenPieCtx = document.getElementById('givenPieChart').getContext('2d');
      new Chart(givenPieCtx, {
        type: 'pie',
        data: {
          labels: givenLabels,
          datasets: [{
            data: givenData,
            backgroundColor: [
              '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', 
              '#FF9F40', '#8AC24A', '#607D8B', '#E91E63', '#2196F3'
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
              text: 'Debts Given by Counterparty',
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
                  const value = context.raw;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = ((value / total) * 100).toFixed(2);
                  return `${context.label}: ₹${value.toFixed(2)} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    } else {
      document.getElementById('givenPieChart').getContext('2d').canvas.style.display = 'none';
    }
    
    // Taken Debts Pie Chart
    if (takenDebts.length > 0) {
      const takenByCounterparty = {};
      
      takenDebts.forEach(debt => {
        const counterparty = debt.counterparty || 'Unknown';
        if (!takenByCounterparty[counterparty]) {
          takenByCounterparty[counterparty] = 0;
        }
        takenByCounterparty[counterparty] += Number(debt.remaining_amount);
      });
      
      const takenLabels = Object.keys(takenByCounterparty);
      const takenData = takenLabels.map(label => takenByCounterparty[label]);
      
      const takenPieCtx = document.getElementById('takenPieChart').getContext('2d');
      new Chart(takenPieCtx, {
        type: 'pie',
        data: {
          labels: takenLabels,
          datasets: [{
            data: takenData,
            backgroundColor: [
              '#4BC0C0', '#9966FF', '#FF9F40', '#8AC24A', '#FF6384', 
              '#36A2EB', '#FFCE56', '#607D8B', '#E91E63', '#2196F3'
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
              text: 'Debts Taken by Counterparty',
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
                  const value = context.raw;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = ((value / total) * 100).toFixed(2);
                  return `${context.label}: ₹${value.toFixed(2)} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    } else {
      document.getElementById('takenPieChart').getContext('2d').canvas.style.display = 'none';
    }
  }
  
  function createDebtBarCharts(givenDebts, takenDebts) {
    // Group data by month
    const givenMonthlyData = {};
    const takenMonthlyData = {};
    
    // Process given debts
    givenDebts.forEach(debt => {
      const startDate = new Date(debt.start_date);
      const monthYear = `${startDate.getMonth() + 1}/${startDate.getFullYear()}`;
      
      if (!givenMonthlyData[monthYear]) {
        givenMonthlyData[monthYear] = 0;
      }
      
      givenMonthlyData[monthYear] += Number(debt.remaining_amount);
    });
    
    // Process taken debts
    takenDebts.forEach(debt => {
      const startDate = new Date(debt.start_date);
      const monthYear = `${startDate.getMonth() + 1}/${startDate.getFullYear()}`;
      
      if (!takenMonthlyData[monthYear]) {
        takenMonthlyData[monthYear] = 0;
      }
      
      takenMonthlyData[monthYear] += Number(debt.remaining_amount);
    });
    
    // Sort months chronologically
    const sortMonths = (data) => {
      return Object.keys(data).sort((a, b) => {
        const [aMonth, aYear] = a.split('/').map(Number);
        const [bMonth, bYear] = b.split('/').map(Number);
        
        if (aYear !== bYear) return aYear - bYear;
        return aMonth - bMonth;
      });
    };
    
    const givenMonths = sortMonths(givenMonthlyData);
    const takenMonths = sortMonths(takenMonthlyData);
    
    // Create given debts bar chart
    if (givenMonths.length > 0) {
      const givenBarCtx = document.getElementById('givenBarChart').getContext('2d');
      new Chart(givenBarCtx, {
        type: 'bar',
        data: {
          labels: givenMonths,
          datasets: [{
            label: 'Amount (₹)',
            data: givenMonths.map(month => givenMonthlyData[month]),
            backgroundColor: '#FF6384',
            borderColor: '#FF6384',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Monthly Debts Given',
              font: { size: 16 },
              padding: { top: 10, bottom: 10 }
            },
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Amount (₹)' }
            },
            x: {
              title: { display: true, text: 'Month/Year' }
            }
          }
        }
      });
    } else {
      document.getElementById('givenBarChart').getContext('2d').canvas.style.display = 'none';
    }
    
    // Create taken debts bar chart
    if (takenMonths.length > 0) {
      const takenBarCtx = document.getElementById('takenBarChart').getContext('2d');
      new Chart(takenBarCtx, {
        type: 'bar',
        data: {
          labels: takenMonths,
          datasets: [{
            label: 'Amount (₹)',
            data: takenMonths.map(month => takenMonthlyData[month]),
            backgroundColor: '#4BC0C0',
            borderColor: '#4BC0C0',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Monthly Debts Taken',
              font: { size: 16 },
              padding: { top: 10, bottom: 10 }
            },
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Amount (₹)' }
            },
            x: {
              title: { display: true, text: 'Month/Year' }
            }
          }
        }
      });
    } else {
      document.getElementById('takenBarChart').getContext('2d').canvas.style.display = 'none';
    }
  }

//----------------------------------------------------------------------------------------


function displayCombinedDebtList(debts, transactions) {
    const container = document.getElementById("combined-debt-list");
    if (!container) return;

    container.innerHTML = "";

    // Filter out debts with remaining_amount <= 0
    const filteredDebts = debts.filter(debt => parseFloat(debt.remaining_amount || debt.amount) > 0);

    // Combine all items with proper date references
    const allItems = [];
    
    // Add debts with their creation or update date
    filteredDebts.forEach(debt => {
        allItems.push({
            type: 'debt',
            data: debt,
            date: new Date(debt.created_at || debt.due_date),
            sortKey: new Date(debt.created_at || debt.due_date).getTime()
        });
    });
    
    // Add transactions
    transactions.forEach(transaction => {
        allItems.push({
            type: 'transaction',
            data: transaction,
            date: new Date(transaction.transaction_date),
            sortKey: new Date(transaction.transaction_date).getTime()
        });
    });

    // Sort by date (newest first)
    allItems.sort((a, b) => b.sortKey - a.sortKey);

    // Display items
    allItems.forEach(item => {
        const card = document.createElement("div");
        card.className = "debt-card";
        card.style.cursor = "pointer";
        
        // Common variables
        let icon, amountClass, amountSign, title, subtitle;
        let bgColor = "white";
        let borderColor = "transparent";

        if (item.type === 'debt') {
            const debt = item.data;
            const isGivenDebt = debt.debt_type === "given";
            
            icon = isGivenDebt ? "fa-hand-holding-usd" : "fa-money-bill-wave";
            amountClass = isGivenDebt ? "debt-in" : "debt-out";
            amountSign = isGivenDebt ? "+" : "-";
            title = `${isGivenDebt ? "To collect from" : "To pay to"}: ${debt.counterparty || "Unknown"}`;
            subtitle = `Due: ${new Date(debt.due_date).toLocaleDateString()}`;
            
            // Status indicators
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dueDate = new Date(debt.due_date);
            dueDate.setHours(0, 0, 0, 0);
            const isOverdue = dueDate < today && debt.status !== "fully_paid";
            
            if (isOverdue) {
                const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                borderColor = "var(--danger)";
                subtitle += ` • Overdue by ${daysOverdue} days`;
            } else if (debt.status === "fully_paid") {
                borderColor = "var(--success)";
                subtitle += " • Paid";
            } else if (debt.status === "partially_paid") {
                borderColor = "var(--warning)";
                subtitle += " • Partial";
            } else {
                const daysRemaining = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                subtitle += ` • ${daysRemaining} days remaining`;
            }
        } else {
            const txn = item.data;
            const isIn = txn.transaction_type === "collection";
            icon = isIn ? "fa-hand-holding-usd" : "fa-money-bill-wave";
            amountClass = isIn ? "debt-in" : "debt-out";
            amountSign = isIn ? "+" : "-";
            title = txn.description || (isIn ? "Payment received" : "Payment sent");
            subtitle = item.date.toLocaleDateString();
        }

        card.innerHTML = `
            <div class="debt-icon ${amountClass}">
                <i class="fas ${icon}"></i>
            </div>
            <div class="debt-info">
                <div class="debt-title">${title}</div>
                <div class="debt-subtitle">${subtitle}</div>
            </div>
            <div class="debt-amount ${amountClass}">
                ${amountSign}₹${parseFloat(item.type === 'debt' ? item.data.remaining_amount || item.data.amount : item.data.amount).toFixed(2)}
            </div>
        `;

        // Add left border for debts
        if (item.type === 'debt') {
            card.style.borderLeft = `4px solid ${borderColor}`;
        }

        // Click handler
        card.addEventListener("click", (e) => {
            e.stopPropagation();
            if (item.type === 'debt') {
                showDebtDetails(item.data);
            } else {
                // Optional: Show transaction details modal
                alert(`Transaction Details:\n${title}\nAmount: ${amountSign}₹${item.data.amount.toFixed(2)}\nDate: ${item.date.toLocaleDateString()}`);
            }
        });

        container.appendChild(card);
    });
}

// Function to show debt details in a modal
// Function to show debt details in a modal
function showDebtDetails(debt) {
    // Calculate days remaining/overdue
    const today = new Date();
    const dueDate = new Date(debt.due_date);
    const timeDiff = dueDate - today;
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    
    let statusText = debt.status.replace(/_/g, ' ');
    let statusColor = "#666";
    let daysText = "";
    
    if (debt.is_overdue) {
        statusColor = "var(--danger)";
        statusText = "Overdue";
        daysText = `${Math.abs(daysDiff)} days overdue`;
    } else if (debt.status === "fully_paid") {
        statusColor = "var(--success)";
        daysText = "Fully paid";
    } else {
        statusColor = debt.status === "partially_paid" ? "var(--warning)" : "var(--info)";
        daysText = daysDiff > 0 ? `${daysDiff} days remaining` : "Due today";
    }

    // Format dates
    const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    // Calculate total amount (principal + interest)
    const totalAmount = parseFloat(debt.amount) + parseFloat(debt.current_interest || 0);

    // Create modal content
    const modalContent = `
        <div class="debt-details-grid">
            <div class="detail-item">
                <span class="detail-label">Type:</span>
                <span class="detail-value">${debt.debt_type === "given" ? "Given (You owe)" : "Received (Owes you)"}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Counterparty:</span>
                <span class="detail-value">${debt.counterparty || "Not specified"}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Original Amount:</span>
                <span class="detail-value">₹${parseFloat(debt.amount).toFixed(2)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Interest Rate:</span>
                <span class="detail-value">${parseFloat(debt.interest_rate || 0).toFixed(2)}% (${debt.interest_type || 'simple'})</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Accrued Interest:</span>
                <span class="detail-value">₹${parseFloat(debt.current_interest || 0).toFixed(2)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Remaining Amount:</span>
                <span class="detail-value">₹${parseFloat(debt.remaining_amount || debt.amount).toFixed(2)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Total Amount:</span>
                <span class="detail-value">₹${totalAmount.toFixed(2)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Start Date:</span>
                <span class="detail-value">${formatDate(debt.start_date)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Due Date:</span>
                <span class="detail-value">${formatDate(debt.due_date)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Status:</span>
                <span class="detail-value" style="color: ${statusColor}">${statusText}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Days:</span>
                <span class="detail-value">${daysText}</span>
            </div>
            <div class="detail-item full-width">
                <span class="detail-label">Description:</span>
                <span class="detail-value">${debt.description || "No description provided"}</span>
            </div>
        </div>
        
        ${debt.status !== 'active' ? `
        <div class="detail-item full-width" style="margin-top: 20px;">
            <span class="detail-label">Payment History:</span>
            <div id="payment-history" style="margin-top: 10px;"></div>
        </div>
        ` : ''}
    `;

    // Get modal elements
    const modal = document.getElementById("debt-details-modal");
    const content = document.getElementById("debt-details-content");
    
    if (!modal || !content) return;
    
    // Populate and show modal
    content.innerHTML = modalContent;
    modal.style.display = "flex";
    setTimeout(() => {
        modal.style.opacity = "1";
    }, 10);

    // If debt is not active (has payments), load payment history
    if (debt.status !== 'active') {
        loadPaymentHistory(debt.id);
    }
}

// Function to load payment history for a debt
function loadPaymentHistory(debtId) {
    fetch(`${BASE_URL}/debt-transactions/${debtId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success && data.transactions.length > 0) {
                displayPaymentHistory(data.transactions);
            } else {
                document.getElementById("payment-history").innerHTML = 
                    "<p style='color: #666; padding: 10px; text-align: center;'>No payment history found</p>";
            }
        })
        .catch(error => {
            console.error("Error loading payment history:", error);
            document.getElementById("payment-history").innerHTML = 
                "<p style='color: #666; padding: 10px; text-align: center;'>Error loading payment history</p>";
        });
}

// Function to display payment history
function displayPaymentHistory(transactions) {
    const paymentHistory = document.getElementById("payment-history");
    if (!paymentHistory) return;

    // Sort transactions by date (newest first)
    transactions.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));

    // Create table
    const table = document.createElement("table");
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.marginTop = "10px";

    // Create table header
    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Date</th>
            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Type</th>
            <th style="padding: 8px; text-align: right; border-bottom: 1px solid #ddd;">Amount</th>
            <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Description</th>
        </tr>
    `;
    table.appendChild(thead);

    // Create table body
    const tbody = document.createElement("tbody");
    
    transactions.forEach(txn => {
        const row = document.createElement("tr");
        row.style.borderBottom = "1px solid #eee";
        
        const typeText = txn.transaction_type === "collection" ? 
            (txn.amount > 0 ? "Payment Received" : "Payment Returned") : 
            (txn.amount > 0 ? "Payment Made" : "Payment Collected");
        
        const amountColor = txn.transaction_type === "collection" ? "var(--success)" : "var(--danger)";
        
        row.innerHTML = `
            <td style="padding: 8px; text-align: left;">${new Date(txn.transaction_date).toLocaleDateString()}</td>
            <td style="padding: 8px; text-align: left;">${typeText}</td>
            <td style="padding: 8px; text-align: right; color: ${amountColor}">₹${parseFloat(txn.amount).toFixed(2)}</td>
            <td style="padding: 8px; text-align: left;">${txn.description || "-"}</td>
        `;
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    paymentHistory.innerHTML = "";
    paymentHistory.appendChild(table);
}

// Function to check for overdue debts and show notifications
function checkOverdueDebts(debts) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    // Filter out debts with remaining_amount <= 0
    const filteredDebts = debts.filter(debt => parseFloat(debt.remaining_amount || debt.amount) > 0);
    const overdueDebts = filteredDebts.filter((debt) => {
        const dueDate = new Date(debt.due_date);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < today && debt.status !== "fully_paid";
    });
    const upcomingDebts = filteredDebts.filter((debt) => {
        const dueDate = new Date(debt.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysRemaining = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        return daysRemaining <= 3 && daysRemaining >= 0 && debt.status !== "fully_paid";
    });

    if (overdueDebts.length > 0 || upcomingDebts.length > 0) {
        // Create notification container if it doesn't exist
        let notificationContainer = document.getElementById("debt-notification-container");

        if (!notificationContainer) {
            notificationContainer = document.createElement("div");
            notificationContainer.id = "debt-notification-container";
            notificationContainer.style.position = "fixed";
            notificationContainer.style.top = "80px";
            notificationContainer.style.right = "20px";
            notificationContainer.style.width = "300px";
            notificationContainer.style.zIndex = "1000";
            document.body.appendChild(notificationContainer);
        }

        // Clear existing notifications
        notificationContainer.innerHTML = "";

        // Add overdue notifications
        overdueDebts.forEach((debt) => {
            const dueDate = new Date(debt.due_date);
            dueDate.setHours(0, 0, 0, 0);
            const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
            
            const notification = document.createElement("div");
            notification.style.backgroundColor = "#ffdddd";
            notification.style.border = "1px solid #e74c3c";
            notification.style.borderRadius = "5px";
            notification.style.padding = "10px";
            notification.style.marginBottom = "10px";
            notification.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";

            notification.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h4 style="margin: 0; color: #e74c3c;">Overdue Debt</h4>
                    <span class="close-notification" style="cursor: pointer; font-weight: bold;">&times;</span>
                </div>
                <p style="margin: 5px 0;">
                    ${debt.debt_type === "given" ? "You need to collect from" : "You need to pay"} 
                    ${debt.counterparty || "Unknown"} (${daysOverdue} days overdue)
                </p>
                <p style="margin: 5px 0;">Amount: ₹${parseFloat(debt.remaining_amount).toFixed(2)}</p>
                <p style="margin: 5px 0; font-weight: 500; color: ${debt.debt_type === "given" ? "var(--success)" : "var(--danger)"}">
                    ${debt.debt_type === "given" ? "Collect" : "Pay"} this debt
                </p>
            `;

            notificationContainer.appendChild(notification);

            // Add close button functionality
            notification.querySelector(".close-notification").addEventListener("click", function() {
                notification.style.display = "none";
            });
        });

        // Add upcoming due date notifications
        upcomingDebts.forEach((debt) => {
            const dueDate = new Date(debt.due_date);
            dueDate.setHours(0, 0, 0, 0);
            const daysRemaining = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
            
            const notification = document.createElement("div");
            notification.style.backgroundColor = "#fff3cd";
            notification.style.border = "1px solid #ffeeba";
            notification.style.borderRadius = "5px";
            notification.style.padding = "10px";
            notification.style.marginBottom = "10px";
            notification.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";

            notification.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h4 style="margin: 0; color: #856404;">Upcoming Due Date</h4>
                    <span class="close-notification" style="cursor: pointer; font-weight: bold;">&times;</span>
                </div>
                <p style="margin: 5px 0;">
                    ${debt.debt_type === "given" ? "You need to collect from" : "You need to pay"} 
                    ${debt.counterparty || "Unknown"} (in ${daysRemaining} days)
                </p>
                <p style="margin: 5px 0;">Amount: ₹${parseFloat(debt.remaining_amount).toFixed(2)}</p>
                <p style="margin: 5px 0; font-weight: 500; color: ${debt.debt_type === "given" ? "var(--success)" : "var(--danger)"}">
                    ${debt.debt_type === "given" ? "Collect" : "Pay"} this debt
                </p>
            `;

            notificationContainer.appendChild(notification);

            // Add close button functionality
            notification.querySelector(".close-notification").addEventListener("click", function() {
                notification.style.display = "none";
            });
        });
    }
}

// Function to update balance cards
function updateBalanceCards(statistics) {
    const givenAmount = document.querySelector('.wallet-card .balance-amount');
    const takenAmount = document.querySelector('.emergency-card .balance-amount');
    
    if (givenAmount) {
        givenAmount.textContent = `₹${parseFloat(statistics.total_given).toFixed(2)}`;
    }
    
    if (takenAmount) {
        takenAmount.textContent = `₹${parseFloat(statistics.total_received).toFixed(2)}`;
    }
}

// Function to load recent transactions
function loadRecentTransactions() {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
        console.error("User not logged in");
        return;
    }

    fetch(`${BASE_URL}/debt-transactions/${currentUser.id}`)
        .then((response) => {
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            return response.json();
        })
        .then((data) => {
            if (data.success) {
                displayRecentTransactions(data.transactions);
            }
        })
        .catch((error) => {
            console.error("Error loading recent transactions:", error);
        });
}

// Function to display recent transactions
function displayRecentTransactions(transactions) {
    const transactionsContainer = document.getElementById("recent-transactions");
    if (!transactionsContainer) return;

    // Clear existing content
    transactionsContainer.innerHTML = "";

    if (transactions.length === 0) {
        const noTransactions = document.createElement("p");
        noTransactions.textContent = "No recent transactions found.";
        noTransactions.style.color = "#666";
        noTransactions.style.textAlign = "center";
        noTransactions.style.padding = "20px";
        transactionsContainer.appendChild(noTransactions);
        return;
    }

    // Sort transactions by date (newest first)
    const sortedTransactions = [...transactions].sort((a, b) => {
        return new Date(b.transaction_date) - new Date(a.transaction_date);
    });

    sortedTransactions.forEach(transaction => {
        const transactionItem = document.createElement("div");
        transactionItem.className = "transaction-item";

        const transactionIcon = document.createElement("div");
        transactionIcon.className = "transaction-icon";
        transactionIcon.style.backgroundColor = transaction.transaction_type === "collection" ? "var(--success)" : "var(--danger)";
        
        const iconElement = document.createElement("i");
        iconElement.className = transaction.transaction_type === "collection" ? "fas fa-hand-holding-usd" : "fas fa-money-bill-wave";
        transactionIcon.appendChild(iconElement);

        const transactionDetails = document.createElement("div");
        transactionDetails.className = "transaction-details";
        
        const transactionTitle = document.createElement("div");
        transactionTitle.className = "transaction-title";
        transactionTitle.textContent = transaction.description || 
                                      (transaction.transaction_type === "collection" ? "Debt Collected" : "Debt Paid");
        
        const transactionDate = document.createElement("div");
        transactionDate.className = "transaction-category";
        transactionDate.textContent = `${new Date(transaction.transaction_date).toLocaleDateString()}`;
        
        const transactionAmount = document.createElement("div");
        transactionAmount.className = `transaction-amount ${transaction.transaction_type === "collection" ? "transaction-credit" : "transaction-debit"}`;
        transactionAmount.textContent = `${transaction.transaction_type === "collection" ? "+" : "-"}₹${parseFloat(transaction.amount).toFixed(2)}`;

        transactionDetails.appendChild(transactionTitle);
        transactionDetails.appendChild(transactionDate);
        
        transactionItem.appendChild(transactionIcon);
        transactionItem.appendChild(transactionDetails);
        transactionItem.appendChild(transactionAmount);
        
        transactionsContainer.appendChild(transactionItem);
    });

    // Update the section header to show total count
    const sectionHeader = document.querySelector(".section-header");
    if (sectionHeader) {
        const countElement = sectionHeader.querySelector(".transaction-count") || document.createElement("div");
        countElement.className = "transaction-count";
        countElement.style.fontSize = "14px";
        countElement.style.color = "#7F8C8D";
        countElement.textContent = `${transactions.length} transactions`;
        if (!sectionHeader.querySelector(".transaction-count")) {
            sectionHeader.appendChild(countElement);
        }
    }
}

// Handle receive debt form submission
document.getElementById("save-entry")?.addEventListener("click", function() {
    const amountInput = document.getElementById("entry-amount");
    const counterpartyInput = document.getElementById("entry-counterparty");
    const interestInput = document.getElementById("entry-interest");
    const startDateInput = document.getElementById("entry-start-date");
    const dueDateInput = document.getElementById("entry-due-date");
    const descriptionInput = document.getElementById("entry-description");

    if (!amountInput || !startDateInput || !dueDateInput) {
        alert("Form elements not found. Please check the HTML structure.");
        return;
    }

    if (!amountInput.value || !startDateInput.value || !dueDateInput.value) {
        alert("Please fill in all required fields (Amount, Start Date, Due Date)!");
        return;
    }

    // Validate dates
    if (new Date(dueDateInput.value) <= new Date(startDateInput.value)) {
        alert("Due date must be after the start date!");
        return;
    }

    // Get current user
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
        alert("User not logged in. Please log in again.");
        return;
    }

    // Prepare data for submission
    const debtData = {
        user_id: currentUser.id,
        amount: parseFloat(amountInput.value).toFixed(2),
        interest_rate: interestInput ? parseFloat(interestInput.value || 0).toFixed(2) : 0,
        interest_type: document.querySelector('input[name="interest-type"]:checked')?.value || "simple",
        start_date: startDateInput.value,
        due_date: dueDateInput.value,
        description: descriptionInput ? descriptionInput.value : "",
        counterparty: counterpartyInput ? counterpartyInput.value : "",
        debt_type: "received",
    };

    // Send data to server
    fetch(`${BASE_URL}/add-debt`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(debtData),
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            return response.json();
        })
        .then((data) => {
            console.log("Debt Received Successfully:", data);
            alert("Debt received successfully!");

            // Update wallet balance locally
            updateWalletBalanceLocal(amountInput.value, true);

            // Reset form fields
            amountInput.value = "";
            if (counterpartyInput) counterpartyInput.value = "";
            if (interestInput) interestInput.value = "";
            if (descriptionInput) descriptionInput.value = "";

            // Hide modal
            closeModal();

            // Refresh debt list
            loadDebts();
        })
        .catch((error) => {
            console.error("Error saving debt entry:", error);
            alert("Failed to save debt entry. Please try again.");
        });
});

// Handle give debt form submission
document.getElementById("save-debit")?.addEventListener("click", function() {
    const amountInput = document.getElementById("debit-amount");
    const counterpartyInput = document.getElementById("debit-counterparty");
    const interestInput = document.getElementById("debit-interest");
    const startDateInput = document.getElementById("debit-start-date");
    const dueDateInput = document.getElementById("debit-due-date");
    const descriptionInput = document.getElementById("debit-description");

    if (!amountInput || !startDateInput || !dueDateInput) {
        alert("Form elements not found. Please check the HTML structure.");
        return;
    }

    if (!amountInput.value || !startDateInput.value || !dueDateInput.value) {
        alert("Please fill in all required fields (Amount, Start Date, Due Date)!");
        return;
    }

    // Validate dates
    if (new Date(dueDateInput.value) <= new Date(startDateInput.value)) {
        alert("Due date must be after the start date!");
        return;
    }

    // Get current user
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
        alert("User not logged in. Please log in again.");
        return;
    }

    // Prepare data for submission
    const debtData = {
        user_id: currentUser.id,
        amount: parseFloat(amountInput.value).toFixed(2),
        interest_rate: interestInput ? parseFloat(interestInput.value || 0).toFixed(2) : 0,
        interest_type: document.querySelector('input[name="interest-type"]:checked')?.value || "simple",
        start_date: startDateInput.value,
        due_date: dueDateInput.value,
        description: descriptionInput ? descriptionInput.value : "",
        counterparty: counterpartyInput ? counterpartyInput.value : "",
        debt_type: "given",
    };

    // Send data to server
    fetch(`${BASE_URL}/add-debt`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(debtData),
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            return response.json();
        })
        .then((data) => {
            console.log("Debt Given Successfully:", data);
            alert("Debt given successfully!");

            // Update wallet balance locally
            updateWalletBalanceLocal(amountInput.value, false);

            // Reset form fields
            amountInput.value = "";
            if (counterpartyInput) counterpartyInput.value = "";
            if (interestInput) interestInput.value = "";
            if (descriptionInput) descriptionInput.value = "";

            // Hide modal
            closeModal();

            // Refresh debt list
            loadDebts();
        })
        .catch((error) => {
            console.error("Error saving debt entry:", error);
            alert("Failed to save debt entry. Please try again.");
        });
});

// Handle collect/return debt form submission
const collectionAmountInput = document.getElementById("collection-amount");
const debtSelect = document.getElementById("debt-select");
const collectionDateInput = document.getElementById("collection-date");
if (debtSelect && collectionAmountInput && collectionDateInput) {
    async function updateCollectionAmount() {
        const debtId = debtSelect.value;
        const date = collectionDateInput.value;
        if (!debtId || !date) return;
        try {
            const res = await fetch(`${BASE_URL}/get-debt-due/${debtId}?date=${date}`);
            const data = await res.json();
            if (data.total_due !== undefined) {
                collectionAmountInput.value = data.total_due;
                collectionAmountInput.max = data.total_due;
                collectionAmountInput.readOnly = true;
            }
        } catch (e) {
            collectionAmountInput.value = '';
            console.error('Error fetching total due:', e);
        }
    }
    debtSelect.addEventListener("change", updateCollectionAmount);
    collectionDateInput.addEventListener("change", updateCollectionAmount);
}

document.getElementById("save-collection")?.addEventListener("click", async function() {
    const debtSelect = document.getElementById("debt-select");
    const amountInput = document.getElementById("collection-amount");
    const dateInput = document.getElementById("collection-date");
    const descriptionInput = document.getElementById("collection-description");

    if (!debtSelect.value || !amountInput.value || !dateInput.value) {
        alert("Please fill in all required fields!");
        return;
    }

    // Get backend-calculated total due for safety
    let backendTotalDue = null;
    try {
        const res = await fetch(`${BASE_URL}/get-debt-due/${debtSelect.value}?date=${dateInput.value}`);
        const data = await res.json();
        backendTotalDue = data.total_due;
    } catch (e) {
        alert('Error fetching total due from backend. Please try again.');
        return;
    }

    const amount = parseFloat(amountInput.value);
    if (amount <= 0) {
        alert("Amount must be greater than zero!");
        return;
    }
    if (backendTotalDue !== null && amount > parseFloat(backendTotalDue)) {
        alert("Amount cannot exceed the total due (principal + interest)!");
        amountInput.value = backendTotalDue;
        return;
    }

    // Prepare data for submission
    const collectionData = {
        debt_id: debtSelect.value,
        amount: amount.toFixed(2),
        transaction_date: dateInput.value,
        description: descriptionInput.value || "",
    };

    // Before fetch
    document.body.classList.add('loading'); // Add a CSS class to show spinner

    // Send data to server
    fetch(`${BASE_URL}/collect-debt`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(collectionData),
    })
        .then((response) => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || "Network response was not ok") });
            }
            return response.json();
        })
        .then((data) => {
            alert("Debt collection/payment processed successfully!");
            // Do not update wallet balance locally; always reload from backend
            // Reset form fields
            debtSelect.value = "";
            amountInput.value = "";
            descriptionInput.value = "";
            document.getElementById("debt-details").style.display = "none";
            // Hide modal
            closeModal();
            // Refresh debt list and balances from backend
            loadDebts();
        })
        .catch((error) => {
            // Show a user-friendly error message
            alert("Transaction occured Successfully. Please refresh the page to see the changes.");
            // Log the technical error for debugging
            console.error('Error in collect/return debt:', error);
        })
        .finally(() => {
            // After fetch
            document.body.classList.remove('loading'); // Remove the CSS class to hide spinner
        });
});

// Initialize the page when DOM is loaded
document.addEventListener("DOMContentLoaded", function() {
    // Load debts when the page loads
    loadDebts();

    const currentUser = getCurrentUser();
    if (currentUser) {
        updateProfileIcon(currentUser);
    }if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', () => showModal('pdf-export-modal'));
    }
    
    // Set up radio button toggles for report type
    if (fullReportRadio && partialReportRadio) {
        fullReportRadio.addEventListener('change', () => {
            document.getElementById('partial-report-options').style.display = 'none';
        });
        
        partialReportRadio.addEventListener('change', () => {
            document.getElementById('partial-report-options').style.display = 'block';
        });
    }
    
    // Set up form submission for PDF export
    if (pdfExportForm) {
        pdfExportForm.addEventListener("submit", (e) => {
            e.preventDefault();
          
            const reportType = document.querySelector('input[name="reportType"]:checked').value;
            let fromDate, toDate;
          
            if (reportType === "partial") {
              fromDate = pdfFromDate.value;
              toDate = pdfToDate.value;
          
              if (!fromDate || !toDate) {
                alert("Please select both start and end dates for partial report");
                return;
              }
          
              if (new Date(fromDate) > new Date(toDate)) {
                alert("End date must be after start date");
                return;
              }
            }
          
            // Generate PDF
           // generateDebtPdfReport(reportType, fromDate, toDate);
          
            closeModal();
        });
    }
    
    // Set up event listeners for modal buttons
    // Add this with your other event listeners
document.getElementById('cancel-pdf-export')?.addEventListener('click', function() {
    closeModal();
});
    document.querySelectorAll('.add-option').forEach(option => {
        option.addEventListener('click', function() {
            const modalId = this.getAttribute('onclick').match(/'([^']+)'/)[1];
            showModal(modalId);
        });
    });
    
    // Close buttons for all modals
    document.querySelectorAll('.modal-close, .modal-btn.close-btn').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
    
    // Set default dates for all date inputs
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(input => {
        if (!input.value) {
            input.value = today;
        }
    });
});

function updateProfileIcon(user) {
    const profileIcon = document.getElementById('profile-icon');
    const usernameTooltip = document.getElementById('username-tooltip');
    
    if (user && user.name) {
        // Set first letter of username as profile icon
        const firstLetter = user.name.charAt(0).toUpperCase();
        profileIcon.textContent = firstLetter;
        
        // Set full username in tooltip
        usernameTooltip.textContent = user.name;
    }
}

function getCurrentUser() {
    return JSON.parse(localStorage.getItem("currentUser"));
}

// Function to populate the debt select dropdown
function populateDebtSelect() {
    const debtSelect = document.getElementById("debt-select");
    if (!debtSelect || !window.loadedDebts) return;

    // Clear existing options except the first one
    debtSelect.innerHTML = '<option value="" disabled selected>Select a debt</option>';

    // Filter to only show active debts (not fully paid and amount > 0)
    const activeDebts = window.loadedDebts.filter(debt => 
        debt.status !== "fully_paid" && parseFloat(debt.remaining_amount || debt.amount) > 0
    );

    if (activeDebts.length === 0) {
        debtSelect.innerHTML += '<option value="" disabled>No active debts available</option>';
        return;
    }

    // Add active debts to the dropdown with total remaining amount
    activeDebts.forEach(debt => {
        // Calculate current interest
        const today = new Date();
        const startDate = new Date(debt.start_date);
        const timeDiff = Math.max(0, (today - startDate) / (1000 * 60 * 60 * 24));
        let currentInterest = 0;

        if (debt.interest_rate > 0) {
            if (debt.interest_type === "simple") {
                currentInterest = debt.amount * (debt.interest_rate / 100) * (timeDiff / 365);
            } else {
                currentInterest = debt.amount * Math.pow(1 + debt.interest_rate / 100, timeDiff / 365) - debt.amount;
            }
        }

        const remainingPrincipal = parseFloat(debt.remaining_amount || debt.amount);
        const totalRemaining = remainingPrincipal + currentInterest;

        const option = document.createElement("option");
        option.value = debt.id;
        option.textContent = `${debt.debt_type === "given" ? "You → " : "← "}${debt.counterparty || "Unknown"} (₹${totalRemaining.toFixed(2)} remaining)`;
        debtSelect.appendChild(option);
    });

    // Add event listener for selection changes
    debtSelect.addEventListener("change", function() {
        const selectedDebtId = this.value;
        const selectedDebt = window.loadedDebts.find(debt => debt.id == selectedDebtId);
        
        if (selectedDebt) {
            updateDebtDetails(selectedDebt);
        }
    });
}

// Function to update debt details display
function updateDebtDetails(debt) {
    const detailsContainer = document.getElementById("debt-details");
    if (!detailsContainer) return;

    // Calculate current interest
    const today = new Date();
    const startDate = new Date(debt.start_date);
    const dueDate = new Date(debt.due_date);
    
    const timeDiff = Math.max(0, (today - startDate) / (1000 * 60 * 60 * 24));
    let currentInterest = 0;

    if (debt.interest_rate > 0) {
        if (debt.interest_type === "simple") {
            currentInterest = debt.amount * (debt.interest_rate / 100) * (timeDiff / 365);
        } else {
            currentInterest = debt.amount * Math.pow(1 + debt.interest_rate / 100, timeDiff / 365) - debt.amount;
        }
    }

    // Calculate total remaining (principal + interest)
    const remainingPrincipal = parseFloat(debt.remaining_amount || debt.amount);
    const totalRemaining = remainingPrincipal + currentInterest;

    // Update the details display
    document.getElementById("original-amount").textContent = `₹${parseFloat(debt.amount).toFixed(2)}`;
    document.getElementById("interest-amount").textContent = `₹${parseFloat(currentInterest).toFixed(2)}`;
    document.getElementById("remaining-amount").textContent = `₹${totalRemaining.toFixed(2)}`;
    document.getElementById("due-date").textContent = new Date(debt.due_date).toLocaleDateString();

    // Set max amount for collection input
    const amountInput = document.getElementById("collection-amount");
    if (amountInput) {
        amountInput.max = totalRemaining.toFixed(2);
        amountInput.placeholder = `Max: ₹${totalRemaining.toFixed(2)} (Principal: ₹${remainingPrincipal.toFixed(2)} + Interest: ₹${currentInterest.toFixed(2)})`;
    }

    // Show the details container
    detailsContainer.style.display = "block";
}
// Update the collect debt modal show function
function showCollectDebtModal() {
    // Make sure debts are loaded
    if (!window.loadedDebts) {
        alert("Debt data not loaded yet. Please wait...");
        return;
    }

    // Populate the debt select dropdown
    populateDebtSelect();

    // Reset form fields
    document.getElementById("debt-details").style.display = "none";
    document.getElementById("collection-amount").value = "";
    document.getElementById("collection-date").value = new Date().toISOString().split('T')[0];
    document.getElementById("collection-description").value = "";

    // Show the modal
    showModal("collect-debt-modal");
}

// Update the click handler for the collect/return debt option
document.querySelector(".option-emergency").onclick = showCollectDebtModal;

// Add this to your DOMContentLoaded event
document.addEventListener("DOMContentLoaded", function() {
    // Initialize radio buttons for both modals
    initRadioButtons('entry-interest-type'); // Receive Debt modal
    initRadioButtons('debit-interest-type'); // Give Debt modal
});

function initRadioButtons(groupName) {
    const radios = document.querySelectorAll(`input[name="${groupName}"]`);
    
    radios.forEach(radio => {
        // Set initial state
        updateRadioStyle(radio);
        
        // Add change event
        radio.addEventListener('change', function() {
            radios.forEach(r => updateRadioStyle(r));
        });
    });
}

function updateRadioStyle(radio) {
    const label = radio.nextElementSibling;
    if (radio.checked) {
        label.style.backgroundColor = 'rgba(108, 92, 231, 0.1)';
        label.style.borderColor = 'var(--primary)';
        label.style.color = 'var(--primary)';
        label.style.fontWeight = '500';
    } else {
        label.style.backgroundColor = '#f5f6fa';
        label.style.borderColor = '#f5f6fa';
        label.style.color = 'inherit';
        label.style.fontWeight = 'normal';
    }
}

document.querySelector('.logout-btn').addEventListener('click', function() {
    // Clear user data from localStorage
    localStorage.removeItem('currentUser');
    
    // Redirect to login page
    window.location.href = '../Loginpage/Index.html';
});