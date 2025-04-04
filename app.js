const express = require('express');
const cron = require('node-cron');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const sanitize = require('perfect-express-sanitizer');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');

const {
  processPendingTransactions,
  processRecurringTransactions,
} = require('./utils/transactionsHandler');
const processPendingGoals = require('./utils/goalHandler');

// Route files
const userRoutes = require('./routes/userRoutes');
const accountRoutes = require('./routes/accountRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const goalRoutes = require('./routes/goalRoutes');
const categoryRoutes = require('./routes/categoryRoutes');

const admin = require('firebase-admin');
// Decode Base64 string
const firebaseCredentials = JSON.parse(
  Buffer.from(process.env.FIREBASE_CREDENTIALS, 'base64').toString(),
);

admin.initializeApp({
  credential: admin.credential.cert(firebaseCredentials),
});

const app = express();

// Start processing transactions
cron.schedule('* * * * *', async () => {
  console.log('Running cron job to process transactions...');
  try {
    await processPendingTransactions();
    await processRecurringTransactions();
    await processPendingGoals();
  } catch (err) {
    console.error('❌ Error in processPendingTransactions:', err);
  }
});

// Set security HTTP headers
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Limit requests from same API
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
});
app.use('/api', limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '100kb' }));

app.use(
  cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  }),
);

app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

// Data sanitization against SQL query injection
app.use(
  sanitize.clean({
    xss: true,
    noSql: true,
    sql: true,
  }),
);

// prevent parameter pollution
app.use(hpp());

// serving static files
app.use(express.static(`${__dirname}/public`));

// routes
app.get('/', (req, res) => {
  res.send('Welcome to the FinanceMate Backend API!');
});

app.use('/api/v1/users', userRoutes);
app.use('/api/v1/accounts', accountRoutes);
app.use('/api/v1/budgets', budgetRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/goals', goalRoutes);
app.use('/api/v1/categories', categoryRoutes);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// global error handling
app.use(globalErrorHandler);

module.exports = app;