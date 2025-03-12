// Sign Up Form Submission
document.querySelector('.sign-up-container form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.querySelector('.sign-up-container input[type="text"]').value;
    const email = document.querySelector('.sign-up-container input[type="email"]').value;
    const password = document.querySelector('.sign-up-container input[type="password"]').value;

    fetch('http://localhost:5000/signup', {
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
            window.location.href = '../penny-pilot-backend/dashboard.html'; // Correct path
        } else {
            alert(data.error);
        }
    })
    .catch(error => console.error('Error:', error));
});

// Sign In Form Submission
document.querySelector('.sign-in-container form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.querySelector('.sign-in-container input[type="email"]').value;
    const password = document.querySelector('.sign-in-container input[type="password"]').value;

    fetch('http://localhost:5000/signin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            alert(data.message);
            window.location.href = '../penny-pilot-backend/dashboard.html'; // Correct path
        } else {
            alert(data.error);
        }
    })
    .catch(error => console.error('Error:', error));
}); 