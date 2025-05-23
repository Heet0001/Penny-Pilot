document.addEventListener("DOMContentLoaded", () => {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"))

  if (!currentUser) {
    window.location.href = "../Loginpage/Login.html"
    return
  }

  // Initialize UI
  initializeUI()
  loadWalletBalance()
  setupEventListeners()
  loadRecentTransfers()
  checkPendingTransfers()
  initModal()
})

function showModal(title, type) {
  const modal = document.getElementById("transfer-modal")
  const modalTitle = document.getElementById("transfer-modal-title")
  const transferType = document.getElementById("transfer-type")

  if (modal && modalTitle) {
    modalTitle.textContent = title
    transferType.value = type
    
    // Clear form fields
    document.getElementById("recipient-email").value = ""
    document.getElementById("transfer-amount").value = ""
    document.getElementById("transfer-description").value = ""
    
    // Show/hide debt-specific fields
    const debtFields = document.getElementById("debt-fields")
    if (debtFields) {
      debtFields.style.display = type === "debt" ? "block" : "none"
      
      if (type === "debt") {
        // Reset debt-specific fields
        document.getElementById("debt-interest-rate").value = "0"
        document.getElementById("debt-interest-type").value = "simple"
        document.getElementById("debt-due-date").value = ""
        document.getElementById("debt-start-date").value = new Date().toISOString().split('T')[0]
      }
    }
    
    modal.style.display = "flex"
    setTimeout(() => {
      modal.style.opacity = "1"
    }, 10)
  }
}

function closeModal() {
  const modal = document.getElementById("transfer-modal")
  if (modal) {
    modal.style.opacity = "0"
    setTimeout(() => {
      modal.style.display = "none"
    }, 300)
  }
}

// Initialize modal event listeners
function initModal() {
  // Set up event listeners for transfer buttons
  document.getElementById("add-debt-btn")?.addEventListener("click", () => {
    hideAddOptions()
    showModal("Transfer as Debt", "debt")
  })
  
  document.getElementById("add-expense-btn")?.addEventListener("click", () => {
    hideAddOptions()
    showModal("Transfer as Expense", "expense")
  })

  // Close modal when clicking X button
  document.querySelectorAll(".modal-overlay .close-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      closeModal()
    })
  })

  // Close modal when clicking outside
  document.querySelectorAll(".modal-overlay").forEach((modal) => {
    modal.addEventListener("click", function (e) {
      if (e.target === this) {
        closeModal()
      }
    })
  })

  // Close modal when pressing Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal()
      hideAddOptions()
    }
  })

  // Add form submission handler
  document.getElementById("transfer-form")?.addEventListener("submit", (e) => {
    e.preventDefault()
    sendMoneyTransfer()
  })
}

function initializeUI() {
  // Set username in avatar and tooltip
  const currentUser = JSON.parse(localStorage.getItem("currentUser"))
  const userAvatar = document.querySelector(".user-avatar")
  const userTooltip = document.querySelector(".user-tooltip")

  if (userAvatar && currentUser) {
    userAvatar.textContent = currentUser.name.charAt(0).toUpperCase()
  }

  if (userTooltip && currentUser) {
    userTooltip.textContent = currentUser.name
  }

  // Set today's date in date pickers
  const today = new Date().toISOString().split("T")[0]
  document.querySelectorAll('input[type="date"]').forEach((input) => {
    input.value = today
    input.max = today
  })
}

function loadWalletBalance() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"))
  if (!currentUser) return

  fetch(`http://localhost:3000/get-wallet-balance/${currentUser.id}`)
    .then((response) => response.json())
    .then((data) => {
      const walletBalanceElement = document.getElementById("wallet-balance")
      if (walletBalanceElement) {
        walletBalanceElement.textContent = `$${Number(data.balance || 0).toFixed(2)}`
      }
    })
    .catch((error) => console.error("Error fetching wallet balance:", error))
}

function setupEventListeners() {
  document.getElementById("logout-btn")?.addEventListener("click", handleLogout)
  
  // Add button event listeners
  document.getElementById("addButton")?.addEventListener("click", function(e) {
    e.stopPropagation()
    toggleAddOptions()
  })
  
  // Close options when clicking outside
  document.addEventListener("click", (e) => {
    const addButton = document.getElementById("addButton")
    const addOptions = document.getElementById("addOptions")
    
    if (addButton && addOptions && !addButton.contains(e.target) && !addOptions.contains(e.target)) {
      hideAddOptions()
    }
  })
  
  // Transfer history button
  document.getElementById("transfer-history-btn")?.addEventListener("click", () => {
    showTransferHistory()
  })
}

function toggleAddOptions() {
  const addOptions = document.getElementById("addOptions")
  const addButton = document.getElementById("addButton")
  
  if (addOptions.style.display === "flex") {
    hideAddOptions()
  } else {
    addOptions.style.display = "flex"
    addButton.classList.add("active")
  }
}

function hideAddOptions() {
  const addOptions = document.getElementById("addOptions")
  const addButton = document.getElementById("addButton")
  
  addOptions.style.display = "none"
  addButton.classList.remove("active")
}

function handleLogout() {
  localStorage.removeItem("currentUser")
  window.location.href = "../Loginpage/Login.html"
}

async function sendMoneyTransfer() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"))
  if (!currentUser) {
    alert("User not logged in. Please log in again.")
    return
  }

  // Disable form submission to prevent double clicks
  const submitButton = document.querySelector("#transfer-form .save-btn")
  if (submitButton) {
    // If button is already disabled, return to prevent multiple submissions
    if (submitButton.disabled) return
    
    submitButton.disabled = true
    submitButton.textContent = "Sending..."
  }

  try {
    const transferType = document.getElementById("transfer-type").value
    const recipientEmail = document.getElementById("recipient-email").value
    const amount = Number.parseFloat(document.getElementById("transfer-amount").value)
    const description = document.getElementById("transfer-description").value

    if (!recipientEmail || !amount || amount <= 0) {
      alert("Please enter valid recipient email and amount")
      if (submitButton) {
        submitButton.disabled = false
        submitButton.textContent = "Send Money"
      }
      return
    }

    // Check if the user is trying to send money to themselves
    if (recipientEmail.toLowerCase() === currentUser.email.toLowerCase()) {
      alert("You cannot send money to yourself.")
      if (submitButton) {
        submitButton.disabled = false
        submitButton.textContent = "Send Money"
      }
      return
    }

    // Check if user has sufficient balance
    const walletResponse = await fetch(`http://localhost:3000/get-wallet-balance/${currentUser.id}`)
    const walletData = await walletResponse.json()

    if (walletData.balance < amount) {
      alert("Insufficient wallet balance for this transfer")
      if (submitButton) {
        submitButton.disabled = false
        submitButton.textContent = "Send Money"
      }
      return
    }

    // Check if recipient exists
    const userCheck = await fetch(`http://localhost:3000/check-user-exists?email=${encodeURIComponent(recipientEmail)}`)
    const userData = await userCheck.json()

    if (!userData.exists) {
      alert("Recipient not found. Please check the email address.")
      if (submitButton) {
        submitButton.disabled = false
        submitButton.textContent = "Send Money"
      }
      return
    }

    // Prepare transfer data
    const transferData = {
      sender_id: currentUser.id,
      recipient_email: recipientEmail,
      amount: amount,
      description: description,
      transfer_type: transferType,
    }

    // Add debt-specific data if this is a debt transfer
    if (transferType === "debt") {
      const startDate = document.getElementById("debt-start-date").value
      const dueDate = document.getElementById("debt-due-date").value
      const interestRate = document.getElementById("debt-interest-rate").value || 0
      const interestType = document.getElementById("debt-interest-type").value

      // Validate debt dates
      if (!startDate || !dueDate) {
        alert("Please enter both start and due dates for debt transfers")
        if (submitButton) {
          submitButton.disabled = false
          submitButton.textContent = "Send Money"
        }
        return
      }

      if (new Date(dueDate) <= new Date(startDate)) {
        alert("Due date must be after start date")
        if (submitButton) {
          submitButton.disabled = false
          submitButton.textContent = "Send Money"
        }
        return
      }

      transferData.debt_details = {
        start_date: startDate,
        due_date: dueDate,
        interest_rate: interestRate,
        interest_type: interestType
      }
    }

    // Create transfer
    console.log(`Sending transfer to ${recipientEmail} for $${amount} as ${transferType}`)
    const transferResponse = await fetch("http://localhost:3000/create-money-transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transferData),
    })

    const result = await transferResponse.json()

    if (result.success) {
      alert(`Money transfer (${transferType}) initiated successfully!`)
      closeModal()

      // Refresh wallet and transfers
      loadWalletBalance()
      loadRecentTransfers()
      
      // Clear form
      document.getElementById("recipient-email").value = ""
      document.getElementById("transfer-amount").value = ""
      document.getElementById("transfer-description").value = ""
    } else {
      alert(`Error: ${result.message}`)
    }
  } catch (error) {
    console.error("Transfer error:", error)
    alert("An error occurred during transfer")
  } finally {
    // Re-enable the submit button
    if (submitButton) {
      submitButton.disabled = false
      submitButton.textContent = "Send Money"
    }
  }
}

function checkPendingTransfers() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"))
  if (!currentUser) return

  fetch(`http://localhost:3000/get-pending-transfers/${currentUser.id}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.transfers && data.transfers.length > 0) {
        // Update pending count
        const pendingCountElement = document.getElementById("pending-count")
        if (pendingCountElement) {
          pendingCountElement.textContent = data.transfers.length
        }

        // Display pending transfers
        displayPendingTransfers(data.transfers)
      } else {
        const pendingCountElement = document.getElementById("pending-count")
        if (pendingCountElement) {
          pendingCountElement.textContent = "0"
        }
      }
    })
    .catch((error) => console.error("Error checking pending transfers:", error))
}

function displayPendingTransfers(transfers) {
  const recentTransfersList = document.getElementById("recent-transfers")
  if (!recentTransfersList) return

  // Clear any "no transfers" message
  if (recentTransfersList.querySelector(".empty-state")) {
    recentTransfersList.innerHTML = ""
  }

  // Add pending transfers at the top
  transfers.forEach((transfer) => {
    const transferItem = document.createElement("div")
    transferItem.className = "recent-transfer-item pending-transfer"
    transferItem.dataset.transferId = transfer.id

    const date = new Date(transfer.created_at).toLocaleDateString()
    const formattedAmount = Number.parseFloat(transfer.amount).toFixed(2)

    transferItem.innerHTML = `
      <div class="transfer-user-icon">
        <i class="fas fa-clock"></i>
      </div>
      <div class="transfer-info">
        <div class="transfer-header">
          <span class="transfer-name">From: ${transfer.sender_name}</span>
          <span class="transfer-amount" style="color: #00B894">+$${formattedAmount}</span>
        </div>
        <div class="transfer-details">
          <span class="transfer-type">${transfer.transfer_type}</span>
          <span class="transfer-date">${date}</span>
          <span class="transfer-status pending">pending</span>
        </div>
        <div class="transfer-description">${transfer.description || ""}</div>
      </div>
      <div class="transfer-actions">
        <button class="accept-btn" data-transfer-id="${transfer.id}">
          <i class="fas fa-check"></i>
        </button>
        <button class="reject-btn" data-transfer-id="${transfer.id}">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `

    // Add to the list
    recentTransfersList.insertBefore(transferItem, recentTransfersList.firstChild)

    // Add event listeners
    transferItem.querySelector(".accept-btn").addEventListener("click", () => {
      respondToTransfer(transfer.id, "accepted")
    })

    transferItem.querySelector(".reject-btn").addEventListener("click", () => {
      respondToTransfer(transfer.id, "rejected")
    })
  })
}

function loadRecentTransfers() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"))
  if (!currentUser) return

  const recentTransfersList = document.getElementById("recent-transfers")
  if (!recentTransfersList) return

  // Show loading state
  recentTransfersList.innerHTML = `
    <div class="loading-state">
      <i class="fas fa-spinner fa-spin"></i>
      <p>Loading transfers...</p>
    </div>
  `

  // Fetch both sent and received transfers
  Promise.all([
    fetch(`http://localhost:3000/get-sent-transfers/${currentUser.id}`).then((res) => res.json()),
    fetch(`http://localhost:3000/get-received-transfers/${currentUser.id}`).then((res) => res.json()),
  ])
    .then(([sentData, receivedData]) => {
      // Combine and sort by date
      const allTransfers = [
        ...(sentData.transfers || []).map((t) => ({ ...t, direction: "sent" })),
        ...(receivedData.transfers || []).map((t) => ({ ...t, direction: "received" })),
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      if (allTransfers.length === 0) {
        recentTransfersList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exchange-alt"></i>
          <p>Your recent transfers will appear here</p>
        </div>
      `
        return
      }

      recentTransfersList.innerHTML = ""

      // Display transfers
      allTransfers.slice(0, 10).forEach((transfer) => {
        const transferItem = document.createElement("div")
        transferItem.className = "recent-transfer-item"

        const date = new Date(transfer.created_at).toLocaleDateString()
        const isSent = transfer.direction === "sent"
        const otherParty = isSent ? transfer.recipient_name : transfer.sender_name
        const formattedAmount = Number.parseFloat(transfer.amount).toFixed(2)

        // Set colors and icons
        let statusClass = transfer.status
        let amountColor = isSent ? "#D63031" : "#00B894"
        let amountPrefix = isSent ? "-" : "+"
        let iconClass = "fas fa-user"
        
        if (transfer.status === "pending") {
          iconClass = "fas fa-clock"
        }

        transferItem.innerHTML = `
          <div class="transfer-user-icon">
            <i class="${iconClass}"></i>
          </div>
          <div class="transfer-info">
            <div class="transfer-header">
              <span class="transfer-name">From: ${otherParty}</span>
              <span class="transfer-amount" style="color: ${amountColor}">${amountPrefix}$${formattedAmount}</span>
            </div>
            <div class="transfer-details">
              <span class="transfer-type">${transfer.transfer_type}</span>
              <span class="transfer-date">${date}</span>
              <span class="transfer-status ${statusClass}">${transfer.status}</span>
            </div>
            <div class="transfer-description">${transfer.description || ""}</div>
          </div>
          ${transfer.status === "pending" && transfer.direction === "received" ? `
            <div class="transfer-actions">
              <button class="accept-btn" data-transfer-id="${transfer.id}">
                <i class="fas fa-check"></i>
              </button>
              <button class="reject-btn" data-transfer-id="${transfer.id}">
                <i class="fas fa-times"></i>
              </button>
            </div>
          ` : ''}
        `

        recentTransfersList.appendChild(transferItem)

        // Add event listeners for accept/reject buttons
        if (transfer.status === "pending" && transfer.direction === "received") {
          transferItem.querySelector(".accept-btn")?.addEventListener("click", () => {
            respondToTransfer(transfer.id, "accepted")
          })

          transferItem.querySelector(".reject-btn")?.addEventListener("click", () => {
            respondToTransfer(transfer.id, "rejected")
          })
        }
      })

      // Check for pending transfers after loading recent transfers
      checkPendingTransfers()
    })
    .catch((error) => {
      console.error("Error loading transfers:", error)
      recentTransfersList.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-circle"></i>
        <p>Error loading transfers. Please try again.</p>
      </div>
    `
    })
}

function respondToTransfer(transferId, action) {
  // Disable buttons to prevent double-clicks
  const buttons = document.querySelectorAll(`.transfer-actions button[data-transfer-id="${transferId}"]`);
  buttons.forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = "0.5";
  });

  console.log(`Responding to transfer ${transferId} with action: ${action}`);
  
  fetch("http://localhost:3000/respond-to-transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transfer_id: transferId, response: action }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (data.success) {
        // Remove the pending transfer from the UI
        const transferElement = document.querySelector(`.pending-transfer[data-transfer-id="${transferId}"]`)
        if (transferElement) {
          transferElement.remove()
        }

        console.log(`Transfer ${action} successfully:`, data);
        alert(`Transfer ${action} successfully!`);

        // Series of balance refreshes to ensure UI is updated
        loadWalletBalance();
        
        // Refresh transfers list
        loadRecentTransfers();
        checkPendingTransfers();

        // If action was "accepted", add multiple refresh attempts with delays
        if (action === "accepted") {
          // First delayed refresh
          setTimeout(() => {
            //console.log("First delayed wallet balance refresh");
            loadWalletBalance();
            
            // Second delayed refresh
            setTimeout(() => {
             // console.log("Second delayed wallet balance refresh");
              loadWalletBalance();
            }, 2000);
          }, 1000);
        }
      } else {
        alert(`Error: ${data.message}`)
        // Re-enable buttons in case of error
        buttons.forEach(btn => {
          btn.disabled = false;
          btn.style.opacity = "1";
        });
      }
    })
    .catch((error) => {
      console.error("Error responding to transfer:", error)
      alert("Error processing response: " + error.message)
      // Re-enable buttons in case of error
      buttons.forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = "1";
      });
    })
}

// Start checking for pending transfers periodically
setInterval(checkPendingTransfers, 30000) // Check every 30 seconds

//// transfer history

// Transfer History Functionality
document.addEventListener("DOMContentLoaded", () => {
  // Set up event listener for transfer history button
  const transferHistoryBtn = document.getElementById("transfer-history-btn")

  if (transferHistoryBtn) {
    transferHistoryBtn.addEventListener("click", () => {
      showTransferHistory()
    })
  }
})

// Show transfer history modal
function showTransferHistory() {
  // Create modal if it doesn't exist
  let historyModal = document.getElementById("history-modal")

  if (!historyModal) {
    historyModal = document.createElement("div")
    historyModal.id = "history-modal"
    historyModal.className = "modal-overlay"

    historyModal.innerHTML = `
      <div class="modal-content history-modal-content">
        <div class="modal-header">
          <h2>Transfer History</h2>
          <span class="close-btn">&times;</span>
        </div>
        <div class="modal-body">
          <div class="tabs-container">
            <div class="tabs">
              <button class="tab-btn active" data-tab="sent">Sent</button>
              <button class="tab-btn" data-tab="received">Received</button>
              <button class="tab-btn" data-tab="pending">Pending</button>
            </div>
            <button id="export-pdf-btn" class="export-pdf-btn">
              <i class="fas fa-file-pdf"></i> Export PDF
            </button>
          </div>
          
          <div class="transfer-history-content">
            <div class="tab-content" id="sent-transfers">
              <p class="loading-text">Loading sent transfers...</p>
            </div>
            
            <div class="tab-content" id="received-transfers" style="display: none;">
              <p class="loading-text">Loading received transfers...</p>
            </div>
            
            <div class="tab-content" id="pending-transfers" style="display: none;">
              <p class="loading-text">Loading pending transfers...</p>
            </div>
          </div>
        </div>
      </div>
    `

    document.body.appendChild(historyModal)

    // Add event listener for close button
    historyModal.querySelector(".close-btn").addEventListener("click", () => {
      historyModal.style.display = "none"
    })

    // Add event listeners for tabs
    const tabButtons = historyModal.querySelectorAll(".tab-btn")
    tabButtons.forEach((button) => {
      button.addEventListener("click", function () {
        // Remove active class from all buttons
        tabButtons.forEach((btn) => btn.classList.remove("active"))

        // Add active class to clicked button
        this.classList.add("active")

        // Hide all tab content
        const tabContents = historyModal.querySelectorAll(".tab-content")
        tabContents.forEach((content) => (content.style.display = "none"))

        // Show selected tab content
        const tabName = this.getAttribute("data-tab")
        document.getElementById(`${tabName}-transfers`).style.display = "block"

        // Load data for the selected tab
        loadTransferHistory(tabName)
      })
    })
    
    // Add PDF export button listener
    const exportPdfBtn = historyModal.querySelector("#export-pdf-btn")
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => {
        showPdfExportModal()
      })
    }
  }

  // Show the modal
  historyModal.style.display = "flex"

  // Load data for the active tab
  loadTransferHistory("sent")
}

// Load transfer history data
function loadTransferHistory(type) {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"))
  const contentElement = document.getElementById(`${type}-transfers`)

  if (!currentUser || !contentElement) return

  contentElement.innerHTML = "<p class='loading-text'><i class='fas fa-spinner fa-spin'></i> Loading...</p>"

  let endpoint
  switch (type) {
    case "sent":
      endpoint = `http://localhost:3000/get-sent-transfers/${currentUser.id}`
      break
    case "received":
      endpoint = `http://localhost:3000/get-received-transfers/${currentUser.id}`
      break
    case "pending":
      endpoint = `http://localhost:3000/get-pending-transfers/${currentUser.id}`
      break
    default:
      contentElement.innerHTML = "<p class='error-text'>Invalid transfer type</p>"
      return
  }

  fetch(endpoint)
    .then((response) => response.json())
    .then((data) => {
      if (!data.transfers || data.transfers.length === 0) {
        contentElement.innerHTML = `
          <div class="empty-transfers">
            <i class="fas fa-exchange-alt"></i>
            <p>No ${type} transfers found</p>
          </div>
        `
        return
      }

      // Create cards to display transfers (similar to investment holdings)
      let transfersHTML = `<div class="transfers-grid">`

      data.transfers.forEach((transfer) => {
        const date = new Date(transfer.created_at).toLocaleDateString()
        const amount = Number.parseFloat(transfer.amount).toFixed(2)
        const otherParty = type === "sent" ? transfer.recipient_name : transfer.sender_name

        // Determine icon and color based on transfer type and status
        let iconClass, colorClass, statusClass
        
        if (transfer.status === "pending") {
          statusClass = "status-pending"
          iconClass = "fa-clock"
        } else if (transfer.status === "accepted") {
          statusClass = "status-accepted"
          iconClass = type === "sent" ? "fa-paper-plane" : "fa-download"
        } else {
          statusClass = "status-rejected"
          iconClass = "fa-ban"
        }
        
        if (transfer.transfer_type === "debt") {
          colorClass = "debt-transfer"
        } else {
          colorClass = "expense-transfer"
        }

        transfersHTML += `
          <div class="transfer-card ${statusClass} ${colorClass}">
            <div class="transfer-card-header">
              <div class="transfer-icon">
                <i class="fas ${iconClass}"></i>
              </div>
              <div class="transfer-amount">$${amount}</div>
            </div>
            <div class="transfer-card-body">
              <div class="transfer-detail">
                <span class="label">${type === "sent" ? "To" : "From"}:</span>
                <span class="value">${otherParty}</span>
              </div>
              <div class="transfer-detail">
                <span class="label">Date:</span>
                <span class="value">${date}</span>
              </div>
              <div class="transfer-detail">
                <span class="label">Type:</span>
                <span class="value">${transfer.transfer_type}</span>
              </div>
              <div class="transfer-detail">
                <span class="label">Status:</span>
                <span class="value">${transfer.status}</span>
              </div>
              ${transfer.description ? `
                <div class="transfer-description">
                  <span class="label">Description:</span>
                  <span class="value">${transfer.description}</span>
                </div>
              ` : ''}
            </div>
            ${type === "pending" ? `
              <div class="transfer-actions">
                <button class="accept-btn small" data-transfer-id="${transfer.id}">Accept</button>
                <button class="reject-btn small" data-transfer-id="${transfer.id}">Reject</button>
              </div>
            ` : ''}
          </div>
        `
      })

      transfersHTML += `</div>`
      contentElement.innerHTML = transfersHTML

      // Add event listeners for accept/reject buttons if this is the pending tab
      if (type === "pending") {
        contentElement.querySelectorAll(".accept-btn").forEach((button) => {
          button.addEventListener("click", function () {
            const transferId = this.getAttribute("data-transfer-id")
            respondToTransferHistory(transferId, "accepted")
            this.closest(".transfer-card").remove()
          })
        })

        contentElement.querySelectorAll(".reject-btn").forEach((button) => {
          button.addEventListener("click", function () {
            const transferId = this.getAttribute("data-transfer-id")
            respondToTransferHistory(transferId, "rejected")
            this.closest(".transfer-card").remove()
          })
        })
      }
    })
    .catch((error) => {
      console.error(`Error loading ${type} transfers:`, error)
      contentElement.innerHTML = `<p class="error-text">Error loading transfers: ${error.message}</p>`
    })
}

// Function to respond to a pending transfer (accept or reject) in history view
function respondToTransferHistory(transferId, action) {
  // Disable buttons to prevent double-clicks
  const buttons = document.querySelectorAll(`.transfer-card button[data-transfer-id="${transferId}"]`);
  buttons.forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = "0.5";
  });

  console.log(`Responding to transfer ${transferId} with action: ${action} from history view`);

  fetch("http://localhost:3000/respond-to-transfer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transfer_id: transferId,
      response: action,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response.json()
    })
    .then((data) => {
      console.log(`Transfer ${action} successfully:`, data)

      if (data.success) {
        // Show success message
        alert(`Transfer ${action} successfully!`)

        // Series of balance refreshes to ensure UI is updated
        loadWalletBalance();
        
        // If we're on the pending tab, refresh it to show the updated list
        const pendingTab = document.querySelector('.tab-btn[data-tab="pending"].active');
        if (pendingTab) {
          loadTransferHistory("pending");
        }
        
        // If transfer was accepted, also refresh the received tab data
        if (action === "accepted") {
          // If we're on the received tab, refresh it
          const receivedTab = document.querySelector('.tab-btn[data-tab="received"].active');
          if (receivedTab) {
            loadTransferHistory("received");
          }
          
          // Also refresh the recent transfers list on the main page
          loadRecentTransfers();
          
          // Multiple delayed refreshes for wallet balance
          setTimeout(() => {
          //  console.log("First delayed wallet balance refresh from history");
            loadWalletBalance();
            
            setTimeout(() => {
             // console.log("Second delayed wallet balance refresh from history");
              loadWalletBalance();
            }, 2000);
          }, 1000);
        }
      } else {
        alert(`Error: ${data.message}`)
        // Re-enable buttons in case of error
        buttons.forEach(btn => {
          btn.disabled = false;
          btn.style.opacity = "1";
        });
      }
    })
    .catch((error) => {
      console.error(`Error responding to transfer:`, error)
      alert(`Error responding to transfer: ${error.message}`)
      // Re-enable buttons in case of error
      buttons.forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = "1";
      });
    })
}

function loadWalletBalanceHistory() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"))

  if (!currentUser) return

  fetch(`http://localhost:3000/get-wallet-balance/${currentUser.id}`)
    .then((response) => response.json())
    .then((data) => {
      const walletBalanceElement = document.getElementById("wallet-balance")
      if (walletBalanceElement) {
        const balance = data.balance || 0
        walletBalanceElement.textContent = `$${Number(balance).toFixed(2)}`
      }
    })
    .catch((error) => {
      console.error("Error fetching wallet balance:", error)
    })
}

// Add CSS for transfer history
const historyStyle = document.createElement("style")
historyStyle.textContent = `
      .history-modal-content {
          width: 80%;
          max-width: 900px;
          max-height: 80vh;
          overflow-y: auto;
      }
      
      .tabs {
          display: flex;
          margin-bottom: 20px;
          border-bottom: 1px solid #ddd;
      }
      
      .tab-btn {
          padding: 10px 20px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          font-weight: bold;
          color: #666;
      }
      
      .tab-btn.active {
          color: #4CAF50;
          border-bottom: 2px solid #4CAF50;
      }
      
      .transfers-table {
          width: 100%;
          border-collapse: collapse;
      }
      
      .transfers-table th, .transfers-table td {
          padding: 10px;
          color:black;
          text-align: left;
          border-bottom: 1px solid #ddd;
      }
      
      .transfers-table th {
          background-color:rgba(91, 88, 185, 0.52);
          font-weight: bold;
      }
      
      .transfers-table tr:hover {
          background-color:rgba(37, 99, 150, 0.77);
      }
      
      .accept-btn.small, .reject-btn.small {
          padding: 5px 10px;
          font-size: 12px;
          margin-right: 5px;
      }
  `

document.head.appendChild(historyStyle)

// Function to show PDF export modal
function showPdfExportModal() {
  // Create PDF export modal if it doesn't exist
  let pdfModal = document.getElementById("pdf-export-modal")
  
  if (!pdfModal) {
    pdfModal = document.createElement("div")
    pdfModal.id = "pdf-export-modal"
    pdfModal.className = "modal-overlay"
    
    pdfModal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Export Transfer History</h2>
          <span class="close-btn" id="close-pdf-modal">&times;</span>
        </div>
        <div class="modal-body">
          <form id="pdf-export-form">
            <div class="form-group">
              <label>Report Type:</label>
              <div class="radio-options">
                <label class="radio-label">
                  <input type="radio" name="reportType" id="full-report" value="full" checked>
                  Full History
                </label>
                <label class="radio-label">
                  <input type="radio" name="reportType" id="partial-report" value="partial">
                  Date Range
                </label>
              </div>
            </div>
            
            <div class="form-group" id="partial-report-options" style="display: none;">
              <div class="date-range">
                <div class="date-input">
                  <label for="pdf-from-date">From Date:</label>
                  <input type="date" id="pdf-from-date" name="fromDate">
                </div>
                <div class="date-input">
                  <label for="pdf-to-date">To Date:</label>
                  <input type="date" id="pdf-to-date" name="toDate">
                </div>
              </div>
            </div>
            
            <div class="modal-buttons">
              <button type="button" class="modal-btn close-btn" id="cancel-pdf-export">Cancel</button>
              <button type="submit" class="modal-btn save-btn">Generate PDF</button>
            </div>
          </form>
        </div>
      </div>
    `
    
    document.body.appendChild(pdfModal)
    
    // Set up event listeners for the PDF export modal
    const closePdfModalBtn = document.getElementById("close-pdf-modal")
    const cancelPdfExportBtn = document.getElementById("cancel-pdf-export")
    const fullReportRadio = document.getElementById("full-report")
    const partialReportRadio = document.getElementById("partial-report")
    const partialReportOptions = document.getElementById("partial-report-options")
    const pdfExportForm = document.getElementById("pdf-export-form")
    
    if (closePdfModalBtn) {
      closePdfModalBtn.addEventListener('click', () => {
        pdfModal.style.display = "none"
      })
    }
    
    if (cancelPdfExportBtn) {
      cancelPdfExportBtn.addEventListener('click', () => {
        pdfModal.style.display = "none"
      })
    }
    
    if (fullReportRadio && partialReportRadio && partialReportOptions) {
      fullReportRadio.addEventListener('change', () => {
        partialReportOptions.style.display = 'none'
      })
      
      partialReportRadio.addEventListener('change', () => {
        partialReportOptions.style.display = 'block'
      })
    }
    
    if (pdfExportForm) {
      pdfExportForm.addEventListener('submit', (e) => {
        e.preventDefault()
        
        const reportType = document.querySelector('input[name="reportType"]:checked').value
        let fromDate, toDate
        
        if (reportType === 'partial') {
          fromDate = document.getElementById("pdf-from-date").value
          toDate = document.getElementById("pdf-to-date").value
          
          if (!fromDate || !toDate) {
            alert('Please select both start and end dates for partial report')
            return
          }
          
          if (new Date(fromDate) > new Date(toDate)) {
            alert('End date must be after start date')
            return
          }
        }
        
        // Generate the PDF report
        generateTransferPdfReport(reportType, fromDate, toDate)
        
        // Hide the modal
        pdfModal.style.display = "none"
      })
    }
    
    // Set default dates (last 30 days)
    const today = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(today.getDate() - 30)
    
    const pdfFromDate = document.getElementById("pdf-from-date")
    const pdfToDate = document.getElementById("pdf-to-date")
    
    if (pdfFromDate && pdfToDate) {
      pdfFromDate.value = thirtyDaysAgo.toISOString().split('T')[0]
      pdfToDate.value = today.toISOString().split('T')[0]
    }
  }
  
  // Show the PDF export modal
  pdfModal.style.display = "flex"
}

// Function to generate PDF report for transfer history
function generateTransferPdfReport(reportType, fromDate, toDate) {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"))
  if (!currentUser) {
    alert("User not logged in. Please log in again.")
    return
  }
  
  // Create loading indicator
  const loadingOverlay = document.createElement("div")
  loadingOverlay.style.position = "fixed"
  loadingOverlay.style.top = "0"
  loadingOverlay.style.left = "0"
  loadingOverlay.style.width = "100%"
  loadingOverlay.style.height = "100%"
  loadingOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)"
  loadingOverlay.style.display = "flex"
  loadingOverlay.style.justifyContent = "center"
  loadingOverlay.style.alignItems = "center"
  loadingOverlay.style.zIndex = "9999"
  
  const loadingSpinner = document.createElement("div")
  loadingSpinner.innerHTML = '<i class="fas fa-spinner fa-spin" style="color: white; font-size: 48px;"></i>'
  loadingOverlay.appendChild(loadingSpinner)
  
  document.body.appendChild(loadingOverlay)
  
  // Load jsPDF if not already available
  if (typeof jsPDF === "undefined") {
    const script = document.createElement("script")
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
    document.head.appendChild(script)
    
    const autoTableScript = document.createElement("script")
    autoTableScript.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js"
    document.head.appendChild(autoTableScript)
    
    // Wait for scripts to load
    setTimeout(() => {
      generateTransferPdf(currentUser, reportType, fromDate, toDate, loadingOverlay)
    }, 1000)
  } else {
    generateTransferPdf(currentUser, reportType, fromDate, toDate, loadingOverlay)
  }
}

function generateTransferPdf(currentUser, reportType, fromDate, toDate, loadingOverlay) {
  // Prepare date filter function
  const isInDateRange = (dateStr) => {
    if (reportType !== 'partial') return true
    
    const date = new Date(dateStr)
    const from = new Date(fromDate)
    const to = new Date(toDate)
    to.setHours(23, 59, 59, 999) // Include the full end date
    
    return date >= from && date <= to
  }
  
  // Fetch wallet balance
  fetch(`http://localhost:3000/get-wallet-balance/${currentUser.id}`)
    .then(response => response.json())
    .then(walletData => {
      // Fetch sent transfers
      return fetch(`http://localhost:3000/get-sent-transfers/${currentUser.id}`)
        .then(response => response.json())
        .then(sentData => {
          // Fetch received transfers
          return fetch(`http://localhost:3000/get-received-transfers/${currentUser.id}`)
            .then(response => response.json())
            .then(receivedData => {
              // Fetch pending transfers
              return fetch(`http://localhost:3000/get-pending-transfers/${currentUser.id}`)
                .then(response => response.json())
                .then(pendingData => {
                  // Filter transfers by date if needed
                  const sentTransfers = sentData.transfers.filter(t => isInDateRange(t.created_at))
                  const receivedTransfers = receivedData.transfers.filter(t => isInDateRange(t.created_at))
                  const pendingTransfers = pendingData.transfers.filter(t => isInDateRange(t.created_at))
                  
                  // Generate PDF
                  let jsPDF
                  if (window.jspdf && window.jspdf.jsPDF) {
                    jsPDF = window.jspdf.jsPDF
                  } else if (window.jsPDF) {
                    jsPDF = window.jsPDF
                  } else {
                    console.error("jsPDF library not found.")
                    document.body.removeChild(loadingOverlay)
                    alert("PDF generation failed: jsPDF library not available.")
                    return
                  }
                  
                  const doc = new jsPDF()
                  
                  // Add title
                  doc.setFontSize(20)
                  doc.setTextColor(40, 40, 40)
                  doc.text("Penny Pilot Transfer History", 105, 20, { align: "center" })
                  
                  // Add report period
                  doc.setFontSize(12)
                  doc.setTextColor(80, 80, 80)
                  if (reportType === "partial") {
                    doc.text(`Report Period: ${formatDateForPdf(fromDate)} to ${formatDateForPdf(toDate)}`, 105, 30, {
                      align: "center",
                    })
                  } else {
                    doc.text("Full Transfer History", 105, 30, { align: "center" })
                  }
                  
                  // Add user info
                  doc.setFontSize(12)
                  doc.text(`User: ${currentUser.name}`, 20, 40)
                  doc.text(`Generated on: ${formatDateForPdf(new Date())}`, 20, 46)
                  doc.text(`Current Wallet Balance: $${Number.parseFloat(walletData.balance).toFixed(2)}`, 20, 52)
                  
                  // Add summary
                  doc.setFontSize(14)
                  doc.setTextColor(40, 40, 40)
                  doc.text("Transfer Summary", 20, 62)
                  
                  doc.setFontSize(12)
                  doc.text(`Total Sent Transfers: ${sentTransfers.length}`, 30, 70)
                  doc.text(`Total Received Transfers: ${receivedTransfers.length}`, 30, 76)
                  doc.text(`Pending Transfers: ${pendingTransfers.length}`, 30, 82)
                  
                  const sentAmount = sentTransfers.reduce((sum, t) => sum + Number.parseFloat(t.amount), 0)
                  const receivedAmount = receivedTransfers.reduce((sum, t) => sum + Number.parseFloat(t.amount), 0)
                  const pendingAmount = pendingTransfers.reduce((sum, t) => sum + Number.parseFloat(t.amount), 0)
                  
                  doc.text(`Total Amount Sent: $${sentAmount.toFixed(2)}`, 30, 88)
                  doc.text(`Total Amount Received: $${receivedAmount.toFixed(2)}`, 30, 94)
                  doc.text(`Pending Amount: $${pendingAmount.toFixed(2)}`, 30, 100)
                  doc.text(`Net Transfer: $${(receivedAmount - sentAmount).toFixed(2)}`, 30, 106)
                  
                  // Add sent transfers table
                  let yPos = 120
                  
                  if (sentTransfers.length > 0) {
                    doc.setFontSize(14)
                    doc.text("Sent Transfers", 20, yPos)
                    
                    // Create table data
                    const sentTableData = sentTransfers.map((transfer) => [
                      formatDateForPdf(transfer.created_at),
                      transfer.recipient_name,
                      `$${Number.parseFloat(transfer.amount).toFixed(2)}`,
                      transfer.transfer_type,
                      transfer.status,
                      transfer.description || "-"
                    ])
                    
                    doc.autoTable({
                      startY: yPos + 4,
                      head: [["Date", "Recipient", "Amount", "Type", "Status", "Description"]],
                      body: sentTableData,
                      theme: "striped",
                      headStyles: { fillColor: [214, 48, 49] }, // Red for sent
                      margin: { top: yPos + 4 }
                    })
                    
                    yPos = doc.lastAutoTable.finalY + 15
                  } else {
                    doc.text("No sent transfers in this period", 20, yPos + 10)
                    yPos += 20
                  }
                  
                  // Add received transfers on next page
                  doc.addPage()
                  yPos = 20
                  
                  if (receivedTransfers.length > 0) {
                    doc.setFontSize(14)
                    doc.text("Received Transfers", 20, yPos)
                    
                    // Create table data
                    const receivedTableData = receivedTransfers.map((transfer) => [
                      formatDateForPdf(transfer.created_at),
                      transfer.sender_name,
                      `$${Number.parseFloat(transfer.amount).toFixed(2)}`,
                      transfer.transfer_type,
                      transfer.status,
                      transfer.description || "-"
                    ])
                    
                    doc.autoTable({
                      startY: yPos + 4,
                      head: [["Date", "Sender", "Amount", "Type", "Status", "Description"]],
                      body: receivedTableData,
                      theme: "striped",
                      headStyles: { fillColor: [0, 184, 148] }, // Green for received
                      margin: { top: yPos + 4 }
                    })
                    
                    yPos = doc.lastAutoTable.finalY + 15
                  } else {
                    doc.text("No received transfers in this period", 20, yPos + 10)
                    yPos += 20
                  }
                  
                  // Add pending transfers if any exist
                  if (pendingTransfers.length > 0) {
                    doc.addPage()
                    yPos = 20
                    
                    doc.setFontSize(14)
                    doc.text("Pending Transfers", 20, yPos)
                    
                    // Create table data
                    const pendingTableData = pendingTransfers.map((transfer) => [
                      formatDateForPdf(transfer.created_at),
                      transfer.sender_name,
                      `$${Number.parseFloat(transfer.amount).toFixed(2)}`,
                      transfer.transfer_type,
                      "Pending",
                      transfer.description || "-"
                    ])
                    
                    doc.autoTable({
                      startY: yPos + 4,
                      head: [["Date", "Sender", "Amount", "Type", "Status", "Description"]],
                      body: pendingTableData,
                      theme: "striped",
                      headStyles: { fillColor: [108, 92, 231] }, // Purple for pending
                      margin: { top: yPos + 4 }
                    })
                  }
                  
                  // Add footer
                  const pageCount = doc.internal.getNumberOfPages()
                  for (let i = 1; i <= pageCount; i++) {
                    doc.setPage(i)
                    doc.setFontSize(10)
                    doc.setTextColor(150, 150, 150)
                    doc.text(`Penny Pilot - Page ${i} of ${pageCount}`, 105, doc.internal.pageSize.height - 10, { align: "center" })
                  }
                  
                  // Save the PDF
                  const fileName = `PennyPilot_Transfers_${currentUser.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`
                  doc.save(fileName)
                  
                  // Remove loading overlay
                  document.body.removeChild(loadingOverlay)
                  
                  // Show success message
                  alert("Transfer history PDF generated successfully!")
                })
            })
        })
    })
    .catch((error) => {
      console.error("Error generating PDF:", error)
      document.body.removeChild(loadingOverlay)
      alert("Error generating PDF: " + error.message)
    })
}

// Helper function to format dates for PDF
function formatDateForPdf(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

