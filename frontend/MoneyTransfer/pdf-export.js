// pdf-export.js
// This file handles PDF generation for reports

// Import jsPDF if not already included in the HTML
if (typeof jsPDF === "undefined") {
    const script = document.createElement("script")
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
    document.head.appendChild(script)
  
    // Also add jspdf-autotable for better tables
    const autoTableScript = document.createElement("script")
    autoTableScript.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js"
    document.head.appendChild(autoTableScript)
  }
  
  const BASE_URL = window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://penny-pilot-production.up.railway.app";
  
  // Function to generate PDF report
  function generatePdfReport(reportType, fromDate, toDate) {
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
  
    // Prepare query parameters
    let queryParams = `user_id=${currentUser.id}`
    if (reportType === "partial" && fromDate && toDate) {
      queryParams += `&from_date=${fromDate}&to_date=${toDate}`
    }
  
    // Fetch transaction data
    fetch(`${BASE_URL}/get-entries?${queryParams}`)
      .then((response) => {
        if (!response.ok) throw new Error("Network response was not ok")
        return response.json()
      })
      .then((data) => {
        // Fetch wallet and emergency fund balances
        return Promise.all([
          fetch(`${BASE_URL}/get-wallet-balance/${currentUser.id}`).then((res) => res.json()),
          fetch(`${BASE_URL}/get-emergency-fund/${currentUser.id}`).then((res) => res.json()),
          Promise.resolve(data),
        ])
      })
      .then(([walletData, emergencyData, transactionData]) => {
        // Generate PDF
        let jsPDF
        if (window.jspdf && window.jspdf.jsPDF) {
          jsPDF = window.jspdf.jsPDF
        } else {
          console.error("jsPDF library not found.")
          return
        }
        const doc = new jsPDF()
  
        // Add title
        doc.setFontSize(20)
        doc.setTextColor(40, 40, 40)
        doc.text("Penny Pilot Financial Report", 105, 20, { align: "center" })
  
        // Add report period
        doc.setFontSize(12)
        doc.setTextColor(80, 80, 80)
        if (reportType === "partial") {
          doc.text(`Report Period: ${formatDateForPdf(fromDate)} to ${formatDateForPdf(toDate)}`, 105, 30, {
            align: "center",
          })
        } else {
          doc.text("Full Financial Report", 105, 30, { align: "center" })
        }
  
        // Add user info
        doc.setFontSize(12)
        doc.text(`User: ${currentUser.name}`, 20, 40)
        doc.text(`Generated on: ${formatDateForPdf(new Date())}`, 20, 46)
  
        // Add balances
        doc.setFontSize(14)
        doc.setTextColor(40, 40, 40)
        doc.text("Current Balances", 20, 56)
  
        doc.setFontSize(12)
        doc.text(`Wallet Balance: $${Number.parseFloat(walletData.balance).toFixed(2)}`, 30, 64)
        doc.text(`Emergency Fund: $${Number.parseFloat(emergencyData.balance).toFixed(2)}`, 30, 70)
  
        // Add transaction summary
        const creditEntries = transactionData.entries.credit
        const debitEntries = transactionData.entries.debit
  
        const totalCredit = creditEntries.reduce((sum, entry) => sum + Number.parseFloat(entry.amount), 0)
        const totalDebit = debitEntries.reduce((sum, entry) => sum + Number.parseFloat(entry.amount), 0)
        const netCashflow = totalCredit - totalDebit
  
        doc.setFontSize(14)
        doc.text("Transaction Summary", 20, 84)
  
        doc.setFontSize(12)
        doc.text(`Total Income: $${totalCredit.toFixed(2)}`, 30, 92)
        doc.text(`Total Expenses: $${totalDebit.toFixed(2)}`, 30, 98)
        doc.text(`Net Cashflow: $${netCashflow.toFixed(2)}`, 30, 104)
  
        // Add credit transactions table
        if (creditEntries.length > 0) {
          doc.setFontSize(14)
          doc.text("Income Transactions", 20, 118)
  
          // Create table
          const creditTableData = creditEntries.map((entry) => [
            formatDateForPdf(entry.entry_date),
            entry.category,
            `$${Number.parseFloat(entry.amount).toFixed(2)}`,
            entry.description || "-",
          ])
  
          doc.autoTable({
            startY: 122,
            head: [["Date", "Category", "Amount", "Description"]],
            body: creditTableData,
            theme: "striped",
            headStyles: { fillColor: [108, 92, 231] },
            margin: { top: 122 },
          })
        }
  
        // Add debit transactions table on a new page
        if (debitEntries.length > 0) {
          doc.addPage()
  
          doc.setFontSize(14)
          doc.text("Expense Transactions", 20, 20)
  
          // Create table
          const debitTableData = debitEntries.map((entry) => [
            formatDateForPdf(entry.entry_date),
            entry.category,
            `$${Number.parseFloat(entry.amount).toFixed(2)}`,
            entry.description || "-",
          ])
  
          doc.autoTable({
            startY: 24,
            head: [["Date", "Category", "Amount", "Description"]],
            body: debitTableData,
            theme: "striped",
            headStyles: { fillColor: [214, 48, 49] },
            margin: { top: 24 },
          })
        }
  
        // Add category breakdown
        doc.addPage()
  
        doc.setFontSize(16)
        doc.text("Category Breakdown", 105, 20, { align: "center" })
  
        // Process credit categories
        const creditCategories = {}
        creditEntries.forEach((entry) => {
          if (!creditCategories[entry.category]) {
            creditCategories[entry.category] = 0
          }
          creditCategories[entry.category] += Number.parseFloat(entry.amount)
        })
  
        // Process debit categories
        const debitCategories = {}
        debitEntries.forEach((entry) => {
          if (!debitCategories[entry.category]) {
            debitCategories[entry.category] = 0
          }
          debitCategories[entry.category] += Number.parseFloat(entry.amount)
        })
  
        // Create category tables
        doc.setFontSize(14)
        doc.text("Income by Category", 20, 30)
  
        const creditCategoryData = Object.entries(creditCategories).map(([category, amount]) => [
          category,
          `$${amount.toFixed(2)}`,
          `${((amount / totalCredit) * 100).toFixed(1)}%`,
        ])
  
        doc.autoTable({
          startY: 34,
          head: [["Category", "Amount", "Percentage"]],
          body: creditCategoryData,
          theme: "striped",
          headStyles: { fillColor: [0, 184, 148] },
          margin: { top: 34 },
        })
  
        const finalY = doc.lastAutoTable.finalY + 20
  
        doc.setFontSize(14)
        doc.text("Expenses by Category", 20, finalY)
  
        const debitCategoryData = Object.entries(debitCategories).map(([category, amount]) => [
          category,
          `$${amount.toFixed(2)}`,
          `${((amount / totalDebit) * 100).toFixed(1)}%`,
        ])
  
        doc.autoTable({
          startY: finalY + 4,
          head: [["Category", "Amount", "Percentage"]],
          body: debitCategoryData,
          theme: "striped",
          headStyles: { fillColor: [214, 48, 49] },
          margin: { top: finalY + 4 },
        })
  
        // Add footer
        const pageCount = doc.internal.getNumberOfPages()
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i)
          doc.setFontSize(10)
          doc.setTextColor(150, 150, 150)
          doc.text(`Penny Pilot - Page ${i} of ${pageCount}`, 105, doc.internal.pageSize.height - 10, { align: "center" })
        }
  
        // Save the PDF
        const fileName = `PennyPilot_Report_${currentUser.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`
        doc.save(fileName)
  
        // Remove loading overlay
        document.body.removeChild(loadingOverlay)
  
        // Show success message
        alert("PDF report generated successfully!")
      })
      .catch((error) => {
        console.error("Error generating PDF report:", error)
        // Remove loading overlay
        document.body.removeChild(loadingOverlay)
        alert("Failed to generate PDF report. Please try again.")
      })
  }
  
  // Helper function to format date for PDF
  function formatDateForPdf(dateString) {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
  }
  
  // Function to generate debt PDF report
  function generateDebtPdfReport(reportType, fromDate, toDate) {
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
  
    // Fetch debt data
    fetch(`${BASE_URL}/get-debts/${currentUser.id}`)
      .then((response) => {
        if (!response.ok) throw new Error("Network response was not ok")
        return response.json()
      })
      .then((debtData) => {
        // Fetch debt transactions
        return fetch(`${BASE_URL}/debt-transactions/${currentUser.id}`)
          .then((response) => {
            if (!response.ok) throw new Error("Network response was not ok")
            return response.json()
          })
          .then((transactionData) => {
            return { debts: debtData.debts, transactions: transactionData.transactions, statistics: debtData.statistics }
          })
      })
      .then((data) => {
        // Filter data if partial report
        let filteredDebts = data.debts
        let filteredTransactions = data.transactions
  
        if (reportType === "partial" && fromDate && toDate) {
          const startDate = new Date(fromDate)
          const endDate = new Date(toDate)
          endDate.setHours(23, 59, 59, 999) // Include the entire end date
  
          filteredDebts = data.debts.filter((debt) => {
            const debtDate = new Date(debt.created_at || debt.start_date)
            return debtDate >= startDate && debtDate <= endDate
          })
  
          filteredTransactions = data.transactions.filter((transaction) => {
            const transactionDate = new Date(transaction.transaction_date)
            return transactionDate >= startDate && transactionDate <= endDate
          })
        }
  
        // Generate PDF
        let jsPDF
        if (window.jspdf && window.jspdf.jsPDF) {
          jsPDF = window.jspdf.jsPDF
        } else {
          console.error("jsPDF library not found.")
          return
        }
        const doc = new jsPDF()
  
        // Add title
        doc.setFontSize(20)
        doc.setTextColor(40, 40, 40)
        doc.text("Penny Pilot Debt Report", 105, 20, { align: "center" })
  
        // Add report period
        doc.setFontSize(12)
        doc.setTextColor(80, 80, 80)
        if (reportType === "partial") {
          doc.text(`Report Period: ${formatDateForPdf(fromDate)} to ${formatDateForPdf(toDate)}`, 105, 30, {
            align: "center",
          })
        } else {
          doc.text("Full Debt Report", 105, 30, { align: "center" })
        }
  
        // Add user info
        doc.setFontSize(12)
        doc.text(`User: ${currentUser.name}`, 20, 40)
        doc.text(`Generated on: ${formatDateForPdf(new Date())}`, 20, 46)
  
        // Add debt summary
        doc.setFontSize(14)
        doc.setTextColor(40, 40, 40)
        doc.text("Debt Summary", 20, 56)
  
        doc.setFontSize(12)
        doc.text(`Total Debt Given: $${Number.parseFloat(data.statistics.total_given).toFixed(2)}`, 30, 64)
        doc.text(`Total Debt Received: $${Number.parseFloat(data.statistics.total_received).toFixed(2)}`, 30, 70)
        doc.text(`Active Debts: ${data.statistics.active_debts}`, 30, 76)
        doc.text(`Overdue Debts: ${data.statistics.overdue_debts}`, 30, 82)
  
        // Add debt tables
        if (filteredDebts.length > 0) {
          // Separate debts by type
          const givenDebts = filteredDebts.filter((debt) => debt.debt_type === "given")
          const receivedDebts = filteredDebts.filter((debt) => debt.debt_type === "received")
  
          // Given debts table
          if (givenDebts.length > 0) {
            doc.setFontSize(14)
            doc.text("Debts Given", 20, 96)
  
            const givenDebtData = givenDebts.map((debt) => [
              formatDateForPdf(debt.start_date),
              formatDateForPdf(debt.due_date),
              debt.counterparty || "Unknown",
              `$${Number.parseFloat(debt.amount).toFixed(2)}`,
              `$${Number.parseFloat(debt.remaining_amount || debt.amount).toFixed(2)}`,
              debt.status.replace(/_/g, " "),
            ])
  
            doc.autoTable({
              startY: 100,
              head: [["Start Date", "Due Date", "To", "Original Amount", "Remaining", "Status"]],
              body: givenDebtData,
              theme: "striped",
              headStyles: { fillColor: [214, 48, 49] },
              margin: { top: 100 },
            })
          }
  
          // Received debts table
          if (receivedDebts.length > 0) {
            // Check if we need a new page
            if (givenDebts.length > 0 && doc.lastAutoTable.finalY > 180) {
              doc.addPage()
              doc.setFontSize(14)
              doc.text("Debts Received", 20, 20)
  
              const receivedDebtData = receivedDebts.map((debt) => [
                formatDateForPdf(debt.start_date),
                formatDateForPdf(debt.due_date),
                debt.counterparty || "Unknown",
                `$${Number.parseFloat(debt.amount).toFixed(2)}`,
                `$${Number.parseFloat(debt.remaining_amount || debt.amount).toFixed(2)}`,
                debt.status.replace(/_/g, " "),
              ])
  
              doc.autoTable({
                startY: 24,
                head: [["Start Date", "Due Date", "From", "Original Amount", "Remaining", "Status"]],
                body: receivedDebtData,
                theme: "striped",
                headStyles: { fillColor: [0, 184, 148] },
                margin: { top: 24 },
              })
            } else {
              const startY = givenDebts.length > 0 ? doc.lastAutoTable.finalY + 15 : 100
  
              doc.setFontSize(14)
              doc.text("Debts Received", 20, startY)
  
              const receivedDebtData = receivedDebts.map((debt) => [
                formatDateForPdf(debt.start_date),
                formatDateForPdf(debt.due_date),
                debt.counterparty || "Unknown",
                `$${Number.parseFloat(debt.amount).toFixed(2)}`,
                `$${Number.parseFloat(debt.remaining_amount || debt.amount).toFixed(2)}`,
                debt.status.replace(/_/g, " "),
              ])
  
              doc.autoTable({
                startY: startY + 4,
                head: [["Start Date", "Due Date", "From", "Original Amount", "Remaining", "Status"]],
                body: receivedDebtData,
                theme: "striped",
                headStyles: { fillColor: [0, 184, 148] },
                margin: { top: startY + 4 },
              })
            }
          }
        }
  
        // Add transactions table on a new page
        if (filteredTransactions.length > 0) {
          doc.addPage()
  
          doc.setFontSize(14)
          doc.text("Debt Transactions", 20, 20)
  
          // Create table
          const transactionData = filteredTransactions.map((transaction) => [
            formatDateForPdf(transaction.transaction_date),
            transaction.transaction_type === "collection" ? "Collection" : "Payment",
            `$${Number.parseFloat(transaction.amount).toFixed(2)}`,
            transaction.description || "-",
          ])
  
          doc.autoTable({
            startY: 24,
            head: [["Date", "Type", "Amount", "Description"]],
            body: transactionData,
            theme: "striped",
            headStyles: { fillColor: [108, 92, 231] },
            margin: { top: 24 },
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
        const fileName = `PennyPilot_Debt_Report_${currentUser.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`
        doc.save(fileName)
  
        // Remove loading overlay
        document.body.removeChild(loadingOverlay)
  
        // Show success message
        alert("Debt PDF report generated successfully!")
      })
      .catch((error) => {
        console.error("Error generating debt PDF report:", error)
        // Remove loading overlay
        document.body.removeChild(loadingOverlay)
        alert("Failed to generate debt PDF report. Please try again.")
      })
  }
  
  