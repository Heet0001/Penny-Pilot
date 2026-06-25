// Team & Payroll Management - Backend API Integration

let teamCurrentUser = null;
let teamMembers = [];
let payrollHistory = [];
let editingMemberId = null;

const TEAM_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://penny-pilot-production.up.railway.app';

// Initialization

document.addEventListener('DOMContentLoaded', function () {
    console.log('Team & Payroll Module Initialized');

    checkTeamAuthentication();
    setupTeamEventListeners();
    loadTeamData();
});

// Authentication

function checkTeamAuthentication() {
    const userData = localStorage.getItem('userData') || localStorage.getItem('currentUser');
    const isAuthenticated = JSON.parse(localStorage.getItem('isAuthenticated') || 'false');

    if (!userData || !isAuthenticated) {
        window.location.href = '../Loginpage/index.html';
        return;
    }

    try {
        teamCurrentUser = JSON.parse(userData);

        const profileIcon = document.getElementById('profile-icon');
        const usernameTooltip = document.getElementById('username-tooltip');

        if (profileIcon && teamCurrentUser.name) {
            profileIcon.textContent = teamCurrentUser.name.charAt(0).toUpperCase();
        }
        if (usernameTooltip && teamCurrentUser.name) {
            usernameTooltip.textContent = teamCurrentUser.name;
        }
    } catch (error) {
        console.error('Error parsing user data for team module:', error);
        localStorage.removeItem('userData');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('isAuthenticated');
        window.location.href = '../Loginpage/index.html';
    }
}

// Get authentication headers
function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': JSON.stringify(teamCurrentUser),
        'x-session-data': JSON.stringify(teamCurrentUser)
    };
}

// Load all team data
async function loadTeamData() {
    await Promise.all([
        loadTeamMembers(),
        loadPayrollHistory(),
        initializeTeamWalletBalance(),
        loadPayrollStats()
    ]);
}

// Wallet helpers

function getTeamWalletBalance() {
    if (!teamCurrentUser) return 0;
    const cached = localStorage.getItem(`wallet_balance_${teamCurrentUser.id}`);
    return cached ? parseFloat(cached) : 0;
}

function displayTeamWalletBalance() {
    const el = document.getElementById('team-wallet-balance');
    if (el) {
        el.textContent = `₹${getTeamWalletBalance().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
}

async function initializeTeamWalletBalance() {
    if (!teamCurrentUser) return;

    try {
        const response = await fetch(`${TEAM_BASE_URL}/get-wallet-balance/${teamCurrentUser.id}`);
        if (!response.ok) throw new Error('Failed to fetch wallet balance');
        
        const data = await response.json();
        const balance = Number(data.balance || 0);
        localStorage.setItem(`wallet_balance_${teamCurrentUser.id}`, balance.toFixed(2));
        displayTeamWalletBalance();
    } catch (err) {
        console.warn('Using cached wallet balance for team page due to error:', err);
        displayTeamWalletBalance();
    }
}

// Load team members from API
async function loadTeamMembers() {
    if (!teamCurrentUser) return;

    try {
        const response = await fetch(`${TEAM_BASE_URL}/api/team-members`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '../Loginpage/index.html';
                return;
            }
            throw new Error('Failed to load team members');
        }

        const data = await response.json();
        teamMembers = data.team_members || [];
        updateTeamStats();
        renderTeamTable();
        updateHistoryFilter();
    } catch (error) {
        console.error('Error loading team members:', error);
        if (typeof showToastError === 'function') {
            showToastError('Failed to load team members. Please refresh the page.');
        } else {
            alert('Failed to load team members. Please refresh the page.');
        }
        teamMembers = [];
        renderTeamTable();
    }
}

// Load payroll history from API
async function loadPayrollHistory(memberId = null) {
    if (!teamCurrentUser) return;

    try {
        let url = `${TEAM_BASE_URL}/api/payroll-history`;
        if (memberId) {
            url += `?team_member_id=${memberId}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '../Loginpage/index.html';
                return;
            }
            throw new Error('Failed to load payroll history');
        }

        const data = await response.json();
        payrollHistory = data.payroll_history || [];
        renderPaymentHistory();
    } catch (error) {
        console.error('Error loading payroll history:', error);
        payrollHistory = [];
        renderPaymentHistory();
    }
}

// Load payroll statistics
async function loadPayrollStats() {
    if (!teamCurrentUser) return;

    try {
        const response = await fetch(`${TEAM_BASE_URL}/api/payroll-stats`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load payroll stats');
        }

        const data = await response.json();
        if (data.stats) {
            updateStatsFromAPI(data.stats);
        }
    } catch (error) {
        console.error('Error loading payroll stats:', error);
    }
}

function updateStatsFromAPI(stats) {
    const totalMembersEl = document.getElementById('total-team-members');
    const totalPayrollEl = document.getElementById('total-monthly-payroll');

    if (totalMembersEl) {
        totalMembersEl.textContent = stats.total_team_members || 0;
    }
    if (totalPayrollEl) {
        totalPayrollEl.textContent = `₹${(stats.total_monthly_payroll || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
}

// UI & Event handlers

function setupTeamEventListeners() {
    const addBtn = document.getElementById('add-team-member-btn');
    if (addBtn) {
        addBtn.addEventListener('click', openAddTeamModal);
    }

    const teamForm = document.getElementById('teamForm');
    if (teamForm) {
        teamForm.addEventListener('submit', handleTeamSubmit);
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            localStorage.removeItem('userData');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('isAuthenticated');
            window.location.href = '../Loginpage/index.html';
        });
    }

    // Close modal on outside click
    window.addEventListener('click', function (event) {
        const modal = document.getElementById('teamModal');
        if (event.target === modal) {
            closeTeamModal();
        }
    });
}

function openAddTeamModal() {
    editingMemberId = null;
    const title = document.getElementById('team-modal-title');
    if (title) title.textContent = 'Add Team Member';

    const form = document.getElementById('teamForm');
    if (form) form.reset();

    const modal = document.getElementById('teamModal');
    if (modal) modal.style.display = 'block';
}

function openEditTeamModal(memberId) {
    const member = teamMembers.find(m => m.id == memberId);
    if (!member) {
        if (typeof showToastError === 'function') {
            showToastError('Team member not found');
        } else {
            alert('Team member not found');
        }
        return;
    }

    editingMemberId = memberId;

    const title = document.getElementById('team-modal-title');
    if (title) title.textContent = 'Edit Team Member';

    document.getElementById('member-name').value = member.name || '';
    document.getElementById('member-role').value = member.role || '';
    document.getElementById('member-payroll').value = member.monthly_payroll || '';
    document.getElementById('member-hr').value = member.department || '';
    document.getElementById('member-notes').value = member.notes || '';

    const modal = document.getElementById('teamModal');
    if (modal) modal.style.display = 'block';
}

function closeTeamModal() {
    const modal = document.getElementById('teamModal');
    if (modal) modal.style.display = 'none';
    editingMemberId = null;
}

// Form submit

async function handleTeamSubmit(event) {
    event.preventDefault();

    const name = document.getElementById('member-name').value.trim();
    const role = document.getElementById('member-role').value.trim();
    const payrollRaw = document.getElementById('member-payroll').value;
    const department = document.getElementById('member-hr').value.trim();
    const notes = document.getElementById('member-notes').value.trim();

    const payroll = parseFloat(payrollRaw);
    if (!name || !role || isNaN(payroll) || payroll <= 0) {
        if (typeof showToastError === 'function') {
            showToastError('Please enter valid name, role and monthly payroll');
        } else {
            alert('Please enter valid name, role and monthly payroll');
        }
        return;
    }

    try {
        const url = editingMemberId 
            ? `${TEAM_BASE_URL}/api/team-members/${editingMemberId}`
            : `${TEAM_BASE_URL}/api/team-members`;
        
        const method = editingMemberId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: getAuthHeaders(),
            body: JSON.stringify({
                name,
                role,
                monthly_payroll: payroll,
                department: department || null,
                notes: notes || null
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '../Loginpage/index.html';
                return;
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to save team member');
        }

        const data = await response.json();
        
        if (typeof showToastSuccess === 'function') {
            showToastSuccess(data.message || 'Team member saved successfully');
        } else {
            alert(data.message || 'Team member saved successfully');
        }

        closeTeamModal();
        await loadTeamMembers();
        await loadPayrollStats();
    } catch (error) {
        console.error('Error saving team member:', error);
        if (typeof showToastError === 'function') {
            showToastError(error.message || 'Failed to save team member. Please try again.');
        } else {
            alert(error.message || 'Failed to save team member. Please try again.');
        }
    }
}

// Payroll actions

async function paySalary(memberId) {
    const member = teamMembers.find(m => m.id == memberId);
    if (!member) {
        if (typeof showToastError === 'function') {
            showToastError('Team member not found');
        } else {
            alert('Team member not found');
        }
        return;
    }

    const amount = parseFloat(member.monthly_payroll) || 0;
    if (amount <= 0) {
        if (typeof showToastError === 'function') {
            showToastError('Invalid payroll amount for this member');
        } else {
            alert('Invalid payroll amount for this member');
        }
        return;
    }

    // Get current wallet balance from server
    try {
        const walletResponse = await fetch(`${TEAM_BASE_URL}/get-wallet-balance/${teamCurrentUser.id}`);
        if (!walletResponse.ok) throw new Error('Failed to check wallet balance');
        
        const walletData = await walletResponse.json();
        const walletBalance = Number(walletData.balance || 0);

        if (walletBalance < amount) {
            const message = `Insufficient wallet balance. Available: ₹${walletBalance.toFixed(2)}, required: ₹${amount.toFixed(2)}`;
            if (typeof showToastError === 'function') {
                showToastError(message);
            } else {
                alert(message);
            }
            return;
        }

        const confirmMsg = `Pay ₹${amount.toFixed(2)} to ${member.name} (${member.role}) from wallet?`;
        const confirmed = window.pennyConfirm
            ? await window.pennyConfirm(confirmMsg, { title: 'Pay salary', okText: 'Pay now' })
            : window.confirm(confirmMsg);
        if (!confirmed) return;

        // Process payment
        const response = await fetch(`${TEAM_BASE_URL}/api/team-members/${memberId}/pay`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                payment_date: new Date().toISOString().split('T')[0],
                description: `Payroll - ${member.name} (${member.role})`
            })
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '../Loginpage/index.html';
                return;
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to process payroll');
        }

        const data = await response.json();
        
        // Update wallet balance from response
        if (data.new_wallet_balance !== undefined) {
            localStorage.setItem(`wallet_balance_${teamCurrentUser.id}`, data.new_wallet_balance.toFixed(2));
            displayTeamWalletBalance();
        } else {
            // Refresh wallet balance
            await initializeTeamWalletBalance();
        }

        // Reload data
        await loadTeamMembers();
        await loadPayrollHistory();
        await loadPayrollStats();

        if (typeof showToastSuccess === 'function') {
            showToastSuccess(`Payroll of ₹${amount.toFixed(2)} processed successfully for ${member.name}`);
        } else {
            alert(`Payroll processed successfully for ${member.name}`);
        }
    } catch (error) {
        console.error('Error processing payroll:', error);
        if (typeof showToastError === 'function') {
            showToastError(error.message || 'Failed to process payroll. Please try again.');
        } else {
            alert(error.message || 'Failed to process payroll. Please try again.');
        }
    }
}

// Delete team member
async function deleteTeamMember(memberId) {
    const member = teamMembers.find(m => m.id == memberId);
    if (!member) {
        if (typeof showToastError === 'function') {
            showToastError('Team member not found');
        } else {
            alert('Team member not found');
        }
        return;
    }

    const confirmed = window.pennyConfirm
        ? await window.pennyConfirm(`Are you sure you want to delete ${member.name}? This action cannot be undone.`, { title: 'Delete team member', okText: 'Delete', danger: true })
        : window.confirm(`Are you sure you want to delete ${member.name}? This action cannot be undone.`);
    if (!confirmed) return;

    try {
        const response = await fetch(`${TEAM_BASE_URL}/api/team-members/${memberId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '../Loginpage/index.html';
                return;
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to delete team member');
        }

        const data = await response.json();
        
        if (typeof showToastSuccess === 'function') {
            showToastSuccess(data.message || 'Team member deleted successfully');
        } else {
            alert(data.message || 'Team member deleted successfully');
        }

        await loadTeamMembers();
        await loadPayrollStats();
    } catch (error) {
        console.error('Error deleting team member:', error);
        if (typeof showToastError === 'function') {
            showToastError(error.message || 'Failed to delete team member. Please try again.');
        } else {
            alert(error.message || 'Failed to delete team member. Please try again.');
        }
    }
}

// Rendering & stats

function updateTeamStats() {
    const totalMembersEl = document.getElementById('total-team-members');
    const totalPayrollEl = document.getElementById('total-monthly-payroll');

    const totalMembers = teamMembers.length;
    const totalPayroll = teamMembers.reduce((sum, m) => sum + (parseFloat(m.monthly_payroll) || 0), 0);

    if (totalMembersEl) totalMembersEl.textContent = totalMembers;
    if (totalPayrollEl) {
        totalPayrollEl.textContent = `₹${totalPayroll.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    displayTeamWalletBalance();
}

function renderTeamTable() {
    const tbody = document.getElementById('team-table-body');
    if (!tbody) return;

    if (teamMembers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    <div class="empty-state">
                        <i class="fas fa-user-tie"></i>
                        <h3>No Team Members</h3>
                        <p>Add your first team member to start tracking payroll.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = teamMembers.map(member => {
        const lastPaid = member.last_paid_at
            ? new Date(member.last_paid_at).toLocaleDateString('en-IN', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            })
            : 'Not paid yet';

        return `
            <tr>
                <td>${escapeHtml(member.name)}</td>
                <td>${escapeHtml(member.role)}${member.department ? ` <span class="client-type">${escapeHtml(member.department)}</span>` : ''}</td>
                <td>₹${(parseFloat(member.monthly_payroll) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>${lastPaid}</td>
                <td>
                    <button class="btn btn-secondary" onclick="paySalary(${member.id})" title="Pay Salary">
                        <i class="fas fa-money-bill-wave"></i>
                    </button>
                    <button class="btn btn-secondary" onclick="openEditTeamModal(${member.id})" title="Edit Member">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-secondary" onclick="deleteTeamMember(${member.id})" title="Delete Member" style="color: #dc3545;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderPaymentHistory() {
    const tbody = document.getElementById('payment-history-body');
    if (!tbody) return;

    if (payrollHistory.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    <div class="empty-state">
                        <i class="fas fa-history"></i>
                        <p>No payment history available</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = payrollHistory.map(payment => {
        const paymentDate = new Date(payment.payment_date).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        return `
            <tr>
                <td>${paymentDate}</td>
                <td>${escapeHtml(payment.member_name || 'N/A')}</td>
                <td>${escapeHtml(payment.member_role || 'N/A')}</td>
                <td>₹${(parseFloat(payment.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>${escapeHtml(payment.description || 'N/A')}</td>
            </tr>
        `;
    }).join('');
}

function updateHistoryFilter() {
    const filter = document.getElementById('history-filter');
    if (!filter) return;

    // Keep "All Members" option
    const allOption = filter.querySelector('option[value=""]');
    filter.innerHTML = '';
    if (allOption) {
        filter.appendChild(allOption);
    } else {
        filter.innerHTML = '<option value="">All Members</option>';
    }

    // Add team members as options
    teamMembers.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = `${member.name} (${member.role})`;
        filter.appendChild(option);
    });
}

function filterPaymentHistory() {
    const filter = document.getElementById('history-filter');
    if (!filter) return;

    const memberId = filter.value;
    loadPayrollHistory(memberId || null);
}

// Utility functions

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Expose functions for HTML onclick
window.openAddTeamModal = openAddTeamModal;
window.openEditTeamModal = openEditTeamModal;
window.closeTeamModal = closeTeamModal;
window.paySalary = paySalary;
window.deleteTeamMember = deleteTeamMember;
window.filterPaymentHistory = filterPaymentHistory;