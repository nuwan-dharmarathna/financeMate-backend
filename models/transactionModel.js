const mongoose = require('mongoose');

const User = require('./userModel');
const Account = require('./accountModel');
const Category = require('./categoryModel');

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'A transaction must have a user'],
    },
    transactionType: {
      type: String,
      enum: ['income', 'expense'],
      required: [true, 'A transaction must hava a transaction type'],
    },
    amount: {
      type: Number,
      required: [true, 'A transaction must have a amount'],
      min: [0, 'Amount must be greater than 0'],
    },
    account: {
      type: mongoose.Schema.ObjectId,
      ref: 'Account',
    },
    description: {
      type: String,
    },
    date: {
      type: Date,
      required: [true, 'A transaction must have a date'],
    },
    category: {
      type: mongoose.Schema.ObjectId,
      ref: 'Category',
      required: [true, 'A transaction must have a category'],
    },
    recieptUrl: {
      type: String,
      default: null,
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurringInterval: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'yearly', ''],
    },
    nextRecurringDate: {
      type: Date,
    },
    lastProcessed: {
      type: Date,
    },
    transactionStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'completed',
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },
    updatedAt: {
      type: Date,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

transactionSchema.pre(/^find/, function (next) {
  this.populate([
    { path: 'user', select: 'firebaseUID' },
    { path: 'category', select: 'name' },
    { path: 'account', select: 'slug' },
  ]);
  next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
