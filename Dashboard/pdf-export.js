// Enhanced PDF Export functionality for Penny Pilot (browser compatible)
// Assumes jsPDF, autoTable, and html2canvas are loaded globally via CDN

window.PdfExport = {
    generateExpenditurePdf: async function(reportType, fromDate, toDate) {
        // Gather user info
        const currentUser = JSON.parse(localStorage.getItem("currentUser")) || { name: "User" };
        const userName = currentUser.name || "User";
        const today = new Date().toLocaleDateString();

        // Gather transactions
        const rows = Array.from(document.querySelectorAll('.transaction-item'));
        if (rows.length === 0) {
            alert('No transactions to export!');
            return;
        }
        // Extract all details
        const data = rows.map(row => {
            const title = row.querySelector('.transaction-title')?.textContent || '';
            const category = row.querySelector('.transaction-category')?.textContent || '';
            const amount = row.querySelector('.transaction-amount')?.textContent || '';
            const type = amount.trim().startsWith('+') ? 'Credit' : 'Debit';
            const date = (category.split('•')[1] || '').trim();
            const description = title;
            return [date, type, category.split('•')[0].trim(), amount, description];
        });

        // Calculate summary
        let totalCredit = 0, totalDebit = 0;
        data.forEach(row => {
            const amt = parseFloat(row[3].replace(/[^\d.-]/g, ''));
            if (row[1] === 'Credit') totalCredit += amt;
            else totalDebit += amt;
        });

        // Create PDF
        const doc = new window.jspdf.jsPDF('p', 'pt', 'a4');
        let y = 40;
        doc.setFontSize(20);
        doc.setTextColor('#6C5CE7');
        doc.text('Penny Pilot Expenditure Report', 40, y);
        y += 25;
        doc.setFontSize(12);
        doc.setTextColor('#333');
        doc.text(`User: ${userName}`, 40, y);
        y += 18;
        doc.text(`Report Date: ${today}`, 40, y);
        y += 18;
        if (reportType === 'partial' && fromDate && toDate) {
            doc.text(`Period: ${fromDate} to ${toDate}`, 40, y);
            y += 18;
        }
        doc.setTextColor('#0984e3');
        doc.text(`Total Credit: $${totalCredit.toFixed(2)}`, 40, y);
        doc.setTextColor('#d63031');
        doc.text(`Total Debit: $${totalDebit.toFixed(2)}`, 200, y);
        y += 20;
        doc.setTextColor('#333');

        // Add charts as images
        const chartIds = ['debitPieChart', 'creditPieChart', 'debitBarChart', 'creditBarChart'];
        let chartY = y;
        for (let i = 0; i < chartIds.length; i++) {
            const chartCanvas = document.getElementById(chartIds[i]);
            if (chartCanvas) {
                try {
                    const chartImg = await window.html2canvas(chartCanvas, { backgroundColor: null });
                    const imgData = chartImg.toDataURL('image/png');
                    doc.addImage(imgData, 'PNG', 40 + (i % 2) * 260, chartY, 220, 140);
                    if (i % 2 === 1) chartY += 150;
                } catch (e) {
                    // Ignore chart errors
                }
            }
        }
        y = chartY + 10;

        // Table headers and body
        const head = [[
            { content: 'Date', styles: { fillColor: [108, 92, 231], textColor: 255 } },
            { content: 'Type', styles: { fillColor: [108, 92, 231], textColor: 255 } },
            { content: 'Category', styles: { fillColor: [108, 92, 231], textColor: 255 } },
            { content: 'Amount', styles: { fillColor: [108, 92, 231], textColor: 255 } },
            { content: 'Description', styles: { fillColor: [108, 92, 231], textColor: 255 } }
        ]];

        // Prepare rowStyles for green/red coloring
        const bodyWithStyles = data.map(row => {
            const isCredit = row[1] === 'Credit';
            return [
                { content: row[0], styles: {} },
                { content: row[1], styles: { textColor: isCredit ? [34, 139, 34] : [220, 53, 69], fontStyle: 'bold' } },
                { content: row[2], styles: {} },
                { content: row[3], styles: { textColor: isCredit ? [34, 139, 34] : [220, 53, 69], fontStyle: 'bold' } },
                { content: row[4], styles: {} }
            ];
        });

        doc.autoTable({
            head: head,
            body: bodyWithStyles,
            startY: y,
            theme: 'striped',
            styles: {
                fontSize: 10,
                cellPadding: 4,
                overflow: 'linebreak',
                halign: 'left',
                valign: 'middle',
            },
            alternateRowStyles: { fillColor: [245, 245, 255] },
            headStyles: { fillColor: [108, 92, 231], textColor: 255, fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 60 },
                1: { cellWidth: 45 },
                2: { cellWidth: 80 },
                3: { cellWidth: 60, halign: 'right' },
                4: { cellWidth: 180 }
            },
            margin: { left: 40, right: 40 }
        });

        doc.save('expenditure_report.pdf');
    }
}; 