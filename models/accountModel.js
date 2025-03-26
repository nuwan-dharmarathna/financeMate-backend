const mongoose = require('mongoose');
const slugify = require('slugify');

const User = require('./userModel');

const accountSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A account must have a name'],
    },
    slug: {
      type: String,
      unique: true,
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Account must belong to a user'],
    },
    accountType: {
      type: String,
      enum: ['current', 'savings'],
      required: [true, 'A account must have a type'],
    },
    balance: {
      type: Number,
      required: [true, 'A account must have a start balance'],
      min: [0, 'Balance must be greater than 0'],
    },
    isDefault: {
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

accountSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'firebaseUID',
  });
  next();
});

accountSchema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

const Account = mongoose.model('Account', accountSchema);

module.exports = Account;