const BASE_URL = window.location.hostname === "localhost"
  ? "http://localhost:3000"
  : window.location.origin;

function setAuthPanel(which) {
    const tabSignin = document.getElementById('tab-signin');
    const tabSignup = document.getElementById('tab-signup');
    const panelSignin = document.getElementById('panel-signin');
    const panelSignup = document.getElementById('panel-signup');
    const heroTitle = document.getElementById('authHeroTitle');
    const heroSubtitle = document.getElementById('authHeroSubtitle');

    if (!tabSignin || !tabSignup || !panelSignin || !panelSignup) return;

    const signup = which === 'signup';
    panelSignin.hidden = signup;
    panelSignup.hidden = !signup;

    tabSignin.setAttribute('aria-selected', signup ? 'false' : 'true');
    tabSignup.setAttribute('aria-selected', signup ? 'true' : 'false');
    tabSignin.tabIndex = signup ? -1 : 0;
    tabSignup.tabIndex = signup ? 0 : -1;

    if (heroTitle && heroSubtitle) {
        if (signup) {
            heroTitle.textContent = 'Create account';
            heroSubtitle.textContent = 'Use your email to register and start tracking your money.';
        } else {
            heroTitle.textContent = 'Sign in';
            heroSubtitle.textContent = 'Welcome back — pick up where you left off.';
        }
    }
}

function attachLoginTabHandlers() {
    const tabSignin = document.getElementById('tab-signin');
    const tabSignup = document.getElementById('tab-signup');
    if (!tabSignin || !tabSignup) return;
    tabSignin.addEventListener('click', () => setAuthPanel('signin'));
    tabSignup.addEventListener('click', () => setAuthPanel('signup'));
}

document.addEventListener('DOMContentLoaded', attachLoginTabHandlers);

// Password validation function
function validatePassword(password) {
    if (password.length < 8) {
        return {
            valid: false,
            message: 'Password must be at least 8 characters long'
        };
    }
    
    if (!/[A-Z]/.test(password)) {
        return {
            valid: false,
            message: 'Password must contain at least one uppercase letter'
        };
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return {
            valid: false,
            message: 'Password must contain at least one special character (!@#$%^&*()_+-=[]{};\'"\\|,.<>/?)'
        };
    }
    
    const numberCount = (password.match(/[0-9]/g) || []).length;
    if (numberCount < 3) {
        return {
            valid: false,
            message: `Password must contain at least 3 numbers (currently has ${numberCount})`
        };
    }
    
    return {
        valid: true,
        message: 'Password meets all requirements'
    };
}

// Sign Up Form Submission
const signUpForm = document.querySelector('form.sign-up-container');
if (signUpForm) {
    signUpForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        if (!name || !email || !password) {
            alert('Please fill in all fields');
            return;
        }
        
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            alert(passwordValidation.message);
            return;
        }

        fetch(`${BASE_URL}/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                alert(data.message);
                setAuthPanel('signin');
                document.getElementById('signup-name').value = '';
                document.getElementById('signup-email').value = '';
                document.getElementById('signup-password').value = '';
            } else {
                alert(data.error);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred. Please try again later.');
        });
    });
}

// Sign In Form Submission - FIXED
const signInForm = document.querySelector('form.sign-in-container');
if (signInForm) {
    signInForm.addEventListener('submit', function(e) {    
        e.preventDefault();
        
        const email = document.getElementById('signin-email').value;
        const password = document.getElementById('signin-password').value;
        
        if (!email || !password) {
            alert('Please fill in all required fields');
            return;
        }
        
      fetch(`${BASE_URL}/signin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        })
        .then(async response => {
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Network response was not ok');
            }
            return data;
        })
        .then(data => {
            if (data.user) {
                // Wipe stale per-user caches from any *previous* user before logging this one in.
                // Without this, wallet/emergency balances briefly flash the previous user's values.
                try {
                    const newUserId = String(data.user.id);
                    const keysToInspect = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (!key) continue;
                        if (
                            key.startsWith('wallet_balance_') ||
                            key.startsWith('emergency_fund_')
                        ) {
                            const ownerId = key.split('_').pop();
                            if (ownerId !== newUserId) keysToInspect.push(key);
                        }
                    }
                    keysToInspect.forEach((k) => localStorage.removeItem(k));
                } catch (cleanupErr) {
                    console.warn('Cache cleanup failed:', cleanupErr);
                }

                localStorage.setItem('currentUser', JSON.stringify(data.user));
                localStorage.setItem('isAuthenticated', 'true');

                window.location.href = '/Dashboard/dashboard.html';
            } else {
                alert(data.error || 'Login failed. Please check your credentials.');
            }
        })
        .catch((error) => {
            console.error('Error during login:', error);
            alert(error.message || 'Login failed. Please try again.');
        });
    });
}

// Logout functionality - FIXED
function logout() {
    // Clear localStorage
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isAuthenticated');
    
    // Optional: Notify server about logout
    fetch(`${BASE_URL}/logout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log('Logout successful:', data.message);
    })
    .catch(error => {
        console.error('Error during logout:', error);
    })
    .finally(() => {
        // Redirect to login page regardless of server response
        window.location.href = '/Loginpage/index.html';
    });
}

// Check if user is logged in (for protected pages)
function checkLoginStatus() {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const currentUser = localStorage.getItem('currentUser');
    
    if (!isAuthenticated || !currentUser) {
        // Redirect to login page if not logged in
        window.location.href = '/Loginpage/index.html';
        return null;
    }
    
    try {
        return JSON.parse(currentUser);
    } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('isAuthenticated');
        window.location.href = '/Loginpage/index.html';
        return null;
    }
}

// Auto-redirect if already logged in (for login page)
function redirectIfLoggedIn() {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const currentUser = localStorage.getItem('currentUser');
    
    if (isAuthenticated && currentUser) {
        try {
            JSON.parse(currentUser); // Validate JSON
            window.location.href = '/Dashboard/dashboard.html';
        } catch (error) {
            // Invalid JSON, clear it
            localStorage.removeItem('currentUser');
            localStorage.removeItem('isAuthenticated');
        }
    }
}

// Initialize logout buttons on page load
document.addEventListener('DOMContentLoaded', function() {
    // Add logout functionality to all logout buttons
    const logoutButtons = document.querySelectorAll('.logout-btn, #logout-btn, [data-logout]');
    logoutButtons.forEach(button => {
        button.addEventListener('click', async function(e) {
            e.preventDefault();
            const ok = window.pennyConfirm
                ? await window.pennyConfirm('Are you sure you want to logout?', { title: 'Log out', okText: 'Log out', danger: true })
                : true;
            if (ok) {
                logout();
            }
        });
    });
    
    // For pages other than the login page, enforce login
    const isLoginPage = window.location.pathname.includes('index.html') || window.location.pathname === '/';
    if (!isLoginPage) {
        const user = checkLoginStatus();
        if (user) {
            // Update UI with user info if elements exist
            const userNameElements = document.querySelectorAll('.user-name, #user-name');
            userNameElements.forEach(element => {
                element.textContent = user.name || 'User';
            });
            
            const userEmailElements = document.querySelectorAll('.user-email, #user-email');
            userEmailElements.forEach(element => {
                element.textContent = user.email || '';
            });
        }
    }
});

// Utility function to get current user
function getCurrentUser() {
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) return null;
    
    try {
        return JSON.parse(currentUser);
    } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('currentUser');
        return null;
    }
}

// Export functions for use in other scripts
window.logout = logout;
window.checkLoginStatus = checkLoginStatus;
window.getCurrentUser = getCurrentUser;
window.redirectIfLoggedIn = redirectIfLoggedIn;