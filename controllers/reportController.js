const mongoose = require('mongoose');
const Transaction = require('../models/transactionModel');
const Category = require('../models/categoryModel');
const Goal = require('../models/goalModel');

const catchAsync = require('../utils/catchAsync');

exports.generateReport = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return next(new AppError('startDate and endDate are required', 400));
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // 1. Total income and expense
  const incomeExpense = await Transaction.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        date: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: '$transactionType',
        total: { $sum: '$amount' },
      },
    },
  ]);

  let totalIncome = 0;
  let totalExpense = 0;
  incomeExpense.forEach((item) => {
    if (item._id === 'income') totalIncome = item.total;
    if (item._id === 'expense') totalExpense = item.total;
  });

  // 2. Top 5 expense categories
  const topCategories = await Transaction.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        transactionType: 'expense',
        date: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: '$category',
        totalSpent: { $sum: '$amount' },
      },
    },
    { $sort: { totalSpent: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: '$category' },
    {
      $project: {
        name: '$category.name',
        totalSpent: 1,
      },
    },
  ]);

  // 3. Goals progress
  const goals = await Goal.find({ user: userId });
  const goalProgress = goals.map((goal) => {
    const progress =
      ((goal.totalAmount - (goal.balance || 0)) / goal.totalAmount) * 100;
    return {
      name: goal.name,
      progress: Number(progress.toFixed(2)),
    };
  });

  // 4. Transactions over time (daily)
  const timeline = await Transaction.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        date: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: {
          day: { $dayOfMonth: '$date' },
          month: { $month: '$date' },
          year: { $year: '$date' },
          type: '$transactionType',
        },
        total: { $sum: '$amount' },
      },
    },
    {
      $group: {
        _id: { day: '$_id.day', month: '$_id.month', year: '$_id.year' },
        types: {
          $push: { type: '$_id.type', total: '$total' },
        },
      },
    },
  ]);

  const transactionsOverTime = timeline.map((entry) => {
    const date = `${entry._id.year}-${String(entry._id.month).padStart(2, '0')}-${String(entry._id.day).padStart(2, '0')}`;
    const income = entry.types.find((t) => t.type === 'income')?.total || 0;
    const expense = entry.types.find((t) => t.type === 'expense')?.total || 0;
    return { date, income, expense };
  });

  // Response
  res.status(200).json({
    totalIncome,
    totalExpense,
    netSavings: totalIncome - totalExpense,
    topExpenseCategories: topCategories,
    goalProgress,
    transactionsOverTime,
  });
});
