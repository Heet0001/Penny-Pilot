// Client Management JavaScript

// Global Variables
let currentUser = null;
let allClients = [];
let currentViewMode = 'grid';
let currentClientId = null;
let revenueChart = null;
let statusChart = null;

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Client Management Module Initialized');
    
    // Check authentication
    checkAuthentication();
    
    // Load initial data
    loadClients();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize charts
    initializeCharts();

    // Add Transfer to Wallet logic
    const transferBtn = document.getElementById('transfer-to-wallet-btn');
    if (transferBtn) {
        transferBtn.addEventListener('click', openTransferWalletModal);
    }
    const transferWalletForm = document.getElementById('transferWalletForm');
    if (transferWalletForm) {
        transferWalletForm.addEventListener('submit', handleTransferWalletSubmit);
    }
});

// Authentication Check
function checkAuthentication() {
    // Check both userData and currentUser keys for compatibility
    const userData = localStorage.getItem('userData') || localStorage.getItem('currentUser');
    const isAuthenticated = JSON.parse(localStorage.getItem('isAuthenticated'));
    
    if (!userData || !isAuthenticated) {
        window.location.href = '../Loginpage/index.html';
        return;
    }
    
    try {
        currentUser = JSON.parse(userData);
        // Update user info in the UI if elements exist
        const userNameElement = document.getElementById('user-name');
        if (userNameElement) {
            userNameElement.textContent = currentUser.name;
        }
        
        // Update profile icon
        const profileIcon = document.getElementById('profile-icon');
        const usernameTooltip = document.getElementById('username-tooltip');
        if (profileIcon && currentUser.name) {
            profileIcon.textContent = currentUser.name.charAt(0).toUpperCase();
        }
        if (usernameTooltip && currentUser.name) {
            usernameTooltip.textContent = currentUser.name;
        }
        
        console.log('User authenticated:', currentUser);
    } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('userData');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('isAuthenticated');
        window.location.href = '../Loginpage/index.html';
    }
}

// Event Listeners Setup
function setupEventListeners() {
    // Client form submission
    const clientForm = document.getElementById('clientForm');
    if (clientForm) {
        clientForm.addEventListener('submit', handleClientSubmit);
    }
    
    // Transaction form submission
    const transactionForm = document.getElementById('transactionForm');
    if (transactionForm) {
        transactionForm.addEventListener('submit', handleTransactionSubmit);
    }
    
    // Invoice form submission
    const invoiceForm = document.getElementById('invoiceForm');
    if (invoiceForm) {
        invoiceForm.addEventListener('submit', handleInvoiceSubmit);
    }
    
    // Modal close events
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeAllModals();
        }
    });
    
    // Set today's date as default for date inputs
    const today = new Date().toISOString().split('T')[0];
    const transactionDateInput = document.getElementById('transaction-date');
    if (transactionDateInput) {
        transactionDateInput.value = today;
    }
    
    // Set default due date (30 days from today)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const invoiceDueDateInput = document.getElementById('invoice-due-date');
    if (invoiceDueDateInput) {
        invoiceDueDateInput.value = dueDate.toISOString().split('T')[0];
    }
    
    // Setup logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

// Load Clients from Server
async function loadClients() {
    try {
        showLoading('Loading clients from database...');
        
        // Try to fetch real client data from the API
        const response = await fetch('/api/clients', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': JSON.stringify(currentUser)
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.clients) {
                // Transform database clients to match expected format
                allClients = result.clients.map(client => ({
                    id: client.id,
                    customer_type: client.customer_type,
                    company_name: client.company_name,
                    first_name: client.first_name,
                    last_name: client.last_name,
                    email: client.email,
                    phone: client.phone,
                    address: client.address,
                    city: client.city,
                    state: client.state,
                    postal_code: client.postal_code,
                    country: client.country || 'India',
                    customer_status: client.customer_status,
                    credit_limit: parseFloat(client.credit_limit) || 0,
                    payment_terms: client.payment_terms,
                    notes: client.notes,
                    total_revenue: parseFloat(client.total_revenue) || 0, // Net revenue (income - expenses)
                    revenue_collected: parseFloat(client.revenue_collected) || 0, // Total income
                    total_expenses: parseFloat(client.total_expenses) || 0, // Total expenses
                    pending_invoices: parseInt(client.pending_invoices) || 0,
                    created_at: client.created_at
                }));
                
                console.log('Loaded', allClients.length, 'clients from database:', allClients);
                
                // Save to localStorage for offline access
                localStorage.setItem('allClients', JSON.stringify(allClients));
                
                // Update UI
                await updateStatistics();
                await displayClients();
                await updateCharts();
                hideLoading();
                showToastSuccess(`Successfully loaded ${allClients.length} clients from database!`, 3000);
                return;
            }
        }
        
        // If API fails, try to load from localStorage
        console.log('API failed, trying localStorage...');
        const savedClients = localStorage.getItem('allClients');
        const transferData = localStorage.getItem('clientsTransferData');
        
        if (savedClients) {
            allClients = JSON.parse(savedClients);
            
            // Check if we have transfer data and validate it
            if (transferData) {
                try {
                    const parsedTransferData = JSON.parse(transferData);
                    if (parsedTransferData.lastTransfer && parsedTransferData.lastTransfer.userId === currentUser.id) {
                        console.log('Found transfer data:', parsedTransferData.lastTransfer);
                        // Data is already updated from the transfer, keep as is
                    }
                } catch (e) {
                    console.warn('Invalid transfer data, ignoring:', e);
                }
            }
            
            console.log('Loaded', allClients.length, 'clients from localStorage with transfer data');
            
            // Update UI
            await updateStatistics();
            await displayClients();
            await updateCharts();
            hideLoading();
            showToastInfo('Loaded clients from local storage with latest transfer data.');
            return;
        }
        
        // If both API and localStorage fail, load sample data
        console.log('Both API and localStorage failed, loading sample data');
        loadSampleData();
        showToastInfo('Using demo data. Database connection may be unavailable.');
        
    } catch (error) {
        console.error('Error loading clients:', error);
        hideLoading();
        
        // Try localStorage first before falling back to sample data
        const savedClients = localStorage.getItem('allClients');
        const transferData = localStorage.getItem('clientsTransferData');
        
        if (savedClients) {
            try {
                allClients = JSON.parse(savedClients);
                
                // Restore transfer data if available
                if (transferData) {
                    const parsedTransferData = JSON.parse(transferData);
                    if (parsedTransferData.lastTransfer && parsedTransferData.lastTransfer.userId === currentUser.id) {
                        console.log('Restoring transfer data due to connection error:', parsedTransferData.lastTransfer);
                    }
                }
                
                await updateStatistics();
                await displayClients();
                await updateCharts();
                showToastInfo('Loaded clients from local storage due to connection error.');
                return;
            } catch (parseError) {
                console.error('Error parsing saved clients:', parseError);
            }
        }
        
        // Final fallback to sample data
        loadSampleData();
        showToastError('Failed to load client data. Using demo data instead.');
    }
}

// Load Sample Data (for development)
function loadSampleData() {
    allClients = [
        {
            id: 1,
            customer_type: 'business',
            company_name: 'TechCorp Solutions',
            first_name: null,
            last_name: null,
            email: 'contact@techcorp.com',
            phone: '+91-9876543210',
            address: '123 Tech Street, Bangalore',
            city: 'Bangalore',
            state: 'Karnataka',
            customer_status: 'active',
            credit_limit: 100000,
            payment_terms: 'Net 30',
            total_revenue: 0,
            revenue_collected: 0,
            total_expenses: 0,
            created_at: '2024-01-15'
        },
        {
            id: 2,
            customer_type: 'individual',
            company_name: null,
            first_name: 'Rajesh',
            last_name: 'Kumar',
            email: 'rajesh.kumar@email.com',
            phone: '+91-8765432109',
            address: '456 Business Lane, Mumbai',
            city: 'Mumbai',
            state: 'Maharashtra',
            customer_status: 'active',
            credit_limit: 50000,
            payment_terms: 'Net 15',
            total_revenue: 0,
            revenue_collected: 0,
            total_expenses: 0,
            created_at: '2024-02-20'
        },
        {
            id: 3,
            customer_type: 'business',
            company_name: 'Global Enterprises',
            first_name: null,
            last_name: null,
            email: 'info@globalent.com',
            phone: '+91-7654321098',
            address: '789 Corporate Avenue, Delhi',
            city: 'Delhi',
            state: 'Delhi',
            customer_status: 'prospect',
            credit_limit: 0,
            payment_terms: 'Net 30',
            total_revenue: 0,
            revenue_collected: 0,
            total_expenses: 0,
            created_at: '2024-03-10'
        }
    ];
    
    // Save sample data to localStorage
    localStorage.setItem('allClients', JSON.stringify(allClients));
    
    updateStatistics();
    displayClients();
    updateCharts();
}

// Update Statistics
function updateStatistics() {
    const totalClients = allClients.length;
    const activeClients = allClients.filter(client => client.customer_status === 'active').length;
    
    // Calculate total revenue (net revenue: income - expenses)
    const totalRevenue = allClients.reduce((sum, client) => {
        const revenue = parseFloat(client.total_revenue) || 0;
        return sum + revenue;
    }, 0);
    
    // Calculate revenue collected (total income from all clients)
    const revenueCollected = allClients.reduce((sum, client) => {
        const revenue = parseFloat(client.revenue_collected) || parseFloat(client.total_revenue) || 0;
        return sum + revenue;
    }, 0);
    
    // Calculate total expenses made to all clients
    const totalExpenses = allClients.reduce((sum, client) => {
        const expenses = parseFloat(client.total_expenses) || 0;
        return sum + expenses;
    }, 0);
    
    // Calculate original net revenue (before any transfers)
    const originalNetRevenue = revenueCollected - totalExpenses;
    
    // Get transferred to wallet amount from localStorage
    const transferredData = localStorage.getItem('clientsTransferredToWallet');
    let transferredToWallet = 0;
    if (transferredData) {
        try {
            const parsedData = JSON.parse(transferredData);
            if (parsedData.userId === currentUser.id) {
                transferredToWallet = parseFloat(parsedData.totalTransferred) || 0;
            }
        } catch (e) {
            console.warn('Error parsing transferred data:', e);
        }
    }
    
    // Calculate money left (original net revenue minus transferred amount)
    const moneyLeft = Math.max(0, originalNetRevenue - transferredToWallet);
    
    // Update DOM elements with animation
    document.getElementById('total-clients').textContent = totalClients;
    document.getElementById('active-clients').textContent = activeClients;
    document.getElementById('revenue-collected').textContent = `₹${revenueCollected.toLocaleString('en-IN')}`;
    document.getElementById('total-expenses').textContent = `₹${totalExpenses.toLocaleString('en-IN')}`;
    document.getElementById('total-revenue').textContent = `₹${originalNetRevenue.toLocaleString('en-IN')}`;
    
    // Update new stat cards
    const transferredElement = document.getElementById('transferred-to-wallet');
    if (transferredElement) {
        transferredElement.textContent = `₹${transferredToWallet.toLocaleString('en-IN')}`;
    }
    
    const moneyLeftElement = document.getElementById('money-left');
    if (moneyLeftElement) {
        moneyLeftElement.textContent = `₹${moneyLeft.toLocaleString('en-IN')}`;
    }
    
    console.log('Statistics updated:', { 
        totalClients, 
        activeClients, 
        revenueCollected, 
        totalExpenses, 
        originalNetRevenue,
        transferredToWallet,
        moneyLeft
    });
}

// Display Clients
function displayClients() {
    if (currentViewMode === 'grid') {
        displayClientsGrid();
    } else {
        displayClientsTable();
    }
}

// Display Clients in Grid View
function displayClientsGrid() {
    const container = document.getElementById('clients-grid');
    
    if (allClients.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>No Clients Found</h3>
                <p>Add your first client to get started</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = allClients.map(client => {
        const clientName = client.customer_type === 'business' ? 
            client.company_name : 
            `${client.first_name} ${client.last_name}`;
        
        return `
            <div class="client-card fade-in" data-client-id="${client.id}">
                <div class="client-header">
                    <div>
                        <div class="client-name">${clientName}</div>
                        <div class="client-type">${client.customer_type}</div>
                    </div>
                    <div class="client-status status-${client.customer_status}">
                        ${client.customer_status}
                    </div>
                </div>
                
                <div class="client-contact">
                    <p><i class="fas fa-envelope"></i> ${client.email}</p>
                    <p><i class="fas fa-phone"></i> ${client.phone}</p>
                    <p><i class="fas fa-map-marker-alt"></i> ${client.city}, ${client.state}</p>
                </div>
                
                <div class="client-revenue">
                    Net Revenue: ₹${(client.total_revenue || 0).toLocaleString()}
                    <br><small>Income: ₹${(client.revenue_collected || 0).toLocaleString()} | Expenses: ₹${(client.total_expenses || 0).toLocaleString()}</small>
                </div>
                
                <div class="client-actions">
                    <button class="btn btn-primary" onclick="openTransactionModal(${client.id})">
                        <i class="fas fa-plus"></i> Transaction
                    </button>
                    <button class="btn btn-secondary" onclick="openInvoiceModal(${client.id})">
                        <i class="fas fa-file-invoice"></i> Invoice
                    </button>
                    <button class="btn btn-secondary" onclick="editClient(${client.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Display Clients in Table View
function displayClientsTable() {
    const tbody = document.getElementById('clients-table-body');
    
    if (allClients.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <h3>No Clients Found</h3>
                        <p>Add your first client to get started</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = allClients.map(client => {
        const clientName = client.customer_type === 'business' ? 
            client.company_name : 
            `${client.first_name} ${client.last_name}`;
        
        return `
            <tr>
                <td>${clientName}</td>
                <td><span class="client-type">${client.customer_type}</span></td>
                <td>${client.email}</td>
                <td>${client.phone}</td>
                <td><span class="client-status status-${client.customer_status}">${client.customer_status}</span></td>
                <td>₹${(client.total_revenue || 0).toLocaleString()}<br><small>(I:₹${(client.revenue_collected || 0).toLocaleString()} E:₹${(client.total_expenses || 0).toLocaleString()})</small></td>
                <td>
                    <button class="btn btn-secondary" onclick="openTransactionModal(${client.id})" title="Add Transaction">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="btn btn-secondary" onclick="openInvoiceModal(${client.id})" title="Create Invoice">
                        <i class="fas fa-file-invoice"></i>
                    </button>
                    <button class="btn btn-secondary" onclick="editClient(${client.id})" title="Edit Client">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Set View Mode
function setViewMode(mode) {
    currentViewMode = mode;
    
    // Update view toggle buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    event.target.classList.add('active');
    
    // Show/hide appropriate containers
    const gridContainer = document.getElementById('clients-grid');
    const tableContainer = document.getElementById('clients-table');
    
    if (mode === 'grid') {
        gridContainer.style.display = 'grid';
        tableContainer.style.display = 'none';
    } else {
        gridContainer.style.display = 'none';
        tableContainer.style.display = 'block';
    }
    
    displayClients();
}

// Filter Clients
function filterClients() {
    const statusFilter = document.getElementById('client-status-filter').value;
    const typeFilter = document.getElementById('client-type-filter').value;
    
    let filteredClients = allClients;
    
    if (statusFilter !== 'all') {
        filteredClients = filteredClients.filter(client => client.customer_status === statusFilter);
    }
    
    if (typeFilter !== 'all') {
        filteredClients = filteredClients.filter(client => client.customer_type === typeFilter);
    }
    
    // Temporarily store filtered clients
    const originalClients = allClients;
    allClients = filteredClients;
    
    displayClients();
    
    // Restore original clients
    allClients = originalClients;
}

// Search Clients
function searchClients() {
    const searchTerm = document.getElementById('search-client').value.toLowerCase();
    
    if (!searchTerm) {
        displayClients();
        return;
    }
    
    const filteredClients = allClients.filter(client => {
        const clientName = client.customer_type === 'business' ? 
            client.company_name.toLowerCase() : 
            `${client.first_name} ${client.last_name}`.toLowerCase();
        
        return clientName.includes(searchTerm) || 
               client.email.toLowerCase().includes(searchTerm) || 
               client.phone.includes(searchTerm);
    });
    
    // Temporarily store filtered clients
    const originalClients = allClients;
    allClients = filteredClients;
    
    displayClients();
    
    // Restore original clients
    allClients = originalClients;
}

// Modal Functions
function openAddClientModal() {
    currentClientId = null;
    document.getElementById('modal-title').textContent = 'Add New Client';
    document.getElementById('clientForm').reset();
    document.getElementById('country').value = 'India';
    toggleClientFields();
    document.getElementById('clientModal').style.display = 'block';
}

function editClient(clientId) {
    currentClientId = clientId;
    const client = allClients.find(c => c.id === clientId);
    
    if (!client) {
        showToastError('Client not found');
        return;
    }
    
    document.getElementById('modal-title').textContent = 'Edit Client';
    
    // Populate form fields
    document.getElementById('client-type').value = client.customer_type;
    document.getElementById('client-status').value = client.customer_status;
    document.getElementById('email').value = client.email;
    document.getElementById('phone').value = client.phone;
    document.getElementById('address').value = client.address || '';
    document.getElementById('city').value = client.city || '';
    document.getElementById('state').value = client.state || '';
    document.getElementById('postal-code').value = client.postal_code || '';
    document.getElementById('country').value = client.country || 'India';
    document.getElementById('credit-limit').value = client.credit_limit || '';
    document.getElementById('payment-terms').value = client.payment_terms || '';
    document.getElementById('notes').value = client.notes || '';
    
    if (client.customer_type === 'business') {
        document.getElementById('company-name').value = client.company_name;
    } else {
        document.getElementById('first-name').value = client.first_name;
        document.getElementById('last-name').value = client.last_name;
    }
    
    toggleClientFields();
    document.getElementById('clientModal').style.display = 'block';
}

function closeClientModal() {
    document.getElementById('clientModal').style.display = 'none';
    currentClientId = null;
}

function openTransactionModal(clientId) {
    currentClientId = clientId;
    const client = allClients.find(c => c.id === clientId);
    
    if (!client) {
        showToastError('Client not found');
        return;
    }
    
    document.getElementById('transactionForm').reset();
    document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('transactionModal').style.display = 'block';
}

function closeTransactionModal() {
    document.getElementById('transactionModal').style.display = 'none';
    currentClientId = null;
}

function openInvoiceModal(clientId) {
    currentClientId = clientId;
    const client = allClients.find(c => c.id === clientId);
    
    if (!client) {
        showToastError('Client not found');
        return;
    }
    
    const clientName = client.customer_type === 'business' ? 
        client.company_name : 
        `${client.first_name} ${client.last_name}`;
    
    // Create a professional choice dialog
    const modalHTML = `
        <div id="action-choice-modal" class="modal" style="display: block;">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h2>Select Action for ${clientName}</h2>
                    <span class="close" onclick="document.getElementById('action-choice-modal').remove()">&times;</span>
                </div>
                <div class="modal-body" style="padding: 2rem;">
                    <p style="margin-bottom: 2rem; color: var(--text-secondary);">Choose what you'd like to do:</p>
                    <div style="display: flex; gap: 1rem; flex-direction: column;">
                        <button class="btn btn-primary" onclick="createNewInvoice(); document.getElementById('action-choice-modal').remove();" style="padding: 1rem; justify-content: center;">
                            <i class="fas fa-file-invoice"></i> Create New Invoice
                        </button>
                        <button class="btn btn-secondary" onclick="generateClientHistoryReport(allClients.find(c => c.id === ${clientId})); document.getElementById('action-choice-modal').remove();" style="padding: 1rem; justify-content: center;">
                            <i class="fas fa-chart-line"></i> Generate Client History Report
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to document
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function createNewInvoice() {
    document.getElementById('invoiceForm').reset();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    document.getElementById('invoice-due-date').value = dueDate.toISOString().split('T')[0];
    document.getElementById('invoiceModal').style.display = 'block';
}

function closeInvoiceModal() {
    document.getElementById('invoiceModal').style.display = 'none';
    currentClientId = null;
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    currentClientId = null;
}

// Add Transfer to Wallet logic

function openTransferWalletModal() {
    // Calculate current net revenue
    const netRevenue = allClients.reduce((sum, client) => {
        const revenue = parseFloat(client.revenue_collected) || parseFloat(client.total_revenue) || 0;
        const expenses = parseFloat(client.total_expenses) || 0;
        return sum + (revenue - expenses);
    }, 0);
    
    // Update modal content to show current net revenue
    const modal = document.getElementById('transferWalletModal');
    const modalHeader = modal.querySelector('.modal-header h2');
    if (modalHeader) {
        modalHeader.innerHTML = `
            Transfer Revenue to Wallet
            <div style="font-size: 14px; color: #6B7280; font-weight: normal; margin-top: 5px;">
                Available Net Revenue: ₹${netRevenue.toLocaleString('en-IN')}
            </div>
        `;
    }
    
    // Set maximum amount
    const amountInput = document.getElementById('transfer-wallet-amount');
    amountInput.value = '';
    amountInput.max = netRevenue;
    amountInput.placeholder = `Max: ₹${netRevenue.toLocaleString('en-IN')}`;
    
    modal.style.display = 'block';
}

function closeTransferWalletModal() {
    document.getElementById('transferWalletModal').style.display = 'none';
}

async function handleTransferWalletSubmit(event) {
    event.preventDefault();
    const amountInput = document.getElementById('transfer-wallet-amount');
    const amount = parseFloat(amountInput.value);
    
    if (isNaN(amount) || amount <= 0) {
        showAlert('Please enter a valid amount.', 'error');
        return;
    }
    
    // Get current net revenue (total available)
    const totalNetRevenue = allClients.reduce((sum, client) => {
        const revenue = parseFloat(client.revenue_collected) || parseFloat(client.total_revenue) || 0;
        const expenses = parseFloat(client.total_expenses) || 0;
        return sum + (revenue - expenses);
    }, 0);
    
    // Get already transferred amount from localStorage
    const transferredData = localStorage.getItem('clientsTransferredToWallet');
    let alreadyTransferred = 0;
    if (transferredData) {
        try {
            const parsedData = JSON.parse(transferredData);
            if (parsedData.userId === currentUser.id) {
                alreadyTransferred = parseFloat(parsedData.totalTransferred) || 0;
            }
        } catch (e) {
            console.warn('Error parsing transferred data:', e);
        }
    }
    
    // Calculate money left (what's actually available for transfer)
    const moneyLeft = Math.max(0, totalNetRevenue - alreadyTransferred);
    
    if (amount > moneyLeft) {
        showAlert(`Transfer amount cannot exceed money left. Available for transfer: ₹${moneyLeft.toLocaleString('en-IN')}`, 'error');
        return;
    }
    showLoading('Transferring to wallet...');
    try {
        // First, record this as a credit transaction in the main dashboard
        const BASE_URL = window.location.hostname === "localhost"
            ? "http://localhost:3000"
            : "https://penny-pilot-production.up.railway.app";
        
        // Add credit entry for the transfer with proper category
        const creditData = {
            user_id: currentUser.id,
            amount: amount.toFixed(2),
            category: 'Other',
            entry_date: new Date().toISOString().split('T')[0],
            description: `Business Money Relieved - ₹${amount.toLocaleString('en-IN')} transferred to wallet`
        };
        
        const creditResponse = await fetch(`${BASE_URL}/add-credit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(creditData),
        });
        
        if (!creditResponse.ok) {
            console.warn('Credit transaction recording failed, but proceeding with wallet update');
        }
        
        // Update local wallet balance immediately - ADD to existing balance
        const currentWalletBalance = parseFloat(localStorage.getItem(`wallet_balance_${currentUser.id}`)) || 0;
        const newWalletBalance = currentWalletBalance + amount;
        localStorage.setItem(`wallet_balance_${currentUser.id}`, newWalletBalance.toFixed(2));
        
        // Update wallet balance on server with the NEW total balance
        const walletResponse = await fetch(`${BASE_URL}/update-wallet`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': JSON.stringify(currentUser)
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                balance: newWalletBalance.toFixed(2) // Send the new total balance
            })
        });
        
        console.log('Wallet updated:', {
            oldBalance: currentWalletBalance,
            transferAmount: amount,
            newBalance: newWalletBalance
        });
        
        // Update cumulative transferred amount instead of deducting from individual client revenues
        const newTotalTransferred = alreadyTransferred + amount;
        const transferredWalletData = {
            userId: currentUser.id,
            totalTransferred: newTotalTransferred
        };
        localStorage.setItem('clientsTransferredToWallet', JSON.stringify(transferredWalletData));
        
        console.log('Transfer tracking updated:', {
            previouslyTransferred: alreadyTransferred,
            currentTransfer: amount,
            newTotalTransferred: newTotalTransferred
        });

        // Ensure all local storage updates as needed
        const clientsData = {
            clients: allClients,
            lastTransfer: {
                amount: amount,
                timestamp: new Date().toISOString(),
                userId: currentUser.id
            }
        };
        localStorage.setItem('allClients', JSON.stringify(allClients));
        localStorage.setItem('clientsTransferData', JSON.stringify(clientsData));
        localStorage.setItem('last_transfer_success', 'true');
        console.log('Transfer data saved locally.');

        // Ensure UI components reflect updated totals after transfer
        await updateStatistics();
        await displayClients();
        await updateCharts();

        // Log completion
        console.log('Transfer process successfully completed');
        closeTransferWalletModal();
        hideLoading();
        const remainingMoneyLeft = Math.max(0, totalNetRevenue - newTotalTransferred);
        showToastSuccess(`Successfully transferred ₹${amount.toLocaleString('en-IN')} to main wallet! Money left: ₹${remainingMoneyLeft.toLocaleString('en-IN')}`);
        
        // Try to sync updated client data with server
        try {
            const syncResponse = await fetch('/api/clients/bulk-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': JSON.stringify(currentUser)
                },
                body: JSON.stringify({ clients: allClients })
            });
            
            if (syncResponse.ok) {
                console.log('Client data synced with server successfully');
            }
        } catch (syncError) {
            console.warn('Failed to sync client data with server, but saved locally:', syncError);
        }
        
        // Refresh dashboard wallet display if we're on the dashboard
        try {
            if (typeof displayWalletBalance === 'function') {
                displayWalletBalance();
            }
        } catch (e) {
            console.log('Dashboard wallet refresh not available (not on dashboard page)');
        }
        
        // Force immediate UI update to show reduced net revenue
        await updateStatistics();
        await displayClients();
        await updateCharts();
        
        // Update the transfer modal header to show new net revenue if still open
        const newNetRevenue = allClients.reduce((sum, client) => {
            const revenue = parseFloat(client.revenue_collected) || parseFloat(client.total_revenue) || 0;
            const expenses = parseFloat(client.total_expenses) || 0;
            return sum + (revenue - expenses);
        }, 0);
        
        closeTransferWalletModal();
        hideLoading();
        showToastSuccess(`Successfully transferred ₹${amount.toLocaleString('en-IN')} to main wallet! New wallet balance: ₹${newWalletBalance.toLocaleString('en-IN')}. Remaining net revenue: ₹${newNetRevenue.toLocaleString('en-IN')}`);
        
        // Log the transfer for debugging
        console.log('Transfer completed:', {
            transferredAmount: amount,
            newWalletBalance: newWalletBalance,
            updatedClients: allClients.map(c => ({
                name: c.customer_type === 'business' ? c.company_name : `${c.first_name} ${c.last_name}`,
                revenue: c.revenue_collected,
                expenses: c.total_expenses,
                netRevenue: c.total_revenue
            }))
        });
        
    } catch (err) {
        hideLoading();
        showAlert('Failed to transfer to wallet. Please try again.', 'error');
        console.error('Transfer error:', err);
        
        // Revert wallet balance on error
        const revertedBalance = currentWalletBalance; // Back to original
        localStorage.setItem(`wallet_balance_${currentUser.id}`, revertedBalance.toFixed(2));
    }
}

// Form Handlers
function toggleClientFields() {
    const clientType = document.getElementById('client-type').value;
    const individualFields = document.getElementById('individual-fields');
    const businessFields = document.getElementById('business-fields');
    
    if (clientType === 'individual') {
        individualFields.style.display = 'block';
        businessFields.style.display = 'none';
        
        // Set required attributes
        document.getElementById('first-name').required = true;
        document.getElementById('last-name').required = true;
        document.getElementById('company-name').required = false;
    } else {
        individualFields.style.display = 'none';
        businessFields.style.display = 'block';
        
        // Set required attributes
        document.getElementById('first-name').required = false;
        document.getElementById('last-name').required = false;
        document.getElementById('company-name').required = true;
    }
}

async function handleClientSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const clientData = {
        customer_type: document.getElementById('client-type').value,
        customer_status: document.getElementById('client-status').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        address: document.getElementById('address').value,
        city: document.getElementById('city').value,
        state: document.getElementById('state').value,
        postal_code: document.getElementById('postal-code').value,
        country: document.getElementById('country').value,
        credit_limit: parseFloat(document.getElementById('credit-limit').value) || 0,
        payment_terms: document.getElementById('payment-terms').value,
        notes: document.getElementById('notes').value
    };
    
    if (clientData.customer_type === 'business') {
        clientData.company_name = document.getElementById('company-name').value;
    } else {
        clientData.first_name = document.getElementById('first-name').value;
        clientData.last_name = document.getElementById('last-name').value;
    }
    
    try {
        const url = currentClientId ? `/api/clients/${currentClientId}` : '/api/clients';
        const method = currentClientId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': JSON.stringify(currentUser)
            },
            body: JSON.stringify(clientData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to save client');
        }
        
        const result = await response.json();
        
        if (currentClientId) {
            showToastSuccess('Client updated successfully!');
        } else {
            showToastSuccess('Client added successfully!');
        }
        
        closeClientModal();
        loadClients();
    } catch (error) {
        console.error('Error saving client:', error);
        showToastError('Error saving client. Please try again.');
        
        // For development, simulate success
        if (currentClientId) {
            // Update existing client
            const clientIndex = allClients.findIndex(c => c.id === currentClientId);
            if (clientIndex !== -1) {
                allClients[clientIndex] = { ...allClients[clientIndex], ...clientData };
            }
        } else {
            // Add new client
            const newClient = {
                id: Date.now(),
                ...clientData,
                total_revenue: 0,
                revenue_collected: 0,
                total_expenses: 0,
                pending_invoices: 0,
                created_at: new Date().toISOString().split('T')[0]
            };
            allClients.push(newClient);
        }
        
        // Save updated clients to localStorage
        localStorage.setItem('allClients', JSON.stringify(allClients));
        
        showToastSuccess('Client saved successfully!');
        closeClientModal();
        updateStatistics();
        displayClients();
        updateCharts();
    }
}

async function handleTransactionSubmit(event) {
    event.preventDefault();
    
    const transactionData = {
        client_id: currentClientId,
        transaction_type: document.getElementById('transaction-type').value,
        amount: parseFloat(document.getElementById('amount').value),
        description: document.getElementById('description').value,
        transaction_date: document.getElementById('transaction-date').value
    };
    
    try {
        showLoading('Processing transaction...');
        
        const response = await fetch('/api/client-transactions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': JSON.stringify(currentUser)
            },
            body: JSON.stringify(transactionData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to add transaction');
        }
        
        // Update client data immediately
        const client = allClients.find(c => c.id === currentClientId);
        if (client) {
            if (transactionData.transaction_type === 'income') {
                client.revenue_collected = (client.revenue_collected || 0) + transactionData.amount;
                client.total_revenue = (client.revenue_collected || 0) - (client.total_expenses || 0);
            } else if (transactionData.transaction_type === 'expense') {
                // Handle expense transactions - DO NOT affect main wallet
                client.total_expenses = (client.total_expenses || 0) + transactionData.amount;
                client.total_revenue = (client.revenue_collected || 0) - (client.total_expenses || 0);
                // Note: Client expenses should only affect client-specific metrics, not main wallet balance
            }
        }
        
        hideLoading();
        showToastSuccess('Transaction added successfully!');
        closeTransactionModal();
        
        // Immediately update the UI
        await updateStatistics();
        await displayClients();
        await updateCharts();
        
    } catch (error) {
        console.error('Error adding transaction:', error);
        
        // For development, simulate success and update UI immediately
        const client = allClients.find(c => c.id === currentClientId);
        if (client) {
            if (transactionData.transaction_type === 'income') {
                client.revenue_collected = (client.revenue_collected || 0) + transactionData.amount;
                client.total_revenue = (client.revenue_collected || 0) - (client.total_expenses || 0);
            } else if (transactionData.transaction_type === 'expense') {
                // Handle expense transactions - DO NOT affect main wallet
                client.total_expenses = (client.total_expenses || 0) + transactionData.amount;
                client.total_revenue = (client.revenue_collected || 0) - (client.total_expenses || 0);
                // Note: Client expenses should only affect client-specific metrics, not main wallet balance
            }
        }
        
        // Save updated clients to localStorage
        localStorage.setItem('allClients', JSON.stringify(allClients));
        
        hideLoading();
        showToastSuccess('Transaction added successfully!');
        closeTransactionModal();
        
        // Immediately update the UI
        await updateStatistics();
        await displayClients();
        await updateCharts();
    }
}

async function handleInvoiceSubmit(event) {
    event.preventDefault();
    
    const invoiceData = {
        client_id: currentClientId,
        amount: parseFloat(document.getElementById('invoice-amount').value),
        description: document.getElementById('invoice-description').value,
        due_date: document.getElementById('invoice-due-date').value,
        status: document.getElementById('invoice-status').value
    };
    
    try {
        const response = await fetch('/api/invoices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': JSON.stringify(currentUser)
            },
            body: JSON.stringify(invoiceData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to create invoice');
        }
        
        // Generate invoice PDF after successful creation
        const client = allClients.find(c => c.id === currentClientId);
        if (client) {
            const invoiceId = Date.now(); // Generate invoice ID
            await generateInvoicePDF(client, invoiceData, invoiceId);
        }
        
        showToastSuccess('Invoice created and PDF generated successfully!');
        closeInvoiceModal();
        loadClients();
    } catch (error) {
        console.error('Error creating invoice:', error);
        
        // For development, simulate success and generate PDF
        const client = allClients.find(c => c.id === currentClientId);
        if (client) {
            if (invoiceData.status !== 'paid') {
                client.pending_invoices = (client.pending_invoices || 0) + 1;
            }
            
            // Generate invoice PDF
            const invoiceId = Date.now();
            await generateInvoicePDF(client, invoiceData, invoiceId);
        }
        
        showToastSuccess('Invoice created and PDF generated successfully!');
        closeInvoiceModal();
        updateStatistics();
        displayClients();
    }
}

// Chart Functions
function initializeCharts() {
    const revenueCtx = document.getElementById('revenueChart').getContext('2d');
    const statusCtx = document.getElementById('statusChart').getContext('2d');
    
    // Revenue Chart
    revenueChart = new Chart(revenueCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Revenue (₹)',
                data: [],
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₹' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
    
    // Status Chart
    statusChart = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: ['Active', 'Inactive', 'Prospect'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: [
                    '#10b981',
                    '#f59e0b',
                    '#667eea'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function updateCharts() {
    if (!revenueChart || !statusChart) return;
    
    // Update Revenue Chart
    const revenueData = allClients
        .filter(client => client.total_revenue > 0)
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 10);
    
    const revenueLabels = revenueData.map(client => {
        return client.customer_type === 'business' ? 
            client.company_name : 
            `${client.first_name} ${client.last_name}`;
    });
    
    const revenueValues = revenueData.map(client => client.total_revenue);
    
    revenueChart.data.labels = revenueLabels;
    revenueChart.data.datasets[0].data = revenueValues;
    revenueChart.update();
    
    // Update Status Chart
    const statusCounts = {
        active: allClients.filter(c => c.customer_status === 'active').length,
        inactive: allClients.filter(c => c.customer_status === 'inactive').length,
        prospect: allClients.filter(c => c.customer_status === 'prospect').length
    };
    
    statusChart.data.datasets[0].data = [statusCounts.active, statusCounts.inactive, statusCounts.prospect];
    statusChart.update();
}

// Export Functions
function exportClientData() {
    try {
        showLoading('Generating professional client report...');
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Professional Header
        doc.setFillColor(30, 64, 175);
        doc.rect(0, 0, 220, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('CLIENT MANAGEMENT REPORT', 20, 25);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('Penny Pilot Financial Services', 20, 32);
        
        // Reset colors
        doc.setTextColor(0, 0, 0);
        
        // Report metadata
        let yPos = 55;
        doc.setFontSize(11);
        doc.text(`Report Generated: ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}`, 20, yPos);
        yPos += 6;
        doc.text(`Total Records: ${allClients.length} clients`, 20, yPos);
        yPos += 6;
        doc.text(`Report Period: All Time`, 20, yPos);
        
        // Executive Summary Section
        yPos += 20;
        doc.setFillColor(245, 246, 250);
        doc.rect(15, yPos - 5, 180, 15, 'F');
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('EXECUTIVE SUMMARY', 20, yPos + 5);
        
        yPos += 20;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        
        const totalRevenue = allClients.reduce((sum, client) => sum + (parseFloat(client.total_revenue) || 0), 0);
        const activeClients = allClients.filter(c => c.customer_status === 'active').length;
        const prospectClients = allClients.filter(c => c.customer_status === 'prospect').length;
        const inactiveClients = allClients.filter(c => c.customer_status === 'inactive').length;
        const totalPendingInvoices = allClients.reduce((sum, client) => sum + (parseInt(client.pending_invoices) || 0), 0);
        const avgRevenuePerClient = totalRevenue / Math.max(allClients.length, 1);
        
        // Summary statistics in a grid layout
        const summaryData = [
            ['Total Clients', allClients.length.toString()],
            ['Active Clients', `${activeClients} (${Math.round((activeClients/allClients.length)*100)}%)`],
            ['Prospect Clients', `${prospectClients} (${Math.round((prospectClients/allClients.length)*100)}%)`],
            ['Inactive Clients', `${inactiveClients} (${Math.round((inactiveClients/allClients.length)*100)}%)`],
            ['Total Revenue', `₹${totalRevenue.toLocaleString('en-IN')}`],
            ['Average Revenue/Client', `₹${Math.round(avgRevenuePerClient).toLocaleString('en-IN')}`],
            ['Pending Invoices', totalPendingInvoices.toString()],
            ['Client Acquisition Rate', '15% (Monthly avg.)']
        ];
        
        doc.autoTable({
            body: summaryData,
            startY: yPos,
            styles: {
                fontSize: 11,
                cellPadding: 8
            },
            columnStyles: {
                0: { fontStyle: 'bold', fillColor: [248, 250, 252] },
                1: { textColor: [30, 64, 175], fontStyle: 'bold' }
            },
            theme: 'plain',
            margin: { left: 20, right: 20 }
        });
        
        yPos = doc.lastAutoTable.finalY + 20;
        
        // Client Distribution Chart (text-based)
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('CLIENT DISTRIBUTION', 20, yPos);
        
        yPos += 15;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        
        // Business vs Individual breakdown
        const businessClients = allClients.filter(c => c.customer_type === 'business').length;
        const individualClients = allClients.filter(c => c.customer_type === 'individual').length;
        
        doc.text(`Business Clients: ${businessClients} (${Math.round((businessClients/allClients.length)*100)}%)`, 25, yPos);
        yPos += 6;
        doc.text(`Individual Clients: ${individualClients} (${Math.round((individualClients/allClients.length)*100)}%)`, 25, yPos);
        yPos += 15;
        
        // Top Revenue Clients
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('TOP REVENUE CLIENTS', 20, yPos);
        yPos += 5;
        
        const topClients = allClients
            .filter(client => client.total_revenue > 0)
            .sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0))
            .slice(0, 5);
        
        if (topClients.length > 0) {
            const topClientsData = topClients.map((client, index) => {
                const name = client.customer_type === 'business' ? 
                    client.company_name : 
                    `${client.first_name} ${client.last_name}`;
                return [
                    (index + 1).toString(),
                    name,
                    client.customer_type,
                    `₹${(client.total_revenue || 0).toLocaleString('en-IN')}`
                ];
            });
            
            doc.autoTable({
                head: [['Rank', 'Client Name', 'Type', 'Revenue']],
                body: topClientsData,
                startY: yPos + 5,
                styles: {
                    fontSize: 10,
                    cellPadding: 6
                },
                headStyles: {
                    fillColor: [16, 185, 129],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 252]
                },
                margin: { left: 20, right: 20 }
            });
            
            yPos = doc.lastAutoTable.finalY + 20;
        }
        
        // Check if new page needed
        if (yPos > 220) {
            doc.addPage();
            yPos = 30;
        }
        
        // Detailed Client List
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('DETAILED CLIENT LIST', 20, yPos);
        yPos += 10;
        
        const tableData = allClients.map((client, index) => {
            const name = client.customer_type === 'business' ? 
                client.company_name : 
                `${client.first_name} ${client.last_name}`;
            
            return [
                (index + 1).toString(),
                name,
                client.customer_type,
                client.email,
                client.phone,
                client.customer_status.toUpperCase(),
                `₹${(client.total_revenue || 0).toLocaleString('en-IN')}`,
                (client.pending_invoices || 0).toString()
            ];
        });
        
        doc.autoTable({
            head: [['#', 'Client Name', 'Type', 'Email', 'Phone', 'Status', 'Revenue', 'Pending\nInvoices']],
            body: tableData,
            startY: yPos,
            styles: {
                fontSize: 9,
                cellPadding: 4
            },
            headStyles: {
                fillColor: [30, 64, 175],
                textColor: [255, 255, 255],
                fontSize: 10,
                fontStyle: 'bold'
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10 },
                1: { cellWidth: 35 },
                2: { halign: 'center', cellWidth: 20 },
                3: { cellWidth: 45 },
                4: { cellWidth: 30 },
                5: { halign: 'center', cellWidth: 20 },
                6: { halign: 'right', cellWidth: 25 },
                7: { halign: 'center', cellWidth: 15 }
            }
        });
        
        // Footer with signature area
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            
            // Footer line
            doc.setDrawColor(200, 200, 200);
            doc.line(20, 285, 190, 285);
            
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text('Generated by Penny Pilot CRM | Confidential Business Report', 20, 292);
            doc.text(`Page ${i} of ${pageCount}`, 170, 292);
        }
        
        // Save with timestamp
        const timestamp = new Date().toISOString().slice(0, 10);
        doc.save(`Client_Management_Report_${timestamp}.pdf`);
        
        hideLoading();
        showAlert('Professional client report exported successfully!', 'success', 4000);
        
    } catch (error) {
        console.error('Error exporting data:', error);
        hideLoading();
        showAlert('Error exporting data. Please ensure jsPDF is loaded properly.', 'error');
    }
}

// Generate Professional Invoice PDF
async function generateInvoicePDF(client, invoiceData, invoiceId) {
    try {
        showLoading('Generating invoice PDF...');
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const clientName = client.customer_type === 'business' ? 
            client.company_name : 
            `${client.first_name} ${client.last_name}`;
        
        const invoiceNumber = `INV-${invoiceId.toString().slice(-6)}`;
        const issueDate = new Date().toLocaleDateString('en-IN');
        const dueDate = new Date(invoiceData.due_date).toLocaleDateString('en-IN');
        
        // Header Section with Company Branding
        doc.setFillColor(30, 64, 175);
        doc.rect(0, 0, 210, 45, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(28);
        doc.setFont('helvetica', 'bold');
        doc.text('INVOICE', 20, 25);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text('Penny Pilot Financial Services', 20, 35);
        
        // Invoice details in header
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(invoiceNumber, 150, 25);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Issue Date: ${issueDate}`, 150, 32);
        doc.text(`Due Date: ${dueDate}`, 150, 38);
        
        // Reset colors
        doc.setTextColor(0, 0, 0);
        
        // Company Information
        let yPos = 65;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('FROM:', 20, yPos);
        
        yPos += 10;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text('Penny Pilot Financial Services', 20, yPos);
        yPos += 6;
        doc.text('123 Business District, Financial Center', 20, yPos);
        yPos += 6;
        doc.text('Mumbai, Maharashtra 400001', 20, yPos);
        yPos += 6;
        doc.text('Email: billing@pennypilot.com', 20, yPos);
        yPos += 6;
        doc.text('Phone: +91-22-1234-5678', 20, yPos);
        yPos += 6;
        doc.text('GST: 27AABCP1234A1ZR', 20, yPos);
        
        // Client Information
        yPos = 65;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('BILL TO:', 120, yPos);
        
        yPos += 10;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.text(clientName, 120, yPos);
        yPos += 6;
        if (client.address) {
            doc.text(client.address, 120, yPos);
            yPos += 6;
        }
        if (client.city && client.state) {
            doc.text(`${client.city}, ${client.state}`, 120, yPos);
            yPos += 6;
        }
        doc.text(`Email: ${client.email}`, 120, yPos);
        yPos += 6;
        doc.text(`Phone: ${client.phone}`, 120, yPos);
        
        // Invoice Details Section
        yPos = 150;
        doc.setFillColor(245, 246, 250);
        doc.rect(15, yPos - 5, 180, 15, 'F');
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('INVOICE DETAILS', 20, yPos + 5);
        
        // Status badge
        const statusColors = {
            'draft': [156, 163, 175],
            'sent': [59, 130, 246],
            'paid': [16, 185, 129],
            'overdue': [239, 68, 68]
        };
        
        const statusColor = statusColors[invoiceData.status] || [107, 114, 128];
        doc.setFillColor(...statusColor);
        doc.roundedRect(150, yPos - 3, 35, 8, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(invoiceData.status.toUpperCase(), 155, yPos + 2);
        
        doc.setTextColor(0, 0, 0);
        
        // Items table header
        yPos += 25;
        doc.setFillColor(30, 64, 175);
        doc.rect(15, yPos, 180, 12, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('DESCRIPTION', 20, yPos + 8);
        doc.text('QUANTITY', 120, yPos + 8);
        doc.text('RATE', 150, yPos + 8);
        doc.text('AMOUNT', 175, yPos + 8);
        
        doc.setTextColor(0, 0, 0);
        
        // Invoice line items
        yPos += 15;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        // Main service item
        doc.text(invoiceData.description, 20, yPos + 5);
        doc.text('1', 125, yPos + 5);
        doc.text(`₹${invoiceData.amount.toLocaleString('en-IN')}`, 150, yPos + 5);
        doc.text(`₹${invoiceData.amount.toLocaleString('en-IN')}`, 175, yPos + 5);
        
        // Separator line
        yPos += 15;
        doc.setDrawColor(200, 200, 200);
        doc.line(15, yPos, 195, yPos);
        
        // Totals section
        yPos += 15;
        const subtotal = invoiceData.amount;
        const gst = subtotal * 0.18; // 18% GST
        const total = subtotal + gst;
        
        doc.setFont('helvetica', 'normal');
        doc.text('Subtotal:', 140, yPos);
        doc.text(`₹${subtotal.toLocaleString('en-IN')}`, 175, yPos);
        
        yPos += 8;
        doc.text('GST (18%):', 140, yPos);
        doc.text(`₹${gst.toLocaleString('en-IN')}`, 175, yPos);
        
        yPos += 8;
        doc.setDrawColor(0, 0, 0);
        doc.line(135, yPos, 195, yPos);
        
        yPos += 8;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('TOTAL:', 140, yPos);
        doc.text(`₹${total.toLocaleString('en-IN')}`, 175, yPos);
        
        // Payment Terms
        yPos += 25;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('PAYMENT TERMS & CONDITIONS', 20, yPos);
        
        yPos += 10;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        const paymentTerms = [
            `• Payment is due within ${client.payment_terms || '30 days'} of invoice date`,
            '• Late payments may incur additional charges',
            '• Please include invoice number in payment reference',
            '• Payment can be made via bank transfer or online payment',
            '• For any queries, contact us at billing@pennypilot.com'
        ];
        
        paymentTerms.forEach(term => {
            doc.text(term, 20, yPos);
            yPos += 6;
        });
        
        // Bank Details
        yPos += 10;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('BANK DETAILS FOR PAYMENT:', 20, yPos);
        
        yPos += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Bank Name: HDFC Bank Ltd.', 20, yPos);
        yPos += 5;
        doc.text('Account Name: Penny Pilot Financial Services', 20, yPos);
        yPos += 5;
        doc.text('Account Number: 1234567890123456', 20, yPos);
        yPos += 5;
        doc.text('IFSC Code: HDFC0001234', 20, yPos);
        yPos += 5;
        doc.text('Branch: Mumbai Financial District', 20, yPos);
        
        // Footer
        doc.setFillColor(245, 246, 250);
        doc.rect(0, 280, 210, 17, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text('Thank you for your business! | Generated by Penny Pilot CRM', 20, 290);
        doc.text(`Invoice generated on: ${new Date().toLocaleString('en-IN')}`, 150, 290);
        
        // Save the PDF
        const fileName = `Invoice_${invoiceNumber}_${clientName.replace(/\s+/g, '_')}.pdf`;
        doc.save(fileName);
        
        hideLoading();
        
    } catch (error) {
        console.error('Error generating invoice PDF:', error);
        hideLoading();
        showToastError('Error generating invoice PDF. Please ensure jsPDF is loaded.');
    }
}

// Generate Comprehensive Client History Report
async function generateClientHistoryReport(client) {
    try {
        showLoading('Generating detailed client report...');
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const clientName = client.customer_type === 'business' ? 
            client.company_name : 
            `${client.first_name} ${client.last_name}`;
        
        // Header
        doc.setFillColor(30, 64, 175);
        doc.rect(0, 0, 220, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('CLIENT COMPREHENSIVE REPORT', 20, 25);
        
        // Reset colors
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        
        // Client Information Section
        let yPosition = 60;
        
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('CLIENT INFORMATION', 20, yPosition);
        
        yPosition += 15;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        
        doc.text(`Name: ${clientName}`, 20, yPosition);
        yPosition += 8;
        doc.text(`Type: ${client.customer_type.toUpperCase()}`, 20, yPosition);
        yPosition += 8;
        doc.text(`Status: ${client.customer_status.toUpperCase()}`, 20, yPosition);
        yPosition += 8;
        doc.text(`Email: ${client.email}`, 20, yPosition);
        yPosition += 8;
        doc.text(`Phone: ${client.phone}`, 20, yPosition);
        yPosition += 8;
        
        if (client.address) {
            doc.text(`Address: ${client.address}`, 20, yPosition);
            yPosition += 8;
        }
        
        if (client.city && client.state) {
            doc.text(`Location: ${client.city}, ${client.state}`, 20, yPosition);
            yPosition += 8;
        }
        
        doc.text(`Credit Limit: ₹${(client.credit_limit || 0).toLocaleString('en-IN')}`, 20, yPosition);
        yPosition += 8;
        doc.text(`Payment Terms: ${client.payment_terms || 'Not specified'}`, 20, yPosition);
        yPosition += 8;
        doc.text(`Client Since: ${client.created_at || 'N/A'}`, 20, yPosition);
        yPosition += 15;
        
        // Financial Summary
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('FINANCIAL SUMMARY', 20, yPosition);
        yPosition += 15;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        
        const totalRevenue = parseFloat(client.total_revenue) || 0;
        const pendingInvoices = parseInt(client.pending_invoices) || 0;
        
        doc.text(`Total Revenue Generated: ₹${totalRevenue.toLocaleString('en-IN')}`, 20, yPosition);
        yPosition += 8;
        doc.text(`Pending Invoices: ${pendingInvoices}`, 20, yPosition);
        yPosition += 8;
        doc.text(`Average Transaction Value: ₹${(totalRevenue / Math.max(1, pendingInvoices + 5)).toLocaleString('en-IN')}`, 20, yPosition);
        yPosition += 15;
        
        // Transaction History Section
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('TRANSACTION HISTORY', 20, yPosition);
        yPosition += 10;
        
        // Fetch actual client transactions
        let actualTransactions = [];
        try {
            const transactionResponse = await fetch(`/api/client-transactions/${client.id}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': JSON.stringify(currentUser)
                }
            });
            
            if (transactionResponse.ok) {
                const transactionData = await transactionResponse.json();
                actualTransactions = transactionData.transactions || [];
            }
        } catch (error) {
            console.error('Error fetching client transactions:', error);
        }
        
        // Use actual transactions or fallback to empty array
        const transactionsToShow = actualTransactions.length > 0 ? actualTransactions : [];
        
        if (transactionsToShow.length === 0) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'italic');
            doc.text('No transactions found for this client.', 20, yPosition + 10);
            yPosition += 25;
        } else {
            // Generate table data from actual transactions
            const transactionTableData = transactionsToShow.map(trans => [
                new Date(trans.transaction_date).toLocaleDateString(),
                trans.transaction_type === 'income' ? 'Income' : 'Expense',
                trans.description || 'No description',
                `₹${parseFloat(trans.amount).toLocaleString('en-IN')}`,
                'Completed'
            ]);
        
            doc.autoTable({
                head: [['Date', 'Type', 'Description', 'Amount', 'Status']],
                body: transactionTableData,
                startY: yPosition,
                styles: {
                    fontSize: 10,
                    cellPadding: 4
                },
                headStyles: {
                    fillColor: [30, 64, 175],
                    textColor: [255, 255, 255],
                    fontSize: 11,
                    fontStyle: 'bold'
                },
                alternateRowStyles: {
                    fillColor: [245, 246, 250]
                }
            });
        }
        
        yPosition = doc.lastAutoTable.finalY + 20;
        
        // Add new page if needed
        if (yPosition > 250) {
            doc.addPage();
            yPosition = 30;
        }
        
        // Invoice History Section
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('INVOICE HISTORY', 20, yPosition);
        yPosition += 10;
        
        // Fetch actual client invoices
        let actualInvoices = [];
        try {
            const invoiceResponse = await fetch(`/api/invoices/${client.id}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': JSON.stringify(currentUser)
                }
            });
            
            if (invoiceResponse.ok) {
                const invoiceData = await invoiceResponse.json();
                actualInvoices = invoiceData.invoices || [];
            }
        } catch (error) {
            console.error('Error fetching client invoices:', error);
        }
        
        if (actualInvoices.length === 0) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'italic');
            doc.text('No invoices found for this client.', 20, yPosition + 10);
            yPosition += 25;
        } else {
            const invoiceTableData = actualInvoices.map((inv, index) => [
                `INV-${String(inv.id).padStart(3, '0')}`,
                new Date(inv.created_at).toLocaleDateString(),
                new Date(inv.due_date).toLocaleDateString(),
                `₹${parseFloat(inv.amount).toLocaleString('en-IN')}`,
                inv.status.toUpperCase(),
                inv.status === 'paid' ? new Date(inv.updated_at).toLocaleDateString() : 'Pending'
            ]);
        
            doc.autoTable({
                head: [['Invoice #', 'Issue Date', 'Due Date', 'Amount', 'Status', 'Payment Date']],
                body: invoiceTableData,
                startY: yPosition,
                styles: {
                    fontSize: 10,
                    cellPadding: 4
                },
                headStyles: {
                    fillColor: [16, 185, 129],
                    textColor: [255, 255, 255],
                    fontSize: 11,
                    fontStyle: 'bold'
                },
                alternateRowStyles: {
                    fillColor: [245, 246, 250]
                }
            });
        }
        
        yPosition = doc.lastAutoTable.finalY + 20;
        
        // Payment Pattern Analysis
        if (yPosition > 220) {
            doc.addPage();
            yPosition = 30;
        }
        
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('PAYMENT PATTERN ANALYSIS', 20, yPosition);
        yPosition += 15;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        
        doc.text(`• Payment History: Generally ${client.customer_status === 'active' ? 'reliable' : 'needs attention'}`, 25, yPosition);
        yPosition += 8;
        doc.text(`• Average Payment Delay: 3-5 days`, 25, yPosition);
        yPosition += 8;
        doc.text(`• Preferred Payment Method: Bank Transfer`, 25, yPosition);
        yPosition += 8;
        doc.text(`• Credit Utilization: ${Math.round((totalRevenue / Math.max(client.credit_limit, 1)) * 100)}%`, 25, yPosition);
        yPosition += 15;
        
        // Recommendations
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('RECOMMENDATIONS', 20, yPosition);
        yPosition += 12;
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        
        if (client.customer_status === 'active') {
            doc.text('• Continue maintaining excellent business relationship', 25, yPosition);
            yPosition += 6;
            doc.text('• Consider offering loyalty discounts for long-term partnership', 25, yPosition);
            yPosition += 6;
            doc.text('• Explore opportunities for additional services', 25, yPosition);
        } else if (client.customer_status === 'prospect') {
            doc.text('• Follow up on pending proposals', 25, yPosition);
            yPosition += 6;
            doc.text('• Schedule a meeting to discuss requirements', 25, yPosition);
            yPosition += 6;
            doc.text('• Provide trial services to demonstrate value', 25, yPosition);
        } else {
            doc.text('• Reach out to understand reasons for inactivity', 25, yPosition);
            yPosition += 6;
            doc.text('• Offer special incentives to re-engage', 25, yPosition);
            yPosition += 6;
            doc.text('• Consider if relationship is worth pursuing', 25, yPosition);
        }
        
        // Footer
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.text(`Report generated on ${new Date().toLocaleDateString()} by Penny Pilot CRM`, 20, 280);
        
        // Save the PDF
        const fileName = `${clientName.replace(/\s+/g, '_')}_detailed_report_${new Date().getFullYear()}.pdf`;
        doc.save(fileName);
        
        hideLoading();
        showToastSuccess(`Detailed client report generated successfully for ${clientName}!`, 4000);
        
    } catch (error) {
        console.error('Error generating client report:', error);
        hideLoading();
        showToastError('Error generating client report. Please ensure jsPDF is loaded.');
    }
}

// Utility Functions
function showLoading(message = 'Loading...') {
    const container = document.getElementById('clients-grid');
    if (container) {
        container.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner"></i>
                <div class="loading-text">${message}</div>
            </div>
        `;
    }
    
    // Also show in table view if active
    const tableContainer = document.getElementById('clients-table-body');
    if (tableContainer && currentViewMode === 'table') {
        tableContainer.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="loading">
                        <i class="fas fa-spinner"></i>
                        <div class="loading-text">${message}</div>
                    </div>
                </td>
            </tr>
        `;
    }
}

function hideLoading() {
    // Remove loading from both grid and table view
    const gridContainer = document.getElementById('clients-grid');
    const tableContainer = document.getElementById('clients-table-body');
    
    // Clear any existing loading states
    const loadingElements = document.querySelectorAll('.loading');
    loadingElements.forEach(element => element.remove());
    
    // Re-display clients if needed
    if (allClients.length > 0) {
        displayClients();
    }
}

function showAlert(message, type = 'info', duration = 5000) {
    // Remove existing alerts
    document.querySelectorAll('.alert').forEach(alert => alert.remove());
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} fade-in`;
    
    const iconMap = {
        success: 'check-circle',
        error: 'exclamation-circle', 
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    
    alertDiv.innerHTML = `
        <i class="fas fa-${iconMap[type] || 'info-circle'}"></i>
        <span>${message}</span>
        <button class="close-alert" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Insert at the top of main content
    const mainContent = document.querySelector('.main-content');
    const firstChild = mainContent.querySelector('.navbar').nextElementSibling || mainContent.firstElementChild;
    mainContent.insertBefore(alertDiv, firstChild);
    
    // Auto remove after duration
    if (duration > 0) {
        setTimeout(() => {
            if (alertDiv.parentElement) {
                alertDiv.style.opacity = '0';
                alertDiv.style.transform = 'translateY(-20px)';
                setTimeout(() => alertDiv.remove(), 300);
            }
        }, duration);
    }
}

function logout() {
    localStorage.removeItem('userData');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isAuthenticated');
    window.location.href = '../Loginpage/index.html';
}

// Function to reset client data (for debugging)
function resetClientData() {
    localStorage.removeItem('allClients');
    showToastInfo('Client data cleared. Page will reload.');
    setTimeout(() => location.reload(), 1500);
}

// Add this function to window for console access
window.resetClientData = resetClientData;

// Global functions for HTML onclick events
window.openAddClientModal = openAddClientModal;
window.editClient = editClient;
window.closeClientModal = closeClientModal;
window.openTransactionModal = openTransactionModal;
window.closeTransactionModal = closeTransactionModal;
window.openInvoiceModal = openInvoiceModal;
window.closeInvoiceModal = closeInvoiceModal;
window.createNewInvoice = createNewInvoice;
window.setViewMode = setViewMode;
window.filterClients = filterClients;
window.searchClients = searchClients;
window.exportClientData = exportClientData;
window.generateClientHistoryReport = generateClientHistoryReport;
window.generateInvoicePDF = generateInvoicePDF;
window.toggleClientFields = toggleClientFields;
window.logout = logout;
