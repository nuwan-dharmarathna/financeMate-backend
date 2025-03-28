const Budget = require('../models/budgetModel');

const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getAllBudgets = catchAsync(async (req, res, next) => {
  const budgets = await Budget.find({
    user: req.user.id,
  });

  res.status(200).json({
    status: 'success',
    results: budgets.length,
    data: {
      budgets,
    },
  });
});

exports.getBudget = catchAsync(async (req, res, next) => {
  const budget = await Budget.findById(req.params.id);

  if (!budget) {
    return next(new AppError('No budget found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      budget,
    },
  });
});

exports.createBudget = catchAsync(async (req, res, next) => {
  // check the user have already created a budget
  const budgets = await Budget.find({
    user: req.user.id,
  });

  if (budgets.length !== 0) {
    return next(new AppError('User already have a budget', 400));
  }

  const newBudget = await Budget.create({
    ...req.body,
    user: req.user.id,
  });

  res.status(201).json({
    status: 'success',
    data: {
      budget: newBudget,
    },
  });
});

exports.updateBudget = catchAsync(async (req, res, next) => {
  const budget = await Budget.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!budget) {
    return next(new AppError('No budget found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      budget,
    },
  });
});

exports.deleteBudget = catchAsync(async (req, res, next) => {
  const budget = await Budget.findByIdAndDelete(req.params.id);

  if (!budget) {
    return next(new AppError('No budget found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});