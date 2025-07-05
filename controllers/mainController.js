const bcrypt = require('bcrypt');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');

// Avatar upload config
const storage = multer.diskStorage({
  destination: 'public/uploads/',
  filename: (req, file, cb) => {
    cb(null, `avatar-${req.session.userId}-${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

// Avatar route middleware
exports.avatarUpload = upload.single('avatar');

exports.uploadAvatar = async (req, res) => {
  if (!req.file) return res.redirect('/profile');

  const user = await User.findById(req.session.userId);
  user.avatar = '/uploads/' + req.file.filename;
  await user.save();

  res.redirect('/profile');
};

const transactions = [
  { type: 'sent', amount: '0.5', date: '2025-07-04', address: '0xabc123...' },
  { type: 'received', amount: '1.2', date: '2025-07-03', address: '0xdef456...' },
];

let dummyStoredPin = '1234';

// Middleware to protect routes
exports.isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.redirect('/login');
};

// Home
exports.getHome = (req, res) => {
  res.render('landing', { isLoggedIn: !!req.session.userId });
};

// Signup
exports.getSignup = (req, res) => {
  res.render('signup', { isLoggedIn: false });
};

exports.postSignup = async (req, res) => {
  const { email, password, confirmPassword, walletAddress } = req.body;

  try {
    // Check for password match
    if (password !== confirmPassword) {
      return res.render('signup', { message: 'Passwords do not match' });
    }

    // Normalize inputs
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedWallet = walletAddress.trim().toLowerCase();

    // Check if email already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.render('signup', { message: 'Email already registered' });
    }

    // Check if wallet is already linked
    const walletUsed = await User.findOne({ walletAddress: normalizedWallet });
    if (walletUsed) {
      return res.render('signup', { message: 'Wallet already linked to another account' });
    }

    // Create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email: normalizedEmail,
      password: hashedPassword,
      walletAddress: normalizedWallet
    });

    await user.save();

    // Store session and redirect
    req.session.userId = user._id;
    req.session.walletAddress = normalizedWallet;

    res.redirect('/dashboard');

  } catch (err) {
    console.error('Signup error:', err);
    res.render('signup', { message: 'Server error. Please try again.' });
  }
};



// Login
exports.getLogin = (req, res) => {
  res.render('login', { isLoggedIn: false });
};

exports.postLogin = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.render('login', { isLoggedIn: false, message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.render('login', { isLoggedIn: false, message: 'Invalid credentials' });

    req.session.userId = user._id;
    req.session.walletAddress = user.walletAddress;
    req.session.user = user; // Set full user session
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.render('login', { isLoggedIn: false, message: 'Server error' });
  }
};

// Dashboard
exports.getDashboard = async (req, res) => {
  const user = await User.findById(req.session.userId);
  res.render('dashboard', {
    isLoggedIn: true,
    activeTab: 'dashboard',
    walletAddress: req.session.walletAddress,
    user:user,
  });
};

// Wallet connection
exports.connectWallet = async (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).json({ error: 'Wallet address is required' });

  if (!req.session.userId) {
    return res.status(401).json({ error: 'Login required to link wallet' });
  }

  try {
    const user = await User.findById(req.session.userId);
    user.walletAddress = walletAddress;
    await user.save();
    req.session.walletAddress = walletAddress;
    res.status(200).json({ message: 'Wallet connected', walletAddress });
  } catch (err) {
    console.error('Wallet connection error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Send ETH with PIN check
exports.getSend = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId); // ✅ fetch user from DB
    res.render('send', {
      isLoggedIn: true,
      user // ✅ pass user to EJS
    });
  } catch (err) {
    console.error("Send Page Error:", err);
    res.status(500).send("Failed to load send page.");
  }
};


exports.postSend = async (req, res) => {
  const { recipient, amount, securityPin } = req.body;
  const user = await User.findById(req.session.userId);
  if (!user) return res.send('❌ User not found');

  const isPinValid = await bcrypt.compare(securityPin, user.pin || '');
  if (!isPinValid) {
    return res.send('<h2 style="color:red;">Invalid Security PIN!</h2><a href="/send">Try again</a>');
  }

  res.send(`<h2 style="color:green;">Transaction Successful to ${recipient}!</h2><a href="/dashboard">Go back</a>`);
};
// Receive ETH
exports.getReceive = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);

    // ✅ Ensure walletAddress exists before generating QR code
    const qrCodeDataURL = user?.walletAddress
      ? await QRCode.toDataURL(user.walletAddress)
      : null;

    res.render('receive', {
      isLoggedIn: true,
      user,            // ✅ for nav and wallet display
      qrCodeDataURL    // ✅ used in EJS to render QR code image
    });
  } catch (err) {
    console.error("Receive Page Error:", err);
    res.status(500).send("Failed to load receive page.");
  }
};


// Transactions
exports.getTransactions = async (req, res) => {
  const userId = req.session.userId;
  const walletAddress = req.session.walletAddress;

  try {
    const transactions = await Transaction.find({ userId }).sort({ timestamp: -1 });

    const user = await User.findById(userId); // ✅ Fetch the user to get avatar/email

    res.render('transactions', {
      transactions,
      walletAddress,
      activeTab: 'transactions',
      isLoggedIn: true,
      user // ✅ Add user to make it available to nav.ejs
    });
  } catch (err) {
    console.error("Transaction load error:", err);
    res.status(500).send("Failed to load transactions.");
  }
};


// Settings
exports.getSettings = async (req, res) => {
  const user = await User.findById(req.session.userId);
  res.render('settings', {
    activeTab: 'settings',
    isLoggedIn: true,
    user: user
  });
};

// Add wallet
exports.postAddWallet = (req, res) => {
  const { newWallet } = req.body;
  console.log('New wallet added:', newWallet);
  res.redirect('/settings');
};

// Save PIN securely
exports.setDummyPin = async (req, res) => {
  if (!req.session.userId) {
    return res.status(400).send("User not logged in");
  }

  const user = await User.findById(req.session.userId);
  if (!user) return res.status(404).send("User not found");

  const { pin } = req.body;
  const hashedPin = await bcrypt.hash(pin, 10);
  user.pin = hashedPin;
  await user.save();

  res.send('✅ Security PIN saved successfully. <a href="/settings">Back</a>');
};

// Profile update (password change)
exports.postProfileUpdate = async (req, res) => {
  const { email, oldPassword, newPassword, confirmPassword } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.send('User not found.');

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.send('Old password is incorrect.');

    if (newPassword !== confirmPassword) {
      return res.send('New password and confirmation do not match.');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    res.send('<h2 style="color:green;">Password updated successfully!</h2><a href="/settings">Back to settings</a>');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error.');
  }
};

exports.postSend = async (req, res) => {
  const { recipient, amount, securityPin } = req.body;
  const userId = req.session.userId;

  try {
    const user = await User.findById(userId);
    const isPinValid = await bcrypt.compare(securityPin, user.pin);

    if (!isPinValid) {
      return res.send('<h2 style="color:red;">Invalid Security PIN!</h2><a href="/send">Try again</a>');
    }

    // Simulate sending ETH via frontend MetaMask
    // But here, capture and save the transaction hash sent via frontend
    const txHash = req.body.txHash || 'mock_tx_hash'; // Replace with actual from frontend

    const tx = new Transaction({
      userId,
      from: user.walletAddress,
      to: recipient,
      amount,
      txHash,
    });

    await tx.save();

    res.send(`<h2 style="color:green;">Transaction saved successfully to ${recipient}!</h2><a href="/dashboard">Go back</a>`);
  } catch (err) {
    console.error('Transaction error:', err);
    res.status(500).send('Transaction failed');
  }
};
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) return res.redirect('/login');
    
    res.render('profile', {
      isLoggedIn: true,
      user
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).send('Server error.');
  }
};

