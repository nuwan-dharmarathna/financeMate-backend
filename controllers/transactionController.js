const Transaction = require('../models/transactionModel');
const Account = require('../models/accountModel');
const Category = require('../models/categoryModel');

const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const ApiFeatures = require('../utils/apiFeatures');

const { trackBudgetLimit } = require('../utils/budgetHandler');
const Budget = require('../models/budgetModel');

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

  //  Get the category
  const categoryDoc = await Category.findOne({
    _id: category,
    user: req.user.id,
  });
  if (!categoryDoc) {
    return next(new AppError('Category not found or unauthorized', 404));
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
      if (accountDoc.remainingBalance < amount) {
        return next(new AppError('Insufficient balance', 400));
      }
      // check the budget limit for the category
      if (categoryDoc.onTrack === true) {
        const budgetLimit = await trackBudgetLimit(
          req.user.id,
          categoryDoc._id,
          amount,
        );

        if (budgetLimit.exceeded === false && budgetLimit.alert === 'success') {
          // reduce the account remaining balance
          accountDoc.remainingBalance -= amount;
        } else {
          return next(new AppError(budgetLimit.alert, 400));
        }
      }
    } else if (transactionType === 'income') {
      accountDoc.remainingBalance += amount;
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

  // Save the account
  await accountDoc.save();

  // Create the transaction
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

  // Fetch existing transaction
  const existingTransaction = await Transaction.findById(req.params.id);

  if (!existingTransaction) {
    return next(new AppError('No transaction found with that ID', 404));
  }

  // Check if date is being changed
  if (date && date !== existingTransaction.date) {
    return next(new AppError('You cannot edit the date field', 400));
  }

  // Validate category if changed
  let categoryDoc = null;
  if (category && category !== String(existingTransaction.category)) {
    categoryDoc = await Category.findOne({
      _id: category,
      user: req.user.id,
    });

    if (!categoryDoc) {
      return next(new AppError('New category not found or unauthorized', 404));
    }

    // Check if category type matches transaction type
    if (transactionType && categoryDoc.type !== transactionType) {
      return next(
        new AppError(`Category must be of type ${transactionType}`, 400),
      );
    }
  } else {
    categoryDoc = await Category.findById(existingTransaction.category);
  }

  // Fetch existing account
  const existingAccount = await Account.findById(existingTransaction.account);
  if (!existingAccount) {
    return next(new AppError('No account found with that ID', 404));
  }

  // Check if new account exists if changed
  let newAccount = null;
  if (account && account !== String(existingTransaction.account)) {
    newAccount = await Account.findOne({ _id: account, user: req.user.id });
    if (!newAccount) {
      return next(new AppError('New account not found', 400));
    }
  }

  // ========== REVERT OLD TRANSACTION EFFECTS ==========
  // Revert from old account
  if (existingTransaction.transactionType === 'expense') {
    existingAccount.remainingBalance += existingTransaction.amount;
  } else {
    existingAccount.remainingBalance -= existingTransaction.amount;
  }

  // Revert from old category budget if it was an expense
  if (existingTransaction.transactionType === 'expense') {
    const existingCategory = await Category.findById(
      existingTransaction.category,
    );
    if (existingCategory && existingCategory.onTrack) {
      const budget = await Budget.findOne({
        user: req.user.id,
        category: existingTransaction.category,
      });
      if (budget) {
        budget.remainingLimit += existingTransaction.amount;
        await budget.save();
      }
    }
  }

  // ========== APPLY NEW TRANSACTION EFFECTS ==========
  // Determine the target account (new or existing)
  const targetAccount = newAccount || existingAccount;

  // Check if transaction type is being changed
  const finalTransactionType =
    transactionType || existingTransaction.transactionType;
  const finalAmount = amount || existingTransaction.amount;

  // Validate account balance for expenses
  if (finalTransactionType === 'expense') {
    if (targetAccount.remainingBalance < finalAmount) {
      return next(new AppError('Insufficient balance in account', 400));
    }
  }

  // Apply to account
  if (finalTransactionType === 'expense') {
    targetAccount.remainingBalance -= finalAmount;
  } else {
    targetAccount.remainingBalance += finalAmount;
  }

  // Apply to category budget if it's an expense
  if (finalTransactionType === 'expense') {
    const finalCategory = category || existingTransaction.category;
    const finalCategoryDoc =
      categoryDoc || (await Category.findById(finalCategory));

    if (finalCategoryDoc.onTrack) {
      const budgetLimit = await trackBudgetLimit(
        req.user.id,
        finalCategory,
        finalAmount,
      );

      if (
        !(budgetLimit.exceeded === false && budgetLimit.alert === 'success')
      ) {
        return next(new AppError(budgetLimit.alert, 400));
      }
    }
  }

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
        default:
          return next(new AppError('Invalid recurring interval', 400));
      }
      existingTransaction.recurringInterval = recurringInterval;
      existingTransaction.nextRecurringDate = nextRecurringDate;
    } else {
      existingTransaction.recurringInterval = undefined;
      existingTransaction.nextRecurringDate = null;
    }
  }

  // Update transaction details
  Object.assign(existingTransaction, {
    transactionType: finalTransactionType,
    amount: finalAmount,
    account: newAccount ? newAccount._id : existingTransaction.account,
    description: description || existingTransaction.description,
    category: category || existingTransaction.category,
    lastProcessed: new Date(),
    updatedAt: new Date(),
  });

  // Save all changes
  await existingAccount.save();
  await existingTransaction.save();
  if (newAccount) {
    await newAccount.save();
  }

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

  // Revert the budget limit if applicable
  let budget = null;
  if (transaction.transactionType === 'expense') {
    const existingCategory = await Category.findById(transaction.category);
    if (existingCategory && existingCategory.onTrack) {
      budget = await Budget.findOne({
        user: req.user.id,
        category: transaction.category,
      });
      if (budget) {
        budget.remainingLimit += transaction.amount;
      }
    }
  }

  await Transaction.findByIdAndDelete(req.params.id);

  await account.save();

  if (budget) {
    await budget.save();
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
