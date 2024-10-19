const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  totalAmount: { type: Number, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amountOwed: Number, // for exact split
    percentageOwed: Number // for percentage split
  }],

  splitMethod: { type: String, enum: ['equal', 'exact', 'percentage'], required: true }
});

module.exports = mongoose.model('Expense', expenseSchema);
