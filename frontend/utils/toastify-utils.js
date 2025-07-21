// Toastify Utility Functions for Penny Pilot
// Make sure Toastify CSS is loaded in your HTML: 
// <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css">
// <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/toastify-js"></script>

// Success notification
function showToastSuccess(message, duration = 3000) {
    if (typeof Toastify !== 'undefined') {
        Toastify({
            text: message,
            duration: duration,
            gravity: "top",
            position: "right",
            style: {
                background: "linear-gradient(135deg, #00b09b, #96c93d)",
                color: "#ffffff",
                borderRadius: "8px",
                fontFamily: "'Inter', sans-serif",
                fontSize: "14px",
                boxShadow: "0 8px 32px rgba(31, 38, 135, 0.37)"
            }
        }).showToast();
    } else {
        // Fallback to alert if Toastify is not available
        alert(`✅ ${message}`);
    }
}

// Error notification
function showToastError(message, duration = 4000) {
    if (typeof Toastify !== 'undefined') {
        Toastify({
            text: message,
            duration: duration,
            gravity: "top",
            position: "right",
            style: {
                background: "linear-gradient(135deg, #ff416c, #ff4757)",
                color: "#ffffff",
                borderRadius: "8px",
                fontFamily: "'Inter', sans-serif",
                fontSize: "14px",
                boxShadow: "0 8px 32px rgba(31, 38, 135, 0.37)"
            }
        }).showToast();
    } else {
        // Fallback to alert if Toastify is not available
        alert(`❌ ${message}`);
    }
}

// Warning notification
function showToastWarning(message, duration = 3500) {
    if (typeof Toastify !== 'undefined') {
        Toastify({
            text: message,
            duration: duration,
            gravity: "top",
            position: "right",
            style: {
                background: "linear-gradient(135deg, #ffa726, #ffb74d)",
                color: "#ffffff",
                borderRadius: "8px",
                fontFamily: "'Inter', sans-serif",
                fontSize: "14px",
                boxShadow: "0 8px 32px rgba(31, 38, 135, 0.37)"
            }
        }).showToast();
    } else {
        // Fallback to alert if Toastify is not available
        alert(`⚠️ ${message}`);
    }
}

// Info notification
function showToastInfo(message, duration = 3000) {
    if (typeof Toastify !== 'undefined') {
        Toastify({
            text: message,
            duration: duration,
            gravity: "top",
            position: "right",
            style: {
                background: "linear-gradient(135deg, #667eea, #764ba2)",
                color: "#ffffff",
                borderRadius: "8px",
                fontFamily: "'Inter', sans-serif",
                fontSize: "14px",
                boxShadow: "0 8px 32px rgba(31, 38, 135, 0.37)"
            }
        }).showToast();
    } else {
        // Fallback to alert if Toastify is not available
        alert(`ℹ️ ${message}`);
    }
}

// Loading notification (should be manually dismissed)
function showToastLoading(message) {
    if (typeof Toastify !== 'undefined') {
        return Toastify({
            text: `⏳ ${message}`,
            duration: -1, // Don't auto dismiss
            gravity: "top",
            position: "right",
            style: {
                background: "linear-gradient(135deg, #74b9ff, #0984e3)",
                color: "#ffffff",
                borderRadius: "8px",
                fontFamily: "'Inter', sans-serif",
                fontSize: "14px",
                boxShadow: "0 8px 32px rgba(31, 38, 135, 0.37)"
            }
        }).showToast();
    }
    return null;
}

// Function to hide a loading toast
function hideToast(toast) {
    if (toast && typeof toast.hideToast === 'function') {
        toast.hideToast();
    }
}

// Custom toast with custom styling
function showCustomToast(message, options = {}) {
    const defaultOptions = {
        text: message,
        duration: 3000,
        gravity: "top",
        position: "right",
        style: {
            background: "linear-gradient(135deg, #667eea, #764ba2)",
            color: "#ffffff",
            borderRadius: "8px",
            fontFamily: "'Inter', sans-serif",
            fontSize: "14px",
            boxShadow: "0 8px 32px rgba(31, 38, 135, 0.37)"
        }
    };

    const finalOptions = { ...defaultOptions, ...options };
    
    if (typeof Toastify !== 'undefined') {
        Toastify(finalOptions).showToast();
    } else {
        // Fallback to alert if Toastify is not available
        alert(message);
    }
}

// Export functions for module usage (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showToastSuccess,
        showToastError,
        showToastWarning,
        showToastInfo,
        showToastLoading,
        hideToast,
        showCustomToast
    };
}
