document.addEventListener("DOMContentLoaded", function() {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));
    
    if (!currentUser || !currentUser.id) {
        console.error("User not logged in");
        return;
    }
    
    fetchAndRenderExpenseChart(currentUser.id);
    fetchAndRenderIncomeChart(currentUser.id); 
});

function fetchAndRenderExpenseChart(userId) {
    console.log("Fetching expenses for user:", userId);
    
    fetch(`http://localhost:3000/get-expenses-by-category/${userId}`)
        .then(response => {
            console.log("Response status:", response.status);
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(text || 'Server error');
                });
            }
            return response.json();
        })
        .then(data => {
            console.log("Expense data received:", data);
            if (data && data.length > 0) {
                const categories = processData(data);
                console.log("Processed categories:", categories);
                renderPieChart(
                    'expensePieChart',
                    Object.keys(categories),
                    Object.values(categories),
                    'Expense Categories'
                );
            } else {
                console.log("No expense data - showing empty state");
                document.getElementById('expensePieChart').parentElement.innerHTML = 
                    `<p>No expenses recorded. Add expenses to see the chart.</p>`;
            }
        })
        .catch(error => {
            console.error("Full error:", error);
            document.getElementById('expensePieChart').parentElement.innerHTML = 
                `<p class="error">Error loading expenses: ${error.message}</p>`;
        });
}

function fetchAndRenderIncomeChart(userId) {
    console.log("Fetching income for user:", userId);
    
    fetch(`http://localhost:3000/get-income-by-category/${userId}`)
        .then(response => {
            console.log("Income response status:", response.status);
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(text || 'Server error');
                });
            }
            return response.json();
        })
        .then(data => {
            console.log("Income data received:", data);
            if (data && data.length > 0) {
                const categories = processIncomeData(data);
                console.log("Processed income categories:", categories);
                renderPieChart(
                    'incomePieChart',
                    Object.keys(categories),
                    Object.values(categories),
                    'Income Categories'
                );
            } else {
                console.log("No income data - showing empty state");
                document.getElementById('incomePieChart').parentElement.innerHTML = 
                    `<p>No income recorded. Add income to see the chart.</p>`;
            }
        })
        .catch(error => {
            console.error("Income fetch error:", error);
            document.getElementById('incomePieChart').parentElement.innerHTML = 
                `<p class="error">Error loading income: ${error.message}</p>`;
        });
}

function processData(data) {
    const categories = {};
    data.forEach(item => {
        if (!categories[item.category]) {
            categories[item.category] = 0;
        }
        categories[item.category] += parseFloat(item.amount);
    });
    return categories;
}

function processIncomeData(data) {
    const categories = {};
    data.forEach(item => {
        // Format the category names to be more readable
        const formattedCategory = formatIncomeCategory(item.category);
        if (!categories[formattedCategory]) {
            categories[formattedCategory] = 0;
        }
        categories[formattedCategory] += parseFloat(item.amount);
    });
    return categories;
}

function formatIncomeCategory(category) {
    // Custom formatting for income categories
    const formatMap = {
        'Salary': 'Salary',
        'Debt Taken': 'Loans Received',
        'Investments Relieved': 'Investment Returns',
        'From Emergency': 'Emergency Withdrawal',
        'Other': 'Other Income'
    };
    return formatMap[category] || category;
}

function generateIncomeColors(count) {
    const incomeColors = [
        '#4CAF50', // Green
        '#8BC34A', // Light Green
        '#CDDC39', // Lime
        '#FFC107', // Amber
        '#FF9800', // Orange
        '#FF5722'  // Deep Orange
    ];
    // Return the first 'count' colors, cycling if needed
    return Array.from({length: count}, (_, i) => incomeColors[i % incomeColors.length]);
}

function generateExpenseColors(count) {
    const expenseColors = [
        '#FF6384', // Red
        '#36A2EB', // Blue
        '#FFCE56', // Yellow
        '#4BC0C0', // Teal
        '#FF5252', // Deep Red
        '#9C27B0'  // Purple
    ];
    // Return the first 'count' colors, cycling if needed
    return Array.from({length: count}, (_, i) => expenseColors[i % expenseColors.length]);
}

function generateColors(count) {
    const colors = [];
    const hueStep = 360 / count;
    for (let i = 0; i < count; i++) {
        colors.push(`hsl(${i * hueStep}, 70%, 60%)`);
    }
    return colors;
}

function renderPieChart(canvasId, labels, data, title) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const colors = canvasId === 'incomePieChart' 
        ? generateIncomeColors(labels.length)
        : generateExpenseColors(labels.length);
        
    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: $${value.toFixed(2)} (${percentage}%)`;
                        }
                    }
                },
                title: {
                    display: true,
                    text: title,
                    font: {
                        size: 16
                    }
                }
            }
        }
    });
}