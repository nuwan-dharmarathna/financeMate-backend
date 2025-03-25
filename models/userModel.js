const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    firebaseUID: {
      type: String,
      required: [true, 'User must have a firebaseUID'],
      unique: true,
    },
    email: {
      type: String,
      required: [true, 'User must have an email'],
      unique: true,
    },
    displayName: {
      type: String,
    },
    image: {
      type: String,
    },
    provider: {
      type: String,
      required: [true, 'User must have a provider'],
    },
    active: {
      type: Boolean,
      default: true,
      select: false,
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
    timestamps: true,
  },
);

const User = mongoose.model('User', userSchema);

module.exports = User;
