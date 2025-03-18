const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Define the base directory for your project
const projectBaseDir = path.join(__dirname);
const loginPageDir = path.join(__dirname, '../LoginPage');

// Serve static files from the LoginPage directory
app.use(express.static(loginPageDir));

// Serve the dashboard.html directly from its location
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(projectBaseDir, 'dashboard.html'));
});

// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Mysql@101010',
    database: 'penny_pilot'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('MySQL connected successfully');
});

// Sign Up Route
app.post('/signup', (req, res) => {
    const { name, email, password } = req.body;
    
    // Validate inputs
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    const sql = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
    db.query(sql, [name, email, password], (err, result) => {
        if (err) {
            console.error('Database error during signup:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Email already exists' });
            }
            return res.status(500).json({ error: 'Database error occurred' });
        }
        res.status(200).json({ message: 'User registered successfully. Please sign in.' });
    });
});

// Sign In Route
app.post('/signin', (req, res) => {
    const { email, password } = req.body;
    
    // Validate inputs
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const sql = 'SELECT * FROM users WHERE email = ? AND password = ?';
    db.query(sql, [email, password], (err, result) => {
        if (err) {
            console.error('Database error during signin:', err);
            return res.status(500).json({ error: 'Database error occurred' });
        }
        
        if (result.length > 0) {
            // Don't send password back to client
            const user = { ...result[0] };
            delete user.password;
            
            res.status(200).json({ message: 'Login successful', user });
        } else {
            res.status(400).json({ error: 'Invalid email or password' });
        }
    });
});

// Add a route to handle initial page load
app.get('/', (req, res) => {
    res.sendFile(path.join(loginPageDir, 'Login.html'));
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the application at http://localhost:${PORT}`);
});