const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const path = require("path");
require('dotenv').config();

const app = express();

// ✅ Connect to MongoDB
connectDB();


// ✅ Middlewares
app.use(cors());


// Increase request body size limits to prevent "PayloadTooLargeError"
app.use(express.json({ limit: '20mb' })); // Allow large JSON bodies
app.use(express.urlencoded({ limit: '20mb', extended: true })); // Allow large form data


// ✅ API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pickup', require('./routes/pickup'));
app.use('/api/compost', require('./routes/compost'));
app.use('/api/order', require('./routes/order'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/rewards', require('./routes/rewards'));
app.use('/api/users', require('./routes/user'));
app.use('/api/redemptions', require('./routes/redemption')); 
app.use('/api/pickup', require('./routes/route-optimization'));


// ✅ Serve Static Frontend Files
app.use(express.static(path.join(__dirname, "..", "frontend")));


// ✅ Frontend Routes (Handle Direct Access)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

app.get("/signin", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "login.html"));
});

app.get("/farmer", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "farmer-dashboard.html"));
});


// ✅ Start Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🏠 Host: localhost`);
});