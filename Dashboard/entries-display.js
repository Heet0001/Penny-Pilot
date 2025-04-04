document.addEventListener("DOMContentLoaded", () => {
    console.log("Transaction history script loaded");
  
    // Initialize Swiper properly with all parameters
    const swiper = new Swiper(".swiper", {
        pagination: {
            el: ".swiper-pagination",
            clickable: true,
        },
        navigation: {
            nextEl: ".swiper-button-next",
            prevEl: ".swiper-button-prev",
        },
        on: {
            init: function() {
                console.log("Swiper initialized");
                // Check if we're on the transactions slide and load data
                if (this.activeIndex === 1) {
                    setTimeout(() => loadTransactionHistory(), 300); // Add slight delay for DOM to be ready
                }
            },
            slideChange: function() {
                console.log("Slide changed to index:", this.activeIndex);
                if (this.activeIndex === 1) {
                    setTimeout(() => loadTransactionHistory(), 300); // Add slight delay for DOM to be ready
                }
            },
        },
    });
  
    // Make loadTransactionHistory available globally
    window.loadTransactionHistory = loadTransactionHistory;
  
    // Function to load transaction history
    async function loadTransactionHistory() {
        console.log("Loading transaction history...");
  
        // Get containers for verification
        const debitContainer = document.getElementById("debit-transactions");
        const creditContainer = document.getElementById("credit-transactions");
        
        if (!debitContainer || !creditContainer) {
            console.error("Transaction containers not found in DOM");
            return;
        }
  
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        if (!currentUser || !currentUser.id) {
            console.error("No user logged in");
            showError("Please log in to view transactions");
            return;
        }
  
        try {
            // Show loading state
            debitContainer.innerHTML = '<p>Loading transactions...</p>';
            creditContainer.innerHTML = '<p>Loading transactions...</p>';
            
            // Fetch both credit and debit transactions
            const [debitData, creditData] = await Promise.all([
                fetchDebitTransactions(currentUser.id),
                fetchCreditTransactions(currentUser.id)
            ]);
  
            console.log("Retrieved transactions:", { debit: debitData.length, credit: creditData.length });
            
            displayTransactions(debitData, creditData);
            setupDateFilter(currentUser.id);
            setDefaultDateRange();
        } catch (error) {
            console.error("Error loading transactions:", error);
            showError("Failed to load transactions. Please try again.");
        }
    }
  
    // Function to fetch debit transactions
    async function fetchDebitTransactions(userId) {
        try {
            const response = await fetch(`http://localhost:3000/get-entries?user_id=${userId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch debit transactions: ${response.status}`);
            }
            const data = await response.json();
            console.log("Debit data retrieved:", data);
            return data.entries?.debit || [];
        } catch (error) {
            console.error("Error in fetchDebitTransactions:", error);
            return [];
        }
    }
  
    // Function to fetch credit transactions
    async function fetchCreditTransactions(userId) {
        try {
            const response = await fetch(`http://localhost:3000/get-entries?user_id=${userId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch credit transactions: ${response.status}`);
            }
            const data = await response.json();
            console.log("Credit data retrieved:", data);
            return data.entries?.credit || [];
        } catch (error) {
            console.error("Error in fetchCreditTransactions:", error);
            return [];
        }
    }
  
    // Function to display transactions in two columns
    function displayTransactions(debitTransactions, creditTransactions) {
        const debitContainer = document.getElementById("debit-transactions");
        const creditContainer = document.getElementById("credit-transactions");
  
        if (!debitContainer || !creditContainer) {
            console.error("Transaction containers not found");
            return;
        }
  
        // Clear existing content
        debitContainer.innerHTML = '';
        creditContainer.innerHTML = '';
  
        // Display debit transactions
        if (!debitTransactions || debitTransactions.length === 0) {
            debitContainer.innerHTML = '<p class="no-transactions">No debit transactions found</p>';
        } else {
            debitTransactions.forEach(transaction => {
                debitContainer.appendChild(createTransactionItem(transaction, 'debit'));
            });
        }
  
        // Display credit transactions
        if (!creditTransactions || creditTransactions.length === 0) {
            creditContainer.innerHTML = '<p class="no-transactions">No credit transactions found</p>';
        } else {
            creditTransactions.forEach(transaction => {
                creditContainer.appendChild(createTransactionItem(transaction, 'credit'));
            });
        }
    }
  
    // Function to create a transaction item
    function createTransactionItem(transaction, type) {
        if (!transaction) return document.createElement("div");
        
        const formattedDate = new Date(transaction.entry_date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
  
        const item = document.createElement("div");
        item.className = `transaction-item ${type}-item`;
  
        item.innerHTML = `
            <div class="transaction-details">
                <div class="transaction-category">${transaction.category || 'Uncategorized'}</div>
                <div class="transaction-date">${formattedDate}</div>
                ${transaction.description ? `<div class="transaction-description">${transaction.description}</div>` : ''}
            </div>
            <div class="transaction-amount ${type}-amount">
                ${type === 'credit' ? '+' : '-'}$${parseFloat(transaction.amount || 0).toFixed(2)}
            </div>
        `;
  
        return item;
    }
  
    // Function to setup date filtering
    function setupDateFilter(userId) {
        const fromDateInput = document.querySelector(".swiper-slide:nth-child(2) .from-date");
        const toDateInput = document.querySelector(".swiper-slide:nth-child(2) .to-date");
  
        if (!fromDateInput || !toDateInput) {
            console.error("Date filter inputs not found");
            return;
        }
  
        const filterTransactions = async () => {
            const fromDate = fromDateInput.value ? new Date(fromDateInput.value) : null;
            const toDate = toDateInput.value ? new Date(toDateInput.value) : null;
  
            try {
                // Show loading state
                document.getElementById("debit-transactions").innerHTML = '<p>Filtering transactions...</p>';
                document.getElementById("credit-transactions").innerHTML = '<p>Filtering transactions...</p>';
                
                // Fetch transactions with date filtering
                const [filteredDebits, filteredCredits] = await Promise.all([
                    fetchFilteredTransactions(userId, 'debit', fromDate, toDate),
                    fetchFilteredTransactions(userId, 'credit', fromDate, toDate)
                ]);
                
                displayTransactions(filteredDebits, filteredCredits);
            } catch (error) {
                console.error("Error filtering transactions:", error);
            }
        };
  
        fromDateInput.addEventListener("change", filterTransactions);
        toDateInput.addEventListener("change", filterTransactions);
    }
  
    // Function to fetch filtered transactions
    async function fetchFilteredTransactions(userId, type, fromDate, toDate) {
        try {
            let url = `http://localhost:3000/get-entries?user_id=${userId}`;
            
            // Add date filters if provided
            if (fromDate) {
                url += `&from_date=${fromDate.toISOString().split('T')[0]}`;
            }
            if (toDate) {
                url += `&to_date=${toDate.toISOString().split('T')[0]}`;
            }
  
            console.log("Fetching filtered transactions:", url);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${type} transactions: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Filtered ${type} data:`, data);
            return data.entries?.[type] || [];
        } catch (error) {
            console.error(`Error fetching filtered ${type} transactions:`, error);
            return [];
        }
    }
  
    // Helper function to set default date range (last 30 days)
    function setDefaultDateRange() {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
  
        const fromDateInput = document.querySelector(".swiper-slide:nth-child(2) .from-date");
        const toDateInput = document.querySelector(".swiper-slide:nth-child(2) .to-date");
  
        if (fromDateInput && toDateInput) {
            fromDateInput.value = formatDateForInput(thirtyDaysAgo);
            toDateInput.value = formatDateForInput(today);
            
            // Trigger change event to load filtered data
            const event = new Event('change');
            fromDateInput.dispatchEvent(event);
        }
    }
  
    // Helper function to format date for input
    function formatDateForInput(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }
  
    // Function to show error message
    function showError(message) {
        const secondSlide = document.querySelector(".swiper-slide:nth-child(2)");
        if (!secondSlide) return;
        
        secondSlide.innerHTML = `
            <div class="date-picker-container">
                <label for="from-date-2">From Date:</label>
                <input type="date" id="from-date-2" class="from-date">
                <label for="to-date-2">To Date:</label>
                <input type="date" id="to-date-2" class="to-date">
            </div>
            <div class="transaction-history-container">
                <div class="error-message" style="color: red; text-align: center; width: 100%; padding: 20px;">
                    ${message}
                    <button onclick="window.loadTransactionHistory()" style="padding: 5px 10px; margin-top: 10px;">Retry</button>
                </div>
            </div>
            <button class="small-btn">Export PDF</button>
        `;
    }
  
    // Add a direct button to reload transactions for debugging
    const secondSlide = document.querySelector(".swiper-slide:nth-child(2)");
    if (secondSlide) {
        const reloadButton = document.createElement("button");
        reloadButton.textContent = "Reload Transactions";
        reloadButton.style.marginTop = "10px";
        reloadButton.className = "small-btn";
        reloadButton.addEventListener("click", loadTransactionHistory);
        secondSlide.appendChild(reloadButton);
    }
  
    // Try to load transactions initially if we're on slide 2
    if (document.querySelector(".swiper-slide:nth-child(2).swiper-slide-active")) {
        setTimeout(() => loadTransactionHistory(), 500);
    }
  });