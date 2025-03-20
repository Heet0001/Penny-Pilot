document.addEventListener("DOMContentLoaded", function () {
    const modal = document.getElementById("entry-modal");
    const addEntryBtn = document.getElementById("add-entry-btn");
    const closeModalBtn = document.getElementById("close-modal");

    // Open Modal
    addEntryBtn.addEventListener("click", function () {
        modal.style.display = "flex";
    });

    // Close Modal
    closeModalBtn.addEventListener("click", function () {
        modal.style.display = "none";
    });

    // Close Modal when clicking outside
    window.addEventListener("click", function (event) {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    });

    // Handle form submission
    document.getElementById("save-entry").addEventListener("click", function () {
        const amountInput = document.getElementById("entry-amount");
        const categoryInput = document.getElementById("entry-category");
        const dateInput = document.getElementById("entry-date");
        const descriptionInput = document.getElementById("entry-description");
        const modal = document.getElementById("entry-modal");
    
        // Get selected date before resetting
        const selectedDate = dateInput.value;
    
        if (amountInput.value && selectedDate) {
            console.log("Entry Saved:", { 
                amount: amountInput.value, 
                category: categoryInput.value, 
                date: selectedDate, 
                description: descriptionInput.value 
            });
    
            // Reset fields except for date
            amountInput.value = "";
            categoryInput.selectedIndex = 0;
            descriptionInput.value = "";
    
            // Keep the selected date
            dateInput.value = selectedDate;
    
            // Apply fade-out animation and then hide modal
            modal.classList.add("hidden");
            setTimeout(() => {
                modal.style.display = "none";
                modal.classList.remove("hidden"); // Reset for next use
            }, 300); // Match animation duration
        } else {
            alert("Please fill in the required fields (Amount & Date)!");
        }
    });    
    
});
document.addEventListener("DOMContentLoaded", function () {
    const debitModal = document.getElementById("debit-modal");
    const debitEntryBtn = document.getElementById("debit-entry-btn");
    const closedebitModalBtn = document.getElementById("close-debit-modal");
    const savedebitBtn = document.getElementById("save-debit");
    const entrySelect = document.getElementById("debit-entry-select");


    // Open debit Modal
    debitEntryBtn.addEventListener("click", function () {
        populateDropdown(); // Refresh dropdown list
        debitModal.style.display = "flex";
    });

    // Close debit Modal
    closedebitModalBtn.addEventListener("click", function () {
        debitModal.style.display = "none";
    });

    // Close when clicking outside
    window.addEventListener("click", function (event) {
        if (event.target === debitModal) {
            debitModal.style.display = "none";
        }
    });

    // Populate dropdown with existing entries
    function populateDropdown() {
        entrySelect.innerHTML = `<option value="" disabled selected>Select an entry</option>`; // Reset
        entries.forEach((entry, index) => {
            let option = document.createElement("option");
            option.value = index;
            option.textContent = `${entry.date} - ${entry.category} - $${entry.amount}`;
            entrySelect.appendChild(option);
        });
    }

    // Load selected entry details into form
    entrySelect.addEventListener("change", function () {
        let selectedEntry = entries[this.value];
        document.getElementById("debit-amount").value = selectedEntry.amount;
        document.getElementById("debit-category").value = selectedEntry.category;
        document.getElementById("debit-date").value = selectedEntry.date;
        document.getElementById("debit-description").value = selectedEntry.description;
    });

    // Save debitd entry
    savedebitBtn.addEventListener("click", function () {
        let selectedIndex = entrySelect.value;
        if (selectedIndex === "") {
            alert("Please select an entry to debit.");
            return;
        }

        entries[selectedIndex] = {
            amount: document.getElementById("debit-amount").value,
            category: document.getElementById("debit-category").value,
            date: document.getElementById("debit-date").value,
            description: document.getElementById("debit-description").value
        };

        // Save to local storage
        localStorage.setItem("entries", JSON.stringify(entries));

        alert("Entry debitd successfully!");

        // Close modal after saving
        debitModal.style.display = "none";
    });
});

document.addEventListener("DOMContentLoaded", function () {
    const walletModal = document.getElementById("wallet-modal");
    const walletBtn = document.getElementById("wallet-btn");
    const closeWalletBtn = document.getElementById("close-wallet-btn");
    const addExpenseBtn = document.getElementById("add-expense-btn");
    const addFundsBtn = document.getElementById("add-funds-btn");

    const creditModal = document.getElementById("entry-modal");  // Credit Funds Modal
    const debitModal = document.getElementById("debit-modal");  // Debit Funds Modal

    const closeCreditModal = document.getElementById("close-modal"); // Close Credit
    const saveCreditBtn = document.getElementById("save-entry"); // Save Credit
    const closeDebitModal = document.getElementById("close-debit-modal"); // Close Debit
    const saveDebitBtn = document.getElementById("save-debit"); // Save Debit

    let openedFromWallet = false; // Track if Credit Funds was opened from Wallet

    // Show Wallet Modal
    walletBtn.addEventListener("click", function () {
        walletModal.style.display = "flex";
    });

    // Close Wallet Modal
    closeWalletBtn.addEventListener("click", function () {
        walletModal.classList.add("hidden");
        setTimeout(() => {
            walletModal.style.display = "none";
            walletModal.classList.remove("hidden");
        }, 300);
    });

    // Open Debit Funds (Existing Modal)
    addExpenseBtn.addEventListener("click", function () {
        walletModal.style.display = "none"; // Hide wallet
        debitModal.style.display = "flex"; // Show Debit Funds
        openedFromWallet = true; // Track wallet origin
    });

    // Open Credit Funds (Existing Modal)
    addFundsBtn.addEventListener("click", function () {
        walletModal.style.display = "none"; // Hide wallet
        creditModal.style.display = "flex"; // Show Credit Funds
        openedFromWallet = true; // Track wallet origin
    });

    // Open Credit Funds directly from Dashboard
    document.getElementById("add-entry-btn").addEventListener("click", function () {
        creditModal.style.display = "flex";
        openedFromWallet = false; // Not from Wallet
    });

    // Open Debit Funds directly from Dashboard
    document.getElementById("debit-entry-btn").addEventListener("click", function () {
        debitModal.style.display = "flex";
        openedFromWallet = false; // Not from Wallet
    });

    // Close Credit Funds and Return to Wallet or Dashboard
    function closeCredit() {
        creditModal.style.display = "none";
        if (openedFromWallet) {
            walletModal.style.display = "flex"; // Return to Wallet
        }
    }

    closeCreditModal.addEventListener("click", closeCredit);
    saveCreditBtn.addEventListener("click", closeCredit);

    // Close Debit Funds and Return to Wallet or Dashboard
    function closeDebit() {
        debitModal.style.display = "none";
        if (openedFromWallet) {
            walletModal.style.display = "flex"; // Return to Wallet
        }
    }

    closeDebitModal.addEventListener("click", closeDebit);
    saveDebitBtn.addEventListener("click", closeDebit);

    // Close Wallet when clicking outside
    window.addEventListener("click", function (event) {
        if (event.target === walletModal) {
            walletModal.style.display = "none";
        }
    });

});

document.addEventListener("DOMContentLoaded", function () {
    const emergencyModal = document.getElementById("emergency-modal");
    const emergencyBtn = document.getElementById("emergency-btn");
    const closeEmergencyBtn = document.getElementById("close-emergency-btn");

    // Open Emergency Modal
    emergencyBtn.addEventListener("click", function () {
        emergencyModal.style.display = "flex"; // Ensure it's visible
        emergencyModal.classList.remove("hidden");
    });

    // Close Emergency Modal
    closeEmergencyBtn.addEventListener("click", function () {
        emergencyModal.classList.add("hidden"); 
        setTimeout(() => {
            emergencyModal.style.display = "none"; // Properly reset display
        }, 300);
    });
});


document.addEventListener("DOMContentLoaded", function () {
    const emergencyModal = document.getElementById("emergency-modal");
    const fundModal = document.getElementById("fund-modal");
    const fundModalTitle = document.getElementById("fund-modal-title");
    const closeEmergencyBtn = document.getElementById("close-emergency-btn");
    const addEmergencyFundsBtn = document.getElementById("add-emergency-funds-btn");
    const withdrawEmergencyBtn = document.getElementById("withdraw-emergency-btn");
    const cancelFundBtn = document.getElementById("cancel-fund-btn");
    const saveFundBtn = document.getElementById("save-fund-btn");
    
    function showModal(modal) {
        modal.style.display = "flex";
        modal.classList.remove("hidden");
    }
    
    function hideModal(modal) {
        modal.classList.add("hidden");
        setTimeout(() => modal.style.display = "none", 300);
    }

    addEmergencyFundsBtn.addEventListener("click", function () {
        fundModalTitle.textContent = "Add Fund";
        showModal(fundModal);
    });

    withdrawEmergencyBtn.addEventListener("click", function () {
        fundModalTitle.textContent = "Withdraw Fund";
        showModal(fundModal);
    });

    closeEmergencyBtn.addEventListener("click", function () {
        hideModal(emergencyModal);
    });

    cancelFundBtn.addEventListener("click", function () {
        hideModal(fundModal);
    });

    saveFundBtn.addEventListener("click", function () {
        hideModal(fundModal);
        showModal(emergencyModal);
    });
});