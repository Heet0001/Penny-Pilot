const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files (e.g., dashboard.html)
app.use(express.static(path.join(__dirname, '../penny-pilot-backend')));

// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Mysql@1020',
    database: 'penny_pilot'
});

db.connect((err) => {
    if (err) throw err;
    console.log('MySQL connected...');
});

// Sign Up Route
app.post('/signup', (req, res) => {
    const { name, email, password } = req.body;
    const sql = 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)';
    db.query(sql, [name, email, password], (err, result) => {
        if (err) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(200).json({ message: 'User registered successfully' });
    });
});

// Sign In Route
app.post('/signin', (req, res) => {
    const { email, password } = req.body;
    const sql = 'SELECT * FROM users WHERE email = ? AND password = ?';
    db.query(sql, [email, password], (err, result) => {
        if (err) throw err;
        if (result.length > 0) {
            res.status(200).json({ message: 'Login successful', user: result[0] });
        } else {
            res.status(400).json({ error: 'Invalid email or password' });
        }
    });
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});