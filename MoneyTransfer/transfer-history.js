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
                  <h2>Transfer History</h2>
                  <div class="tabs">
                      <button class="tab-btn active" data-tab="sent">Sent</button>
                      <button class="tab-btn" data-tab="received">Received</button>
                      <button class="tab-btn" data-tab="pending">Pending</button>
                  </div>
                  
                  <div class="tab-content" id="sent-transfers">
                      <p>Loading sent transfers...</p>
                  </div>
                  
                  <div class="tab-content" id="received-transfers" style="display: none;">
                      <p>Loading received transfers...</p>
                  </div>
                  
                  <div class="tab-content" id="pending-transfers" style="display: none;">
                      <p>Loading pending transfers...</p>
                  </div>
                  
                  <div class="modal-buttons">
                      <button id="close-history-btn" class="modal-btn close-btn">Close</button>
                  </div>
              </div>
          `

    document.body.appendChild(historyModal)

    // Add event listener for close button
    document.getElementById("close-history-btn").addEventListener("click", () => {
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

  contentElement.innerHTML = "<p>Loading...</p>"

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
      contentElement.innerHTML = "<p>Invalid transfer type</p>"
      return
  }

  fetch(endpoint)
    .then((response) => response.json())
    .then((data) => {
      if (!data.transfers || data.transfers.length === 0) {
        contentElement.innerHTML = "<p>No transfers found</p>"
        return
      }

      // Create table to display transfers
      let tableHTML = `
                  <table class="transfers-table">
                      <thead>
                          <tr>
                              <th>Date</th>
                              <th>${type === "sent" ? "Recipient" : "Sender"}</th>
                              <th>Amount</th>
                              <th>Type</th>
                              <th>Status</th>
                              <th>Description</th>
                              ${type === "pending" ? "<th>Action</th>" : ""}
                          </tr>
                      </thead>
                      <tbody>
              `

      data.transfers.forEach((transfer) => {
        const date = new Date(transfer.created_at).toLocaleDateString()
        const amount = Number.parseFloat(transfer.amount).toFixed(2)
        const otherParty = type === "sent" ? transfer.recipient_name : transfer.sender_name

        tableHTML += `
                      <tr>
                          <td>${date}</td>
                          <td>${otherParty}</td>
                          <td>₹${amount}</td>
                          <td>${transfer.transfer_type}</td>
                          <td>${transfer.status}</td>
                          <td>${transfer.description || "-"}</td>
                  `

        if (type === "pending") {
          tableHTML += `
                          <td>
                              <button class="accept-btn small" data-transfer-id="${transfer.id}">Accept</button>
                              <button class="reject-btn small" data-transfer-id="${transfer.id}">Reject</button>
                          </td>
                      `
        }

        tableHTML += `</tr>`
      })

      tableHTML += `
                      </tbody>
                  </table>
              `

      contentElement.innerHTML = tableHTML

      // Add event listeners for accept/reject buttons if this is the pending tab
      if (type === "pending") {
        contentElement.querySelectorAll(".accept-btn").forEach((button) => {
          button.addEventListener("click", function () {
            const transferId = this.getAttribute("data-transfer-id")
            respondToTransfer(transferId, "accepted")
            this.closest("tr").remove()
          })
        })

        contentElement.querySelectorAll(".reject-btn").forEach((button) => {
          button.addEventListener("click", function () {
            const transferId = this.getAttribute("data-transfer-id")
            respondToTransfer(transferId, "rejected")
            this.closest("tr").remove()
          })
        })
      }
    })
    .catch((error) => {
      console.error(`Error loading ${type} transfers:`, error)
      contentElement.innerHTML = `<p>Error loading transfers: ${error.message}</p>`
    })
}

// Function to respond to a pending transfer (accept or reject)
// Updated respondToTransfer function in transfer-history.js
function respondToTransfer(transferId, action) {
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

        // Refresh the wallet balance after successful transfer response
        loadWalletBalance()

        // Refresh the transfer history tabs
        loadTransferHistory("pending")
        if (action === "accepted") {
          loadTransferHistory("received")
        }
      } else {
        alert(`Error: ${data.message}`)
      }
    })
    .catch((error) => {
      console.error(`Error responding to transfer:`, error)
      alert(`Error responding to transfer: ${error.message}`)
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
        const balance = data.balance || 0
        walletBalanceElement.textContent = `₹${Number(balance).toFixed(2)}`
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

