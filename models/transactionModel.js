const mongoose = require('mongoose');

const User = require('./userModel');
const Account = require('./accountModel');

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
      type: String,
      enum: [
        'Groceries',
        'Restaurants',
        'Coffee Shops',
        'Electricity',
        'Water',
        'Internet',
        'Phone',
        'Fuel',
        'Public Transport',
        'Taxi/Ride-sharing',
        'Car Maintenance',
        'Rent',
        'Loan',
        'Mortgage',
        'Home Maintenance',
        'Clothing',
        'Electronics',
        'Home Supplies',
        'Movies',
        'Subscriptions',
        'Events',
        'Gym Membership',
        'Medicines',
        'Doctor Visits',
        'Courses',
        'Books',
        'Tuition Fees',
        'Health Insurance',
        'Vehicle Insurance',
        'Home Insurance',
        'Loan Repayments',
        'Credit Card Payments',
        'Salary',
        'Business Income',
        'Dividends',
        'Stock Profits',
        'Freelancing',
        'Property Rent',
        'Equipment Rental',
        'Gifts & Donations',
        'Bonuses',
        'Refunds',
        'Other Income',
        'Other Expense',
        'Savings',
      ],
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
      enum: ['daily', 'weekly', 'monthly', 'yearly'],
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
  this.populate({
    path: 'user',
    select: 'firebaseUID',
  });
  next();
});

transactionSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'account',
    select: 'slug',
  });
  next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
