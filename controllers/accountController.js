const Account = require('../models/accountModel');
const Transaction = require('../models/transactionModel');

const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const slugify = require('slugify');

exports.getAllAccounts = catchAsync(async (req, res, next) => {
  const accounts = await Account.find({
    user: req.user.id,
  });

  res.status(200).json({
    status: 'success',
    results: accounts.length,
    data: {
      accounts,
    },
  });
});

exports.getAccount = catchAsync(async (req, res, next) => {
  const account = await Account.findOne({
    user: req.user.id,
    _id: req.params.id,
  });

  if (!account) {
    return next(new AppError('No account found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      account,
    },
  });
});

exports.createAccount = catchAsync(async (req, res, next) => {
  console.log(req.body);

  const userId = req.user.id;
  const { name, isDefault, balance } = req.body;

  // Generate slug from name if not provided
  const slug = slugify(name, { lower: true });

  // Check if the slug already exists for this user
  const existingAccountWithSlug = await Account.findOne({
    user: userId,
    slug: slug,
  });

  if (existingAccountWithSlug) {
    return next(new AppError('Account name already exists', 400));
  }

  // Check existing accounts of the user
  const existingAccounts = await Account.find({ user: userId });

  // If request isDefault is true, and existing default account exists, update it
  if (isDefault && existingAccounts.length > 0) {
    const currentDefaultAccount = await Account.findOne({
      user: userId,
      isDefault: true,
    });

    if (currentDefaultAccount) {
      currentDefaultAccount.isDefault = false;
      await currentDefaultAccount.save();
      console.log('Updated old default account:', currentDefaultAccount);
    }
  }

  // Prepare account payload
  const accountData = {
    ...req.body,
    slug,
    user: userId,
    remainingBalance: balance,
  };

  // If no existing accounts, force isDefault to true
  if (existingAccounts.length === 0) {
    accountData.isDefault = true;
  }

  const newAccount = await Account.create(accountData);

  res.status(201).json({
    status: 'success',
    data: {
      account: newAccount,
    },
  });
});

exports.updateAccount = catchAsync(async (req, res, next) => {
  // fetch the account
  const account = await Account.findOne({
    user: req.user.id,
    _id: req.params.id,
  });

  if (!account) {
    return next(new AppError('No account found with that ID', 404));
  }

  // check the account name is changed
  if (req.body.name && req.body.name !== account.name) {
    // check the slug is already exist
    const slug = req.body.slug
      ? req.body.slug
      : slugify(req.body.name, { lower: true });

    const account = await Account.findOne({
      user: req.user.id,
      slug: slug,
    });

    if (account) {
      return next(new AppError('Account name already exist', 400));
    }
  }

  // Check isDefault field is present in the request body
  if (req.body.isDefault === true) {
    // Get the default account
    const defaultAccount = await Account.findOne({
      user: req.user.id,
      isDefault: true,
    });

    // If there is a default account, update it to false
    if (defaultAccount) {
      await Account.findByIdAndUpdate(defaultAccount.id, {
        isDefault: false,
      });
    }

    // Update the new default account
    req.body.isDefault = true;
  }

  // check the balance is updated
  if (req.body.balance !== account.balance) {
    // update the remaining balance
    let remainingBalance =
      account.remainingBalance + (req.body.balance - account.balance);

    if (remainingBalance < 0) {
      return next(new AppError('Remaining balance cannot be less than 0', 400));
    }

    req.body.remainingBalance = remainingBalance;
  }

  // update the account
  Object.assign(account, {
    ...req.body,
  });

  await account.save();

  res.status(200).json({
    status: 'success',
    data: {
      account,
    },
  });
});

exports.deleteAccount = catchAsync(async (req, res, next) => {
  // Check is there any transaction exist with this account
  const transactions = await Transaction.find({
    account: req.params.id,
  });

  if (transactions.length > 0) {
    return next(
      new AppError(
        'This account has transactions. Please delete them before deleting the account',
        400,
      ),
    );
  }

  // fetch all accounts of the user
  const existingAccounts = await Account.find({
    user: req.user.id,
  });

  if (existingAccounts.length > 1) {
    // Check if the account to be deleted is the default account

    const accountToBeDeleted = await Account.findById(req.params.id);

    if (accountToBeDeleted.isDefault) {
      return next(
        new AppError(
          'You cannot delete the default account. Please change the default account before deleting.',
          400,
        ),
      );
    }
  }

  await Account.findByIdAndDelete(req.params.id);

  // Check no of accounts exist
  const accounts = await Account.find({
    user: req.user.id,
  });

  if (accounts.length === 1) {
    // Update the default account
    await Account.findByIdAndUpdate(accounts[0].id, {
      isDefault: true,
    });
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// get transactions of the account
exports.getTransactionsOfAccount = catchAsync(async (req, res, next) => {
  const transactions = await Transaction.find({
    account: req.params.id,
    user: req.user.id,
  });

  console.log(transactions);

  if (!transactions) {
    return next(new AppError('No transactions found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    results: transactions.length,
    data: {
      transactions,
    },
  });
});
