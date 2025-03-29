const Transaction = require('../models/transactionModel');
const Account = require('../models/accountModel');

const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const ApiFeatures = require('../utils/apiFeatures');

const { trackBudgetLimit } = require('../utils/budgetHandler');

exports.getAllTransactions = catchAsync(async (req, res, next) => {
  // Base filter to ensure only logged-in user's transactions are fetched
  let filter = { user: req.user.id };

  // Apply additional filter by account if provided in query
  if (req.query.account) filter.account = req.query.account;

  // Apply filtering, sorting, field limiting, and pagination
  const features = new ApiFeatures(Transaction.find(filter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const transactions = await features.query;

  res.status(200).json({
    status: 'success',
    results: transactions.length,
    data: {
      transactions,
    },
  });
});

exports.getTransaction = catchAsync(async (req, res, next) => {
  const transaction = await Transaction.findById(req.params.id);

  if (!transaction) {
    return next(new AppError('No transaction found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      transaction,
    },
  });
});

exports.createTransaction = catchAsync(async (req, res, next) => {
  const {
    transactionType,
    amount,
    account,
    description,
    date,
    category,
    isRecurring,
    recurringInterval,
  } = req.body;

  //  Get the account or Default Account
  let accountDoc;

  if (account) {
    accountDoc = await Account.findOne({ _id: account, user: req.user.id });
    if (!accountDoc) {
      return next(new AppError('Account not found or unauthorized', 404));
    }
  } else {
    accountDoc = await Account.findOne({ isDefault: true, user: req.user.id });
    if (!accountDoc) {
      return next(
        new AppError('No default account found. Please select an account', 404),
      );
    }
  }

  // Date handling
  let transactionDate = date ? new Date(date) : new Date();
  transactionDate.setHours(0, 0, 0, 0);
  let today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to ignore time part

  let transactionStatus = 'completed';
  let shouldDeductAmount = true;

  if (transactionDate > today) {
    transactionStatus = 'pending'; // Mark as pending if future date
    shouldDeductAmount = false;
  }

  //  Handle transaction type
  if (shouldDeductAmount === true) {
    if (transactionType === 'expense') {
      if (accountDoc.balance < amount) {
        return next(new AppError('Insufficient balance', 400));
      }
      // check the budget limit
      const budgetLimit = await trackBudgetLimit(req.user.id, amount);
      if (budgetLimit.exceeded) {
        return next(new AppError(budgetLimit.alert, 400));
      }
      accountDoc.balance -= amount;
    } else if (transactionType === 'income') {
      accountDoc.balance += amount;
    }
  }

  // Set nextRecurringDate
  let nextRecurringDate = null;
  if (isRecurring && recurringInterval) {
    nextRecurringDate = new Date(transactionDate);

    switch (recurringInterval) {
      case 'daily':
        nextRecurringDate.setDate(nextRecurringDate.getDate() + 1);
        break;
      case 'weekly':
        nextRecurringDate.setDate(nextRecurringDate.getDate() + 7);
        break;
      case 'monthly':
        nextRecurringDate.setMonth(nextRecurringDate.getMonth() + 1);
        break;
      case 'yearly':
        nextRecurringDate.setFullYear(nextRecurringDate.getFullYear() + 1);
        break;
    }
  }

  const newTransaction = await Transaction.create({
    user: req.user.id,
    transactionType,
    amount,
    account: accountDoc._id,
    description,
    date: transactionDate,
    category,
    isRecurring,
    recurringInterval,
    nextRecurringDate,
    transactionStatus,
  });

  // Save the account
  await accountDoc.save();

  res.status(201).json({
    status: 'success',
    data: {
      transaction: newTransaction,
    },
  });
});

exports.updateTransaction = catchAsync(async (req, res, next) => {
  const {
    transactionType,
    amount,
    account,
    description,
    date,
    category,
    isRecurring,
    recurringInterval,
  } = req.body;

  // check the date field include in the body
  if (date) {
    return next(new AppError('You cannot edit date field', 400));
  }

  // Fetch existing transaction
  const existingTransaction = await Transaction.findById(req.params.id);
  if (!existingTransaction) {
    return next(new AppError('No transaction found with that ID', 404));
  }

  const existingAccount = await Account.findById(existingTransaction.account);
  if (!existingAccount) {
    return next(new AppError('No account found with that ID', 404));
  }

  // Check if the account is changed
  let newAccount = null;
  if (account && account !== String(existingTransaction.account)) {
    newAccount = await Account.findOne({ _id: account, user: req.user.id });
    if (!newAccount) {
      return next(new AppError('New account not found', 400));
    }
  }

  // Revert old transaction amount
  if (existingTransaction.transactionType === 'expense') {
    existingAccount.balance += existingTransaction.amount;
  } else {
    // check the budget limit
    const budgetLimit = await trackBudgetLimit(
      req.user.id,
      existingTransaction.amount,
    );
    if (budgetLimit.exceeded) {
      budgetLimit.alert = 'Cannot revert the transaction. ' + budgetLimit.alert;
      return next(new AppError(budgetLimit.alert, 400));
    }
    existingAccount.balance -= existingTransaction.amount;
  }

  console.log('Old account balance:', existingAccount.balance);

  // If the account is changing, apply the transaction to the new account
  if (newAccount) {
    console.log('Account changed');
    if (transactionType === 'expense') {
      if (newAccount.balance < amount) {
        return next(new AppError('Insufficient balance in new account', 400));
      }
      // check the budget limit
      const budgetLimit = await trackBudgetLimit(req.user.id, amount);
      if (budgetLimit.exceeded) {
        budgetLimit.alert =
          'Cannot apply the transaction. ' + budgetLimit.alert;
        return next(new AppError(budgetLimit.alert, 400));
      }
      newAccount.balance -= amount;
    } else {
      newAccount.balance += amount;
    }
  } else {
    console.log('Account not changed');
    // Apply new transaction effect
    if (transactionType === 'expense') {
      if (existingAccount.balance < amount) {
        return next(new AppError('Insufficient balance', 400));
      }
      // check the budget limit
      const budgetLimit = await trackBudgetLimit(req.user.id, amount);
      if (budgetLimit.exceeded) {
        budgetLimit.alert =
          'Cannot apply the transaction. ' + budgetLimit.alert;
        return next(new AppError(budgetLimit.alert, 400));
      }
      existingAccount.balance -= amount;
    } else {
      existingAccount.balance += amount;
    }
  }

  console.log('New account balance:', existingAccount.balance);

  // Handle recurring transactions
  if (isRecurring !== undefined) {
    existingTransaction.isRecurring = isRecurring;
    if (isRecurring) {
      const nextRecurringDate = new Date(existingTransaction.date);
      switch (recurringInterval) {
        case 'daily':
          nextRecurringDate.setDate(nextRecurringDate.getDate() + 1);
          break;
        case 'weekly':
          nextRecurringDate.setDate(nextRecurringDate.getDate() + 7);
          break;
        case 'monthly':
          nextRecurringDate.setMonth(nextRecurringDate.getMonth() + 1);
          break;
        case 'yearly':
          nextRecurringDate.setFullYear(nextRecurringDate.getFullYear() + 1);
          break;
      }
      existingTransaction.recurringInterval = recurringInterval;
      existingTransaction.nextRecurringDate = nextRecurringDate;
    } else {
      existingTransaction.nextRecurringDate = null;
    }
  }

  // Update transaction details
  Object.assign(existingTransaction, {
    transactionType: transactionType,
    amount: amount,
    account: account || existingTransaction.account,
    description: description || existingTransaction.description,
    category: category || existingTransaction.category,
    lastProcessed: new Date(),
    updatedAt: new Date(),
  });

  await existingTransaction.save();

  // If the account is changed, save the new account
  await newAccount.save();

  // Save the account
  await existingAccount.save();

  res.status(200).json({
    status: 'success',
    data: existingTransaction,
  });
});

exports.deleteTransaction = catchAsync(async (req, res, next) => {
  const transaction = await Transaction.findById(req.params.id);
  if (!transaction) {
    return next(new AppError('No transaction found with that ID', 404));
  }

  // Revert the transaction amount
  const account = await Account.findById(transaction.account);
  if (!account) {
    return next(new AppError('No account found for the transaction', 404));
  }

  if (transaction.transactionType === 'expense') {
    account.balance += transaction.amount;
  } else {
    account.balance -= transaction.amount;
  }

  await Transaction.findByIdAndDelete(req.params.id);

  await account.save();

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
