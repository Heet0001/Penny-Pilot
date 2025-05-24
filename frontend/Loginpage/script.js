// Toggle between sign-in and sign-up panels
const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('container');

const BASE_URL = window.location.hostname === "localhost"
  ? "http://localhost:3000"
  : "https://penny-pilot-production.up.railway.app";

if (signUpButton) {
    signUpButton.addEventListener('click', () => {
        container.classList.add('right-panel-active');
    });
}

if (signInButton) {
    signInButton.addEventListener('click', () => {
        container.classList.remove('right-panel-active');
    });
}

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
const signUpForm = document.querySelector('.sign-up-container form');
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
                container.classList.remove('right-panel-active');
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
const signInForm = document.querySelector('.sign-in-container form');
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
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.user) {
                // Store user data in localStorage
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                localStorage.setItem('isAuthenticated', 'true');
                
                // Redirect to dashboard
                window.location.href = '/Dashboard/dashboard.html';
            } else {
                alert(data.error || 'Login failed. Please check your credentials.');
            }
        })
        .catch((error) => {
            console.error('Error during login:', error);
            alert('Login failed. Please try again.');
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
        button.addEventListener('click', function(e) {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                logout();
            }
        });
    });
    
    // Check if we're on the login page
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        redirectIfLoggedIn();
    }
    // For other pages, check login status
    else {
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