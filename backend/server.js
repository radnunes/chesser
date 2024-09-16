import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import path from 'path';

const app = express();
const PORT = process.env.SERVER_PORT;

app.use(cors());
app.use(express.json());

app.use(express.static('frontend'));

app.get("/api", (req, res) => {
    res.json({ message: "Hello from server!!!!" });
  });

app.listen( PORT, () =>
    console.log(`Server listening on port ${PORT}!`),
  );
