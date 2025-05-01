const winston = require('winston');

const Budget = require('../models/budgetModel');
const Category = require('../models/categoryModel');

const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

exports.getAllBudgets = catchAsync(async (req, res, next) => {
  logger.info('Fetching all budgets for user', { userId: req.user.id });

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
  logger.info('Fetching budget by ID', { budgetId: req.params.id });

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

exports.getBudgetsByCategory = catchAsync(async (req, res, next) => {
  logger.info('Fetching budgets by category', {
    userId: req.user.id,
    categoryId: req.params.categoryId,
  });

  const budgets = await Budget.findOne({
    user: req.user.id,
    category: req.params.categoryId,
  });

  if (!budgets) {
    return next(new AppError('No budgets found for this category', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      budgets,
    },
  });
});

exports.createBudget = catchAsync(async (req, res, next) => {
  logger.info('Creating a new budget', {
    userId: req.user.id,
    category: req.body.category,
  });

  const { limit, category } = req.body;

  // check the user already have a budget for the category
  const existingBudget = await Budget.findOne({
    user: req.user.id,
    category: category,
  });

  if (existingBudget) {
    return next(
      new AppError('User already have a budget for the category', 400),
    );
  }

  // fetch the category
  const existingCategory = await Category.findOne({
    _id: category,
    user: req.user.id,
  });

  if (!existingCategory) {
    return next(new AppError('No category found with that ID', 404));
  }

  if (existingCategory.type === 'income') {
    return next(new AppError('Cannot create budget for income category', 400));
  }

  const newBudget = await Budget.create({
    limit,
    remainingLimit: limit,
    category,
    user: req.user.id,
  });

  // set the category to onTrack
  existingCategory.onTrack = true;
  existingCategory.updatedAt = Date.now();
  await existingCategory.save();

  res.status(201).json({
    status: 'success',
    data: {
      budget: newBudget,
    },
  });
});

exports.updateBudget = catchAsync(async (req, res, next) => {
  // 1. Find the existing budget
  const existingBudget = await Budget.findById(req.params.id);

  if (!existingBudget) {
    return next(new AppError('No budget found for this category', 404));
  }

  // 3. Prevent category changes
  if (
    req.body.category &&
    req.body.category !== existingBudget.category.toString()
  ) {
    return next(
      new AppError(
        'Cannot change the budget category. Create a new budget instead.',
        400,
      ),
    );
  }

  // 4. Handle limit updates
  if (req.body.limit !== undefined) {
    // 4a. Validate new limit is positive
    if (req.body.limit < 0) {
      return next(new AppError('Budget limit cannot be negative', 400));
    }

    // 4b. Calculate difference between new and old limit
    const limitDifference = req.body.limit - existingBudget.limit;

    // 4c. If decreasing the limit
    if (limitDifference < 0) {
      // Check if new limit would be less than already spent amount
      const spentAmount = existingBudget.limit - existingBudget.remainingLimit;
      if (req.body.limit < spentAmount) {
        return next(
          new AppError(
            `Cannot reduce limit below already spent amount (${spentAmount})`,
            400,
          ),
        );
      }
    }

    // 4d. Update both limit and remainingLimit
    existingBudget.limit = req.body.limit;
    existingBudget.remainingLimit += limitDifference;
  }

  // 5. Save the updated budget
  existingBudget.updatedAt = Date.now();
  await existingBudget.save();

  // 6. Send response
  res.status(200).json({
    status: 'success',
    data: {
      budget: existingBudget,
    },
  });
});

exports.deleteBudget = catchAsync(async (req, res, next) => {
  const budget = await Budget.findByIdAndDelete(req.params.id);

  if (!budget) {
    return next(new AppError('No budget found with that ID', 404));
  }

  // Check if the budget is associated with a category
  const category = await Category.findById(budget.category);

  if (category) {
    // If the category is associated with the budget, set onTrack to false
    category.onTrack = false;
    await category.save();
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});
