//--------------------------------------------------------------------------

//<!-- Add these before your script.js file -->


//--------------------------------------------------------------------------

let debitPieChart, creditPieChart, debitBarChart, creditBarChart;

const BASE_URL = window.location.hostname === "localhost"
  ? "http://localhost:3000"
  : "https://penny-pilot-production.up.railway.app";

document.addEventListener("DOMContentLoaded", function () {
    // Initialize Swiper
    const swiper = new Swiper('.swiper-container', {
        loop: true,
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
        on: {
            slideChange: function() {
                // Redraw charts when slide changes
                setTimeout(() => {
                    if (this.activeIndex === 0) {
                        debitPieChart && debitPieChart.resize();
                        creditPieChart && creditPieChart.resize();
                    } else {
                        debitBarChart && debitBarChart.resize();
                        creditBarChart && creditBarChart.resize();
                    }
                }, 50);
            },
            init: function() {
                // Initial resize
                setTimeout(() => {
                    if (this.activeIndex === 0) {
                        debitPieChart && debitPieChart.resize();
                        creditPieChart && creditPieChart.resize();
                    } else {
                        debitBarChart && debitBarChart.resize();
                        creditBarChart && creditBarChart.resize();
                    }
                }, 100);
            }
        }
    });

    window.addEventListener('focus', function() {
        initializeBalances(); // This will refresh the wallet balance
      });
    // Initialize user data
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) {
        window.location.href = "../Loginpage/Index.html";
        return;
    }

    // Set user profile
    document.getElementById("profile-icon").textContent = currentUser.name.charAt(0).toUpperCase();
    document.getElementById("username-tooltip").textContent = currentUser.name;

    // Initialize balances and transactions
    initializeBalances();
    loadRecentTransactions();

    // Track if modal was opened from wallet
    let openedFromWallet = false;

    // --- MODAL ELEMENTS ---
    const creditModal = document.getElementById("entry-modal");
    const debitModal = document.getElementById("debit-modal");
    const emergencyModal = document.getElementById("emergency-modal");
    const fundModal = document.getElementById("fund-modal");
    const fundModalTitle = document.getElementById("fund-modal-title");
    // In the section where you define modal elements, add these:
    const closeModalBtn = document.getElementById("close-modal-btn");
    const closeDebitModalBtn = document.getElementById("close-debit-modal-btn");
    const cancelFundBtn = document.getElementById("cancel-fund-btn");

    // Then in your event listeners section, add these:
    closeModalBtn.addEventListener('click', () => closeModal(creditModal));
    closeDebitModalBtn.addEventListener('click', () => closeModal(debitModal));
    cancelFundBtn.addEventListener('click', () => closeModal(emergencyModal));

    // --- BUTTON ELEMENTS ---
    const addButton = document.getElementById("addButton");
    const addOptions = document.getElementById("addOptions");
    const addCreditBtn = document.getElementById("add-credit-btn");
    const addDebitBtn = document.getElementById("add-debit-btn");
    const addEmergencyBtn = document.getElementById("add-emergency-btn");
    const logoutBtn = document.getElementById("logout-btn");

    // --- FORM ELEMENTS ---
    const creditForm = document.getElementById("credit-form");
    const debitForm = document.getElementById("debit-form");
    const emergencyForm = document.getElementById("emergency-form");
    const fundForm = document.getElementById("fund-form");

    // ----PDF form
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

    // --- UTILITY FUNCTIONS ---
    function showModal(modal) {
        if (modal) {
            modal.style.display = "flex";
            setTimeout(() => {
                modal.style.opacity = "1";
                modal.querySelector('.modal-content').style.transform = "translateY(0)";
            }, 10);
        }
    }

    function closeModal(modal) {
        if (modal) {
            modal.style.opacity = "0";
            modal.querySelector('.modal-content').style.transform = "translateY(-20px)";
            setTimeout(() => {
                modal.style.display = "none";
            }, 300);
        }
    }

    function hideSpecialCategories(selectId) {
        const select = document.getElementById(selectId);
        if (select) {
            Array.from(select.options).forEach(option => {
                if (option.hasAttribute('hidden')) {
                    option.style.display = 'none';
                    option.disabled = true;
                }
            });
            
            // Ensure a valid option is selected
            if (!select.value && select.options.length > 0) {
                const firstVisible = Array.from(select.options).find(opt => 
                    !opt.hidden && !opt.disabled
                );
                if (firstVisible) select.value = firstVisible.value;
            }
        }
    }
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
    
    closePdfModal.addEventListener('click', () => {
        closeModal(pdfExportModal);
    });
    
    cancelPdfExport.addEventListener('click', () => {
        closeModal(pdfExportModal);
    });
    
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
        
        // Generate PDF
        PdfExport.generateExpenditurePdf(reportType, fromDate, toDate);        
        closeModal(pdfExportModal);
    });

    document.addEventListener('DOMContentLoaded', function() {
        // Hide in both credit and debit forms
        hideSpecialCategories('entry-category');
        hideSpecialCategories('debit-category');
    });

    function setupModalListeners() {
        document.querySelectorAll('[data-modal-toggle]').forEach(button => {
            button.addEventListener('click', () => {
                setTimeout(() => {
                    hideSpecialCategories('entry-category');
                    hideSpecialCategories('debit-category');
                }, 50); // Small delay for modal animation
            });
        });
    }
    setupModalListeners();

    function closeAllModals() {
        closeModal(creditModal);
        closeModal(debitModal);
        closeModal(emergencyModal);
        closeModal(fundModal);
    }

    function setTodayDate(elementId) {
        const today = new Date().toISOString().split('T')[0];
        if (document.getElementById(elementId)) {
            document.getElementById(elementId).value = today;
        }
    }

    function getWalletBalance() {
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        if (!currentUser) return 0;
        
        // Get from localStorage first (for immediate UI update)
        const cachedBalance = localStorage.getItem(`wallet_balance_${currentUser.id}`);
        if (cachedBalance) {
            return parseFloat(cachedBalance);
        }
        return 0;
    }

    function getEmergencyFundBalance() {
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        if (!currentUser) return 0;
        
        // Get from localStorage first (for immediate UI update)
        const cachedBalance = localStorage.getItem(`emergency_fund_${currentUser.id}`);
        if (cachedBalance) {
            return parseFloat(cachedBalance);
        }
        return 0;
    }

    function displayWalletBalance() {
        const balanceDisplay = document.getElementById("wallet-balance");
        if (balanceDisplay) {
            balanceDisplay.textContent = `₹${getWalletBalance().toFixed(2)}`;
        }
    }

    function displayEmergencyFundBalance() {
        const balanceDisplay = document.getElementById("emergency-balance");
        if (balanceDisplay) {
            balanceDisplay.textContent = `₹${getEmergencyFundBalance().toFixed(2)}`;
        }
    }

    function updateWalletBalance(amount, isCredit = true) {
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        if (!currentUser) return;
        
        // Get current balance from localStorage
        let currentBalance = parseFloat(localStorage.getItem(`wallet_balance_${currentUser.id}`)) || 0;
        
        // Update balance
        if (isCredit) {
            currentBalance += parseFloat(amount);
        } else {
            currentBalance -= parseFloat(amount);
            if (currentBalance < 0) currentBalance = 0; // Prevent negative balance
        }
        
        // Update localStorage
        localStorage.setItem(`wallet_balance_${currentUser.id}`, currentBalance.toFixed(2));
        
        // Update display
        displayWalletBalance();
        
        // Sync with server
        fetch(`${BASE_URL}/update-wallet`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                balance: currentBalance.toFixed(2)
            }),
        }).catch(error => console.error('Error updating wallet:', error));
    }

    function updateEmergencyFundBalance(amount, isAddition = true) {
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        if (!currentUser) return;
        
        // Get current balance from localStorage
        let currentBalance = parseFloat(localStorage.getItem(`emergency_fund_${currentUser.id}`)) || 0;
        
        // Update balance
        if (isAddition) {
            currentBalance += parseFloat(amount);
        } else {
            currentBalance -= parseFloat(amount);
            if (currentBalance < 0) currentBalance = 0; // Prevent negative balance
        }
        
        // Update localStorage
        localStorage.setItem(`emergency_fund_${currentUser.id}`, currentBalance.toFixed(2));
        
        // Update display
        displayEmergencyFundBalance();
    }

    function initializeBalances() {
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        if (!currentUser) return;

        // Fetch wallet balance from server
        fetch(`${BASE_URL}/get-wallet-balance/${currentUser.id}`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                // Ensure balance is a number and handle any potential null/undefined values
                const balance = Number(data.balance || 0);
                localStorage.setItem(`wallet_balance_${currentUser.id}`, balance.toFixed(2));
                displayWalletBalance();
            })
            .catch(error => {
                console.error('Error fetching wallet balance:', error);
                // Fallback to localStorage if available
                displayWalletBalance();
            });

        // Fetch emergency fund balance from server
        fetch(`${BASE_URL}/get-emergency-fund/${currentUser.id}`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                // Ensure balance is a number and handle any potential null/undefined values
                const balance = Number(data.balance || 0);
                localStorage.setItem(`emergency_fund_${currentUser.id}`, balance.toFixed(2));
                displayEmergencyFundBalance();
            })
            .catch(error => {
                console.error('Error fetching emergency fund:', error);
                // Fallback to localStorage if available
                displayEmergencyFundBalance();
            });
    }

    function loadRecentTransactions() {
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        if (!currentUser) return;
    
        // Fetch all entries
        fetch(`${BASE_URL}/get-entries?user_id=${currentUser.id}`)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                // Combine and sort all entries by date (newest first)
                const allTransactions = [
                    ...data.entries.credit.map(entry => ({ ...entry, type: "credit" })),
                    ...data.entries.debit.map(entry => ({ ...entry, type: "debit" }))
                ].sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date));
    
                displayTransactions(allTransactions);
                
                // Create charts with the data
                createCharts(data.entries.credit, data.entries.debit);
            })
            .catch(error => {
                console.error("Error fetching transactions:", error);
            });
    }
    
    // New function to create all charts
    function createCharts(creditEntries, debitEntries) {
        // Destroy existing charts if they exist
        if (debitPieChart) debitPieChart.destroy();
        if (creditPieChart) creditPieChart.destroy();
        if (debitBarChart) debitBarChart.destroy();
        if (creditBarChart) creditBarChart.destroy();
    
        // Process data for charts
        const debitData = processChartData(debitEntries, 'debit');
        const creditData = processChartData(creditEntries, 'credit');
        
        // Create debit pie chart
        const debitPieCtx = document.getElementById('debitPieChart').getContext('2d');
        debitPieChart = new Chart(debitPieCtx, {
            type: 'pie',
            data: {
                labels: debitData.categories,
                datasets: [{
                    data: debitData.amounts,
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
                        '#9966FF', '#FF9F40', '#8AC24A', '#607D8B'
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
                        text: 'Debit by Category',
                        font: {
                            size: 16
                        },
                        padding: {
                            top: 10,
                            bottom: 10
                        }
                    },
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12,
                            padding: 12
                        }
                    }
                }
            }
        });
        
        // Create credit pie chart
        const creditPieCtx = document.getElementById('creditPieChart').getContext('2d');
        creditPieChart = new Chart(creditPieCtx, {
            type: 'pie',
            data: {
                labels: creditData.categories,
                datasets: [{
                    data: creditData.amounts,
                    backgroundColor: [
                        '#4BC0C0', '#9966FF', '#FF9F40', '#8AC24A', 
                        '#FF6384', '#36A2EB', '#FFCE56', '#607D8B'
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
                        text: 'Credit by Category',
                        font: {
                            size: 16
                        },
                        padding: {
                            top: 10,
                            bottom: 10
                        }
                    },
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12,
                            padding: 12
                        }
                    }
                }
            }
        });
        
        // Create debit bar chart
        const debitBarCtx = document.getElementById('debitBarChart').getContext('2d');
        debitBarChart = new Chart(debitBarCtx, {
            type: 'bar',
            data: {
                labels: debitData.categories,
                datasets: [{
                    label: 'Amount (₹)',
                    data: debitData.amounts,
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
                        text: 'Debit by Category',
                        font: {
                            size: 16
                        },
                        padding: {
                            top: 10,
                            bottom: 10
                        }
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Amount (₹)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Categories'
                        }
                    }
                }
            }
        });
        
        // Create credit bar chart
        const creditBarCtx = document.getElementById('creditBarChart').getContext('2d');
        creditBarChart = new Chart(creditBarCtx, {
            type: 'bar',
            data: {
                labels: creditData.categories,
                datasets: [{
                    label: 'Amount (₹)',
                    data: creditData.amounts,
                    backgroundColor: '#36A2EB',
                    borderColor: '#36A2EB',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Credit by Category',
                        font: {
                            size: 16
                        },
                        padding: {
                            top: 10,
                            bottom: 10
                        }
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Amount (₹)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Categories'
                        }
                    }
                }
            }
        });
    
        // Trigger resize after a short delay to ensure proper rendering
        setTimeout(() => {
            if (swiper.activeIndex === 0) {
                debitPieChart.resize();
                creditPieChart.resize();
            } else {
                debitBarChart.resize();
                creditBarChart.resize();
            }
        }, 100);
    }
    
    // Helper function to process data for charts
    function processChartData(entries, type) {
        const categoryMap = {};
        
        entries.forEach(entry => {
            if (!categoryMap[entry.category]) {
                categoryMap[entry.category] = 0;
            }
            categoryMap[entry.category] += parseFloat(entry.amount);
        });
        
        // Convert to arrays for Chart.js
        const categories = Object.keys(categoryMap);
        const amounts = categories.map(cat => categoryMap[cat]);
        
        return {
            categories,
            amounts
        };
    }
    function displayTransactions(transactions) {
        const transactionList = document.getElementById("transaction-list");
        if (!transactionList) return;
    
        // Clear existing transactions
        transactionList.innerHTML = "";

        const sortedTransactions = [...transactions].sort((a, b) => {
            const dateDiff = new Date(b.entry_date) - new Date(a.entry_date);
            if (dateDiff !== 0) return dateDiff;
            
            // If dates are equal, sort by created_at (assuming it exists)
            const aTime = a.created_at ? new Date(a.created_at) : 0;
            const bTime = b.created_at ? new Date(b.created_at) : 0;
            return bTime - aTime;
        });
    
        // Display all transactions (already sorted)
        sortedTransactions.forEach(transaction => {

            const transactionItem = document.createElement("div");
            transactionItem.className = "transaction-item";
    
            const icon = document.createElement("div");
            icon.className = "transaction-icon";
            icon.style.background = transaction.type === "credit" ? "#00B894" : "#D63031";
            
            const iconElement = document.createElement("i");
            if (transaction.category === 'To Emergency' || transaction.category === 'From Emergency') {
                iconElement.className = "fas fa-piggy-bank";
            } else {
                iconElement.className = transaction.type === "credit" ? "fas fa-plus-circle" : "fas fa-minus-circle";
            }
            icon.appendChild(iconElement);
    
            const details = document.createElement("div");
            details.className = "transaction-details";
    
            const title = document.createElement("div");
            title.className = "transaction-title";
            title.textContent = transaction.description || transaction.category;
    
            const category = document.createElement("div");
            category.className = "transaction-category";
            category.textContent = `${transaction.category} • ${formatDate(transaction.entry_date)}`;
    
            details.appendChild(title);
            details.appendChild(category);
    
            const amount = document.createElement("div");
            amount.className = `transaction-amount transaction-${transaction.type}`;
            amount.textContent = `${transaction.type === "credit" ? "+" : "-"}$${parseFloat(transaction.amount).toFixed(2)}`;
    
            transactionItem.appendChild(icon);
            transactionItem.appendChild(details);
            transactionItem.appendChild(amount);
    
            transactionList.appendChild(transactionItem);
        });
    
        // Update the section header to show total count
        const sectionHeader = document.querySelector(".section-header");
        if (sectionHeader) {
            const countElement = sectionHeader.querySelector(".transaction-count") || document.createElement("div");
            countElement.className = "transaction-count";
            countElement.textContent = `${transactions.length} transactions`;
            if (!sectionHeader.querySelector(".transaction-count")) {
                sectionHeader.appendChild(countElement);
            }
        }
    }
    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }

    function initializeDatePickers() {
        const fromDateInput = document.getElementById("from-date");
        const toDateInput = document.getElementById("to-date");

        // Set default dates (last 30 days)
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);

        if (fromDateInput) fromDateInput.value = thirtyDaysAgo.toISOString().split('T')[0];
        if (toDateInput) toDateInput.value = today.toISOString().split('T')[0];

        // Set min/max dates
        if (fromDateInput && toDateInput) {
            fromDateInput.max = toDateInput.value;
            toDateInput.min = fromDateInput.value;

            // Update constraints when dates change
            fromDateInput.addEventListener("change", function() {
                toDateInput.min = this.value;
            });

            toDateInput.addEventListener("change", function() {
                fromDateInput.max = this.value;
            });
        }
    }

    // --- CREDIT ENTRY FUNCTIONS ---
    function handleCreditSubmit(e) {
        e.preventDefault();
        
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        if (!currentUser) {
            alert("User not logged in. Please log in again.");
            return;
        }

        const amountInput = document.getElementById("entry-amount");
        const categoryInput = document.getElementById("entry-category");
        const dateInput = document.getElementById("entry-date");
        const descriptionInput = document.getElementById("entry-description");
        
        if (!amountInput.value || !dateInput.value) {
            alert("Please fill in the required fields (Amount & Date)!");
            return;
        }

        // Validate category - only allow values from the database ENUM
        const validCategories = ['Salary', 'Debt Taken', 'Investments Relieved', 'From Emergency', 'Other'];
        if (!categoryInput.value || !validCategories.includes(categoryInput.value)) {
            alert("Please select a valid category from the dropdown!");
            return;
        }

        // Parse and format amount
        const amount = parseFloat(amountInput.value);
        if (isNaN(amount) || amount <= 0) {
            alert("Please enter a valid amount!");
            return;
        }

        const creditData = { 
            user_id: currentUser.id,
            amount: amount.toFixed(2),
            category: categoryInput.value,
            entry_date: dateInput.value,
            description: descriptionInput.value || "No description"
        };

        fetch(`${BASE_URL}/add-credit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(creditData),
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            // Update wallet balance
            updateWalletBalance(amountInput.value, true);
            
            // If the category is "From Emergency", update emergency fund balance
            if (categoryInput.value === "From Emergency") {
                updateEmergencyFundBalance(amountInput.value, false);
            }
            
            // Reset form
            creditForm.reset();
            setTodayDate("entry-date");
            
            // Close modal
            closeModal(creditModal);
            
            // Reload transactions
            loadRecentTransactions();
            
            alert("Credit entry added successfully!");
        })
        .catch(error => {
            console.error('Error saving credit entry:', error);
            alert("Failed to save entry. Please try again.");
        });
    }

    // --- DEBIT ENTRY FUNCTIONS ---
    function handleDebitSubmit(e) {
        e.preventDefault();
        
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        if (!currentUser) {
            alert("User not logged in. Please log in again.");
            return;
        }

        const amountInput = document.getElementById("debit-amount");
        const categoryInput = document.getElementById("debit-category");
        const dateInput = document.getElementById("debit-date");
        const descriptionInput = document.getElementById("debit-description");
        
        if (!amountInput.value || !dateInput.value) {
            alert("Please fill in the required fields (Amount & Date)!");
            return;
        }

        // Validate category - only allow values from the database ENUM
        const validCategories = ['Food', 'Transport', 'Entertainment', 'Bills', 'Emergency', 'Other'];
        if (!categoryInput.value || !validCategories.includes(categoryInput.value)) {
            alert("Please select a valid category from the dropdown!");
            return;
        }

        const amount = parseFloat(amountInput.value).toFixed(2);
        const debitData = {
            user_id: currentUser.id,
            amount: amount,
            category: categoryInput.value,
            entry_date: dateInput.value,
            description: descriptionInput.value || ''
        };

        fetch(`${BASE_URL}/add-debit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(debitData),
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            // Update wallet balance (deduct from wallet)
            updateWalletBalance(amount, false);
            
            // Check if category is "Emergency" to update emergency fund
            if (categoryInput.value === "Emergency") {
                // Update emergency fund balance from the response if available
                if (data.emergency_balance !== undefined) {
                    localStorage.setItem(`emergency_fund_${currentUser.id}`, data.emergency_balance.toFixed(2));
                    displayEmergencyFundBalance();
                } else {
                    // Fallback to local update
                    updateEmergencyFundBalance(amount, true);
                }
            }
            
            // Reset form
            debitForm.reset();
            setTodayDate("debit-date");
            
            // Close modal
            closeModal(debitModal);
            
            // Reload transactions
            loadRecentTransactions();
            
            alert("Debit entry added successfully!");
        })
        .catch(error => {
            console.error('Error saving debit entry:', error);
            alert("Failed to save entry. Please try again.");
        });
    }

    // --- EMERGENCY FUND FUNCTIONS ---
    function handleEmergencySubmit(e) {
        e.preventDefault();
        
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        if (!currentUser) {
            alert("User not logged in. Please log in again.");
            return;
        }
    
        const amountInput = document.getElementById("fund-amount");
        const dateInput = document.getElementById("fund-date");
        const action = document.querySelector('input[name="fundAction"]:checked').value;
        
        if (!amountInput.value || isNaN(amountInput.value) || !dateInput.value) {
            alert("Please enter a valid amount and date!");
            return;
        }
    
        // Only allow valid categories for emergency fund
        const validCreditCategory = 'From Emergency';
        const validDebitCategory = 'Emergency';
        const amount = parseFloat(amountInput.value).toFixed(2);
        const transactionData = {
            user_id: currentUser.id,
            amount: amount,
            entry_date: dateInput.value,
            description: `Emergency Fund ${action === 'add' ? 'Contribution' : 'Withdrawal'}`,
            category: action === 'add' ? validDebitCategory : validCreditCategory
        };
    
        // First, create the transaction
        fetch(`${BASE_URL}/${action === 'add' ? 'add-debit' : 'add-credit'}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(transactionData),
        })
        .then(response => {
            if (!response.ok) throw new Error('Transaction failed');
            return response.json();
        })
        .then(data => {
            // Update local balances
            if (action === 'add') {
                // Deduct from wallet
                updateWalletBalance(amount, false);
            } else {
                // Add to wallet
                updateWalletBalance(amount, true);
            }
            // Sync balances from backend
            initializeBalances();
            // Reset form and close modal
            emergencyForm.reset();
            document.getElementById("addFund").checked = true;
            closeModal(emergencyModal);
            // Reload transactions
            loadRecentTransactions();
            alert(`Emergency fund ${action === 'add' ? 'contribution' : 'withdrawal'} successful!`);
        })
        .catch(error => {
            console.error('Error:', error);
            alert("Transaction failed. Please check console for details.");
        });

        if (action === 'withdraw') {
            const currentEmergencyBalance = getEmergencyFundBalance();
            if (parseFloat(amount) > currentEmergencyBalance) {
                alert('You cannot withdraw more than the available emergency fund balance!');
                return;
            }
        }
    }
    // --- EVENT LISTENERS ---
    // Add Button Functionality
    addButton.addEventListener('click', function(e) {
        e.stopPropagation();
        addOptions.style.display = addOptions.style.display === 'flex' ? 'none' : 'flex';
        addButton.classList.toggle('active');
    });

    document.addEventListener('click', function(e) {
        if (!addButton.contains(e.target) && !addOptions.contains(e.target)) {
            addOptions.style.display = 'none';
            addButton.classList.remove('active');
        }
    });

    // Open Modals from Add Options
    addCreditBtn.addEventListener('click', function() {
        addOptions.style.display = 'none';
        addButton.classList.remove('active');
        showModal(creditModal);
        setTodayDate("entry-date");
    });

    addDebitBtn.addEventListener('click', function() {
        addOptions.style.display = 'none';
        addButton.classList.remove('active');
        showModal(debitModal);
        setTodayDate("debit-date");
    });

    addEmergencyBtn.addEventListener('click', function() {
        addOptions.style.display = 'none';
        addButton.classList.remove('active');
        showModal(emergencyModal);
        setTodayDate("fund-date");
        document.getElementById("emergency-balance-modal").textContent = 
            document.getElementById("emergency-balance").textContent;
    });

    // Form Submissions
    creditForm.addEventListener('submit', handleCreditSubmit);
    debitForm.addEventListener('submit', handleDebitSubmit);
    emergencyForm.addEventListener('submit', handleEmergencySubmit);

    // Close Modals
    document.getElementById('close-modal').addEventListener('click', () => closeModal(creditModal));
    document.getElementById('close-debit-modal').addEventListener('click', () => closeModal(debitModal));
    document.getElementById('close-emergency-btn').addEventListener('click', () => closeModal(emergencyModal));
    document.getElementById('close-pdf-modal').addEventListener('click', () => closeModal(pdfExportModal));

    document.getElementById('close-modal-btn').addEventListener('click', () => closeModal(creditModal));
    document.getElementById('close-debit-modal-btn').addEventListener('click', () => closeModal(debitModal));
    document.getElementById('cancel-fund-btn').addEventListener('click', () => closeModal(emergencyModal));
    document.getElementById('cancel-pdf-export').addEventListener('click', () => closeModal(pdfExportModal));

    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal-overlay')) {
            closeModal(event.target);
        }
    });

    // Logout
    logoutBtn.addEventListener('click', function() {
        // Clear user data from localStorage
        localStorage.removeItem("currentUser");
        // Redirect to login page
        window.location.href = "../Loginpage/Index.html";
    });

    // Initialize date pickers
    initializeDatePickers();

    // Initialize balances
    initializeBalances();
    loadRecentTransactions();
});