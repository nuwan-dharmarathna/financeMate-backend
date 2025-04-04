const Account = require('../models/accountModel');
const Transaction = require('../models/transactionModel');

const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

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
  const account = await Account.findById(req.params.id);

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
  // check the user have already created an account
  const accounts = await Account.find({
    user: req.user.id,
  });

  let newAccount;

  if (accounts.length !== 0) {
    //   Check isDefault field is present in the request body
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

    newAccount = await Account.create({
      ...req.body,
      remainingBalance: req.body.balance,
      user: req.user.id,
    });
  } else {
    newAccount = await Account.create({
      ...req.body,
      user: req.user.id,
      remainingBalance: req.body.balance,
      isDefault: true,
    });
  }

  res.status(201).json({
    status: 'success',
    data: {
      account: newAccount,
    },
  });
});

exports.updateAccount = catchAsync(async (req, res, next) => {
  // fetch the account
  const account = await Account.findById(req.params.id);

  if (!account) {
    return next(new AppError('No account found with that ID', 404));
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
