import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import pkg from 'pg';
import authRoutes, { authenticateToken } from './auth.js';  // Import auth routes and middleware

const { Pool } = pkg;

const app = express();
const PORT = process.env.SERVER_PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true,
}));

app.use(express.json());
app.use(express.static('frontend'));

// Use auth routes
app.use('/auth', authRoutes);

// Example of a protected route
app.get("/api", async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM users');
    res.json({ message: "Protected data fetched successfully", data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Database connection failed" });
  } finally {
    client.release();
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}!`);
});
