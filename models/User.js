const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  walletAddress: {
    type: String,
    unique: true,
    sparse: true
  },
  pin: {
    type: String // Hashed PIN
  },
  avatar: {
  type: String,
  default: ''
}
});

module.exports = mongoose.model('User', userSchema);
