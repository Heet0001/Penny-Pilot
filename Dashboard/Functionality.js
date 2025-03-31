<<<<<<< HEAD
document.addEventListener("DOMContentLoaded", function () {
    // --- MODAL ELEMENTS ---
    // Credit Modal Elements
    const creditModal = document.getElementById("entry-modal");
    const addEntryBtn = document.getElementById("add-entry-btn");
    const closeCreditModalBtn = document.getElementById("close-modal");
    const saveCreditBtn = document.getElementById("save-entry");
    
    // Debit Modal Elements
    const debitModal = document.getElementById("debit-modal");
    const debitEntryBtn = document.getElementById("debit-entry-btn");
    const closeDebitModalBtn = document.getElementById("close-debit-modal");
    const saveDebitBtn = document.getElementById("save-debit");
    
    // Wallet Modal Elements
    const walletModal = document.getElementById("wallet-modal");
    const walletBtn = document.getElementById("wallet-btn");
    const closeWalletBtn = document.getElementById("close-wallet-btn");
    const addExpenseBtn = document.getElementById("add-expense-btn");
    const addFundsBtn = document.getElementById("add-funds-btn");
    
    // Emergency Modal Elements
    const emergencyModal = document.getElementById("emergency-modal");
    const emergencyBtn = document.getElementById("emergency-btn");
    const closeEmergencyBtn = document.getElementById("close-emergency-btn");
    const addEmergencyFundsBtn = document.getElementById("add-emergency-funds-btn");
    const withdrawEmergencyBtn = document.getElementById("withdraw-emergency-btn");
    
    // Fund Modal Elements
    const fundModal = document.getElementById("fund-modal");
    const fundModalTitle = document.getElementById("fund-modal-title");
    const cancelFundBtn = document.getElementById("cancel-fund-btn");
    const saveFundBtn = document.getElementById("save-fund-btn");
    
    // Track if modal was opened from wallet
    let openedFromWallet = false;
    
    // Initialize emergency fund balance on page load
    initializeEmergencyFund();
    
    // --- UTILITY FUNCTIONS ---
    
    // Show modal with animation
    function showModal(modal) {
        if (modal) {
            modal.style.display = "flex";
            modal.classList.remove("hidden");
        }
    }
    
    // Hide modal with animation
    function hideModal(modal) {
        if (modal) {
            modal.classList.add("hidden");
            setTimeout(() => {
                modal.style.display = "none";
                modal.classList.remove("hidden"); // Reset for next use
            }, 300); // Match animation duration
        }
    }
    
    // --- CREDIT ENTRY MODAL FUNCTIONS ---
    
    // Open Credit Modal
    if (addEntryBtn) {
        addEntryBtn.addEventListener("click", function () {
            showModal(creditModal);
            openedFromWallet = false;
        });
    }
    
    // Close Credit Modal
    if (closeCreditModalBtn) {
        closeCreditModalBtn.addEventListener("click", function () {
            hideModal(creditModal);
            // Return to wallet if opened from there
            if (openedFromWallet) {
                showModal(walletModal);
            }
        });
    }
    
    // Handle credit form submission
    if (saveCreditBtn) {
        saveCreditBtn.addEventListener("click", function () {
            const amountInput = document.getElementById("entry-amount");
            const categoryInput = document.getElementById("entry-category");
            const dateInput = document.getElementById("entry-date");
            const descriptionInput = document.getElementById("entry-description");
            
            // Get selected date before resetting
            const selectedDate = dateInput.value;
            
            if (amountInput.value && selectedDate) {
                // Get current user from localStorage
                const currentUser = JSON.parse(localStorage.getItem("currentUser"));
                
                if (!currentUser || !currentUser.id) {
                    alert("User not logged in. Please log in again.");
                    return;
                }
                
                // Prepare data for submission
                const creditData = { 
                    user_id: currentUser.id,
                    amount: amountInput.value, 
                    category: categoryInput.value, 
                    entry_date: selectedDate, 
                    description: descriptionInput.value 
                };
                
                // Send data to server
                fetch('http://localhost:3000/add-credit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(creditData),
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    console.log("Entry Saved Successfully:", data);
                    alert("Credit entry added successfully!");
                    
                    // Update wallet balance
                    updateWalletBalance(amountInput.value, true);
                    
                    // If the category is "From Emergency", update emergency fund balance
                    if (categoryInput.value === "From Emergency") {
                        updateEmergencyFundBalance(amountInput.value, false);
                    }
                    
                    // Reset fields except for date
                    amountInput.value = "";
                    categoryInput.selectedIndex = 0;
                    descriptionInput.value = "";
                    
                    // Keep the selected date
                    dateInput.value = selectedDate;
                    
                    // Hide modal
                    hideModal(creditModal);
                    
                    // Return to wallet if opened from there
                    if (openedFromWallet) {
                        showModal(walletModal);
                        displayWalletBalance(); // Refresh balance display
                    }
                })
                .catch((error) => {
                    console.error('Error saving credit entry:', error);
                    alert("Failed to save entry. Please try again.");
                });
            } else {
                alert("Please fill in the required fields (Amount & Date)!");
            }
        });
    }
    
    // --- DEBIT ENTRY MODAL FUNCTIONS ---
    
    // Open debit Modal
    if (debitEntryBtn) {
        debitEntryBtn.addEventListener("click", function () {
            showModal(debitModal);
            openedFromWallet = false;
        });
    }
    
    // Close debit Modal
    if (closeDebitModalBtn) {
        closeDebitModalBtn.addEventListener("click", function () {
            hideModal(debitModal);
            
            // Return to wallet if opened from there
            if (openedFromWallet) {
                showModal(walletModal);
            }
        });
    }
  
// Save debit entry
if (saveDebitBtn) {
    saveDebitBtn.addEventListener("click", function () {
        const amountInput = document.getElementById("debit-amount");
        const categoryInput = document.getElementById("debit-category");
        const dateInput = document.getElementById("debit-date");
        const descriptionInput = document.getElementById("debit-description");
        
        if (amountInput && dateInput && amountInput.value && dateInput.value) {
            // Get current user from localStorage
            const currentUser = JSON.parse(localStorage.getItem("currentUser"));
            
            if (!currentUser || !currentUser.id) {
                alert("User not logged in. Please log in again.");
                return;
            }
            
            const amount = parseFloat(amountInput.value).toFixed(2);
            
            // Prepare data for submission
            const debitData = {
                user_id: currentUser.id,
                amount: amount,
                category: categoryInput.value,
                entry_date: dateInput.value,
                description: descriptionInput.value || ''
            };
            
            console.log("Sending debit data:", debitData); // Debug
            
            // Send data to server
            fetch('http://localhost:3000/add-debit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(debitData),
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok: ' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                console.log("Debit Entry Saved Successfully:", data);
                
                // Update wallet balance (deduct from wallet)
                updateWalletBalance(amount, false);
                
                // Check if category is "Emergency" to update emergency fund
                if (categoryInput.value === "Emergency") {
                    // Update emergency fund balance directly from the response
                    if (data.emergency_balance !== undefined) {
                        localStorage.setItem(`emergency_fund_${currentUser.id}`, data.emergency_balance.toFixed(2));
                        displayEmergencyFundBalance();
                    } else {
                        // Fallback to local update if server didn't return the balance
                        updateEmergencyFundBalance(amount, true);
                    }
                    
                    alert("Debit entry added successfully and emergency fund updated!");
                } else {
                    alert("Debit entry added successfully!");
                }
                
                // Reset fields
                amountInput.value = "";
                if (categoryInput) categoryInput.selectedIndex = 0;
                dateInput.value = "";
                if (descriptionInput) descriptionInput.value = "";
                
                // Close modal after saving
                hideModal(debitModal);
                
                // Return to wallet if opened from there
                if (openedFromWallet) {
                    showModal(walletModal);
                    displayWalletBalance(); // Refresh balance display
                }
            })
            .catch((error) => {
                console.error('Error saving debit entry:', error);
                alert("Failed to save entry. Please try again.");
            });
        } else {
            alert("Please fill in the required fields (Amount & Date)!");
        }
    });
}
    
    // --- WALLET MODAL FUNCTIONS ---
    
    // Show Wallet Modal
    if (walletBtn) {
        walletBtn.addEventListener("click", function () {
            showModal(walletModal);
            displayWalletBalance(); // Display current balance when opening wallet
        });
    }
    
    // Close Wallet Modal
    if (closeWalletBtn) {
        closeWalletBtn.addEventListener("click", function () {
            hideModal(walletModal);
        });
    }
    
    // Open Debit Funds from Wallet
    if (addExpenseBtn) {
        addExpenseBtn.addEventListener("click", function () {
            hideModal(walletModal);
            showModal(debitModal);
            openedFromWallet = true; // Track wallet origin
        });
    }
    
    // Open Credit Funds from Wallet
    if (addFundsBtn) {
        addFundsBtn.addEventListener("click", function () {
            hideModal(walletModal);
            showModal(creditModal);
            openedFromWallet = true; // Track wallet origin
        });
    }
    
    // --- EMERGENCY MODAL FUNCTIONS ---
    
    // Open Emergency Modal
    if (emergencyBtn) {
        emergencyBtn.addEventListener("click", function () {
            showModal(emergencyModal);
            displayEmergencyFundBalance(); // Display current emergency fund balance
        });
    }
    
    // Close Emergency Modal
    if (closeEmergencyBtn) {
        closeEmergencyBtn.addEventListener("click", function () {
            hideModal(emergencyModal);
        });
    }
    
    // Open Add Emergency Funds Modal
    if (addEmergencyFundsBtn) {
        addEmergencyFundsBtn.addEventListener("click", function() {
            fundModalTitle.textContent = "Add to Emergency Fund";
            
            // Set up the fund modal for adding to emergency fund
            const amountInput = document.getElementById("fund-amount");
            const descriptionInput = document.getElementById("fund-description");
            
            // Clear previous inputs
            if (amountInput) amountInput.value = "";
            if (descriptionInput) descriptionInput.value = "";
            
            // Show the modal
            hideModal(emergencyModal);
            showModal(fundModal);
            
            // Update the save button functionality
            saveFundBtn.onclick = function() {
                const amount = parseFloat(amountInput.value);
                
                if (!amount || isNaN(amount) || amount <= 0) {
                    alert("Please enter a valid amount!");
                    return;
                }
                
                // Get current user
                const currentUser = JSON.parse(localStorage.getItem("currentUser"));
                if (!currentUser) {
                    alert("User not logged in. Please log in again.");
                    return;
                }
                
                // Create a debit entry with emergency category
                const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
                
                const debitData = {
                    user_id: currentUser.id,
                    amount: amount.toFixed(2),
                    category: "Emergency",
                    entry_date: today,
                    description: descriptionInput ? descriptionInput.value || "Emergency Fund Contribution" : "Emergency Fund Contribution"
                };
                
                // Send data to server (debit operation)
                fetch('http://localhost:3000/add-debit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(debitData),
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    // Update wallet balance (deduct from wallet)
                    updateWalletBalance(amount, false);
                    
                    // Add to emergency fund via separate API call
                    const emergencyData = {
                        user_id: currentUser.id,
                        amount: amount.toFixed(2),
                        operation_type: 'add'
                    };
                    
                    return fetch('http://localhost:3000/update-emergency-fund', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(emergencyData),
                    });
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to update emergency fund');
                    }
                    return response.json();
                })
                .then(emergencyResponse => {
                    // Update local emergency fund balance
                    updateEmergencyFundBalance(amount, true);
                    
                    alert("Emergency fund contribution successful!");
                    hideModal(fundModal);
                    showModal(emergencyModal);
                    displayEmergencyFundBalance(); // Refresh emergency fund display
                })
                .catch(error => {
                    console.error('Error adding to emergency fund:', error);
                    alert("Failed to add to emergency fund. Please try again.");
                    hideModal(fundModal);
                    showModal(emergencyModal);
                });
            };
        });
    }
   
// Open Withdraw Emergency Funds Modal
if (withdrawEmergencyBtn) {
    withdrawEmergencyBtn.addEventListener("click", function() {
        fundModalTitle.textContent = "Withdraw from Emergency Fund";
        
        // Set up the fund modal for withdrawing from emergency fund
        const amountInput = document.getElementById("fund-amount");
        const descriptionInput = document.getElementById("fund-description");
        
        // Clear previous inputs
        if (amountInput) amountInput.value = "";
        if (descriptionInput) descriptionInput.value = "";
        
        // Show the modal
        hideModal(emergencyModal);
        showModal(fundModal);
        
        // Update the save button functionality
        saveFundBtn.onclick = function() {
            const amount = parseFloat(amountInput.value);
            
            if (!amount || isNaN(amount) || amount <= 0) {
                alert("Please enter a valid amount!");
                return;
            }
            
            // Check if withdrawal amount exceeds emergency fund balance
            if (amount > getEmergencyFundBalance()) {
                alert("Withdrawal amount exceeds emergency fund balance!");
                return;
            }
            
            // Get current user
            const currentUser = JSON.parse(localStorage.getItem("currentUser"));
            if (!currentUser) {
                alert("User not logged in. Please log in again.");
                return;
            }
            
            // Create a credit entry for emergency withdrawal
            const today = new Date().toISOString().split('T')[0]; // Get today's date
            
            const creditData = {
                user_id: currentUser.id,
                amount: amount.toFixed(2),
                category: "From Emergency",
                entry_date: today,
                description: descriptionInput ? descriptionInput.value || "Emergency Fund Withdrawal" : "Emergency Fund Withdrawal"
            };
            
            // Send data to server (credit operation)
            fetch('http://localhost:3000/add-credit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(creditData),
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Update wallet balance (add to wallet)
                updateWalletBalance(amount, true);
                
                // Update emergency fund balance from response or locally
                if (data.emergency_balance !== undefined) {
                    localStorage.setItem(`emergency_fund_${currentUser.id}`, data.emergency_balance.toFixed(2));
                } else {
                    // Fallback to local update
                    updateEmergencyFundBalance(amount, false);
                }
                
                alert("Emergency fund withdrawal successful!");
                hideModal(fundModal);
                showModal(emergencyModal);
                displayEmergencyFundBalance(); // Refresh emergency fund display
            })
            .catch(error => {
                console.error('Error withdrawing from emergency fund:', error);
                alert("Failed to withdraw from emergency fund. Please try again.");
                hideModal(fundModal);
                showModal(emergencyModal);
            });
        };
    });
}
    
    // Cancel Fund Transaction
    if (cancelFundBtn) {
        cancelFundBtn.addEventListener("click", function () {
            hideModal(fundModal);
            showModal(emergencyModal);
        });
    }
    
    // --- GLOBAL MODAL INTERACTIONS ---
    
    // Close modals when clicking outside
    window.addEventListener("click", function (event) {
        if (event.target === creditModal) {
            hideModal(creditModal);
            if (openedFromWallet) {
                showModal(walletModal);
            }
        } else if (event.target === debitModal) {
            hideModal(debitModal);
            if (openedFromWallet) {
                showModal(walletModal);
            }
        } else if (event.target === walletModal) {
            hideModal(walletModal);
        } else if (event.target === emergencyModal) {
            hideModal(emergencyModal);
        } else if (event.target === fundModal) {
            hideModal(fundModal);
            showModal(emergencyModal);
        }
    });
});

// Function to get current wallet balance
function getWalletBalance() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return 0;
    
    // Get or initialize wallet balance
    return parseFloat(localStorage.getItem(`wallet_balance_${currentUser.id}`) || 0);
}

// Function to update wallet balance
function updateWalletBalance(amount, isCredit = true) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return;
    
    // Get current balance
    let currentBalance = getWalletBalance();
    
    // Update balance (add for credit, subtract for debit)
    if (isCredit) {
        currentBalance += parseFloat(amount);
    } else {
        currentBalance -= parseFloat(amount);
    }
    
    // Save updated balance
    localStorage.setItem(`wallet_balance_${currentUser.id}`, currentBalance.toFixed(2));
    
    // Update display if wallet is open
    const balanceDisplay = document.getElementById("wallet-balance");
    if (balanceDisplay) {
        balanceDisplay.textContent = `$${currentBalance.toFixed(2)}`;
    }
    
    // Update wallet balance in database via API
    const walletData = {
        user_id: currentUser.id,
        balance: currentBalance.toFixed(2)
    };
    
    fetch('http://localhost:3000/update-wallet', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(walletData),
    })
    .then(response => {
        if (!response.ok) {
            console.error('Error updating wallet in database');
        }
        return response.json();
    })
    .catch(error => {
        console.error('Error updating wallet:', error);
    });
}

// Function to display wallet balance when modal opens
function displayWalletBalance() {
    const balanceDisplay = document.getElementById("wallet-balance");
    if (balanceDisplay) {
        balanceDisplay.textContent = `$${getWalletBalance().toFixed(2)}`;
    }
}

// Function to get emergency fund balance
function getEmergencyFundBalance() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return 0;
    
    // Get or initialize emergency fund balance
    return parseFloat(localStorage.getItem(`emergency_fund_${currentUser.id}`) || 0);
}

// Initialize emergency fund balance from localStorage or database
function initializeEmergencyFund() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return;
    
    // First try to get from localStorage
    let emergencyFundBalance = getEmergencyFundBalance();
    
    // If we have a current user, fetch the latest from the database
    fetch(`http://localhost:3000/get-emergency-fund/${currentUser.id}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch emergency fund data');
            }
            return response.json();
        })
        .then(data => {
            if (data && data.balance) {
                // Update localStorage with latest database value
                localStorage.setItem(`emergency_fund_${currentUser.id}`, data.balance.toFixed(2));
                // Display updated balance
                displayEmergencyFundBalance();
            }
        })
        .catch(error => {
            console.error('Error fetching emergency fund data:', error);
            // If there's an error, just use what we have in localStorage
            displayEmergencyFundBalance();
        });
}

function updateEmergencyFundBalance(amount, isAddition = true) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return;
    
    // Get current balance
    let currentBalance = getEmergencyFundBalance();
    
    // Update the balance
    if (isAddition) {
        currentBalance += parseFloat(amount);
    } else {
        currentBalance -= parseFloat(amount);
        
        // Don't allow negative emergency fund
        if (currentBalance < 0) currentBalance = 0;
    }
    // Save to localStorage
    localStorage.setItem(`emergency_fund_${currentUser.id}`, currentBalance.toFixed(2));
    
    // Update display
    displayEmergencyFundBalance();
}

// Function to display emergency fund balance
function displayEmergencyFundBalance() {
    const emergencyBalanceDisplay = document.getElementById("emergency-balance");
    if (emergencyBalanceDisplay) {
        emergencyBalanceDisplay.textContent = `$${getEmergencyFundBalance().toFixed(2)}`;
    }
}




// This code should be added to one of your JavaScript files (like Dashboard_script.js)
document.addEventListener('DOMContentLoaded', function() {
    // Get all navigation buttons
    const navButtons = document.querySelectorAll('.nav-btn');
    
    // Add click event listener to each navigation button
    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            const index = this.getAttribute('data-index');
            
            // For buttons with data-index attribute
            if (index !== null) {
                switch(index) {
                    case "0": // Expenditure - redirect to dashboard.html
                        window.location.href = '../Dashboard/dashboard.html';
                        break;
                    case "3": // Transfer Money
                        window.location.href = '../MoneyTransfer/moneytransfer.html';
                        break;
                }
            }
            // For the Investments button
            else if (this.textContent.trim() === 'Investments') {
                window.location.href = '../Investment/Investments.html';
            }
            // For the Debts button
            else if (this.textContent.trim() === 'Debts') {
                window.location.href = '../Debts/debts.html';
            }
            // For the Transfer Money button (added explicit check)
            else if (this.textContent.trim() === 'Transfer Money') {
                window.location.href = '../MoneyTransfer/moneytransfer.html';
            }
        });
    });
});
=======
document.addEventListener("DOMContentLoaded", function () {
    // --- MODAL ELEMENTS ---
    // Credit Modal Elements
    const creditModal = document.getElementById("entry-modal");
    const addEntryBtn = document.getElementById("add-entry-btn");
    const closeCreditModalBtn = document.getElementById("close-modal");
    const saveCreditBtn = document.getElementById("save-entry");
    
    // Debit Modal Elements
    const debitModal = document.getElementById("debit-modal");
    const debitEntryBtn = document.getElementById("debit-entry-btn");
    const closeDebitModalBtn = document.getElementById("close-debit-modal");
    const saveDebitBtn = document.getElementById("save-debit");
    
    // Wallet Modal Elements
    const walletModal = document.getElementById("wallet-modal");
    const walletBtn = document.getElementById("wallet-btn");
    const closeWalletBtn = document.getElementById("close-wallet-btn");
    const addExpenseBtn = document.getElementById("add-expense-btn");
    const addFundsBtn = document.getElementById("add-funds-btn");
    
    // Emergency Modal Elements
    const emergencyModal = document.getElementById("emergency-modal");
    const emergencyBtn = document.getElementById("emergency-btn");
    const closeEmergencyBtn = document.getElementById("close-emergency-btn");
    const addEmergencyFundsBtn = document.getElementById("add-emergency-funds-btn");
    const withdrawEmergencyBtn = document.getElementById("withdraw-emergency-btn");
    
    // Fund Modal Elements
    const fundModal = document.getElementById("fund-modal");
    const fundModalTitle = document.getElementById("fund-modal-title");
    const cancelFundBtn = document.getElementById("cancel-fund-btn");
    const saveFundBtn = document.getElementById("save-fund-btn");
    
    // Track if modal was opened from wallet
    let openedFromWallet = false;
    
    // Initialize emergency fund balance on page load
    initializeEmergencyFund();
    
    // --- UTILITY FUNCTIONS ---
    
    // Show modal with animation
    function showModal(modal) {
        if (modal) {
            modal.style.display = "flex";
            modal.classList.remove("hidden");
        }
    }
    
    // Hide modal with animation
    function hideModal(modal) {
        if (modal) {
            modal.classList.add("hidden");
            setTimeout(() => {
                modal.style.display = "none";
                modal.classList.remove("hidden"); // Reset for next use
            }, 300); // Match animation duration
        }
    }
    
    // --- CREDIT ENTRY MODAL FUNCTIONS ---
    
    // Open Credit Modal
    if (addEntryBtn) {
        addEntryBtn.addEventListener("click", function () {
            showModal(creditModal);
            openedFromWallet = false;
        });
    }
    
    // Close Credit Modal
    if (closeCreditModalBtn) {
        closeCreditModalBtn.addEventListener("click", function () {
            hideModal(creditModal);
            // Return to wallet if opened from there
            if (openedFromWallet) {
                showModal(walletModal);
            }
        });
    }
    
    // Handle credit form submission
    if (saveCreditBtn) {
        saveCreditBtn.addEventListener("click", function () {
            const amountInput = document.getElementById("entry-amount");
            const categoryInput = document.getElementById("entry-category");
            const dateInput = document.getElementById("entry-date");
            const descriptionInput = document.getElementById("entry-description");
            
            // Get selected date before resetting
            const selectedDate = dateInput.value;
            
            if (amountInput.value && selectedDate) {
                // Get current user from localStorage
                const currentUser = JSON.parse(localStorage.getItem("currentUser"));
                
                if (!currentUser || !currentUser.id) {
                    alert("User not logged in. Please log in again.");
                    return;
                }
                
                // Prepare data for submission
                const creditData = { 
                    user_id: currentUser.id,
                    amount: amountInput.value, 
                    category: categoryInput.value, 
                    entry_date: selectedDate, 
                    description: descriptionInput.value 
                };
                
                // Send data to server
                fetch('http://localhost:3000/add-credit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(creditData),
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    console.log("Entry Saved Successfully:", data);
                    alert("Credit entry added successfully!");
                    
                    // Update wallet balance
                    updateWalletBalance(amountInput.value, true);
                    
                    // If the category is "From Emergency", update emergency fund balance
                    if (categoryInput.value === "From Emergency") {
                        updateEmergencyFundBalance(amountInput.value, false);
                    }
                    
                    // Reset fields except for date
                    amountInput.value = "";
                    categoryInput.selectedIndex = 0;
                    descriptionInput.value = "";
                    
                    // Keep the selected date
                    dateInput.value = selectedDate;
                    
                    // Hide modal
                    hideModal(creditModal);
                    
                    // Return to wallet if opened from there
                    if (openedFromWallet) {
                        showModal(walletModal);
                        displayWalletBalance(); // Refresh balance display
                    }
                })
                .catch((error) => {
                    console.error('Error saving credit entry:', error);
                    alert("Failed to save entry. Please try again.");
                });
            } else {
                alert("Please fill in the required fields (Amount & Date)!");
            }
        });
    }
    
    // --- DEBIT ENTRY MODAL FUNCTIONS ---
    
    // Open debit Modal
    if (debitEntryBtn) {
        debitEntryBtn.addEventListener("click", function () {
            showModal(debitModal);
            openedFromWallet = false;
        });
    }
    
    // Close debit Modal
    if (closeDebitModalBtn) {
        closeDebitModalBtn.addEventListener("click", function () {
            hideModal(debitModal);
            
            // Return to wallet if opened from there
            if (openedFromWallet) {
                showModal(walletModal);
            }
        });
    }
  
// Save debit entry
if (saveDebitBtn) {
    saveDebitBtn.addEventListener("click", function () {
        const amountInput = document.getElementById("debit-amount");
        const categoryInput = document.getElementById("debit-category");
        const dateInput = document.getElementById("debit-date");
        const descriptionInput = document.getElementById("debit-description");
        
        if (amountInput && dateInput && amountInput.value && dateInput.value) {
            // Get current user from localStorage
            const currentUser = JSON.parse(localStorage.getItem("currentUser"));
            
            if (!currentUser || !currentUser.id) {
                alert("User not logged in. Please log in again.");
                return;
            }
            
            const amount = parseFloat(amountInput.value).toFixed(2);
            
            // Prepare data for submission
            const debitData = {
                user_id: currentUser.id,
                amount: amount,
                category: categoryInput.value,
                entry_date: dateInput.value,
                description: descriptionInput.value || ''
            };
            
            console.log("Sending debit data:", debitData); // Debug
            
            // Send data to server
            fetch('http://localhost:3000/add-debit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(debitData),
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok: ' + response.statusText);
                }
                return response.json();
            })
            .then(data => {
                console.log("Debit Entry Saved Successfully:", data);
                
                // Update wallet balance (deduct from wallet)
                updateWalletBalance(amount, false);
                
                // Check if category is "Emergency" to update emergency fund
                if (categoryInput.value === "Emergency") {
                    // Update emergency fund balance directly from the response
                    if (data.emergency_balance !== undefined) {
                        localStorage.setItem(`emergency_fund_${currentUser.id}`, data.emergency_balance.toFixed(2));
                        displayEmergencyFundBalance();
                    } else {
                        // Fallback to local update if server didn't return the balance
                        updateEmergencyFundBalance(amount, true);
                    }
                    
                    alert("Debit entry added successfully and emergency fund updated!");
                } else {
                    alert("Debit entry added successfully!");
                }
                
                // Reset fields
                amountInput.value = "";
                if (categoryInput) categoryInput.selectedIndex = 0;
                dateInput.value = "";
                if (descriptionInput) descriptionInput.value = "";
                
                // Close modal after saving
                hideModal(debitModal);
                
                // Return to wallet if opened from there
                if (openedFromWallet) {
                    showModal(walletModal);
                    displayWalletBalance(); // Refresh balance display
                }
            })
            .catch((error) => {
                console.error('Error saving debit entry:', error);
                alert("Failed to save entry. Please try again.");
            });
        } else {
            alert("Please fill in the required fields (Amount & Date)!");
        }
    });
}
    
    // --- WALLET MODAL FUNCTIONS ---
    
    // Show Wallet Modal
    if (walletBtn) {
        walletBtn.addEventListener("click", function () {
            showModal(walletModal);
            displayWalletBalance(); // Display current balance when opening wallet
        });
    }
    
    // Close Wallet Modal
    if (closeWalletBtn) {
        closeWalletBtn.addEventListener("click", function () {
            hideModal(walletModal);
        });
    }
    
    // Open Debit Funds from Wallet
    if (addExpenseBtn) {
        addExpenseBtn.addEventListener("click", function () {
            hideModal(walletModal);
            showModal(debitModal);
            openedFromWallet = true; // Track wallet origin
        });
    }
    
    // Open Credit Funds from Wallet
    if (addFundsBtn) {
        addFundsBtn.addEventListener("click", function () {
            hideModal(walletModal);
            showModal(creditModal);
            openedFromWallet = true; // Track wallet origin
        });
    }
    
    // --- EMERGENCY MODAL FUNCTIONS ---
    
    // Open Emergency Modal
    if (emergencyBtn) {
        emergencyBtn.addEventListener("click", function () {
            showModal(emergencyModal);
            displayEmergencyFundBalance(); // Display current emergency fund balance
        });
    }
    
    // Close Emergency Modal
    if (closeEmergencyBtn) {
        closeEmergencyBtn.addEventListener("click", function () {
            hideModal(emergencyModal);
        });
    }
    
    // Open Add Emergency Funds Modal
    if (addEmergencyFundsBtn) {
        addEmergencyFundsBtn.addEventListener("click", function() {
            fundModalTitle.textContent = "Add to Emergency Fund";
            
            // Set up the fund modal for adding to emergency fund
            const amountInput = document.getElementById("fund-amount");
            const descriptionInput = document.getElementById("fund-description");
            
            // Clear previous inputs
            if (amountInput) amountInput.value = "";
            if (descriptionInput) descriptionInput.value = "";
            
            // Show the modal
            hideModal(emergencyModal);
            showModal(fundModal);
            
            // Update the save button functionality
            saveFundBtn.onclick = function() {
                const amount = parseFloat(amountInput.value);
                
                if (!amount || isNaN(amount) || amount <= 0) {
                    alert("Please enter a valid amount!");
                    return;
                }
                
                // Get current user
                const currentUser = JSON.parse(localStorage.getItem("currentUser"));
                if (!currentUser) {
                    alert("User not logged in. Please log in again.");
                    return;
                }
                
                // Create a debit entry with emergency category
                const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
                
                const debitData = {
                    user_id: currentUser.id,
                    amount: amount.toFixed(2),
                    category: "Emergency",
                    entry_date: today,
                    description: descriptionInput ? descriptionInput.value || "Emergency Fund Contribution" : "Emergency Fund Contribution"
                };
                
                // Send data to server (debit operation)
                fetch('http://localhost:3000/add-debit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(debitData),
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    // Update wallet balance (deduct from wallet)
                    updateWalletBalance(amount, false);
                    
                    // Add to emergency fund via separate API call
                    const emergencyData = {
                        user_id: currentUser.id,
                        amount: amount.toFixed(2),
                        operation_type: 'add'
                    };
                    
                    return fetch('http://localhost:3000/update-emergency-fund', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(emergencyData),
                    });
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to update emergency fund');
                    }
                    return response.json();
                })
                .then(emergencyResponse => {
                    // Update local emergency fund balance
                    updateEmergencyFundBalance(amount, true);
                    
                    alert("Emergency fund contribution successful!");
                    hideModal(fundModal);
                    showModal(emergencyModal);
                    displayEmergencyFundBalance(); // Refresh emergency fund display
                })
                .catch(error => {
                    console.error('Error adding to emergency fund:', error);
                    alert("Failed to add to emergency fund. Please try again.");
                    hideModal(fundModal);
                    showModal(emergencyModal);
                });
            };
        });
    }
   
// Open Withdraw Emergency Funds Modal
if (withdrawEmergencyBtn) {
    withdrawEmergencyBtn.addEventListener("click", function() {
        fundModalTitle.textContent = "Withdraw from Emergency Fund";
        
        // Set up the fund modal for withdrawing from emergency fund
        const amountInput = document.getElementById("fund-amount");
        const descriptionInput = document.getElementById("fund-description");
        
        // Clear previous inputs
        if (amountInput) amountInput.value = "";
        if (descriptionInput) descriptionInput.value = "";
        
        // Show the modal
        hideModal(emergencyModal);
        showModal(fundModal);
        
        // Update the save button functionality
        saveFundBtn.onclick = function() {
            const amount = parseFloat(amountInput.value);
            
            if (!amount || isNaN(amount) || amount <= 0) {
                alert("Please enter a valid amount!");
                return;
            }
            
            // Check if withdrawal amount exceeds emergency fund balance
            if (amount > getEmergencyFundBalance()) {
                alert("Withdrawal amount exceeds emergency fund balance!");
                return;
            }
            
            // Get current user
            const currentUser = JSON.parse(localStorage.getItem("currentUser"));
            if (!currentUser) {
                alert("User not logged in. Please log in again.");
                return;
            }
            
            // Create a credit entry for emergency withdrawal
            const today = new Date().toISOString().split('T')[0]; // Get today's date
            
            const creditData = {
                user_id: currentUser.id,
                amount: amount.toFixed(2),
                category: "From Emergency",
                entry_date: today,
                description: descriptionInput ? descriptionInput.value || "Emergency Fund Withdrawal" : "Emergency Fund Withdrawal"
            };
            
            // Send data to server (credit operation)
            fetch('http://localhost:3000/add-credit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(creditData),
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Update wallet balance (add to wallet)
                updateWalletBalance(amount, true);
                
                // Update emergency fund balance from response or locally
                if (data.emergency_balance !== undefined) {
                    localStorage.setItem(`emergency_fund_${currentUser.id}`, data.emergency_balance.toFixed(2));
                } else {
                    // Fallback to local update
                    updateEmergencyFundBalance(amount, false);
                }
                
                alert("Emergency fund withdrawal successful!");
                hideModal(fundModal);
                showModal(emergencyModal);
                displayEmergencyFundBalance(); // Refresh emergency fund display
            })
            .catch(error => {
                console.error('Error withdrawing from emergency fund:', error);
                alert("Failed to withdraw from emergency fund. Please try again.");
                hideModal(fundModal);
                showModal(emergencyModal);
            });
        };
    });
}
    
    // Cancel Fund Transaction
    if (cancelFundBtn) {
        cancelFundBtn.addEventListener("click", function () {
            hideModal(fundModal);
            showModal(emergencyModal);
        });
    }
    
    // --- GLOBAL MODAL INTERACTIONS ---
    
    // Close modals when clicking outside
    window.addEventListener("click", function (event) {
        if (event.target === creditModal) {
            hideModal(creditModal);
            if (openedFromWallet) {
                showModal(walletModal);
            }
        } else if (event.target === debitModal) {
            hideModal(debitModal);
            if (openedFromWallet) {
                showModal(walletModal);
            }
        } else if (event.target === walletModal) {
            hideModal(walletModal);
        } else if (event.target === emergencyModal) {
            hideModal(emergencyModal);
        } else if (event.target === fundModal) {
            hideModal(fundModal);
            showModal(emergencyModal);
        }
    });
});

// Function to get current wallet balance
function getWalletBalance() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return 0;
    
    // Get or initialize wallet balance
    return parseFloat(localStorage.getItem(`wallet_balance_${currentUser.id}`) || 0);
}

// Function to update wallet balance
function updateWalletBalance(amount, isCredit = true) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return;
    
    // Get current balance
    let currentBalance = getWalletBalance();
    
    // Update balance (add for credit, subtract for debit)
    if (isCredit) {
        currentBalance += parseFloat(amount);
    } else {
        currentBalance -= parseFloat(amount);
    }
    
    // Save updated balance
    localStorage.setItem(`wallet_balance_${currentUser.id}`, currentBalance.toFixed(2));
    
    // Update display if wallet is open
    const balanceDisplay = document.getElementById("wallet-balance");
    if (balanceDisplay) {
        balanceDisplay.textContent = `$${currentBalance.toFixed(2)}`;
    }
    
    // Update wallet balance in database via API
    const walletData = {
        user_id: currentUser.id,
        balance: currentBalance.toFixed(2)
    };
    
    fetch('http://localhost:3000/update-wallet', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(walletData),
    })
    .then(response => {
        if (!response.ok) {
            console.error('Error updating wallet in database');
        }
        return response.json();
    })
    .catch(error => {
        console.error('Error updating wallet:', error);
    });
}

// Function to display wallet balance when modal opens
function displayWalletBalance() {
    const balanceDisplay = document.getElementById("wallet-balance");
    if (balanceDisplay) {
        balanceDisplay.textContent = `$${getWalletBalance().toFixed(2)}`;
    }
}

// Function to get emergency fund balance
function getEmergencyFundBalance() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return 0;
    
    // Get or initialize emergency fund balance
    return parseFloat(localStorage.getItem(`emergency_fund_${currentUser.id}`) || 0);
}

// Initialize emergency fund balance from localStorage or database
function initializeEmergencyFund() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return;
    
    // First try to get from localStorage
    let emergencyFundBalance = getEmergencyFundBalance();
    
    // If we have a current user, fetch the latest from the database
    fetch(`http://localhost:3000/get-emergency-fund/${currentUser.id}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch emergency fund data');
            }
            return response.json();
        })
        .then(data => {
            if (data && data.balance) {
                // Update localStorage with latest database value
                localStorage.setItem(`emergency_fund_${currentUser.id}`, data.balance.toFixed(2));
                // Display updated balance
                displayEmergencyFundBalance();
            }
        })
        .catch(error => {
            console.error('Error fetching emergency fund data:', error);
            // If there's an error, just use what we have in localStorage
            displayEmergencyFundBalance();
        });
}

function updateEmergencyFundBalance(amount, isAddition = true) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return;
    
    // Get current balance
    let currentBalance = getEmergencyFundBalance();
    
    // Update the balance
    if (isAddition) {
        currentBalance += parseFloat(amount);
    } else {
        currentBalance -= parseFloat(amount);
        
        // Don't allow negative emergency fund
        if (currentBalance < 0) currentBalance = 0;
    }
    // Save to localStorage
    localStorage.setItem(`emergency_fund_${currentUser.id}`, currentBalance.toFixed(2));
    
    // Update display
    displayEmergencyFundBalance();
}

// Function to display emergency fund balance
function displayEmergencyFundBalance() {
    const emergencyBalanceDisplay = document.getElementById("emergency-balance");
    if (emergencyBalanceDisplay) {
        emergencyBalanceDisplay.textContent = `$${getEmergencyFundBalance().toFixed(2)}`;
    }
}




// This code should be added to one of your JavaScript files (like Dashboard_script.js)
document.addEventListener('DOMContentLoaded', function() {
    // Get all navigation buttons
    const navButtons = document.querySelectorAll('.nav-btn');
    
    // Add click event listener to each navigation button
    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            const index = this.getAttribute('data-index');
            
            // For buttons with data-index attribute
            if (index !== null) {
                switch(index) {
                    case "0": // Expenditure - redirect to dashboard.html
                        window.location.href = '../Dashboard/dashboard.html';
                        break;
                    case "3": // Transfer Money
                        window.location.href = '../MoneyTransfer/moneytransfer.html';
                        break;
                }
            }
            // For the Investments button
            else if (this.textContent.trim() === 'Investments') {
                window.location.href = '../Investment/Investments.html';
            }
            // For the Debts button
            else if (this.textContent.trim() === 'Debts') {
                window.location.href = '../Debts/debts.html';
            }
        });
    });
});



>>>>>>> recovered-branch
