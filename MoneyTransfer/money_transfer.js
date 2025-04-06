document.addEventListener("DOMContentLoaded", () => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    
    if (!currentUser) {
      window.location.href = "../LoginPage/Login.html";
      return;
    }
  
    // Initialize UI
    initializeUI();
    loadWalletBalance();
    setupEventListeners();
    checkPendingTransfers();
    initModals()
  });
  
  function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = "flex";
        setTimeout(() => {
            modal.style.opacity = "1";
        }, 10);
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.opacity = "0";
        setTimeout(() => {
            modal.style.display = "none";
        }, 300);
    }
}

// Initialize modal event listeners
function initModals() {
    // Show modals
    document.getElementById("add-debt-btn")?.addEventListener("click", () => showModal("entry-modal"));
    document.getElementById("add-expense-btn")?.addEventListener("click", () => showModal("debit-modal"));
    
    // Close modals when clicking X button
    document.querySelectorAll(".modal-overlay .close-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            const modal = this.closest(".modal-overlay");
            hideModal(modal.id);
        });
    });
    
    // Close modals when clicking outside
    document.querySelectorAll(".modal-overlay").forEach(modal => {
        modal.addEventListener("click", function(e) {
            if (e.target === this) {
                hideModal(this.id);
            }
        });
    });
    
    // Close modals when pressing Escape key
    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape") {
            document.querySelectorAll(".modal-overlay").forEach(modal => {
                if (modal.style.display === "flex") {
                    hideModal(modal.id);
                }
            });
        }
    });
}

  function initializeUI() {
    // Set username
    const usernameTooltip = document.getElementById("username-tooltip");
    if (usernameTooltip) {
      usernameTooltip.textContent = currentUser.name;
    }
  
    // Set today's date in date pickers
    const today = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="date"]').forEach(input => {
      input.value = today;
      input.max = today;
    });
  }
  
  function loadWalletBalance() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    fetch(`http://localhost:3000/get-wallet-balance/${currentUser.id}`)
      .then(response => response.json())
      .then(data => {
        const walletBalanceElement = document.getElementById("wallet-balance");
        if (walletBalanceElement) {
          walletBalanceElement.textContent = `$${Number(data.balance || 0).toFixed(2)}`;
        }
      })
      .catch(error => console.error("Error fetching wallet balance:", error));
  }
  
  function setupEventListeners() {

    document.getElementById("addButton")?.addEventListener("click", function(e) {
        e.stopPropagation();
        const options = document.getElementById("addOptions");
        options.style.display = options.style.display === "flex" ? "none" : "flex";
        this.classList.toggle("active");
    });

    // Close options when clicking outside
    document.addEventListener("click", function(e) {
        const addButton = document.getElementById("addButton");
        const addOptions = document.getElementById("addOptions");
        
        if (!addButton.contains(e.target) && !addOptions.contains(e.target)) {
            addOptions.style.display = "none";
            addButton.classList.remove("active");
        }
    });

    // Add debt transfer option
    document.getElementById("add-debt-btn")?.addEventListener("click", function() {
        document.getElementById("addOptions").style.display = "none";
        document.getElementById("addButton").classList.remove("active");
        document.getElementById("entry-modal").style.display = "flex";
    });

    // Add expense transfer option
    document.getElementById("add-expense-btn")?.addEventListener("click", function() {
        document.getElementById("addOptions").style.display = "none";
        document.getElementById("addButton").classList.remove("active");
        document.getElementById("debit-modal").style.display = "flex";
    });
    // Transfer as Debt
    document.getElementById("add-entry-btn")?.addEventListener("click", () => {
      document.getElementById("entry-modal").style.display = "flex";
    });
  
    document.getElementById("close-modal")?.addEventListener("click", () => {
      document.getElementById("entry-modal").style.display = "none";
    });
  
    document.getElementById("save-entry")?.addEventListener("click", () => {
      sendMoneyTransfer("debt");
    });
  
    // Transfer as Expense
    document.getElementById("debit-entry-btn")?.addEventListener("click", () => {
      document.getElementById("debit-modal").style.display = "flex";
    });
  
    document.getElementById("close-debit-modal")?.addEventListener("click", () => {
      document.getElementById("debit-modal").style.display = "none";
    });
  
    document.getElementById("save-debit")?.addEventListener("click", () => {
      sendMoneyTransfer("expense");
    });
  
    // Transfer History
    document.getElementById("transfer-history-btn")?.addEventListener("click", showTransferHistory);

    document.getElementById("logout-btn")?.addEventListener("click", handleLogout);
    
  }
  function handleLogout() {
    // Clear user data from localStorage
    localStorage.removeItem("currentUser");
    
    // Optional: Clear any other user-related data
    localStorage.removeItem("userToken");
    localStorage.removeItem("walletBalance");
    
    // Redirect to login page
    window.location.href = "../LoginPage/Login.html";
    
    setTimeout(() => {
         window.location.href = "../LoginPage/Login.html";
     }, 500);
}
  
async function sendMoneyTransfer(transferType) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    const isDebt = transferType === "debt";
    
    const emailField = isDebt ? "username-debt" : "username-expense";
    const amountField = isDebt ? "entry-amount" : "debit-amount";
    const descField = isDebt ? "entry-description" : "debit-description";
    const modalId = isDebt ? "entry-modal" : "debit-modal";
    
    const recipientEmail = document.getElementById(emailField).value;
    const amount = parseFloat(document.getElementById(amountField).value);
    const description = document.getElementById(descField).value;
    
    if (!recipientEmail || !amount || amount <= 0) {
        alert("Please enter valid recipient email and amount");
        return;
    }
    
    try {
        // Check if recipient exists
        const userCheck = await fetch(`http://localhost:3000/check-user-exists?email=${encodeURIComponent(recipientEmail)}`);
        const userData = await userCheck.json();
        
        if (!userData.exists) {
            alert("Recipient not found. Please check the email address.");
            return;
        }
        
        // Create transfer
        const transferResponse = await fetch("http://localhost:3000/create-money-transfer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sender_id: currentUser.id,
                recipient_email: recipientEmail,
                amount: amount,
                description: description,
                transfer_type: transferType
            })
        });
        
        const result = await transferResponse.json();
        
        if (result.success) {
            alert(`Money transfer (${transferType}) initiated successfully!`);
            hideModal(modalId);
            
            // Clear form
            document.getElementById(emailField).value = "";
            document.getElementById(amountField).value = "";
            document.getElementById(descField).value = "";
            
            // Refresh wallet
            loadWalletBalance();
        } else {
            alert(`Error: ${result.message}`);
        }
    } catch (error) {
        console.error("Transfer error:", error);
        alert("An error occurred during transfer");
    }
}
  
  function checkPendingTransfers() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    
    fetch(`http://localhost:3000/get-pending-transfers/${currentUser.id}`)
      .then(response => response.json())
      .then(data => {
        if (data.transfers?.length > 0) {
          showTransferHistory("pending");
        }
      })
      .catch(error => console.error("Error checking pending transfers:", error));
  }
  
  function showTransferHistory(initialTab = "sent") {
    // Create or show modal
    let modal = document.getElementById("history-modal");
    
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "history-modal";
      modal.className = "modal-overlay";
      
      modal.innerHTML = `
        <div class="modal-content" style="width: 80%; max-width: 900px; max-height: 80vh;">
          <div class="modal-header">
            <div class="modal-title">Transfer History</div>
            <div class="close-btn" id="close-history-modal">&times;</div>
          </div>
          
          <div class="modal-body">
            <div class="tabs">
              <button class="tab-btn ${initialTab === 'sent' ? 'active' : ''}" data-tab="sent">Sent</button>
              <button class="tab-btn ${initialTab === 'received' ? 'active' : ''}" data-tab="received">Received</button>
              <button class="tab-btn ${initialTab === 'pending' ? 'active' : ''}" data-tab="pending">Pending</button>
            </div>
            
            <div class="transactions-container">
              <div class="transaction-list" id="sent-transfers"></div>
              <div class="transaction-list" id="received-transfers" style="display: none;"></div>
              <div class="transaction-list" id="pending-transfers" style="display: none;"></div>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Tab switching
      modal.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", function() {
          modal.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
          this.classList.add("active");
          
          document.querySelectorAll(".transaction-list").forEach(list => {
            list.style.display = "none";
          });
          
          const tab = this.getAttribute("data-tab");
          document.getElementById(`${tab}-transfers`).style.display = "block";
          loadTransfers(tab);
        });
      });
      
      // Close button
      modal.querySelector("#close-history-modal").addEventListener("click", () => {
        modal.style.display = "none";
      });
    }
    
    // Show modal and load initial tab
    modal.style.display = "flex";
    loadTransfers(initialTab);
  }
  
  function loadTransfers(type) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    const container = document.getElementById(`${type}-transfers`);
    
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Loading...</div>';
    
    let endpoint;
    switch(type) {
      case 'sent': endpoint = `http://localhost:3000/get-sent-transfers/${currentUser.id}`; break;
      case 'received': endpoint = `http://localhost:3000/get-received-transfers/${currentUser.id}`; break;
      case 'pending': endpoint = `http://localhost:3000/get-pending-transfers/${currentUser.id}`; break;
      default: return;
    }
    
    fetch(endpoint)
      .then(response => response.json())
      .then(data => {
        if (!data.transfers || data.transfers.length === 0) {
          container.innerHTML = '<div class="no-transfers">No transfers found</div>';
          return;
        }
        
        container.innerHTML = '';
        data.transfers.forEach(transfer => {
          const transferEl = createTransferElement(transfer, type);
          container.appendChild(transferEl);
        });
      })
      .catch(error => {
        console.error(`Error loading ${type} transfers:`, error);
        container.innerHTML = `<div class="error">Error loading transfers</div>`;
      });
  }
  
  function createTransferElement(transfer, type) {
    const el = document.createElement("div");
    el.className = "transaction-item";
    
    const date = new Date(transfer.created_at).toLocaleDateString();
    const amount = parseFloat(transfer.amount).toFixed(2);
    const otherParty = type === 'sent' ? transfer.recipient_name : transfer.sender_name;
    
    // Determine icon and color based on transfer type and status
    let iconClass, bgColor;
    if (type === 'pending') {
      iconClass = 'fas fa-clock';
      bgColor = '#FDCB6E'; // yellow
    } else if (transfer.transfer_type === 'debt') {
      iconClass = type === 'sent' ? 'fas fa-hand-holding-usd' : 'fas fa-coins';
      bgColor = type === 'sent' ? '#D63031' : '#00B894'; // red for sent, green for received
    } else {
      iconClass = 'fas fa-exchange-alt';
      bgColor = '#6C5CE7'; // purple
    }
    
    el.innerHTML = `
      <div class="transaction-icon" style="background: ${bgColor}">
        <i class="${iconClass}"></i>
      </div>
      <div class="transaction-details">
        <div class="transaction-title">${otherParty}</div>
        <div class="transaction-category">
          ${transfer.transfer_type} • ${date} • ${transfer.status || ''}
        </div>
        ${transfer.description ? `<div class="transaction-description">${transfer.description}</div>` : ''}
      </div>
      <div class="transaction-amount" style="color: ${type === 'sent' ? '#D63031' : '#00B894'}">
        ${type === 'sent' ? '-' : '+'}$${amount}
      </div>
      ${type === 'pending' && transfer.status === 'pending' ? `
        <div class="transfer-actions">
          <button class="accept-btn" data-transfer-id="${transfer.id}">
            <i class="fas fa-check"></i>
          </button>
          <button class="reject-btn" data-transfer-id="${transfer.id}">
            <i class="fas fa-times"></i>
          </button>
        </div>
      ` : ''}
    `;
    
    // Add event listeners for action buttons
    if (type === 'pending') {
      el.querySelector(".accept-btn")?.addEventListener("click", () => {
        respondToTransfer(transfer.id, "accepted");
      });
      
      el.querySelector(".reject-btn")?.addEventListener("click", () => {
        respondToTransfer(transfer.id, "rejected");
      });
    }
    
    return el;
  }
  
  function respondToTransfer(transferId, action) {
    fetch("http://localhost:3000/respond-to-transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transfer_id: transferId, response: action })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        alert(`Transfer ${action} successfully!`);
        loadWalletBalance();
        loadTransfers("pending");
        loadTransfers("received");
      } else {
        alert(`Error: ${data.message}`);
      }
    })
    .catch(error => {
      console.error("Error responding to transfer:", error);
      alert("Error processing response");
    });
  }

  let requestCheckInterval;

function startRequestPolling() {
  // Check immediately on load
  checkForPendingRequests();
  
  // Then check every 30 seconds
  requestCheckInterval = setInterval(checkForPendingRequests, 30000);
  
  // Clear on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(requestCheckInterval);
  });
}

async function checkForPendingRequests() {
  try {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    if (!currentUser) return;
    
    const response = await fetch(`http://localhost:3000/pending-transfers/${currentUser.id}`);
    const data = await response.json();
    
    if (data.success && data.transfers.length > 0) {
      displayPendingRequests(data.transfers);
    }
  } catch (error) {
    console.error("Error checking requests:", error);
  }
}

function displayPendingRequests(transfers) {
  const container = document.getElementById('pending-requests-container');
  if (!container) return;
  
  container.innerHTML = transfers.map(transfer => `
    <div class="request-card" data-id="${transfer.id}">
      <div class="request-header">
        <span class="sender">${transfer.sender_name}</span>
        <span class="amount">$${transfer.amount.toFixed(2)}</span>
      </div>
      <div class="request-description">${transfer.description || 'No description'}</div>
      <div class="request-actions">
        <button class="accept-btn" data-id="${transfer.id}">Accept</button>
        <button class="reject-btn" data-id="${transfer.id}">Reject</button>
      </div>
    </div>
  `).join('');
  
  // Add event listeners
  document.querySelectorAll('.accept-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      await respondToTransfer(e.target.dataset.id, 'accept');
    });
  });
  
  document.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      await respondToTransfer(e.target.dataset.id, 'reject');
    });
  });
}