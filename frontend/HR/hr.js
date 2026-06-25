// HR & Payroll - frontend logic
// Talks to /api/hr/* on the backend

const HR_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://penny-pilot-production.up.railway.app';

let hrUser = null;
let hrEmployees = [];
let hrLeaves = [];
let hrAppraisals = [];
let hrPostings = [];
let hrApplicants = [];
let hrPayslips = [];

// ---- helpers ----

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'x-session-data': JSON.stringify(hrUser),
    };
}

async function api(method, path, body) {
    const opts = { method, headers: authHeaders() };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(`${HR_BASE_URL}/api/hr${path}`, opts);
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
        throw new Error((data && data.error) || `Request failed (${res.status})`);
    }
    return data || {};
}

function inr(n) {
    const num = Number(n) || 0;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function shortInr(n) {
    return `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
}
function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

function toast(type, msg) {
    if (typeof Toastify !== 'undefined') {
        const colors = {
            success: 'linear-gradient(135deg,#10B981,#34D399)',
            error:   'linear-gradient(135deg,#EF4444,#F87171)',
            info:    'linear-gradient(135deg,#4F46E5,#6366F1)',
            warning: 'linear-gradient(135deg,#F59E0B,#FBBF24)',
        };
        Toastify({
            text: msg, duration: 3500, gravity: 'top', position: 'right',
            style: { background: colors[type] || colors.info },
        }).showToast();
    }
}

function openModal(id)  { document.getElementById(id)?.classList.add('is-open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('is-open'); }

function checkHrAuth() {
    const userData = localStorage.getItem('userData') || localStorage.getItem('currentUser');
    const isAuthenticated = JSON.parse(localStorage.getItem('isAuthenticated') || 'false');
    if (!userData || !isAuthenticated) {
        window.location.href = '../Loginpage/index.html';
        return null;
    }
    try {
        hrUser = JSON.parse(userData);
        const profile = document.getElementById('profile-icon');
        const tooltip = document.getElementById('username-tooltip');
        if (profile && hrUser.name) profile.textContent = hrUser.name.charAt(0).toUpperCase();
        if (tooltip && hrUser.name) tooltip.textContent = hrUser.name;
        return hrUser;
    } catch (e) {
        window.location.href = '../Loginpage/index.html';
        return null;
    }
}

function setupTabs() {
    document.querySelectorAll('.inv-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            document.querySelectorAll('.inv-tab').forEach((t) => t.classList.remove('active'));
            document.querySelectorAll('.inv-panel').forEach((p) => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`panel-${target}`)?.classList.add('active');
            // Load data lazily on tab switch where helpful
            if (target === 'attendance') loadAttendance();
            if (target === 'leaves') loadLeaves();
            if (target === 'performance') loadAppraisals();
            if (target === 'recruitment') loadRecruitment();
            if (target === 'payroll') loadPayslips();
        });
    });
}

// ---- Employees ----

function renderEmployees() {
    const tbody = document.getElementById('employees-tbody');
    if (!tbody) return;
    if (hrEmployees.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="inv-empty">No employees yet. Add your first team member.</td></tr>`;
        return;
    }
    tbody.innerHTML = hrEmployees.map((e) => `
        <tr>
            <td><strong>${escapeHtml(e.name)}</strong>${e.email ? `<div style="font-size:11.5px;color:var(--text-muted);">${escapeHtml(e.email)}</div>` : ''}</td>
            <td>${escapeHtml(e.employee_code || '—')}</td>
            <td>${escapeHtml(e.role)}</td>
            <td>${escapeHtml(e.department || '—')}</td>
            <td>${escapeHtml(e.work_mode || '—')}</td>
            <td>${e.joining_date ? e.joining_date.slice(0, 10) : '—'}</td>
            <td>${inr(e.monthly_payroll)}</td>
            <td>
                <button class="inv-action" data-hr-action="mark-attendance" data-id="${e.id}" title="Mark attendance"><i class="fas fa-calendar-check"></i></button>
                <button class="inv-action" data-hr-action="edit-employee" data-id="${e.id}" title="Edit"><i class="fas fa-pen"></i></button>
                <button class="inv-action danger" data-hr-action="delete-employee" data-id="${e.id}" title="Remove"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function loadEmployees() {
    try {
        const data = await api('GET', '/employees');
        hrEmployees = data.employees || [];
        renderEmployees();
    } catch (err) {
        toast('error', err.message);
    }
}

function openEmployeeModal(emp) {
    document.getElementById('employee-modal-title').textContent = emp ? 'Edit Employee' : 'Add Employee';
    const $ = (id) => document.getElementById(id);
    $('employee-id').value = emp?.id || '';
    $('emp-name').value = emp?.name || '';
    $('emp-code').value = emp?.employee_code || '';
    $('emp-role').value = emp?.role || '';
    $('emp-department').value = emp?.department || '';
    $('emp-email').value = emp?.email || '';
    $('emp-phone').value = emp?.phone || '';
    $('emp-joining-date').value = emp?.joining_date ? emp.joining_date.slice(0, 10) : '';
    $('emp-work-mode').value = emp?.work_mode || 'onsite';
    $('emp-bank-account').value = emp?.bank_account || '';
    $('emp-ifsc').value = emp?.ifsc || '';
    $('emp-pan').value = emp?.pan || '';
    $('emp-tax-regime').value = emp?.tax_regime || 'new';
    $('emp-basic').value = emp?.basic_salary || 0;
    $('emp-hra').value = emp?.hra || 0;
    $('emp-allowances').value = emp?.allowances || 0;
    $('emp-pf-percent').value = emp?.pf_percent || 12;
    $('emp-notes').value = emp?.notes || '';
    openModal('employee-modal');
}

async function saveEmployee(e) {
    e.preventDefault();
    const $ = (id) => document.getElementById(id);
    const id = $('employee-id').value;
    const payload = {
        name: $('emp-name').value.trim(),
        role: $('emp-role').value.trim(),
        department: $('emp-department').value.trim(),
        email: $('emp-email').value.trim(),
        phone: $('emp-phone').value.trim(),
        joining_date: $('emp-joining-date').value || null,
        employee_code: $('emp-code').value.trim(),
        work_mode: $('emp-work-mode').value,
        bank_account: $('emp-bank-account').value.trim(),
        ifsc: $('emp-ifsc').value.trim(),
        pan: $('emp-pan').value.trim(),
        tax_regime: $('emp-tax-regime').value,
        basic_salary: Number($('emp-basic').value) || 0,
        hra: Number($('emp-hra').value) || 0,
        allowances: Number($('emp-allowances').value) || 0,
        pf_percent: Number($('emp-pf-percent').value) || 12,
        notes: $('emp-notes').value.trim(),
    };
    payload.monthly_payroll = payload.basic_salary + payload.hra + payload.allowances;

    try {
        if (id) await api('PUT', `/employees/${id}`, payload);
        else await api('POST', '/employees', payload);
        toast('success', id ? 'Employee updated' : 'Employee added');
        closeModal('employee-modal');
        await Promise.all([loadEmployees(), loadStats()]);
    } catch (err) {
        toast('error', err.message);
    }
}

async function deleteEmployee(id) {
    const ok = window.pennyConfirm
        ? await window.pennyConfirm('Mark this employee as inactive?', { title: 'Remove employee', okText: 'Mark inactive', danger: true })
        : true;
    if (!ok) return;
    try {
        await api('DELETE', `/employees/${id}`);
        toast('success', 'Employee removed');
        await Promise.all([loadEmployees(), loadStats()]);
    } catch (err) {
        toast('error', err.message);
    }
}

// ---- Attendance ----

async function loadAttendance() {
    const dateInput = document.getElementById('attendance-date');
    if (!dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
    const date = dateInput.value;
    try {
        const data = await api('GET', `/attendance?from=${date}&to=${date}`);
        const records = data.attendance || [];
        renderAttendance(records, date);
    } catch (err) {
        toast('error', err.message);
    }
}

function renderAttendance(records, date) {
    const tbody = document.getElementById('attendance-tbody');
    if (!tbody) return;
    if (hrEmployees.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="inv-empty">Add employees first.</td></tr>`;
        return;
    }
    const recordMap = new Map();
    records.forEach((r) => recordMap.set(r.team_member_id, r));

    tbody.innerHTML = hrEmployees.map((e) => {
        const r = recordMap.get(e.id);
        const statusPill = r ? attStatusPill(r.status) : '<span class="pill pill-muted">Not marked</span>';
        return `
            <tr>
                <td><strong>${escapeHtml(e.name)}</strong></td>
                <td>${escapeHtml(e.role)}</td>
                <td>${statusPill}</td>
                <td>${r ? r.hours_worked : '—'}</td>
                <td>${escapeHtml(r?.notes || '—')}</td>
                <td>
                    <button class="inv-action" data-hr-action="mark-attendance" data-id="${e.id}" data-date="${date}"><i class="fas fa-pen"></i> Mark</button>
                </td>
            </tr>
        `;
    }).join('');
}

function attStatusPill(status) {
    const map = {
        present:  ['pill-success', 'Present'],
        absent:   ['pill-danger',  'Absent'],
        leave:    ['pill-warning', 'On Leave'],
        remote:   ['pill-info',    'Remote'],
        holiday:  ['pill-muted',   'Holiday'],
    };
    const [cls, label] = map[status] || ['pill-muted', status];
    return `<span class="pill ${cls}">${label}</span>`;
}

function openAttendanceModal(memberId, date) {
    const member = hrEmployees.find((e) => String(e.id) === String(memberId));
    if (!member) return;
    document.getElementById('att-member-id').value = member.id;
    document.getElementById('att-member-name').value = `${member.name} - ${member.role}`;
    document.getElementById('att-date').value = date || new Date().toISOString().slice(0, 10);
    document.getElementById('att-status').value = 'present';
    document.getElementById('att-hours').value = 8;
    document.getElementById('att-notes').value = '';
    openModal('attendance-modal');
}

async function saveAttendance(e) {
    e.preventDefault();
    const payload = {
        team_member_id: document.getElementById('att-member-id').value,
        attendance_date: document.getElementById('att-date').value,
        status: document.getElementById('att-status').value,
        hours_worked: Number(document.getElementById('att-hours').value) || 0,
        notes: document.getElementById('att-notes').value.trim(),
    };
    try {
        await api('POST', '/attendance', payload);
        toast('success', 'Attendance recorded');
        closeModal('attendance-modal');
        await loadAttendance();
    } catch (err) {
        toast('error', err.message);
    }
}

// ---- Leaves ----

async function loadLeaves() {
    try {
        const data = await api('GET', '/leaves');
        hrLeaves = data.leaves || [];
        renderLeaves();
    } catch (err) {
        toast('error', err.message);
    }
}

function leaveStatusPill(s) {
    const map = {
        approved: ['pill-success', 'Approved'],
        rejected: ['pill-danger',  'Rejected'],
        pending:  ['pill-warning', 'Pending'],
    };
    const [cls, label] = map[s] || ['pill-muted', s];
    return `<span class="pill ${cls}">${label}</span>`;
}

function renderLeaves() {
    const tbody = document.getElementById('leaves-tbody');
    if (!tbody) return;
    if (hrLeaves.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="inv-empty">No leave requests yet.</td></tr>`;
        return;
    }
    tbody.innerHTML = hrLeaves.map((l) => `
        <tr>
            <td><strong>${escapeHtml(l.member_name)}</strong></td>
            <td>${escapeHtml(l.leave_type)}</td>
            <td>${l.start_date.slice(0, 10)}</td>
            <td>${l.end_date.slice(0, 10)}</td>
            <td>${escapeHtml(l.reason || '—')}</td>
            <td>${leaveStatusPill(l.status)}</td>
            <td>
                ${l.status === 'pending' ? `
                    <button class="inv-action" data-hr-action="approve-leave" data-id="${l.id}" title="Approve"><i class="fas fa-check"></i></button>
                    <button class="inv-action danger" data-hr-action="reject-leave" data-id="${l.id}" title="Reject"><i class="fas fa-xmark"></i></button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

function openLeaveModal() {
    const sel = document.getElementById('leave-member-id');
    sel.innerHTML = hrEmployees.map((e) => `<option value="${e.id}">${escapeHtml(e.name)} (${escapeHtml(e.role)})</option>`).join('');
    document.getElementById('leave-from').value = new Date().toISOString().slice(0, 10);
    document.getElementById('leave-to').value = new Date().toISOString().slice(0, 10);
    document.getElementById('leave-reason').value = '';
    document.getElementById('leave-type').value = 'casual';
    document.getElementById('leave-status').value = 'pending';
    openModal('leave-modal');
}

async function saveLeave(e) {
    e.preventDefault();
    const payload = {
        team_member_id: document.getElementById('leave-member-id').value,
        leave_type: document.getElementById('leave-type').value,
        start_date: document.getElementById('leave-from').value,
        end_date: document.getElementById('leave-to').value,
        reason: document.getElementById('leave-reason').value.trim(),
        status: document.getElementById('leave-status').value,
    };
    try {
        await api('POST', '/leaves', payload);
        toast('success', 'Leave logged');
        closeModal('leave-modal');
        await Promise.all([loadLeaves(), loadStats()]);
    } catch (err) {
        toast('error', err.message);
    }
}

async function setLeaveStatus(id, status) {
    try {
        await api('PUT', `/leaves/${id}/status`, { status });
        toast('success', `Leave ${status}`);
        await Promise.all([loadLeaves(), loadStats()]);
    } catch (err) {
        toast('error', err.message);
    }
}

// ---- Appraisals ----

async function loadAppraisals() {
    try {
        const data = await api('GET', '/appraisals');
        hrAppraisals = data.appraisals || [];
        renderAppraisals();
    } catch (err) {
        toast('error', err.message);
    }
}

function renderAppraisals() {
    const grid = document.getElementById('appraisals-grid');
    if (!grid) return;
    if (hrAppraisals.length === 0) {
        grid.innerHTML = `<div class="inv-empty">No performance reviews yet.</div>`;
        return;
    }
    grid.innerHTML = hrAppraisals.map((a) => `
        <div class="hr-card">
            <h4>${escapeHtml(a.member_name)} <span style="font-weight:400;color:var(--text-muted);">· ${escapeHtml(a.member_role)}</span></h4>
            <p>${a.review_period ? `<strong>${escapeHtml(a.review_period)}</strong> · ` : ''}${escapeHtml(a.comments || a.goals || '')}</p>
            ${a.promotion_to_role ? `<p style="margin-top:6px;"><i class="fas fa-arrow-up"></i> Promotion: <strong>${escapeHtml(a.promotion_to_role)}</strong></p>` : ''}
            ${Number(a.salary_increment) > 0 ? `<p>Increment: <strong>${inr(a.salary_increment)}</strong> / month</p>` : ''}
            <div class="hr-card-meta">
                <span class="hr-card-rating">${a.rating ? `★ ${Number(a.rating).toFixed(1)} / 5` : ''}</span>
                <span>${a.created_at ? a.created_at.slice(0, 10) : ''}</span>
            </div>
        </div>
    `).join('');
}

function openAppraisalModal() {
    const sel = document.getElementById('appraisal-member-id');
    sel.innerHTML = hrEmployees.map((e) => `<option value="${e.id}">${escapeHtml(e.name)} (${escapeHtml(e.role)})</option>`).join('');
    document.getElementById('appraisal-period').value = '';
    document.getElementById('appraisal-rating').value = '';
    document.getElementById('appraisal-promotion').value = '';
    document.getElementById('appraisal-increment').value = 0;
    document.getElementById('appraisal-goals').value = '';
    document.getElementById('appraisal-comments').value = '';
    openModal('appraisal-modal');
}

async function saveAppraisal(e) {
    e.preventDefault();
    const payload = {
        team_member_id: document.getElementById('appraisal-member-id').value,
        review_period: document.getElementById('appraisal-period').value.trim(),
        rating: Number(document.getElementById('appraisal-rating').value) || null,
        promotion_to_role: document.getElementById('appraisal-promotion').value.trim(),
        salary_increment: Number(document.getElementById('appraisal-increment').value) || 0,
        goals: document.getElementById('appraisal-goals').value.trim(),
        comments: document.getElementById('appraisal-comments').value.trim(),
    };
    try {
        await api('POST', '/appraisals', payload);
        toast('success', 'Review saved');
        closeModal('appraisal-modal');
        await Promise.all([loadAppraisals(), loadEmployees()]);
    } catch (err) {
        toast('error', err.message);
    }
}

// ---- Recruitment ----

async function loadRecruitment() {
    try {
        const [postingsData, applicantsData] = await Promise.all([
            api('GET', '/job-postings'),
            api('GET', '/applicants'),
        ]);
        hrPostings = postingsData.job_postings || [];
        hrApplicants = applicantsData.applicants || [];
        renderPostings();
        renderApplicants();
    } catch (err) {
        toast('error', err.message);
    }
}

function renderPostings() {
    const grid = document.getElementById('postings-grid');
    if (!grid) return;
    if (hrPostings.length === 0) {
        grid.innerHTML = `<div class="inv-empty">No job postings yet.</div>`;
        return;
    }
    grid.innerHTML = hrPostings.map((p) => `
        <div class="hr-card">
            <h4>${escapeHtml(p.title)}</h4>
            ${p.department ? `<p>${escapeHtml(p.department)}</p>` : ''}
            <p>${escapeHtml(p.description || '').slice(0, 200)}${(p.description || '').length > 200 ? '…' : ''}</p>
            <div class="hr-card-meta">
                <span class="pill ${p.status === 'open' ? 'pill-success' : 'pill-muted'}">${p.status}</span>
                <span>${p.applicant_count || 0} applicants</span>
            </div>
        </div>
    `).join('');
}

function renderApplicants() {
    const board = document.getElementById('applicants-board');
    if (!board) return;
    const stages = ['applied', 'shortlisted', 'interview', 'offer', 'hired', 'rejected'];
    const labels = { applied: 'Applied', shortlisted: 'Shortlisted', interview: 'Interview', offer: 'Offer', hired: 'Hired', rejected: 'Rejected' };
    board.innerHTML = stages.map((stage) => {
        const apps = hrApplicants.filter((a) => a.stage === stage);
        return `
            <div class="hr-pipeline-col">
                <div class="hr-pipeline-col-header"><span>${labels[stage]}</span><span>${apps.length}</span></div>
                ${apps.map((a) => `
                    <div class="hr-applicant">
                        <div class="hr-applicant-name">${escapeHtml(a.name)}</div>
                        <div class="hr-applicant-meta">${escapeHtml(a.job_title || '')}</div>
                        ${a.email ? `<div class="hr-applicant-meta">${escapeHtml(a.email)}</div>` : ''}
                        <select data-hr-action="move-applicant" data-id="${a.id}">
                            ${stages.map((s) => `<option value="${s}" ${s === stage ? 'selected' : ''}>${labels[s]}</option>`).join('')}
                        </select>
                    </div>
                `).join('') || `<div style="color:var(--text-muted);font-size:11.5px;text-align:center;padding:0.5rem;">—</div>`}
            </div>
        `;
    }).join('');
}

function openPostingModal() {
    document.getElementById('posting-id').value = '';
    document.getElementById('posting-title').value = '';
    document.getElementById('posting-department').value = '';
    document.getElementById('posting-status').value = 'open';
    document.getElementById('posting-description').value = '';
    openModal('posting-modal');
}

async function savePosting(e) {
    e.preventDefault();
    const id = document.getElementById('posting-id').value;
    const payload = {
        title: document.getElementById('posting-title').value.trim(),
        department: document.getElementById('posting-department').value.trim(),
        status: document.getElementById('posting-status').value,
        description: document.getElementById('posting-description').value.trim(),
    };
    try {
        if (id) await api('PUT', `/job-postings/${id}`, payload);
        else await api('POST', '/job-postings', payload);
        toast('success', 'Job posting saved');
        closeModal('posting-modal');
        await Promise.all([loadRecruitment(), loadStats()]);
    } catch (err) {
        toast('error', err.message);
    }
}

function openApplicantModal() {
    const sel = document.getElementById('applicant-posting-id');
    sel.innerHTML = hrPostings.map((p) => `<option value="${p.id}">${escapeHtml(p.title)}</option>`).join('');
    if (hrPostings.length === 0) {
        toast('warning', 'Create a job posting first');
        return;
    }
    document.getElementById('applicant-name').value = '';
    document.getElementById('applicant-email').value = '';
    document.getElementById('applicant-phone').value = '';
    document.getElementById('applicant-stage').value = 'applied';
    document.getElementById('applicant-resume').value = '';
    document.getElementById('applicant-notes').value = '';
    openModal('applicant-modal');
}

async function saveApplicant(e) {
    e.preventDefault();
    const payload = {
        job_posting_id: document.getElementById('applicant-posting-id').value,
        name: document.getElementById('applicant-name').value.trim(),
        email: document.getElementById('applicant-email').value.trim(),
        phone: document.getElementById('applicant-phone').value.trim(),
        stage: document.getElementById('applicant-stage').value,
        resume_url: document.getElementById('applicant-resume').value.trim(),
        notes: document.getElementById('applicant-notes').value.trim(),
    };
    try {
        await api('POST', '/applicants', payload);
        toast('success', 'Applicant added');
        closeModal('applicant-modal');
        await loadRecruitment();
    } catch (err) {
        toast('error', err.message);
    }
}

async function moveApplicantStage(id, stage) {
    try {
        await api('PUT', `/applicants/${id}/stage`, { stage });
        toast('success', `Applicant moved to ${stage}`);
        await loadRecruitment();
    } catch (err) {
        toast('error', err.message);
    }
}

// ---- Payroll ----

async function loadPayslips() {
    try {
        const data = await api('GET', '/payslips');
        hrPayslips = data.payslips || [];
        renderPayslips();
    } catch (err) {
        toast('error', err.message);
    }
}

function renderPayslips() {
    const tbody = document.getElementById('payslips-tbody');
    if (!tbody) return;
    if (hrPayslips.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="inv-empty">No payslips yet. Click "Run Payroll" to generate one.</td></tr>`;
        return;
    }
    tbody.innerHTML = hrPayslips.map((p) => `
        <tr>
            <td><strong>${escapeHtml(p.pay_period)}</strong></td>
            <td>${escapeHtml(p.member_name)}<div style="font-size:11.5px;color:var(--text-muted);">${escapeHtml(p.member_role)}</div></td>
            <td>${inr(p.gross_salary)}</td>
            <td>${inr(p.pf_deduction)}</td>
            <td>${inr(p.tax_deduction)}</td>
            <td><strong>${inr(p.net_salary)}</strong></td>
            <td>${p.payment_date ? p.payment_date.slice(0, 10) : '—'}</td>
            <td>${p.payment_status === 'paid' ? '<span class="pill pill-success">Paid</span>' : '<span class="pill pill-warning">Pending</span>'}</td>
            <td></td>
        </tr>
    `).join('');
}

function openPayrollModal() {
    if (hrEmployees.length === 0) {
        toast('warning', 'Add at least one employee first');
        return;
    }
    const today = new Date();
    const periodInput = document.getElementById('payroll-period');
    const dateInput = document.getElementById('payroll-payment-date');
    if (!periodInput.value) {
        periodInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    }
    if (!dateInput.value) {
        dateInput.value = today.toISOString().slice(0, 10);
    }
    if (!document.getElementById('payroll-working-days').value) {
        document.getElementById('payroll-working-days').value = 22;
    }

    renderPayrollRows();
    openModal('payroll-modal');
}

function renderPayrollRows() {
    const tbody = document.getElementById('payroll-tbody');
    const workingDays = Number(document.getElementById('payroll-working-days').value) || 22;
    tbody.innerHTML = hrEmployees.map((e) => {
        const net = computeNetClient(e, workingDays, workingDays, 0, 0);
        return `
            <tr data-emp-id="${e.id}">
                <td><input type="checkbox" class="payroll-row-check" checked></td>
                <td><strong>${escapeHtml(e.name)}</strong><div style="font-size:11.5px;color:var(--text-muted);">${escapeHtml(e.role)}</div></td>
                <td><input class="form-control payroll-days" type="number" min="0" max="${workingDays}" value="${workingDays}" style="width:90px;"></td>
                <td><input class="form-control payroll-overtime" type="number" min="0" step="0.01" value="0" style="width:110px;"></td>
                <td><input class="form-control payroll-bonus" type="number" min="0" step="0.01" value="0" style="width:110px;"></td>
                <td class="payroll-net">${inr(net)}</td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('tr').forEach((row) => {
        const update = () => {
            const empId = row.dataset.empId;
            const e = hrEmployees.find((x) => String(x.id) === empId);
            const days = Number(row.querySelector('.payroll-days').value) || 0;
            const wd = Number(document.getElementById('payroll-working-days').value) || 22;
            const ot = Number(row.querySelector('.payroll-overtime').value) || 0;
            const bn = Number(row.querySelector('.payroll-bonus').value) || 0;
            const net = computeNetClient(e, days, wd, ot, bn);
            row.querySelector('.payroll-net').textContent = inr(net);
            updatePayrollTotal();
        };
        row.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', update));
    });

    document.getElementById('payroll-working-days').addEventListener('input', () => renderPayrollRows());
    document.getElementById('payroll-select-all').addEventListener('change', (ev) => {
        document.querySelectorAll('.payroll-row-check').forEach((c) => { c.checked = ev.target.checked; });
        updatePayrollTotal();
    });
    document.querySelectorAll('.payroll-row-check').forEach((c) => c.addEventListener('change', updatePayrollTotal));

    updatePayrollTotal();
}

function updatePayrollTotal() {
    let total = 0;
    document.querySelectorAll('#payroll-tbody tr').forEach((row) => {
        const checked = row.querySelector('.payroll-row-check')?.checked;
        if (!checked) return;
        const empId = row.dataset.empId;
        const e = hrEmployees.find((x) => String(x.id) === empId);
        const days = Number(row.querySelector('.payroll-days').value) || 0;
        const wd = Number(document.getElementById('payroll-working-days').value) || 22;
        const ot = Number(row.querySelector('.payroll-overtime').value) || 0;
        const bn = Number(row.querySelector('.payroll-bonus').value) || 0;
        total += computeNetClient(e, days, wd, ot, bn);
    });
    document.getElementById('payroll-total').textContent = inr(total);
}

// Mirror of server-side computePayslip - good enough for live preview
function computeNetClient(emp, daysPresent, workingDays, overtime, bonus) {
    if (!emp) return 0;
    const ratio = workingDays > 0 ? Math.min(1, daysPresent / workingDays) : 1;
    const basic = (Number(emp.basic_salary) || 0) * ratio;
    const hra = (Number(emp.hra) || 0) * ratio;
    const allow = (Number(emp.allowances) || 0) * ratio;
    const gross = basic + hra + allow + (Number(overtime) || 0) + (Number(bonus) || 0);
    const pf = basic * ((Number(emp.pf_percent) || 12) / 100);
    const annualGross = gross * 12;
    let annualTax = 0;
    if ((emp.tax_regime || 'new') === 'old') {
        if (annualGross <= 250000) annualTax = 0;
        else if (annualGross <= 500000) annualTax = (annualGross - 250000) * 0.05;
        else if (annualGross <= 1000000) annualTax = 12500 + (annualGross - 500000) * 0.20;
        else annualTax = 112500 + (annualGross - 1000000) * 0.30;
    } else {
        if (annualGross <= 300000) annualTax = 0;
        else if (annualGross <= 600000) annualTax = (annualGross - 300000) * 0.05;
        else if (annualGross <= 900000) annualTax = 15000 + (annualGross - 600000) * 0.10;
        else if (annualGross <= 1200000) annualTax = 45000 + (annualGross - 900000) * 0.15;
        else if (annualGross <= 1500000) annualTax = 90000 + (annualGross - 1200000) * 0.20;
        else annualTax = 150000 + (annualGross - 1500000) * 0.30;
    }
    const monthlyTax = Math.max(0, annualTax / 12);
    return Math.max(0, gross - pf - monthlyTax);
}

async function runPayroll(e) {
    e.preventDefault();
    const period = document.getElementById('payroll-period').value;
    const paymentDate = document.getElementById('payroll-payment-date').value;
    const wd = Number(document.getElementById('payroll-working-days').value) || 22;
    if (!/^\d{4}-\d{2}$/.test(period)) {
        toast('error', 'Pay period must be in YYYY-MM format');
        return;
    }

    const rows = Array.from(document.querySelectorAll('#payroll-tbody tr')).filter((r) => r.querySelector('.payroll-row-check').checked);
    if (rows.length === 0) {
        toast('warning', 'Select at least one employee');
        return;
    }

    let success = 0, fail = 0;
    for (const row of rows) {
        const empId = row.dataset.empId;
        const days = Number(row.querySelector('.payroll-days').value) || wd;
        const overtime = Number(row.querySelector('.payroll-overtime').value) || 0;
        const bonus = Number(row.querySelector('.payroll-bonus').value) || 0;
        try {
            await api('POST', '/payroll/run', {
                team_member_id: empId,
                pay_period: period,
                working_days: wd,
                days_present: days,
                overtime,
                bonus,
                payment_date: paymentDate,
            });
            success++;
        } catch (err) {
            console.error(err);
            fail++;
            toast('error', `${err.message}`);
        }
    }

    if (success > 0) {
        toast('success', `Payroll processed for ${success} employee${success === 1 ? '' : 's'}${fail ? ` (${fail} failed)` : ''}`);
    }
    closeModal('payroll-modal');
    await Promise.all([loadPayslips(), loadStats()]);
}

// ---- stats ----

async function loadStats() {
    try {
        const data = await api('GET', '/stats');
        const s = data.stats || {};
        document.getElementById('stat-active-employees').textContent = s.active_employees || 0;
        document.getElementById('stat-monthly-outflow').textContent = shortInr(s.monthly_outflow);
        document.getElementById('stat-pending-leaves').textContent = s.pending_leaves || 0;
        document.getElementById('stat-open-postings').textContent = s.open_postings || 0;
        document.getElementById('stat-payslips-month').textContent = s.payslips_this_month || 0;
        document.getElementById('stat-paid-30d').textContent = shortInr(s.paid_30d);
    } catch (err) {
        console.error(err);
    }
}

// ---- bootstrap ----

document.addEventListener('DOMContentLoaded', () => {
    if (!checkHrAuth()) return;

    setupTabs();

    document.getElementById('add-employee-btn')?.addEventListener('click', () => openEmployeeModal());
    document.getElementById('add-leave-btn')?.addEventListener('click', openLeaveModal);
    document.getElementById('add-appraisal-btn')?.addEventListener('click', openAppraisalModal);
    document.getElementById('add-posting-btn')?.addEventListener('click', openPostingModal);
    document.getElementById('add-applicant-btn')?.addEventListener('click', openApplicantModal);
    document.getElementById('run-payroll-btn')?.addEventListener('click', openPayrollModal);

    document.getElementById('employee-form')?.addEventListener('submit', saveEmployee);
    document.getElementById('attendance-form')?.addEventListener('submit', saveAttendance);
    document.getElementById('leave-form')?.addEventListener('submit', saveLeave);
    document.getElementById('appraisal-form')?.addEventListener('submit', saveAppraisal);
    document.getElementById('posting-form')?.addEventListener('submit', savePosting);
    document.getElementById('applicant-form')?.addEventListener('submit', saveApplicant);
    document.getElementById('payroll-form')?.addEventListener('submit', runPayroll);

    document.getElementById('attendance-date')?.addEventListener('change', loadAttendance);

    document.querySelectorAll('[data-close]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });
    document.querySelectorAll('.inv-modal-overlay').forEach((overlay) => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('is-open');
        });
    });

    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-hr-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        switch (btn.dataset.hrAction) {
            case 'edit-employee':   { const emp = hrEmployees.find((x) => String(x.id) === id); if (emp) openEmployeeModal(emp); break; }
            case 'delete-employee': deleteEmployee(id); break;
            case 'mark-attendance': openAttendanceModal(id, btn.dataset.date); break;
            case 'approve-leave':   setLeaveStatus(id, 'approved'); break;
            case 'reject-leave':    setLeaveStatus(id, 'rejected'); break;
        }
    });

    document.body.addEventListener('change', (e) => {
        const sel = e.target.closest('[data-hr-action="move-applicant"]');
        if (sel) moveApplicantStage(sel.dataset.id, sel.value);
    });

    Promise.all([loadEmployees(), loadStats()]);
});
