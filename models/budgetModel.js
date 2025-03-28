const mongoose = require('mongoose');

const User = require('./userModel');

const budgetSchema = new mongoose.Schema(
  {
    limit: {
      type: Number,
      required: [true, 'A budget must have an limit'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Account must belong to a user'],
      unique: true,
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

budgetSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'firebaseUID',
  });
  next();
});

const Budget = mongoose.model('Budget', budgetSchema);

module.exports = Budget;