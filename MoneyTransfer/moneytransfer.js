// Money Transfer Functionality
document.addEventListener("DOMContentLoaded", () => {
  // Get user information from localStorage
  const currentUser = JSON.parse(localStorage.getItem("currentUser"))

  if (!currentUser) {
    window.location.href = "../LoginPage/Login.html"
    return
  }

  // Display username in the tooltip
  const usernameTooltip = document.getElementById("username-tooltip")
  if (usernameTooltip) {
    usernameTooltip.textContent = currentUser.name
  }

  // Load wallet balance
  loadWalletBalance()

  // Set up event listeners for money transfer
  setupMoneyTransferListeners()

  // Check for pending transfers
  checkPendingTransfers()
})

// Load wallet balance
// Updated loadWalletBalance function in moneytransfer.js
function loadWalletBalance() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"))

  fetch(`http://localhost:3000/get-wallet-balance/${currentUser.id}`)
    .then((response) => response.json())
    .then((data) => {
      const walletBalanceElement = document.getElementById("wallet-balance")
      if (walletBalanceElement) {
        // Handle cases where balance might be null/undefined
        const balance = data.balance || 0
        walletBalanceElement.textContent = `₹${Number(balance).toFixed(2)}`
      }
    })
    .catch((error) => {
      console.error("Error fetching wallet balance:", error)
    })
}

// Set up event listeners for money transfer
function setupMoneyTransferListeners() {
  // Money Transfer Modal (Debt)
  const addEntryBtn = document.getElementById("add-entry-btn")
  const entryModal = document.getElementById("entry-modal")
  const closeModalBtn = document.getElementById("close-modal")
  const saveEntryBtn = document.getElementById("save-entry")

  if (addEntryBtn) {
    addEntryBtn.addEventListener("click", () => {
      entryModal.style.display = "flex"
    })
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () => {
      entryModal.style.display = "none"
    })
  }

  if (saveEntryBtn) {
    saveEntryBtn.addEventListener("click", () => {
      sendMoneyTransfer()
    })
  }

  // Money Transfer Modal (Expense)
  const debitEntryBtn = document.getElementById("debit-entry-btn")
  const debitModal = document.getElementById("debit-modal")
  const closeDebitModalBtn = document.getElementById("close-debit-modal")
  const saveDebitBtn = document.getElementById("save-debit")

  if (debitEntryBtn) {
    debitEntryBtn.addEventListener("click", () => {
      debitModal.style.display = "flex"
    })
  }

  if (closeDebitModalBtn) {
    closeDebitModalBtn.addEventListener("click", () => {
      debitModal.style.display = "none"
    })
  }

  if (saveDebitBtn) {
    saveDebitBtn.addEventListener("click", () => {
      sendMoneyTransferAsExpense()
    })
  }

  // Transfer Money button in bottom navigation
  const transferMoneyBtn = document.querySelector('.nav-btn[data-index="3"]')
  if (transferMoneyBtn) {
    transferMoneyBtn.addEventListener("click", () => {
      // You can add specific functionality for this button if needed
      entryModal.style.display = "flex"
    })
  }
}

// Send money transfer (as debt)
function sendMoneyTransfer() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"))
  const recipientEmail = document.getElementById("username-debt").value
  const amount = Number.parseFloat(document.getElementById("entry-amount").value)
  const description = document.getElementById("entry-description").value

  if (!recipientEmail || isNaN(amount) || amount <= 0) {
    alert("Please enter a valid recipient email and amount.")
    return
  }

  // First, check if the recipient exists
  fetch(`http://localhost:3000/check-user-exists?email=${encodeURIComponent(recipientEmail)}`)
    .then((response) => response.json())
    .then((data) => {
      if (!data.exists) {
        alert("Recipient not found. Please check the email address.")
        return
      }

      // Create the money transfer
      const transferData = {
        sender_id: currentUser.id,
        recipient_email: recipientEmail,
        amount: amount,
        description: description,
        transfer_type: "debt",
      }

      return fetch("http://localhost:3000/create-money-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transferData),
      })
    })
    .then((response) => {
      if (!response) return // Handle case where first promise rejected
      return response.json()
    })
    .then((data) => {
      if (!data) return // Handle case where second promise rejected

      if (data.success) {
        alert("Money transfer initiated successfully!")
        document.getElementById("entry-modal").style.display = "none"

        // Clear form fields
        document.getElementById("username-debt").value = ""
        document.getElementById("entry-amount").value = ""
        document.getElementById("entry-description").value = ""

        // Refresh wallet balance
        loadWalletBalance()
      } else {
        alert(`Error: ${data.message}`)
      }
    })
    .catch((error) => {
      console.error("Error creating money transfer:", error)
      alert("An error occurred while processing your request.")
    })
}

// Send money transfer (as expense)
function sendMoneyTransferAsExpense() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"))
  const recipientEmail = document.getElementById("username-expnese").value
  const amount = Number.parseFloat(document.getElementById("debit-amount").value)
  const description = document.getElementById("debit-description").value

  if (!recipientEmail || isNaN(amount) || amount <= 0) {
    alert("Please enter a valid recipient email and amount.")
    return
  }

  // First, check if the recipient exists
  fetch(`http://localhost:3000/check-user-exists?email=${encodeURIComponent(recipientEmail)}`)
    .then((response) => response.json())
    .then((data) => {
      if (!data.exists) {
        alert("Recipient not found. Please check the email address.")
        return
      }

      // Create the money transfer
      const transferData = {
        sender_id: currentUser.id,
        recipient_email: recipientEmail,
        amount: amount,
        description: description,
        transfer_type: "expense",
      }

      return fetch("http://localhost:3000/create-money-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transferData),
      })
    })
    .then((response) => {
      if (!response) return // Handle case where first promise rejected
      return response.json()
    })
    .then((data) => {
      if (!data) return // Handle case where second promise rejected

      if (data.success) {
        alert("Money transfer initiated successfully!")
        document.getElementById("debit-modal").style.display = "none"

        // Clear form fields
        document.getElementById("username-expnese").value = ""
        document.getElementById("debit-amount").value = ""
        document.getElementById("debit-description").value = ""

        // Refresh wallet balance
        loadWalletBalance()
      } else {
        alert(`Error: ${data.message}`)
      }
    })
    .catch((error) => {
      console.error("Error creating money transfer:", error)
      alert("An error occurred while processing your request.")
    })
}

// Check for pending transfers that need user action
function checkPendingTransfers() {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"))

  fetch(`http://localhost:3000/get-pending-transfers/${currentUser.id}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.transfers && data.transfers.length > 0) {
        // Display notifications for each pending transfer
        data.transfers.forEach((transfer) => {
          showTransferNotification(transfer)
        })
      }
    })
    .catch((error) => {
      console.error("Error checking pending transfers:", error)
    })
}

// Show notification for pending transfer
function showTransferNotification(transfer) {
  // Create notification element
  const notification = document.createElement("div")
  notification.className = "transfer-notification"

  // Format the amount with 2 decimal places
  const formattedAmount = Number.parseFloat(transfer.amount).toFixed(2)

  notification.innerHTML = `
        <div class="notification-content">
            <h3>Money Transfer Request</h3>
            <p><strong>${transfer.sender_name}</strong> wants to send you ₹${formattedAmount}</p>
            <p class="notification-description">${transfer.description || "No description provided"}</p>
            <div class="notification-buttons">
                <button class="accept-btn" data-transfer-id="${transfer.id}">Accept</button>
                <button class="reject-btn" data-transfer-id="${transfer.id}">Reject</button>
            </div>
        </div>
    `

  // Add to document
  document.body.appendChild(notification)

  // Add event listeners for accept/reject buttons
  notification.querySelector(".accept-btn").addEventListener("click", function () {
    const transferId = this.getAttribute("data-transfer-id")
    respondToTransfer(transferId, "accepted")
    notification.remove()
  })

  notification.querySelector(".reject-btn").addEventListener("click", function () {
    const transferId = this.getAttribute("data-transfer-id")
    respondToTransfer(transferId, "rejected")
    notification.remove()
  })
}

// Respond to transfer (accept or reject)
function respondToTransfer(transferId, response) {
  fetch("http://localhost:3000/respond-to-transfer", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transfer_id: transferId,
      response: response,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response.json()
    })
    .then((data) => {
      if (data.success) {
        alert(`Transfer ${response} successfully!`)

        // Refresh wallet balance
        loadWalletBalance()
      } else {
        alert(`Error: ${data.message}`)
      }
    })
    .catch((error) => {
      console.error("Error responding to transfer:", error)
      alert("An error occurred while processing your response.")
    })
}

// Add CSS for notifications
const style = document.createElement("style")
style.textContent = `
    .transfer-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        max-width: 350px;
        animation: slideIn 0.3s ease-out;
    }
    
    .notification-content {
        padding: 15px;
    }
    
    .notification-content h3 {
        margin-top: 0;
        color: #333;
    }
    
    .notification-description {
        margin-bottom: 15px;
        color: #666;
    }
    
    .notification-buttons {
        display: flex;
        justify-content: space-between;
    }
    
    .accept-btn, .reject-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
    }
    
    .accept-btn {
        background-color: #4CAF50;
        color: white;
    }
    
    .reject-btn {
        background-color: #f44336;
        color: white;
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`

document.head.appendChild(style)

