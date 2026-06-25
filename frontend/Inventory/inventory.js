// Inventory & Procurement frontend logic
// Communicates with /api/inventory/* on the backend.

const INV_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://penny-pilot-production.up.railway.app';

let invCurrentUser = null;
let invSuppliers = [];
let invProducts = [];
let invPOs = [];

// ---------- helpers ----------

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        'x-session-data': JSON.stringify(invCurrentUser),
    };
}

async function api(method, path, body) {
    const opts = { method, headers: authHeaders() };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(`${INV_BASE_URL}/api/inventory${path}`, opts);
    let data = null;
    try { data = await res.json(); } catch (_) { /* empty body */ }
    if (!res.ok) {
        const msg = (data && data.error) || `Request failed (${res.status})`;
        throw new Error(msg);
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

function toast(type, message) {
    if (typeof Toastify !== 'undefined') {
        const colors = {
            success: 'linear-gradient(135deg,#10B981,#34D399)',
            error:   'linear-gradient(135deg,#EF4444,#F87171)',
            info:    'linear-gradient(135deg,#4F46E5,#6366F1)',
            warning: 'linear-gradient(135deg,#F59E0B,#FBBF24)',
        };
        Toastify({
            text: message,
            duration: 3500,
            gravity: 'top',
            position: 'right',
            style: { background: colors[type] || colors.info },
        }).showToast();
    } else {
        console.log(type, message);
    }
}

function openModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.add('is-open');
}
function closeModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.remove('is-open');
}

// ---------- auth ----------

function checkInvAuth() {
    const userData = localStorage.getItem('userData') || localStorage.getItem('currentUser');
    const isAuthenticated = JSON.parse(localStorage.getItem('isAuthenticated') || 'false');
    if (!userData || !isAuthenticated) {
        window.location.href = '../Loginpage/index.html';
        return null;
    }
    try {
        invCurrentUser = JSON.parse(userData);
        const profileIcon = document.getElementById('profile-icon');
        const usernameTooltip = document.getElementById('username-tooltip');
        if (profileIcon && invCurrentUser.name) profileIcon.textContent = invCurrentUser.name.charAt(0).toUpperCase();
        if (usernameTooltip && invCurrentUser.name) usernameTooltip.textContent = invCurrentUser.name;
        return invCurrentUser;
    } catch (e) {
        window.location.href = '../Loginpage/index.html';
        return null;
    }
}

// ---------- tabs ----------

function setupTabs() {
    document.querySelectorAll('.inv-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            document.querySelectorAll('.inv-tab').forEach((t) => t.classList.remove('active'));
            document.querySelectorAll('.inv-panel').forEach((p) => p.classList.remove('active'));
            tab.classList.add('active');
            const panel = document.getElementById(`panel-${target}`);
            if (panel) panel.classList.add('active');
        });
    });
}

// ---------- products ----------

function renderProducts(filter = '') {
    const tbody = document.getElementById('products-tbody');
    if (!tbody) return;
    const q = filter.trim().toLowerCase();
    const list = q
        ? invProducts.filter((p) =>
            (p.name || '').toLowerCase().includes(q) ||
            (p.sku || '').toLowerCase().includes(q) ||
            (p.category || '').toLowerCase().includes(q))
        : invProducts;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="inv-empty">No products yet. Click "Add Product" to start.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map((p) => {
        const stockClass = p.is_low_stock ? 'low-stock-cell' : '';
        const supplier = p.supplier_name || '<span class="pill pill-muted">No supplier</span>';
        const statusPill = p.status === 'active'
            ? '<span class="pill pill-success">Active</span>'
            : '<span class="pill pill-muted">Discontinued</span>';
        return `
            <tr>
                <td><strong>${escapeHtml(p.name)}</strong> ${statusPill}</td>
                <td>${escapeHtml(p.sku || '—')}</td>
                <td>${escapeHtml(p.category || '—')}</td>
                <td class="${stockClass}">${p.quantity_in_stock} ${escapeHtml(p.unit || '')}</td>
                <td>${p.reorder_level}</td>
                <td>${inr(p.cost_price)}</td>
                <td>${inr(p.selling_price)}</td>
                <td>${supplier}</td>
                <td>
                    <button class="inv-action" data-action="adjust" data-id="${p.id}" title="Adjust stock"><i class="fas fa-sliders"></i></button>
                    <button class="inv-action" data-action="edit-product" data-id="${p.id}" title="Edit"><i class="fas fa-pen"></i></button>
                    <button class="inv-action danger" data-action="delete-product" data-id="${p.id}" title="Delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadProducts() {
    try {
        const data = await api('GET', '/products');
        invProducts = data.products || [];
        renderProducts(document.getElementById('product-search')?.value || '');
    } catch (err) {
        toast('error', err.message);
    }
}

function openProductModal(product) {
    document.getElementById('product-modal-title').textContent = product ? 'Edit Product' : 'Add Product';
    document.getElementById('product-id').value = product?.id || '';
    document.getElementById('product-name').value = product?.name || '';
    document.getElementById('product-sku').value = product?.sku || '';
    document.getElementById('product-category').value = product?.category || '';
    document.getElementById('product-unit').value = product?.unit || 'pcs';
    document.getElementById('product-cost-price').value = product?.cost_price || 0;
    document.getElementById('product-selling-price').value = product?.selling_price || 0;
    document.getElementById('product-quantity').value = product?.quantity_in_stock ?? 0;
    document.getElementById('product-reorder').value = product?.reorder_level ?? 10;
    document.getElementById('product-status').value = product?.status || 'active';
    document.getElementById('product-description').value = product?.description || '';

    // Disable initial-stock when editing (use adjust-stock instead)
    document.getElementById('product-quantity').disabled = !!product;

    populateSupplierSelect('product-supplier', product?.supplier_id);
    openModal('product-modal');
}

async function saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('product-id').value;
    const payload = {
        name: document.getElementById('product-name').value.trim(),
        sku: document.getElementById('product-sku').value.trim(),
        category: document.getElementById('product-category').value.trim(),
        unit: document.getElementById('product-unit').value.trim() || 'pcs',
        cost_price: Number(document.getElementById('product-cost-price').value) || 0,
        selling_price: Number(document.getElementById('product-selling-price').value) || 0,
        reorder_level: Number(document.getElementById('product-reorder').value) || 10,
        supplier_id: document.getElementById('product-supplier').value || null,
        status: document.getElementById('product-status').value,
        description: document.getElementById('product-description').value.trim(),
    };
    if (!id) {
        payload.quantity_in_stock = Number(document.getElementById('product-quantity').value) || 0;
    }

    try {
        if (id) await api('PUT', `/products/${id}`, payload);
        else await api('POST', '/products', payload);
        toast('success', id ? 'Product updated' : 'Product added');
        closeModal('product-modal');
        await Promise.all([loadProducts(), loadStats()]);
    } catch (err) {
        toast('error', err.message);
    }
}

async function deleteProduct(id) {
    const ok = window.pennyConfirm
        ? await window.pennyConfirm('Delete this product? This cannot be undone.', { title: 'Delete product', okText: 'Delete', danger: true })
        : true;
    if (!ok) return;
    try {
        await api('DELETE', `/products/${id}`);
        toast('success', 'Product deleted');
        await Promise.all([loadProducts(), loadStats()]);
    } catch (err) {
        toast('error', err.message);
    }
}

function openAdjustModal(product) {
    document.getElementById('adjust-product-id').value = product.id;
    document.getElementById('adjust-product-name').value = product.name;
    document.getElementById('adjust-current-stock').value = `${product.quantity_in_stock} ${product.unit || ''}`;
    document.getElementById('adjust-delta').value = '';
    document.getElementById('adjust-reason').value = 'manual';
    document.getElementById('adjust-notes').value = '';
    openModal('adjust-stock-modal');
}

async function saveAdjustment(e) {
    e.preventDefault();
    const id = document.getElementById('adjust-product-id').value;
    const delta = Number(document.getElementById('adjust-delta').value);
    if (!delta) {
        toast('error', 'Enter a non-zero delta');
        return;
    }
    try {
        const data = await api('POST', `/products/${id}/adjust-stock`, {
            delta,
            reason: document.getElementById('adjust-reason').value,
            notes: document.getElementById('adjust-notes').value,
        });
        toast('success', `Stock updated to ${data.new_quantity}`);
        closeModal('adjust-stock-modal');
        await Promise.all([loadProducts(), loadStats()]);
    } catch (err) {
        toast('error', err.message);
    }
}

// ---------- suppliers ----------

function renderSuppliers() {
    const tbody = document.getElementById('suppliers-tbody');
    if (!tbody) return;
    if (invSuppliers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="inv-empty">No suppliers yet. Click "Add Supplier" to start.</td></tr>`;
        return;
    }
    tbody.innerHTML = invSuppliers.map((s) => `
        <tr>
            <td><strong>${escapeHtml(s.name)}</strong></td>
            <td>${escapeHtml(s.contact_person || '—')}</td>
            <td>${escapeHtml(s.email || '—')}</td>
            <td>${escapeHtml(s.phone || '—')}</td>
            <td>${escapeHtml(s.gst_number || '—')}</td>
            <td>${s.product_count || 0}</td>
            <td>${s.status === 'active' ? '<span class="pill pill-success">Active</span>' : '<span class="pill pill-muted">Inactive</span>'}</td>
            <td>
                <button class="inv-action" data-action="edit-supplier" data-id="${s.id}" title="Edit"><i class="fas fa-pen"></i></button>
                <button class="inv-action danger" data-action="delete-supplier" data-id="${s.id}" title="Delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function loadSuppliers() {
    try {
        const data = await api('GET', '/suppliers');
        invSuppliers = data.suppliers || [];
        renderSuppliers();
        populateSupplierSelect('product-supplier');
        populateSupplierSelect('po-supplier');
    } catch (err) {
        toast('error', err.message);
    }
}

function populateSupplierSelect(selectId, selectedId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const placeholder = selectId === 'product-supplier' ? '— None —' : 'Select supplier';
    sel.innerHTML = `<option value="">${placeholder}</option>` +
        invSuppliers
            .filter((s) => s.status === 'active')
            .map((s) => `<option value="${s.id}" ${selectedId == s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`)
            .join('');
}

function openSupplierModal(supplier) {
    document.getElementById('supplier-modal-title').textContent = supplier ? 'Edit Supplier' : 'Add Supplier';
    document.getElementById('supplier-id').value = supplier?.id || '';
    document.getElementById('supplier-name').value = supplier?.name || '';
    document.getElementById('supplier-contact').value = supplier?.contact_person || '';
    document.getElementById('supplier-email').value = supplier?.email || '';
    document.getElementById('supplier-phone').value = supplier?.phone || '';
    document.getElementById('supplier-gst').value = supplier?.gst_number || '';
    document.getElementById('supplier-payment-terms').value = supplier?.payment_terms || '';
    document.getElementById('supplier-status').value = supplier?.status || 'active';
    document.getElementById('supplier-address').value = supplier?.address || '';
    document.getElementById('supplier-notes').value = supplier?.notes || '';
    openModal('supplier-modal');
}

async function saveSupplier(e) {
    e.preventDefault();
    const id = document.getElementById('supplier-id').value;
    const payload = {
        name: document.getElementById('supplier-name').value.trim(),
        contact_person: document.getElementById('supplier-contact').value.trim(),
        email: document.getElementById('supplier-email').value.trim(),
        phone: document.getElementById('supplier-phone').value.trim(),
        gst_number: document.getElementById('supplier-gst').value.trim(),
        payment_terms: document.getElementById('supplier-payment-terms').value.trim(),
        status: document.getElementById('supplier-status').value,
        address: document.getElementById('supplier-address').value.trim(),
        notes: document.getElementById('supplier-notes').value.trim(),
    };
    try {
        if (id) await api('PUT', `/suppliers/${id}`, payload);
        else await api('POST', '/suppliers', payload);
        toast('success', id ? 'Supplier updated' : 'Supplier added');
        closeModal('supplier-modal');
        await Promise.all([loadSuppliers(), loadStats()]);
    } catch (err) {
        toast('error', err.message);
    }
}

async function deleteSupplier(id) {
    const ok = window.pennyConfirm
        ? await window.pennyConfirm('Delete this supplier?', { title: 'Delete supplier', okText: 'Delete', danger: true })
        : true;
    if (!ok) return;
    try {
        await api('DELETE', `/suppliers/${id}`);
        toast('success', 'Supplier deleted');
        await Promise.all([loadSuppliers(), loadStats()]);
    } catch (err) {
        toast('error', err.message);
    }
}

// ---------- purchase orders ----------

function statusPill(status) {
    const map = {
        draft:            ['pill-muted',   'Draft'],
        pending_approval: ['pill-warning', 'Pending'],
        approved:         ['pill-info',    'Approved'],
        received:         ['pill-success', 'Received'],
        cancelled:        ['pill-danger',  'Cancelled'],
    };
    const [cls, label] = map[status] || ['pill-muted', status];
    return `<span class="pill ${cls}">${label}</span>`;
}

function renderPOs() {
    const tbody = document.getElementById('po-tbody');
    if (!tbody) return;
    if (invPOs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="inv-empty">No purchase orders yet. Create one to track inventory spend.</td></tr>`;
        return;
    }
    tbody.innerHTML = invPOs.map((po) => `
        <tr>
            <td><strong>${escapeHtml(po.po_number)}</strong></td>
            <td>${escapeHtml(po.supplier_name || '—')}</td>
            <td>${po.line_items}</td>
            <td>${inr(po.total_amount)}</td>
            <td>${po.expected_date ? po.expected_date.slice(0, 10) : '—'}</td>
            <td>${statusPill(po.status)}</td>
            <td>
                ${po.status === 'pending_approval' ? `<button class="inv-action" data-action="approve-po" data-id="${po.id}" title="Approve"><i class="fas fa-check"></i></button>` : ''}
                ${po.status === 'approved' ? `<button class="inv-action" data-action="receive-po" data-id="${po.id}" title="Receive"><i class="fas fa-truck-ramp-box"></i></button>` : ''}
                ${['draft','pending_approval','approved'].includes(po.status) ? `<button class="inv-action danger" data-action="cancel-po" data-id="${po.id}" title="Cancel"><i class="fas fa-xmark"></i></button>` : ''}
            </td>
        </tr>
    `).join('');
}

async function loadPOs() {
    try {
        const data = await api('GET', '/purchase-orders');
        invPOs = data.purchase_orders || [];
        renderPOs();
    } catch (err) {
        toast('error', err.message);
    }
}

function openPOModal() {
    document.getElementById('po-form').reset();
    document.getElementById('po-items-container').innerHTML = '';
    populateSupplierSelect('po-supplier');
    addPOItemRow();
    updatePOTotal();
    openModal('po-modal');
}

function addPOItemRow() {
    const container = document.getElementById('po-items-container');
    const row = document.createElement('div');
    row.className = 'po-item-row';
    row.innerHTML = `
        <div class="form-group">
            <label>Product</label>
            <select class="form-control po-item-product" required>
                <option value="">Select product</option>
                ${invProducts.map((p) => `<option value="${p.id}" data-cost="${p.cost_price}">${escapeHtml(p.name)}${p.sku ? ' (' + escapeHtml(p.sku) + ')' : ''}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>Quantity</label>
            <input class="form-control po-item-qty" type="number" min="1" value="1" required>
        </div>
        <div class="form-group">
            <label>Unit Price (₹)</label>
            <input class="form-control po-item-price" type="number" step="0.01" min="0" value="0" required>
        </div>
        <button type="button" class="po-item-remove" title="Remove"><i class="fas fa-xmark"></i></button>
    `;
    container.appendChild(row);

    row.querySelector('.po-item-product').addEventListener('change', (e) => {
        const opt = e.target.selectedOptions[0];
        if (opt && opt.dataset.cost) {
            row.querySelector('.po-item-price').value = Number(opt.dataset.cost).toFixed(2);
            updatePOTotal();
        }
    });
    row.querySelectorAll('.po-item-qty, .po-item-price').forEach((inp) => inp.addEventListener('input', updatePOTotal));
    row.querySelector('.po-item-remove').addEventListener('click', () => {
        if (container.children.length === 1) {
            toast('warning', 'A PO needs at least one line item');
            return;
        }
        row.remove();
        updatePOTotal();
    });
}

function updatePOTotal() {
    let total = 0;
    document.querySelectorAll('.po-item-row').forEach((row) => {
        const qty = Number(row.querySelector('.po-item-qty').value) || 0;
        const price = Number(row.querySelector('.po-item-price').value) || 0;
        total += qty * price;
    });
    document.getElementById('po-total').textContent = inr(total);
}

async function savePO(e) {
    e.preventDefault();
    const items = Array.from(document.querySelectorAll('.po-item-row')).map((row) => ({
        product_id: row.querySelector('.po-item-product').value,
        quantity: Number(row.querySelector('.po-item-qty').value),
        unit_price: Number(row.querySelector('.po-item-price').value),
    }));
    if (!items.length || items.some((i) => !i.product_id || !i.quantity || !i.unit_price)) {
        toast('error', 'Each line item needs a product, quantity and price');
        return;
    }
    const payload = {
        supplier_id: document.getElementById('po-supplier').value,
        expected_date: document.getElementById('po-expected-date').value || null,
        notes: document.getElementById('po-notes').value || null,
        items,
        status: 'pending_approval',
    };
    if (!payload.supplier_id) {
        toast('error', 'Pick a supplier');
        return;
    }
    try {
        const data = await api('POST', '/purchase-orders', payload);
        toast('success', `PO ${data.po_number} created (pending approval)`);
        closeModal('po-modal');
        await Promise.all([loadPOs(), loadStats()]);
    } catch (err) {
        toast('error', err.message);
    }
}

async function approvePO(id) {
    const ok = window.pennyConfirm
        ? await window.pennyConfirm('Once approved you can receive this PO, which deducts the wallet and adds an expense.', { title: 'Approve purchase order', okText: 'Approve' })
        : true;
    if (!ok) return;
    try {
        await api('PUT', `/purchase-orders/${id}/approve`);
        toast('success', 'PO approved');
        await Promise.all([loadPOs(), loadStats()]);
    } catch (err) {
        toast('error', err.message);
    }
}

async function receivePO(id) {
    const ok = window.pennyConfirm
        ? await window.pennyConfirm('This will add stock to each product, deduct the total from your wallet, and record an "Inventory Purchase" expense entry.', { title: 'Receive purchase order', okText: 'Receive' })
        : true;
    if (!ok) return;
    try {
        const data = await api('PUT', `/purchase-orders/${id}/receive`);
        toast('success', `PO received - ${inr(data.total_amount)} deducted from wallet`);
        await Promise.all([loadPOs(), loadProducts(), loadStats()]);
    } catch (err) {
        toast('error', err.message);
    }
}

async function cancelPO(id) {
    const ok = window.pennyConfirm
        ? await window.pennyConfirm('Cancel this purchase order?', { title: 'Cancel purchase order', okText: 'Cancel PO', danger: true })
        : true;
    if (!ok) return;
    try {
        await api('PUT', `/purchase-orders/${id}/cancel`);
        toast('success', 'PO cancelled');
        await Promise.all([loadPOs(), loadStats()]);
    } catch (err) {
        toast('error', err.message);
    }
}

// ---------- stats ----------

async function loadStats() {
    try {
        const data = await api('GET', '/stats');
        const s = data.stats || {};
        document.getElementById('stat-total-products').textContent = s.total_products || 0;
        document.getElementById('stat-low-stock').textContent = s.low_stock_count || 0;
        document.getElementById('stat-inventory-value').textContent = shortInr(s.inventory_value);
        document.getElementById('stat-suppliers').textContent = s.supplier_count || 0;
        document.getElementById('stat-pending-pos').textContent = s.pending_pos || 0;
        document.getElementById('stat-spend-30d').textContent = shortInr(s.spend_30d);
    } catch (err) {
        console.error(err);
    }
}

// ---------- helpers ----------

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ---------- bootstrap ----------

document.addEventListener('DOMContentLoaded', () => {
    if (!checkInvAuth()) return;

    setupTabs();

    document.getElementById('add-product-btn')?.addEventListener('click', () => openProductModal());
    document.getElementById('add-supplier-btn')?.addEventListener('click', () => openSupplierModal());
    document.getElementById('add-po-btn')?.addEventListener('click', openPOModal);
    document.getElementById('po-add-item-btn')?.addEventListener('click', addPOItemRow);

    document.getElementById('product-form')?.addEventListener('submit', saveProduct);
    document.getElementById('supplier-form')?.addEventListener('submit', saveSupplier);
    document.getElementById('po-form')?.addEventListener('submit', savePO);
    document.getElementById('adjust-stock-form')?.addEventListener('submit', saveAdjustment);

    document.getElementById('product-search')?.addEventListener('input', (e) => renderProducts(e.target.value));

    // Modal close handlers (× button + clicking overlay backdrop)
    document.querySelectorAll('[data-close]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });
    document.querySelectorAll('.inv-modal-overlay').forEach((overlay) => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('is-open');
        });
    });

    // Action delegation across all action buttons
    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        switch (btn.dataset.action) {
            case 'edit-product':   { const p = invProducts.find((x) => String(x.id) === id); if (p) openProductModal(p); break; }
            case 'delete-product': deleteProduct(id); break;
            case 'adjust':         { const p = invProducts.find((x) => String(x.id) === id); if (p) openAdjustModal(p); break; }
            case 'edit-supplier':  { const s = invSuppliers.find((x) => String(x.id) === id); if (s) openSupplierModal(s); break; }
            case 'delete-supplier':deleteSupplier(id); break;
            case 'approve-po':     approvePO(id); break;
            case 'receive-po':     receivePO(id); break;
            case 'cancel-po':      cancelPO(id); break;
        }
    });

    // Initial load
    Promise.all([loadSuppliers(), loadProducts(), loadPOs(), loadStats()]);
});
