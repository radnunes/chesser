import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import pkg from 'pg';
import bcrypt from 'bcryptjs';  
import jwt from 'jsonwebtoken';  

const { Pool } = pkg;

const app = express();
const PORT = process.env.SERVER_PORT || 5000;  // Default to 5000 if not provided

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const JWT_SECRET = process.env.JWT_SECRET;  // Default secret for JWT

app.use(cors({
   "origin": 'http://localhost:5173', // Replace with your frontend URL
  "methods": ['GET', 'POST'],
  "credentials": true
}));

app.use(express.json());
app.use(express.static('frontend'));

app.get("/api", async (req, res) => {
  const client = await pool.connect();
  try {
      const result = await client.query('SELECT * FROM users');
      console.log("Query Result:", result.rows);
      res.json({ message: "Data fetched successfully", data: result.rows });
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Database connection failed" });
  } finally {
      client.release();
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log("Login attempt with email:", email);
  
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    console.log("User retrieved from database:", user);

    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      console.log("Password match result:", isMatch);

      if (isMatch) {
        const token = jwt.sign({ userId: user.id }, JWT_SECRET);
        res.json({ token: token });
      } else {
        res.status(401).json({ error: 'Invalid credentials' });
      }
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// Register endpoint
app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Check if the user already exists
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user into the database
    await pool.query('INSERT INTO users (email, password) VALUES ($1, $2)', [email, hashedPassword]);

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// Start the server
app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}!`);
});
