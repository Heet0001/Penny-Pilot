// Toastify Utility Functions for Penny Pilot — Noir monochrome premium
// Toasts use solid blacks/grays and subtle status accents on a dark base.
// Make sure Toastify CSS is loaded in your HTML.

// Capture the browser's native alert/confirm BEFORE we override window.alert below,
// so internal fallbacks never recurse into our own toast handler.
const __nativeAlert = (typeof window !== 'undefined' && window.alert)
    ? window.alert.bind(window)
    : (msg) => console.log(msg);
const __nativeConfirm = (typeof window !== 'undefined' && window.confirm)
    ? window.confirm.bind(window)
    : () => true;

const TOAST_BASE_STYLE = {
    color: "#FFFFFF",
    borderRadius: "12px",
    fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
    fontSize: "13px",
    fontWeight: "500",
    letterSpacing: "-0.005em",
    padding: "12px 16px",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    backdropFilter: "blur(16px) saturate(160%)",
    WebkitBackdropFilter: "blur(16px) saturate(160%)",
    boxShadow: "0 24px 56px -12px rgba(10, 10, 10, 0.40), 0 8px 18px -8px rgba(10, 10, 10, 0.25)",
};

const NOIR_BG = "rgba(10, 10, 10, 0.94)";

function showToastSuccess(message, duration = 3000) {
    if (typeof Toastify !== 'undefined') {
        Toastify({
            text: `✓  ${message}`,
            duration: duration,
            gravity: "top",
            position: "right",
            style: {
                ...TOAST_BASE_STYLE,
                background: NOIR_BG,
                borderLeft: "3px solid #22C55E",
            },
        }).showToast();
    } else {
        __nativeAlert(`✓ ${message}`);
    }
}

function showToastError(message, duration = 4000) {
    if (typeof Toastify !== 'undefined') {
        Toastify({
            text: `✕  ${message}`,
            duration: duration,
            gravity: "top",
            position: "right",
            style: {
                ...TOAST_BASE_STYLE,
                background: NOIR_BG,
                borderLeft: "3px solid #EF4444",
            },
        }).showToast();
    } else {
        __nativeAlert(`✕ ${message}`);
    }
}

function showToastWarning(message, duration = 3500) {
    if (typeof Toastify !== 'undefined') {
        Toastify({
            text: `⚠  ${message}`,
            duration: duration,
            gravity: "top",
            position: "right",
            style: {
                ...TOAST_BASE_STYLE,
                background: NOIR_BG,
                borderLeft: "3px solid #F59E0B",
            },
        }).showToast();
    } else {
        __nativeAlert(`⚠ ${message}`);
    }
}

function showToastInfo(message, duration = 3000) {
    if (typeof Toastify !== 'undefined') {
        Toastify({
            text: `ⓘ  ${message}`,
            duration: duration,
            gravity: "top",
            position: "right",
            style: {
                ...TOAST_BASE_STYLE,
                background: NOIR_BG,
                borderLeft: "3px solid #FFFFFF",
            },
        }).showToast();
    } else {
        __nativeAlert(`ⓘ ${message}`);
    }
}

function showToastLoading(message) {
    if (typeof Toastify !== 'undefined') {
        return Toastify({
            text: `⏳  ${message}`,
            duration: -1,
            gravity: "top",
            position: "right",
            style: {
                ...TOAST_BASE_STYLE,
                background: NOIR_BG,
                borderLeft: "3px solid rgba(255, 255, 255, 0.45)",
            },
        }).showToast();
    }
    return null;
}

function hideToast(toast) {
    if (toast && typeof toast.hideToast === 'function') {
        toast.hideToast();
    }
}

function showCustomToast(message, options = {}) {
    const defaultOptions = {
        text: message,
        duration: 3000,
        gravity: "top",
        position: "right",
        style: { ...TOAST_BASE_STYLE, background: NOIR_BG },
    };

    const finalOptions = { ...defaultOptions, ...options };

    if (typeof Toastify !== 'undefined') {
        Toastify(finalOptions).showToast();
    } else {
        __nativeAlert(message);
    }
}

// ---------------------------------------------------------------------------
// Professional confirm dialog (replaces native confirm()) — returns a Promise<boolean>
// ---------------------------------------------------------------------------
function pennyConfirm(message, options = {}) {
    const {
        title = 'Please confirm',
        okText = 'Confirm',
        cancelText = 'Cancel',
        danger = false,
    } = options;

    // No DOM (e.g. SSR / tests) -> fall back to native confirm.
    if (typeof document === 'undefined') {
        return Promise.resolve(__nativeConfirm(message));
    }

    __injectConfirmStyles();

    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'pp-confirm-overlay';
        overlay.innerHTML = `
            <div class="pp-confirm-card" role="alertdialog" aria-modal="true">
                <div class="pp-confirm-title">${__escapeHtml(title)}</div>
                <div class="pp-confirm-message">${__escapeHtml(message).replace(/\n/g, '<br>')}</div>
                <div class="pp-confirm-actions">
                    <button type="button" class="pp-confirm-btn pp-confirm-cancel">${__escapeHtml(cancelText)}</button>
                    <button type="button" class="pp-confirm-btn ${danger ? 'pp-confirm-danger' : 'pp-confirm-ok'}">${__escapeHtml(okText)}</button>
                </div>
            </div>`;

        const cleanup = (result) => {
            overlay.classList.remove('pp-confirm-show');
            setTimeout(() => overlay.remove(), 160);
            document.removeEventListener('keydown', onKey);
            resolve(result);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') cleanup(false);
            if (e.key === 'Enter') cleanup(true);
        };

        overlay.querySelector('.pp-confirm-cancel').addEventListener('click', () => cleanup(false));
        overlay.querySelector('.pp-confirm-btn:not(.pp-confirm-cancel)').addEventListener('click', () => cleanup(true));
        overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) cleanup(false); });
        document.addEventListener('keydown', onKey);

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('pp-confirm-show'));
    });
}

function __escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

let __confirmStylesInjected = false;
function __injectConfirmStyles() {
    if (__confirmStylesInjected || typeof document === 'undefined') return;
    __confirmStylesInjected = true;
    const css = `
    .pp-confirm-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;
        background:rgba(8,8,8,0.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
        opacity:0;transition:opacity .16s ease;font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif;}
    .pp-confirm-overlay.pp-confirm-show{opacity:1;}
    .pp-confirm-card{width:min(420px,92vw);background:rgba(18,18,18,0.98);color:#fff;border:1px solid rgba(255,255,255,0.10);
        border-radius:16px;padding:24px;box-shadow:0 32px 80px -16px rgba(0,0,0,.6);
        transform:translateY(8px) scale(.98);transition:transform .16s ease;}
    .pp-confirm-overlay.pp-confirm-show .pp-confirm-card{transform:translateY(0) scale(1);}
    .pp-confirm-title{font-size:16px;font-weight:700;letter-spacing:-0.01em;margin-bottom:8px;}
    .pp-confirm-message{font-size:13.5px;line-height:1.55;color:rgba(255,255,255,0.72);margin-bottom:22px;}
    .pp-confirm-actions{display:flex;gap:10px;justify-content:flex-end;}
    .pp-confirm-btn{appearance:none;border:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;
        padding:9px 18px;border-radius:10px;transition:filter .12s ease,background .12s ease;}
    .pp-confirm-cancel{background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.10);}
    .pp-confirm-cancel:hover{background:rgba(255,255,255,0.14);}
    .pp-confirm-ok{background:#fff;color:#0a0a0a;}
    .pp-confirm-ok:hover{filter:brightness(.92);}
    .pp-confirm-danger{background:#EF4444;color:#fff;}
    .pp-confirm-danger:hover{filter:brightness(1.08);}`;
    const style = document.createElement('style');
    style.id = 'pp-confirm-styles';
    style.textContent = css;
    document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Override native alert() so every legacy alert() across the app renders as a
// professional, auto-classified toast instead of a blocking browser dialog.
// ---------------------------------------------------------------------------
function __classifyAndToast(message) {
    const msg = String(message == null ? '' : message);
    const lower = msg.toLowerCase();

    const errorWords = ['error', 'failed', 'fail', 'invalid', 'wrong', 'incorrect',
        'denied', 'not found', 'unable', 'could not', "couldn't", 'cannot', "can't",
        'insufficient', 'exception', 'unauthor'];
    const warnWords = ['required', 'please', 'must', 'warning', 'select', 'enter ',
        'missing', 'already', 'no ', 'empty', 'at least', 'greater than', 'less than'];
    const successWords = ['success', 'successful', 'successfully', 'added', 'updated',
        'saved', 'created', 'deleted', 'removed', 'completed', 'sent', 'approved',
        'received', 'paid', 'done', 'welcome'];

    if (errorWords.some((w) => lower.includes(w))) return showToastError(msg);
    if (successWords.some((w) => lower.includes(w))) return showToastSuccess(msg);
    if (warnWords.some((w) => lower.includes(w))) return showToastWarning(msg);
    return showToastInfo(msg);
}

if (typeof window !== 'undefined') {
    window.showToastSuccess = showToastSuccess;
    window.showToastError = showToastError;
    window.showToastWarning = showToastWarning;
    window.showToastInfo = showToastInfo;
    window.showToastLoading = showToastLoading;
    window.hideToast = hideToast;
    window.showCustomToast = showCustomToast;
    window.pennyConfirm = pennyConfirm;
    window.nativeAlert = __nativeAlert;

    // Route all alert() calls through the toast system.
    window.alert = function (message) {
        try {
            __classifyAndToast(message);
        } catch (e) {
            __nativeAlert(message);
        }
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showToastSuccess,
        showToastError,
        showToastWarning,
        showToastInfo,
        showToastLoading,
        hideToast,
        showCustomToast,
        pennyConfirm
    };
}
