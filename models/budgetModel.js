const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema(
  {
    limit: {
      type: Number,
      required: [true, 'A budget must have a limit'],
    },
    remainingLimit: {
      type: Number,
      min: [0, 'Remaining limit must be greater than or equal to 0'],
    },
    category: {
      type: mongoose.Schema.ObjectId,
      ref: 'Category',
      required: [true, 'A budget must be assigned to a category'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'A budget must belong to a user'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
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

// Compound index: ensure one budget per user per category
budgetSchema.index({ user: 1, category: 1 }, { unique: true });

// Auto-populate category slug on find
budgetSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'category',
    select: 'slug',
  });
  next();
});

const Budget = mongoose.model('Budget', budgetSchema);

module.exports = Budget;
