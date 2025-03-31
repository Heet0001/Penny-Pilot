// Toggle between sign-in and sign-up panels
const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('container');

signUpButton.addEventListener('click', () => {
    container.classList.add('right-panel-active');
});

signInButton.addEventListener('click', () => {
    container.classList.remove('right-panel-active');
});

// Password validation function
function validatePassword(password) {
    // Check minimum length of 8 characters
    if (password.length < 8) {
        return {
            valid: false,
            message: 'Password must be at least 8 characters long'
        };
    }
    
    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
        return {
            valid: false,
            message: 'Password must contain at least one uppercase letter'
        };
    }
    
    // Check for at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        return {
            valid: false,
            message: 'Password must contain at least one special character (!@#$%^&*()_+-=[]{};\'"\\|,.<>/?)'
        };
    }
    
    // Check for at least three numbers
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
document.querySelector('.sign-up-container form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    // Validate inputs
    if (!name || !email || !password) {
        alert('Please fill in all fields');
        return;
    }
    
    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        alert(passwordValidation.message);
        return;
    }

    fetch('http://localhost:3000/signup', {
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
            // Switch to sign-in form instead of redirecting
            container.classList.remove('right-panel-active');
            // Clear the sign-up form
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

// Sign In Form Submission
// // Add this code to your sign-in form submission handler

document.querySelector('.sign-in-container form').addEventListener('submit', function(e) {    
    e.preventDefault();
    
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;
    
    // Validate form fields
    if (!email || !password) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Send login request to the server
    fetch('http://localhost:3000/signin', {
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
            // Store user info in localStorage for later use
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            
            // Redirect to dashboard
            window.location.href = '../Dashboard/dashboard.html';
        } else {
            alert(data.error || 'Login failed. Please check your credentials.');
        }
    })
    .catch((error) => {
        console.error('Error during login:', error);
        alert('Login failed. Please try again.');
    });
});