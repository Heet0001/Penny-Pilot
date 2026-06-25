// Shared in-app notifications bell.
// Usage: include this script on any page that has a navbar; the widget will
// inject itself into ".navbar-actions" and poll /api/notifications.

(function () {
    const NOTIF_BASE_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : 'https://penny-pilot-production.up.railway.app';

    function getCurrentUser() {
        try {
            const raw = localStorage.getItem('userData') || localStorage.getItem('currentUser');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function authHeaders(user) {
        return { 'Content-Type': 'application/json', 'x-session-data': JSON.stringify(user) };
    }

    async function api(method, path, body) {
        const user = getCurrentUser();
        if (!user) throw new Error('Not authenticated');
        const opts = { method, headers: authHeaders(user) };
        if (body !== undefined) opts.body = JSON.stringify(body);
        const res = await fetch(`${NOTIF_BASE_URL}/api/notifications${path}`, opts);
        let data = null;
        try { data = await res.json(); } catch (_) {}
        if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
        return data || {};
    }

    function severityColor(sev) {
        const map = {
            info: '#0A0A0A',
            warning: '#B45309',
            danger: '#B91C1C',
            success: '#15803D',
        };
        return map[sev] || map.info;
    }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str).replace(/[&<>"']/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
    }

    function timeAgo(iso) {
        if (!iso) return '';
        const dt = new Date(iso);
        if (isNaN(dt.getTime())) return '';
        const diff = Math.floor((Date.now() - dt.getTime()) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }

    function injectStyles() {
        if (document.getElementById('penny-notif-style')) return;
        const style = document.createElement('style');
        style.id = 'penny-notif-style';
        style.textContent = `
            .pp-notif-wrap { position: relative; }
            .pp-notif-btn {
                background: #FFFFFF;
                border: 1px solid #E5E5E5;
                border-radius: 10px;
                width: 38px; height: 38px;
                display: inline-flex; align-items: center; justify-content: center;
                cursor: pointer;
                color: #404040;
                position: relative;
                font-size: 14px;
                box-shadow: 0 1px 2px rgba(10, 10, 10, 0.04);
                transition: all 0.18s cubic-bezier(0.22, 1, 0.36, 1);
            }
            .pp-notif-btn:hover {
                color: #FFFFFF;
                background: #0A0A0A;
                border-color: #0A0A0A;
                transform: translateY(-1px);
                box-shadow: 0 4px 14px -2px rgba(10, 10, 10, 0.16);
            }
            .pp-notif-badge {
                position: absolute;
                top: -4px; right: -4px;
                background: #0A0A0A;
                color: white;
                font-size: 9.5px;
                font-weight: 700;
                border-radius: 999px;
                min-width: 17px;
                height: 17px;
                line-height: 17px;
                padding: 0 5px;
                text-align: center;
                border: 2px solid #FFFFFF;
            }
            .pp-notif-panel {
                position: absolute;
                top: calc(100% + 10px);
                right: 0;
                width: 360px;
                max-height: 70vh;
                background: rgba(255, 255, 255, 0.92);
                -webkit-backdrop-filter: blur(22px) saturate(160%);
                backdrop-filter: blur(22px) saturate(160%);
                border: 1px solid #E5E5E5;
                border-radius: 18px;
                box-shadow: 0 40px 100px -16px rgba(10, 10, 10, 0.24), 0 16px 32px -12px rgba(10, 10, 10, 0.10);
                z-index: 100;
                display: none;
                overflow: hidden;
                flex-direction: column;
            }
            .pp-notif-panel.is-open { display: flex; animation: ppFadeUp 0.22s cubic-bezier(0.22, 1, 0.36, 1); }
            @keyframes ppFadeUp {
                from { opacity: 0; transform: translateY(6px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .pp-notif-head {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.95rem 1.1rem;
                border-bottom: 1px solid #E5E5E5;
                font-weight: 700;
                font-size: 13.5px;
                color: #0A0A0A;
                letter-spacing: -0.01em;
            }
            .pp-notif-mark-read {
                background: transparent;
                border: none;
                color: #525252;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                padding: 4px 8px;
                border-radius: 6px;
                transition: all 0.15s ease-out;
            }
            .pp-notif-mark-read:hover { background: #F2F2F2; color: #0A0A0A; }
            .pp-notif-list {
                overflow-y: auto;
                padding: 0.5rem;
                scrollbar-width: thin;
                scrollbar-color: rgba(10, 10, 10, 0.18) transparent;
            }
            .pp-notif-list::-webkit-scrollbar { width: 8px; }
            .pp-notif-list::-webkit-scrollbar-thumb { background: rgba(10, 10, 10, 0.18); border-radius: 999px; }
            .pp-notif-empty { padding: 2.25rem 1rem; text-align: center; color: #737373; font-size: 13px; }
            .pp-notif-item {
                display: flex;
                gap: 0.7rem;
                padding: 0.8rem;
                border-radius: 10px;
                margin-bottom: 4px;
                background: transparent;
                border: 1px solid transparent;
                position: relative;
                transition: background 0.15s ease-out, border-color 0.15s ease-out;
            }
            .pp-notif-item:hover { background: rgba(10, 10, 10, 0.03); }
            .pp-notif-item.unread {
                background: rgba(10, 10, 10, 0.04);
                border-color: rgba(10, 10, 10, 0.08);
            }
            .pp-notif-item.unread::before {
                content: '';
                position: absolute;
                left: -2px; top: 50%;
                transform: translateY(-50%);
                width: 3px; height: 22px;
                background: #0A0A0A;
                border-radius: 0 3px 3px 0;
            }
            .pp-notif-dot {
                width: 8px; height: 8px;
                border-radius: 50%;
                margin-top: 6px;
                flex: 0 0 8px;
                box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.6);
            }
            .pp-notif-body { flex: 1; min-width: 0; }
            .pp-notif-title {
                font-weight: 600;
                font-size: 12.5px;
                color: #0A0A0A;
                margin-bottom: 2px;
                letter-spacing: -0.005em;
            }
            .pp-notif-msg {
                font-size: 11.5px;
                color: #404040;
                line-height: 1.45;
            }
            .pp-notif-time {
                font-size: 10.5px;
                color: #737373;
                margin-top: 5px;
            }
            .pp-notif-close {
                background: transparent;
                border: none;
                color: #737373;
                cursor: pointer;
                font-size: 16px;
                padding: 0 6px;
                opacity: 0.4;
                border-radius: 5px;
                transition: all 0.15s ease-out;
            }
            .pp-notif-close:hover { opacity: 1; background: #F2F2F2; color: #0A0A0A; }
        `;
        document.head.appendChild(style);
    }

    function build() {
        const target = document.querySelector('.navbar-actions');
        if (!target) return null;

        // Skip if already mounted
        if (target.querySelector('.pp-notif-wrap')) return null;

        const wrap = document.createElement('div');
        wrap.className = 'pp-notif-wrap';
        wrap.innerHTML = `
            <button class="pp-notif-btn" type="button" aria-label="Notifications">
                <i class="fas fa-bell"></i>
                <span class="pp-notif-badge" style="display: none;">0</span>
            </button>
            <div class="pp-notif-panel">
                <div class="pp-notif-head">
                    <span>Notifications</span>
                    <button class="pp-notif-mark-read">Mark all read</button>
                </div>
                <div class="pp-notif-list">
                    <div class="pp-notif-empty">Loading...</div>
                </div>
            </div>
        `;
        // Mount as the FIRST child of navbar-actions so it sits before user-profile
        target.insertBefore(wrap, target.firstChild);
        return wrap;
    }

    function attachHandlers(wrap) {
        const btn = wrap.querySelector('.pp-notif-btn');
        const panel = wrap.querySelector('.pp-notif-panel');
        const list = wrap.querySelector('.pp-notif-list');
        const badge = wrap.querySelector('.pp-notif-badge');
        const markAllBtn = wrap.querySelector('.pp-notif-mark-read');

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.toggle('is-open');
            if (panel.classList.contains('is-open')) refresh();
        });

        document.addEventListener('click', (e) => {
            if (!wrap.contains(e.target)) panel.classList.remove('is-open');
        });

        markAllBtn.addEventListener('click', async () => {
            try {
                await api('PUT', '/read-all');
                refresh();
            } catch (err) {
                console.warn('mark-all failed:', err.message);
            }
        });

        list.addEventListener('click', async (e) => {
            const closeBtn = e.target.closest('.pp-notif-close');
            if (closeBtn) {
                const id = closeBtn.dataset.id;
                try {
                    await api('DELETE', `/${id}`);
                    refresh();
                } catch (err) { console.warn(err); }
                return;
            }
            const item = e.target.closest('.pp-notif-item');
            if (item && item.classList.contains('unread')) {
                const id = item.dataset.id;
                try {
                    await api('PUT', `/${id}/read`);
                    item.classList.remove('unread');
                    const count = Math.max(0, parseInt(badge.textContent, 10) - 1);
                    badge.textContent = count;
                    badge.style.display = count ? 'inline-block' : 'none';
                } catch (err) { console.warn(err); }
            }
        });

        async function refresh() {
            try {
                const data = await api('GET', '/');
                renderList(data.notifications || []);
                const count = data.unread_count || 0;
                badge.textContent = count;
                badge.style.display = count ? 'inline-block' : 'none';
            } catch (err) {
                console.warn('notifications refresh failed:', err.message);
            }
        }

        function renderList(items) {
            if (!items.length) {
                list.innerHTML = `<div class="pp-notif-empty">You're all caught up.</div>`;
                return;
            }
            list.innerHTML = items.map((n) => `
                <div class="pp-notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
                    <span class="pp-notif-dot" style="background:${severityColor(n.severity)};"></span>
                    <div class="pp-notif-body">
                        <div class="pp-notif-title">${escapeHtml(n.title)}</div>
                        <div class="pp-notif-msg">${escapeHtml(n.body || '')}</div>
                        <div class="pp-notif-time">${timeAgo(n.created_at)}</div>
                    </div>
                    <button class="pp-notif-close" data-id="${n.id}" title="Dismiss">&times;</button>
                </div>
            `).join('');
        }

        // Initial fetch + poll every 5 minutes for new in-app notifications
        refresh();
        setInterval(refresh, 5 * 60 * 1000);
    }

    function init() {
        const user = getCurrentUser();
        if (!user) return; // not signed in; nothing to do
        injectStyles();
        const wrap = build();
        if (wrap) attachHandlers(wrap);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
