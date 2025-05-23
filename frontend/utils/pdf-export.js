// PDF Export Utility Functions
const PdfExport = {
  // Initialize the PDF export functionality
  init: () => {
    if (typeof window.jspdf === "undefined") {
      console.error("jsPDF library not loaded")
      return false
    }
    if (typeof window.html2canvas === "undefined") {
      console.error("html2canvas library not loaded")
      return false
    }
    return true
  },

  // Generate PDF for Dashboard/Expenditure
  generateExpenditurePdf: function (reportType, fromDate, toDate) {
    if (!this.init()) {
      alert("Required libraries not loaded. Please refresh the page and try again.")
      return
    }

    const currentUser = JSON.parse(localStorage.getItem("currentUser"))
    if (!currentUser) {
      alert("User not logged in")
      return
    }

    // Create a new jsPDF instance
    const { jsPDF } = window.jspdf
    const doc = new jsPDF("p", "mm", "a4")
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    // Add header
    this.addHeader(doc, "Expenditure Report", currentUser.name)

    let yPos = 40

    // Add report type and date range
    doc.setFontSize(12)
    doc.text(`Report Type: ${reportType === "full" ? "Full Report" : "Partial Report"}`, 20, yPos)
    yPos += 10

    let creditEntries = []
    let debitEntries = []

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

    if (reportType === "partial") {
      const fromDateObj = new Date(fromDate)
      const toDateObj = new Date(toDate)
      // Set time to end of day for toDate to include the entire day
      toDateObj.setHours(23, 59, 59, 999)

      console.log(`Filtering entries from ${fromDateObj.toISOString()} to ${toDateObj.toISOString()}`)

      fetch(`http://localhost:3000/get-entries?user_id=${currentUser.id}`)
        .then((response) => response.json())
        .then((data) => {
          creditEntries = data.entries.credit
          debitEntries = data.entries.debit

          creditEntries = creditEntries.filter((entry) => {
            const entryDate = new Date(entry.entry_date)
            return entryDate >= fromDateObj && entryDate <= toDateObj
          })

          debitEntries = debitEntries.filter((entry) => {
            const entryDate = new Date(entry.entry_date)
            return entryDate >= fromDateObj && entryDate <= toDateObj
          })

          console.log(`Filtered to ${creditEntries.length} credit entries and ${debitEntries.length} debit entries`)
          yPos += 10

          // Add wallet and emergency fund balances
          const walletBalance = localStorage.getItem(`wallet_balance_${currentUser.id}`) || "0.00"
          const emergencyBalance = localStorage.getItem(`emergency_fund_${currentUser.id}`) || "0.00"

          doc.text(`Wallet Balance: ₹${Number(walletBalance).toFixed(2)}`, 20, yPos)
          yPos += 10
          doc.text(`Emergency Fund: ₹${Number(emergencyBalance).toFixed(2)}`, 20, yPos)
          yPos += 15

          // Add credit entries table
          if (creditEntries.length > 0) {
            doc.setFontSize(14)
            doc.text("Credit Entries", 20, yPos)
            yPos += 10

            const creditHeaders = [["Date", "Category", "Amount", "Description"]]
            const creditData = creditEntries.map((entry) => [
              new Date(entry.entry_date).toLocaleDateString(),
              entry.category,
              `₹${Number(entry.amount).toFixed(2)}`,
              entry.description || "-",
            ])

            doc.autoTable({
              startY: yPos,
              head: creditHeaders,
              body: creditData,
              theme: "grid",
              headStyles: { fillColor: [108, 92, 231] },
              margin: { top: 10 },
              didDrawPage: (data) => {
                // Add header on new pages
                if (data.pageCount > 1 && data.cursor.y === data.settings.margin.top) {
                  doc.setFontSize(12)
                  doc.text("Credit Entries (continued)", 20, 20)
                }
              },
            })

            yPos = doc.lastAutoTable.finalY + 15
          } else {
            doc.setFontSize(12)
            doc.text("No credit entries found for this period", 20, yPos)
            yPos += 15
          }

          // Add debit entries table
          if (debitEntries.length > 0) {
            // Check if we need a new page
            if (yPos > pageHeight - 60) {
              doc.addPage()
              yPos = 20
            }

            doc.setFontSize(14)
            doc.text("Debit Entries", 20, yPos)
            yPos += 10

            const debitHeaders = [["Date", "Category", "Amount", "Description"]]
            const debitData = debitEntries.map((entry) => [
              new Date(entry.entry_date).toLocaleDateString(),
              entry.category,
              `₹${Number(entry.amount).toFixed(2)}`,
              entry.description || "-",
            ])

            doc.autoTable({
              startY: yPos,
              head: debitHeaders,
              body: debitData,
              theme: "grid",
              headStyles: { fillColor: [214, 48, 49] },
              margin: { top: 10 },
              didDrawPage: (data) => {
                // Add header on new pages
                if (data.pageCount > 1 && data.cursor.y === data.settings.margin.top) {
                  doc.setFontSize(12)
                  doc.text("Debit Entries (continued)", 20, 20)
                }
              },
            })

            yPos = doc.lastAutoTable.finalY + 15
          } else {
            doc.setFontSize(12)
            doc.text("No debit entries found for this period", 20, yPos)
            yPos += 15
          }

          // Add summary section
          if (creditEntries.length > 0 || debitEntries.length > 0) {
            // Check if we need a new page
            if (yPos > pageHeight - 80) {
              doc.addPage()
              yPos = 20
            }

            doc.setFontSize(14)
            doc.text("Financial Summary", 20, yPos)
            yPos += 10

            const totalCredit = creditEntries.reduce((sum, entry) => sum + Number(entry.amount), 0)
            const totalDebit = debitEntries.reduce((sum, entry) => sum + Number(entry.amount), 0)
            const netCashflow = totalCredit - totalDebit

            doc.setFontSize(12)
            doc.text(`Total Income: ₹${totalCredit.toFixed(2)}`, 30, yPos)
            yPos += 8
            doc.text(`Total Expenses: ₹${totalDebit.toFixed(2)}`, 30, yPos)
            yPos += 8
            doc.text(`Net Cashflow: ₹${netCashflow.toFixed(2)}`, 30, yPos)
            yPos += 8

            // Set color based on positive or negative cashflow
            if (netCashflow >= 0) {
              doc.setTextColor(0, 184, 148) // Green for positive
            } else {
              doc.setTextColor(214, 48, 49) // Red for negative
            }

            doc.text(`Overall Financial Status: ${netCashflow >= 0 ? "Positive" : "Negative"}`, 30, yPos)

            // Reset text color
            doc.setTextColor(0, 0, 0)
            yPos += 15
          }

          // Add charts
          this.addChartsToExpenditurePdf(doc, yPos, creditEntries, debitEntries)
            .then(() => {
              // Remove loading indicator
              document.body.removeChild(loadingOverlay)
            })
            .catch((error) => {
              console.error("Error generating PDF:", error)
              alert("Error generating PDF. Please try again.")
              document.body.removeChild(loadingOverlay)
            })
        })
        .catch((error) => {
          console.error("Error fetching entries for PDF:", error)
          alert("Error generating PDF. Please try again.")
          document.body.removeChild(loadingOverlay)
        })
    } else {
      // Fetch entries
      fetch(`http://localhost:3000/get-entries?user_id=${currentUser.id}`)
        .then((response) => response.json())
        .then((data) => {
          creditEntries = data.entries.credit
          debitEntries = data.entries.debit

          // Add wallet and emergency fund balances
          const walletBalance = localStorage.getItem(`wallet_balance_${currentUser.id}`) || "0.00"
          const emergencyBalance = localStorage.getItem(`emergency_fund_${currentUser.id}`) || "0.00"

          doc.text(`Wallet Balance: ₹${Number(walletBalance).toFixed(2)}`, 20, yPos)
          yPos += 10
          doc.text(`Emergency Fund: ₹${Number(emergencyBalance).toFixed(2)}`, 20, yPos)
          yPos += 15

          // Add credit entries table
          if (creditEntries.length > 0) {
            doc.setFontSize(14)
            doc.text("Credit Entries", 20, yPos)
            yPos += 10

            const creditHeaders = [["Date", "Category", "Amount", "Description"]]
            const creditData = creditEntries.map((entry) => [
              new Date(entry.entry_date).toLocaleDateString(),
              entry.category,
              `₹${Number(entry.amount).toFixed(2)}`,
              entry.description || "-",
            ])

            doc.autoTable({
              startY: yPos,
              head: creditHeaders,
              body: creditData,
              theme: "grid",
              headStyles: { fillColor: [108, 92, 231] },
              margin: { top: 10 },
              didDrawPage: (data) => {
                // Add header on new pages
                if (data.pageCount > 1 && data.cursor.y === data.settings.margin.top) {
                  doc.setFontSize(12)
                  doc.text("Credit Entries (continued)", 20, 20)
                }
              },
            })

            yPos = doc.lastAutoTable.finalY + 15
          } else {
            doc.setFontSize(12)
            doc.text("No credit entries found for this period", 20, yPos)
            yPos += 15
          }

          // Add debit entries table
          if (debitEntries.length > 0) {
            // Check if we need a new page
            if (yPos > pageHeight - 60) {
              doc.addPage()
              yPos = 20
            }

            doc.setFontSize(14)
            doc.text("Debit Entries", 20, yPos)
            yPos += 10

            const debitHeaders = [["Date", "Category", "Amount", "Description"]]
            const debitData = debitEntries.map((entry) => [
              new Date(entry.entry_date).toLocaleDateString(),
              entry.category,
              `₹${Number(entry.amount).toFixed(2)}`,
              entry.description || "-",
            ])

            doc.autoTable({
              startY: yPos,
              head: debitHeaders,
              body: debitData,
              theme: "grid",
              headStyles: { fillColor: [214, 48, 49] },
              margin: { top: 10 },
              didDrawPage: (data) => {
                // Add header on new pages
                if (data.pageCount > 1 && data.cursor.y === data.settings.margin.top) {
                  doc.setFontSize(12)
                  doc.text("Debit Entries (continued)", 20, 20)
                }
              },
            })

            yPos = doc.lastAutoTable.finalY + 15
          } else {
            doc.setFontSize(12)
            doc.text("No debit entries found for this period", 20, yPos)
            yPos += 15
          }

          // Add summary section
          if (creditEntries.length > 0 || debitEntries.length > 0) {
            // Check if we need a new page
            if (yPos > pageHeight - 80) {
              doc.addPage()
              yPos = 20
            }

            doc.setFontSize(14)
            doc.text("Financial Summary", 20, yPos)
            yPos += 10

            const totalCredit = creditEntries.reduce((sum, entry) => sum + Number(entry.amount), 0)
            const totalDebit = debitEntries.reduce((sum, entry) => sum + Number(entry.amount), 0)
            const netCashflow = totalCredit - totalDebit

            doc.setFontSize(12)
            doc.text(`Total Income: ₹${totalCredit.toFixed(2)}`, 30, yPos)
            yPos += 8
            doc.text(`Total Expenses: ₹${totalDebit.toFixed(2)}`, 30, yPos)
            yPos += 8
            doc.text(`Net Cashflow: ₹${netCashflow.toFixed(2)}`, 30, yPos)
            yPos += 8

            // Set color based on positive or negative cashflow
            if (netCashflow >= 0) {
              doc.setTextColor(0, 184, 148) // Green for positive
            } else {
              doc.setTextColor(214, 48, 49) // Red for negative
            }

            doc.text(`Overall Financial Status: ${netCashflow >= 0 ? "Positive" : "Negative"}`, 30, yPos)

            // Reset text color
            doc.setTextColor(0, 0, 0)
            yPos += 15
          }

          // Add charts
          this.addChartsToExpenditurePdf(doc, yPos, creditEntries, debitEntries)
            .then(() => {
              // Remove loading indicator
              document.body.removeChild(loadingOverlay)
            })
            .catch((error) => {
              console.error("Error generating PDF:", error)
              alert("Error generating PDF. Please try again.")
              document.body.removeChild(loadingOverlay)
            })
        })
        .catch((error) => {
          console.error("Error fetching entries for PDF:", error)
          alert("Error generating PDF. Please try again.")
          document.body.removeChild(loadingOverlay)
        })
    }
  },

  // Add charts to expenditure PDF
  addChartsToExpenditurePdf: async function (doc, yPos, creditEntries, debitEntries) {
    try {
      // Wait for charts to be fully rendered
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Capture debit pie chart
      const debitPieChart = document.getElementById("debitPieChart")
      if (!debitPieChart) {
        throw new Error("Debit pie chart not found")
      }

      const debitPieCanvas = await window.html2canvas(debitPieChart, {
        scale: 2,
        logging: false,
        useCORS: true,
        backgroundColor: null,
      })

      // Check if we need a new page
      if (yPos > doc.internal.pageSize.getHeight() - 100) {
        doc.addPage()
        yPos = 20
      }

      doc.setFontSize(14)
      doc.text("Debit Categories (Pie)", 20, yPos)
      yPos += 10

      const debitPieImg = debitPieCanvas.toDataURL("image/png")
      const debitPieWidth = 170
      const debitPieHeight = (debitPieCanvas.height * debitPieWidth) / debitPieCanvas.width
      doc.addImage(debitPieImg, "PNG", 20, yPos, debitPieWidth, debitPieHeight)
      yPos += debitPieHeight + 15

      // Capture credit pie chart
      const creditPieChart = document.getElementById("creditPieChart")
      if (!creditPieChart) {
        throw new Error("Credit pie chart not found")
      }

      const creditPieCanvas = await window.html2canvas(creditPieChart, {
        scale: 2,
        logging: false,
        useCORS: true,
        backgroundColor: null,
      })

      if (yPos > doc.internal.pageSize.getHeight() - 100) {
        doc.addPage()
        yPos = 20
      }

      doc.text("Credit Categories (Pie)", 20, yPos)
      yPos += 10

      const creditPieImg = creditPieCanvas.toDataURL("image/png")
      const creditPieHeight = (creditPieCanvas.height * debitPieWidth) / creditPieCanvas.width
      doc.addImage(creditPieImg, "PNG", 20, yPos, debitPieWidth, creditPieHeight)
      yPos += creditPieHeight + 15

      // Capture debit bar chart
      const debitBarChart = document.getElementById("debitBarChart")
      if (!debitBarChart) {
        throw new Error("Debit bar chart not found")
      }

      const debitBarCanvas = await window.html2canvas(debitBarChart, {
        scale: 2,
        logging: false,
        useCORS: true,
        backgroundColor: null,
      })

      if (yPos > doc.internal.pageSize.getHeight() - 100) {
        doc.addPage()
        yPos = 20
      }

      doc.text("Debit Categories (Bar)", 20, yPos)
      yPos += 10

      const debitBarImg = debitBarCanvas.toDataURL("image/png")
      const debitBarHeight = (debitBarCanvas.height * debitPieWidth) / debitBarCanvas.width
      doc.addImage(debitBarImg, "PNG", 20, yPos, debitPieWidth, debitBarHeight)
      yPos += debitBarHeight + 15

      // Capture credit bar chart
      const creditBarChart = document.getElementById("creditBarChart")
      if (!creditBarChart) {
        throw new Error("Credit bar chart not found")
      }

      const creditBarCanvas = await window.html2canvas(creditBarChart, {
        scale: 2,
        logging: false,
        useCORS: true,
        backgroundColor: null,
      })

      if (yPos > doc.internal.pageSize.getHeight() - 100) {
        doc.addPage()
        yPos = 20
      }

      doc.text("Credit Categories (Bar)", 20, yPos)
      yPos += 10

      const creditBarImg = creditBarCanvas.toDataURL("image/png")
      const creditBarHeight = (creditBarCanvas.height * debitPieWidth) / creditBarCanvas.width
      doc.addImage(creditBarImg, "PNG", 20, yPos, debitPieWidth, creditBarHeight)

      // Add footer
      this.addFooter(doc)

      // Save the PDF
      doc.save(`Penny_Pilot_Expenditure_Report_${new Date().toISOString().split("T")[0]}.pdf`)
    } catch (error) {
      console.error("Error adding charts to PDF:", error)
      this.addFooter(doc)
      doc.save(`Penny_Pilot_Expenditure_Report_${new Date().toISOString().split("T")[0]}.pdf`)
      throw error
    }
  },

  // Generate PDF for Debts
  generateDebtsPdf: function (reportType, fromDate, toDate) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"))
    if (!currentUser) {
      alert("User not logged in")
      return
    }

    // Create a new jsPDF instance
    const { jsPDF } = window.jspdf
    const doc = new jsPDF("p", "mm", "a4")
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    // Add header
    this.addHeader(doc, "Debts Report", currentUser.name)

    let yPos = 40

    // Add report type and date range
    doc.setFontSize(12)
    doc.text(`Report Type: ${reportType === "full" ? "Full Report" : "Partial Report"}`, 20, yPos)
    yPos += 10

    if (reportType === "partial") {
      doc.text(
        `Date Range: ${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}`,
        20,
        yPos,
      )
      yPos += 10
    }

    // Fetch debts
    fetch(`http://localhost:3000/get-debts/${currentUser.id}`)
      .then((response) => response.json())
      .then((data) => {
        if (!data.success) {
          throw new Error("Failed to fetch debts")
        }

        let debts = data.debts

        // Filter by date range if partial report
        if (reportType === "partial") {
          const fromDateObj = new Date(fromDate)
          const toDateObj = new Date(toDate)

          debts = debts.filter((debt) => {
            const startDate = new Date(debt.start_date)
            return startDate >= fromDateObj && startDate <= toDateObj
          })
        }

        // Add debt statistics
        doc.text(`Total Debt Given: ₹${Number(data.statistics.total_given).toFixed(2)}`, 20, yPos)
        yPos += 10
        doc.text(`Total Debt Taken: ₹${Number(data.statistics.total_received).toFixed(2)}`, 20, yPos)
        yPos += 15

        // Separate debts by type
        const givenDebts = debts.filter((debt) => debt.debt_type === "given")
        const takenDebts = debts.filter((debt) => debt.debt_type === "received")

        // Add given debts table
        if (givenDebts.length > 0) {
          doc.setFontSize(14)
          doc.text("Debts Given", 20, yPos)
          yPos += 10

          const givenHeaders = [["Counterparty", "Amount", "Interest", "Due Date", "Status"]]
          const givenData = givenDebts.map((debt) => [
            debt.counterparty || "Unknown",
            `₹${Number(debt.remaining_amount).toFixed(2)}`,
            `${Number(debt.interest_rate).toFixed(2)}% (${debt.interest_type})`,
            new Date(debt.due_date).toLocaleDateString(),
            debt.status,
          ])

          doc.autoTable({
            startY: yPos,
            head: givenHeaders,
            body: givenData,
            theme: "grid",
            headStyles: { fillColor: [214, 48, 49] },
            margin: { top: 10 },
          })

          yPos = doc.lastAutoTable.finalY + 15
        }

        // Add taken debts table
        if (takenDebts.length > 0) {
          // Check if we need a new page
          if (yPos > pageHeight - 60) {
            doc.addPage()
            yPos = 20
          }

          doc.setFontSize(14)
          doc.text("Debts Taken", 20, yPos)
          yPos += 10

          const takenHeaders = [["Counterparty", "Amount", "Interest", "Due Date", "Status"]]
          const takenData = takenDebts.map((debt) => [
            debt.counterparty || "Unknown",
            `₹${Number(debt.remaining_amount).toFixed(2)}`,
            `${Number(debt.interest_rate).toFixed(2)}% (${debt.interest_type})`,
            new Date(debt.due_date).toLocaleDateString(),
            debt.status,
          ])

          doc.autoTable({
            startY: yPos,
            head: takenHeaders,
            body: takenData,
            theme: "grid",
            headStyles: { fillColor: [0, 184, 148] },
            margin: { top: 10 },
          })

          yPos = doc.lastAutoTable.finalY + 15
        }

        // Add charts
        this.addChartsToDebtsPdf(doc, yPos, givenDebts, takenDebts)
      })
      .catch((error) => {
        console.error("Error fetching debts for PDF:", error)
        alert("Error generating PDF. Please try again.")
      })
  },

  // Add charts to debts PDF
  addChartsToDebtsPdf: function (doc, yPos, givenDebts, takenDebts) {
    // Capture pie charts
    const pieChartPromise = window
      .html2canvas(document.getElementById("debt-list-container"), {
        scale: 2,
        logging: false,
        useCORS: true,
      })
      .then((canvas) => {
        // Check if we need a new page
        if (yPos > doc.internal.pageSize.getHeight() - 100) {
          doc.addPage()
          yPos = 20
        }

        doc.setFontSize(14)
        doc.text("Debt Distribution Charts", 20, yPos)
        yPos += 10

        const imgData = canvas.toDataURL("image/png")
        const imgWidth = 170
        const imgHeight = (canvas.height * imgWidth) / canvas.width

        doc.addImage(imgData, "PNG", 20, yPos, imgWidth, imgHeight)
        yPos += imgHeight + 10

        return yPos
      })

    // Capture bar charts
    pieChartPromise
      .then((newYPos) => {
        yPos = newYPos

        return window.html2canvas(document.getElementById("debt-stats-container"), {
          scale: 2,
          logging: false,
          useCORS: true,
        })
      })
      .then((canvas) => {
        // Check if we need a new page
        if (yPos > doc.internal.pageSize.getHeight() - 100) {
          doc.addPage()
          yPos = 20
        }

        const imgData = canvas.toDataURL("image/png")
        const imgWidth = 170
        const imgHeight = (canvas.height * imgWidth) / canvas.width

        doc.addImage(imgData, "PNG", 20, yPos, imgWidth, imgHeight)

        // Add footer
        this.addFooter(doc)

        // Save the PDF
        doc.save(`Penny_Pilot_Debts_Report_${new Date().toISOString().split("T")[0]}.pdf`)
      })
      .catch((error) => {
        console.error("Error adding charts to PDF:", error)

        // Still save the PDF even if charts fail
        this.addFooter(doc)
        doc.save(`Penny_Pilot_Debts_Report_${new Date().toISOString().split("T")[0]}.pdf`)
      })
  },

  // Generate PDF for Investments
  generateInvestmentsPdf: function (reportType, fromDate, toDate) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"))
    if (!currentUser) {
      alert("User not logged in")
      return
    }

    // Create a new jsPDF instance
    const { jsPDF } = window.jspdf
    const doc = new jsPDF("p", "mm", "a4")
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    // Add header
    this.addHeader(doc, "Investments Report", currentUser.name)

    let yPos = 40

    // Add report type and date range
    doc.setFontSize(12)
    doc.text(`Report Type: ${reportType === "full" ? "Full Report" : "Partial Report"}`, 20, yPos)
    yPos += 10

    if (reportType === "partial") {
      doc.text(
        `Date Range: ${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}`,
        20,
        yPos,
      )
      yPos += 10
    }

    // Fetch investments
    fetch(`http://localhost:3000/get-investments/${currentUser.id}`)
      .then((response) => response.json())
      .then((data) => {
        let investments = data.investments

        // Filter by date range if partial report
        if (reportType === "partial") {
          const fromDateObj = new Date(fromDate)
          const toDateObj = new Date(toDate)

          investments = investments.filter((inv) => {
            const buyDate = new Date(inv.buy_date)
            return buyDate >= fromDateObj && buyDate <= toDateObj
          })
        }

        // Add investment statistics
        doc.text(`Total Invested: ₹${Number(data.summary.total_invested).toFixed(2)}`, 20, yPos)
        yPos += 10
        doc.text(`Current Value: ₹${Number(data.summary.total_current_value).toFixed(2)}`, 20, yPos)
        yPos += 10
        doc.text(
          `Profit/Loss: ₹${Number(data.summary.total_profit_loss).toFixed(2)} (${data.summary.total_profit_loss_percentage}%)`,
          20,
          yPos,
        )
        yPos += 15

        // Separate investments by status
        const activeInvestments = investments.filter((inv) => inv.status === "active")
        const soldInvestments = investments.filter((inv) => inv.status === "sold")

        // Add active investments table
        if (activeInvestments.length > 0) {
          doc.setFontSize(14)
          doc.text("Active Investments", 20, yPos)
          yPos += 10

          const activeHeaders = [["Stock", "Buy Price", "Current Price", "Quantity", "Buy Date", "Profit/Loss"]]
          const activeData = activeInvestments.map((inv) => [
            inv.stock_name,
            `₹${Number(inv.buy_price).toFixed(2)}`,
            `₹${Number(inv.current_price).toFixed(2)}`,
            inv.quantity,
            new Date(inv.buy_date).toLocaleDateString(),
            `₹${Number(inv.profit_loss).toFixed(2)} (${inv.profit_loss_percentage}%)`,
          ])

          doc.autoTable({
            startY: yPos,
            head: activeHeaders,
            body: activeData,
            theme: "grid",
            headStyles: { fillColor: [0, 184, 148] },
            margin: { top: 10 },
          })

          yPos = doc.lastAutoTable.finalY + 15
        }

        // Add sold investments table
        if (soldInvestments.length > 0) {
          // Check if we need a new page
          if (yPos > pageHeight - 60) {
            doc.addPage()
            yPos = 20
          }

          doc.setFontSize(14)
          doc.text("Sold Investments", 20, yPos)
          yPos += 10

          const soldHeaders = [["Stock", "Buy Price", "Sell Price", "Quantity", "Buy Date", "Sell Date", "Profit/Loss"]]
          const soldData = soldInvestments.map((inv) => [
            inv.stock_name,
            `₹${Number(inv.buy_price).toFixed(2)}`,
            `₹${Number(inv.sell_price).toFixed(2)}`,
            inv.quantity,
            new Date(inv.buy_date).toLocaleDateString(),
            new Date(inv.sell_date).toLocaleDateString(),
            `₹${Number(inv.profit_loss).toFixed(2)} (${inv.profit_loss_percentage}%)`,
          ])

          doc.autoTable({
            startY: yPos,
            head: soldHeaders,
            body: soldData,
            theme: "grid",
            headStyles: { fillColor: [214, 48, 49] },
            margin: { top: 10 },
          })

          yPos = doc.lastAutoTable.finalY + 15
        }

        // Add charts
        this.addChartsToInvestmentsPdf(doc, yPos, activeInvestments)
      })
      .catch((error) => {
        console.error("Error fetching investments for PDF:", error)
        alert("Error generating PDF. Please try again.")
      })
  },

  // Add charts to investments PDF
  addChartsToInvestmentsPdf: function (doc, yPos, investments) {
    // Capture pie chart
    const pieChartPromise = window
      .html2canvas(document.querySelector(".swiper-slide:first-child"), {
        scale: 2,
        logging: false,
        useCORS: true,
      })
      .then((canvas) => {
        // Check if we need a new page
        if (yPos > doc.internal.pageSize.getHeight() - 100) {
          doc.addPage()
          yPos = 20
        }

        doc.setFontSize(14)
        doc.text("Investment Distribution", 20, yPos)
        yPos += 10

        const imgData = canvas.toDataURL("image/png")
        const imgWidth = 170
        const imgHeight = (canvas.height * imgWidth) / canvas.width

        doc.addImage(imgData, "PNG", 20, yPos, imgWidth, imgHeight)
        yPos += imgHeight + 10

        return yPos
      })

    // Capture bar chart
    pieChartPromise
      .then((newYPos) => {
        yPos = newYPos

        return window.html2canvas(document.querySelector(".swiper-slide:nth-child(2)"), {
          scale: 2,
          logging: false,
          useCORS: true,
        })
      })
      .then((canvas) => {
        // Check if we need a new page
        if (yPos > doc.internal.pageSize.getHeight() - 100) {
          doc.addPage()
          yPos = 20
        }

        const imgData = canvas.toDataURL("image/png")
        const imgWidth = 170
        const imgHeight = (canvas.height * imgWidth) / canvas.width

        doc.addImage(imgData, "PNG", 20, yPos, imgWidth, imgHeight)

        // Add footer
        this.addFooter(doc)

        // Save the PDF
        doc.save(`Penny_Pilot_Investments_Report_${new Date().toISOString().split("T")[0]}.pdf`)
      })
      .catch((error) => {
        console.error("Error adding charts to PDF:", error)

        // Still save the PDF even if charts fail
        this.addFooter(doc)
        doc.save(`Penny_Pilot_Investments_Report_${new Date().toISOString().split("T")[0]}.pdf`)
      })
  },

  // Add header to PDF
  addHeader: (doc, title, username) => {
    doc.setFontSize(20)
    doc.text(title, 20, 20)
    doc.setFontSize(12)
    doc.text(`Generated for: ${username}`, 20, 30)
  },

  // Add footer to PDF
  addFooter: (doc) => {
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(10)
      doc.text(
        `Generated on: ${new Date().toLocaleString()}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" },
      )
    }
  },
}

// Make sure PdfExport is available globally
if (typeof window !== "undefined") {
  window.PdfExport = PdfExport
}

// Initialize when the script loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    if (typeof window.PdfExport === "undefined") {
      window.PdfExport = PdfExport
    }
  })
} else {
  if (typeof window.PdfExport === "undefined") {
    window.PdfExport = PdfExport
  }
}
