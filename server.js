require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // You might need to add databaseURL or other options depending on your needs
});

const app = express();
const port = process.env.PORT || 3000;

// Middleware for parsing JSON requests
app.use(express.json());

// Middleware for handling CORS
app.use(cors());

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Agricast API is running!' });
});

// Start the server
app.listen(port, () => {
  console.log(`Agricast API listening on port ${port}`);
});