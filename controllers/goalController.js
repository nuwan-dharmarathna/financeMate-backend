const Goal = require('../models/goalModel');
const Account = require('../models/accountModel');
const Transaction = require('../models/transactionModel');

const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const ApiFeatures = require('../utils/apiFeatures');

exports.getAllGoals = catchAsync(async (req, res, next) => {
  // Base filter to ensure only logged-in user's goals are fetched
  let filter = { user: req.user.id };

  // Apply filtering, sorting, field limiting, and pagination
  const features = new ApiFeatures(Goal.find(filter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const goals = await features.query;

  res.status(200).json({
    status: 'success',
    results: goals.length,
    data: {
      goals,
    },
  });
});

exports.getGall = catchAsync(async (req, res, next) => {
  const goal = await Goal.findById(req.params.id);

  if (!goal) {
    return next(new AppError('No goal found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      goal,
    },
  });
});

exports.createGoal = catchAsync(async (req, res, next) => {
  const {
    name,
    description,
    totalAmount,
    account,
    contributionAmount,
    contributionInterval,
  } = req.body;

  // Get the default account
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

  // Check if the account has sufficient balance
  if (accountDoc.balance < contributionAmount) {
    return next(
      new AppError('Insufficient balance in the selected account', 400),
    );
  }

  accountDoc.balance -= contributionAmount;

  // set the next contribution date based on the contribution interval
  let nextContributionDate = new Date();
  switch (contributionInterval) {
    case 'daily':
      nextContributionDate.setDate(nextContributionDate.getDate() + 1);
      break;
    case 'weekly':
      nextContributionDate.setDate(nextContributionDate.getDate() + 7);
      break;
    case 'monthly':
      nextContributionDate.setMonth(nextContributionDate.getMonth() + 1);
      break;
    default:
      return next(new AppError('Invalid contribution interval', 400));
  }

  const newGoal = await Goal.create({
    user: req.user.id,
    name,
    description,
    totalAmount,
    account,
    noOfInstallments: Math.ceil(totalAmount / contributionAmount),
    currentInstallment: 1,
    balance: totalAmount - contributionAmount,
    contributionAmount,
    contributionInterval,
    nextContributionDate,
  });

  // save the account
  await accountDoc.save();

  // create a transaction for the contribution
  await Transaction.create({
    user: req.user.id,
    account: accountDoc.id,
    amount: contributionAmount,
    category: 'Savings',
    transactionType: 'expense',
    description: `Contribution for goal: ${name}`,
    transactionStatus: 'completed',
  });

  res.status(201).json({
    status: 'success',
    data: {
      goal: newGoal,
    },
  });
});

exports.updateGoal = catchAsync(async (req, res, next) => {
  const {
    name,
    description,
    account,
    totalAmount,
    contributionAmount,
    contributionInterval,
  } = req.body;

  // fetch excisting goal
  const existingGoal = await Goal.findById(req.params.id);
  if (!existingGoal) {
    return next(new AppError('No goal found with that ID', 404));
  }

  if (existingGoal.goalStatus === 'completed') {
    return next(new AppError('Cannot update a completed goal', 400));
  }

  // Get the goal account
  const existingAccount = await Account.findById(existingGoal.account);
  if (!existingAccount) {
    return next(new AppError('No account found with that ID', 404));
  }

  if (account !== existingGoal.account) {
    return next(new AppError('Cannot change the account of a goal', 400));
  }

  // set the next contribution date based on the contribution interval
  if (contributionInterval !== existingGoal.contributionInterval) {
    let nextContributionDate = new Date();
    switch (contributionInterval) {
      case 'daily':
        nextContributionDate.setDate(nextContributionDate.getDate() + 1);
        break;
      case 'weekly':
        nextContributionDate.setDate(nextContributionDate.getDate() + 7);
        break;
      case 'monthly':
        nextContributionDate.setMonth(nextContributionDate.getMonth() + 1);
        break;
      default:
        return next(new AppError('Invalid contribution interval', 400));
    }
    existingGoal.nextContributionDate = nextContributionDate;
    existingGoal.contributionInterval = contributionInterval;
  }

  // update the goal
  Object.assign(existingGoal, {
    name: name || existingGoal.name,
    description: description || existingGoal.description,
    contributionAmount: contributionAmount || existingGoal.contributionAmount,
    totalAmount: totalAmount || existingGoal.totalAmount,
    updateAt: Date.now(),
  });

  await existingAccount.save();

  res.status(200).json({
    status: 'success',
    data: {
      goal: existingGoal,
    },
  });
});

exports.deleteGoal = catchAsync(async (req, res, next) => {
  const existingGoal = await Goal.findById(req.params.id);

  if (!existingGoal) {
    return next(new AppError('No goal found with that ID', 404));
  }

  if (existingGoal.goalStatus === 'ongoing') {
    // Get the goal account
    const existingAccount = await Account.findById(existingGoal.account);

    if (!existingAccount) {
      return next(new AppError('No account found with that ID', 404));
    }
    // Revert the balance
    let revertAmount = existingGoal.totalAmount - existingGoal.balance;

    existingAccount.balance += revertAmount;

    await existingAccount.save();
  }

  await existingGoal.remove();

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
