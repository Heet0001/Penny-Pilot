// PDF Export Utility for Penny Pilot
class PdfExport {
    static async generateDebtsPdf(reportType, fromDate, toDate) {
        // Import jsPDF dynamically
        const { jsPDF } = await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        const { autoTable } = await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js');

        // Create new PDF document
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        
        // Add title
        doc.setFontSize(20);
        doc.text('Penny Pilot - Debt Report', pageWidth / 2, 20, { align: 'center' });
        
        // Add report type and date range
        doc.setFontSize(12);
        const reportTypeText = reportType === 'full' ? 'Full Report' : `Report from ${fromDate} to ${toDate}`;
        doc.text(reportTypeText, pageWidth / 2, 30, { align: 'center' });
        
        // Add generation date
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, 40, { align: 'center' });
        
        // Get debt data
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser) {
            alert('User not logged in');
            return;
        }

        try {
            const response = await fetch(`http://localhost:3000/get-debts/${currentUser.id}`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error('Failed to fetch debt data');
            }

            const debts = data.debts;
            
            // Filter debts based on report type
            let filteredDebts = debts;
            if (reportType === 'partial') {
                filteredDebts = debts.filter(debt => {
                    const debtDate = new Date(debt.start_date);
                    return debtDate >= new Date(fromDate) && debtDate <= new Date(toDate);
                });
            }

            // Separate given and received debts
            const givenDebts = filteredDebts.filter(debt => debt.debt_type === 'given');
            const receivedDebts = filteredDebts.filter(debt => debt.debt_type === 'received');

            // Add summary section
            doc.setFontSize(14);
            doc.text('Summary', 20, 60);
            
            // Calculate totals
            const totalGiven = givenDebts.reduce((sum, debt) => sum + parseFloat(debt.remaining_amount), 0);
            const totalReceived = receivedDebts.reduce((sum, debt) => sum + parseFloat(debt.remaining_amount), 0);
            const netDebt = totalGiven - totalReceived;

            // Add summary table
            doc.autoTable({
                startY: 65,
                head: [['Category', 'Amount']],
                body: [
                    ['Total Debts Given', `$${totalGiven.toFixed(2)}`],
                    ['Total Debts Received', `$${totalReceived.toFixed(2)}`],
                    ['Net Debt Position', `$${netDebt.toFixed(2)}`],
                ],
                theme: 'grid',
                headStyles: { fillColor: [108, 92, 231] },
                styles: { fontSize: 10, cellPadding: 5 }
            });

            // Add given debts section
            if (givenDebts.length > 0) {
                doc.setFontSize(14);
                doc.text('Debts Given', 20, doc.lastAutoTable.finalY + 20);

                doc.autoTable({
                    startY: doc.lastAutoTable.finalY + 25,
                    head: [['Counterparty', 'Amount', 'Due Date', 'Status', 'Interest']],
                    body: givenDebts.map(debt => [
                        debt.counterparty || 'Unknown',
                        `$${parseFloat(debt.remaining_amount).toFixed(2)}`,
                        new Date(debt.due_date).toLocaleDateString(),
                        debt.status.replace('_', ' '),
                        `${debt.interest_rate}% (${debt.interest_type})`
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [108, 92, 231] },
                    styles: { fontSize: 10, cellPadding: 5 }
                });
            }

            // Add received debts section
            if (receivedDebts.length > 0) {
                doc.setFontSize(14);
                doc.text('Debts Received', 20, doc.lastAutoTable.finalY + 20);

                doc.autoTable({
                    startY: doc.lastAutoTable.finalY + 25,
                    head: [['Counterparty', 'Amount', 'Due Date', 'Status', 'Interest']],
                    body: receivedDebts.map(debt => [
                        debt.counterparty || 'Unknown',
                        `$${parseFloat(debt.remaining_amount).toFixed(2)}`,
                        new Date(debt.due_date).toLocaleDateString(),
                        debt.status.replace('_', ' '),
                        `${debt.interest_rate}% (${debt.interest_type})`
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [108, 92, 231] },
                    styles: { fontSize: 10, cellPadding: 5 }
                });
            }

            // Add footer
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.text(
                    'Generated by Penny Pilot - Your Personal Finance Manager',
                    pageWidth / 2,
                    doc.internal.pageSize.getHeight() - 10,
                    { align: 'center' }
                );
            }

            // Save the PDF
            doc.save(`penny-pilot-debt-report-${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF report. Please try again.');
        }
    }
}

// Export the class
window.PdfExport = PdfExport; 