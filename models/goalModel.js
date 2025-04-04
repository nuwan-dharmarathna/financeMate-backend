const mongoose = require('mongoose');

const User = require('./userModel');
const Account = require('./accountModel');

const goalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'A goal must have a user'],
    },
    name: {
      type: String,
      required: [true, 'A goal must have a name'],
    },
    description: {
      type: String,
    },
    account: {
      type: mongoose.Schema.ObjectId,
      ref: 'Account',
    },
    noOfInstallments: {
      type: Number,
    },
    currentInstallment: {
      type: Number,
    },
    goalStatus: {
      type: String,
      enum: ['ongoing', 'completed'],
      default: 'ongoing',
    },
    totalAmount: {
      type: Number,
      required: [true, 'A goal must have a total amount'],
      min: [0, 'Total amount must be greater than 0'],
    },
    balance: {
      type: Number,
    },
    contributionAmount: {
      type: Number,
      required: [true, 'A goal must have a contribution amount'],
      min: [0, 'Contribution amount must be greater than 0'],
    },
    contributionInterval: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: [true, 'A goal must have a contribution interval'],
    },
    nextContributionDate: {
      type: Date,
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },
    updateAt: {
      type: Date,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

goalSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'firebaseUID',
  });
  next();
});

const Goal = mongoose.model('Goal', goalSchema);
module.exports = Goal;
