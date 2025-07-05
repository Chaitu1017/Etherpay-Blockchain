const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const dotenv = require('dotenv');
const mainController = require('./controllers/mainController');
const multer = require('multer'); // Already required above

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB error:", err));

// EJS and Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
//app.use(express.static('public')); // Serve images from public/images
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

app.use(session({
  secret: 'chaitu',  // Replace with a secure secret
  resave: false,
  saveUninitialized: false
}));

// Routes
app.get('/', mainController.getHome);
app.get('/login', mainController.getLogin);
app.post('/login', mainController.postLogin);
app.get('/signup', mainController.getSignup);
app.post('/signup', mainController.postSignup);
app.post('/connect-wallet', mainController.connectWallet);
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// 🔒 Protected Routes
app.post('/set-pin', mainController.isAuthenticated, mainController.setDummyPin);
app.get('/dashboard', mainController.isAuthenticated, mainController.getDashboard);
app.get('/send', mainController.isAuthenticated, mainController.getSend);
app.post('/send', mainController.isAuthenticated, mainController.postSend);
app.get('/receive', mainController.isAuthenticated, mainController.getReceive);
app.get('/transactions', mainController.isAuthenticated, mainController.getTransactions);
app.get('/settings', mainController.isAuthenticated, mainController.getSettings);
app.post('/settings/profile', mainController.isAuthenticated, mainController.postProfileUpdate);
app.post('/settings/add-account', mainController.isAuthenticated, mainController.postAddWallet);
app.get('/profile', mainController.isAuthenticated, mainController.getProfile);
app.post('/profile/avatar', mainController.isAuthenticated, mainController.avatarUpload, mainController.uploadAvatar);


// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
