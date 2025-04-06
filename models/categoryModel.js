const mongoose = require('mongoose');
const slugify = require('slugify');

const User = require('./userModel');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A Category must have a name'],
    },
    slug: {
      type: String,
    },
    type: {
      type: String,
      enum: ['income', 'expense'],
      required: [true, 'A Category must have a type'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Category must belong to a user'],
    },
    onTrack: {
      type: Boolean,
      default: false,
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

categorySchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'firebaseUID',
  });
  next();
});

categorySchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
