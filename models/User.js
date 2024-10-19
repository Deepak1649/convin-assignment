const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  mobile: { type: String, required: true },
  serialId: { type: Number, unique: true },
});

module.exports = mongoose.model('User', userSchema);
