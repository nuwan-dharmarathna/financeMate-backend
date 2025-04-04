const mongoose = require('mongoose');

const User = require('./userModel');
const Category = require('./categoryModel');

const budgetSchema = new mongoose.Schema(
  {
    limit: {
      type: Number,
      required: [true, 'A budget must have an limit'],
    },
    remainingLimit: {
      type: Number,
      min: [0, 'Balance must be greater than 0'],
    },
    category: {
      type: mongoose.Schema.ObjectId,
      ref: 'Category',
      required: [true, 'A budget must have a category'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Account must belong to a user'],
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
    path: 'category',
    select: 'slug',
  });
  next();
});

const Budget = mongoose.model('Budget', budgetSchema);

module.exports = Budget;
