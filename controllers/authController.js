const admin = require('firebase-admin');
const catchAsync = require('../utils/catchAsync');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');

const AppError = require('../utils/appError');

const { initializeApp } = require('firebase/app');
const {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} = require('firebase/auth');

const User = require('../models/userModel');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

// Load Firebase Config (Replace with your actual Firebase Config)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BCKT,
  messagingSenderId: process.env.FIREBASE_MSG_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// Initialize Firebase App (Ensure it's initialized before calling getAuth)
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp); // Firebase Client Auth

exports.signUp = catchAsync(async (req, res, next) => {
  const { email, password, passwordConfirm } = req.body;
  if (!email || !password || !passwordConfirm) {
    return next(new AppError('Provide both email and password', 404));
  }

  if (password !== passwordConfirm) {
    return next(new AppError('Passwords are not same!', 400));
  }

  const userRecord = await admin.auth().createUser({
    email: email,
    password: password,
    emailVerified: false,
    disabled: false,
  });

  // Save user to database
  const newUser = await User.create({
    firebaseUID: userRecord.uid,
    email: userRecord.email,
    displayName: req.body.displayName || userRecord.email.split('@')[0],
    provider: 'email',
  });

  await newUser.save();

  createSendToken(newUser, 201, res);
});

exports.signIn = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new AppError('Provide both email and password', 400));
  }

  const userRecord = await admin.auth().getUserByEmail(email);

  console.log(`userRecord : ${userRecord.email}`);

  if (!userRecord) {
    return next(new AppError('User not found', 404));
  }

  // Check if user exists in database
  const user = await User.findOne({
    firebaseUID: userRecord.uid,
  });

  const signInResult = await signInWithEmailAndPassword(auth, email, password);
  // Additional logic after successful sign in
  const token = signToken(user._id);

  res.cookie('authToken', token, {
    httpOnly: true, // Prevents client-side access
    secure: true, // Set to `true` in production (requires HTTPS)
    sameSite: 'None',
    maxAge: 2 * 60 * 60 * 1000, // Expires in 2 hours
  });

  res.status(200).json({
    status: 'success',
    token,
  });
});

exports.signInWithGoogle = catchAsync(async (req, res, next) => {
  const { uid } = req.body;

  console.log(`idToken received: ${uid}`);

  if (!uid) {
    return res.status(400).json({ message: 'Missing Google ID Token' });
  }

  try {
    // ✅ Verify Firebase ID Token
    // const decodedToken = await admin.auth().verifyIdToken(idToken);
    // console.log(`Decoded Token:`, decodedToken);

    const userRecord = await admin.auth().getUserByProviderUid(uid);

    // ✅ Check if user exists in database
    let user = await User.findOne({ firebaseUID: uid });

    if (!user) {
      user = new User({
        firebaseUID: uid,
        email: userRecord.email,
        displayName: userRecord.email.split('@')[0],
        provider: 'google',
      });

      await user.save();
    }

    const token = signToken(user._id);

    res.cookie('authToken', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 2 * 60 * 60 * 1000, // Expires in 2 hours
    });

    return res.status(200).json({
      status: 'success',
      token,
      user,
    });
  } catch (error) {
    console.error('Error verifying ID token:', error.message);
    return res.status(401).json({
      status: 'error',
      message: 'Invalid Google ID Token',
    });
  }
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) check token is there
  const token = req.cookies.authToken;

  // 1) check token is there
  // let token;
  // if (
  //   req.headers.authorization &&
  //   req.headers.authorization.startsWith('Bearer')
  // ) {
  //   token = req.headers.authorization.split(' ')[1];
  // }

  // console.log(`token : ${token}`);

  if (!token) {
    return next(new AppError('You are not logged in!', 401));
  }

  // 2) verification token
  const decode = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decode.id);
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401,
      ),
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  next();
});
