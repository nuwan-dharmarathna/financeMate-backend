const mongoose = require('mongoose');

const Budget = require('../models/budgetModel');

//const Transaction = require('../models/transactionModel');

exports.trackBudgetLimit = async function (user, transactionAmount) {
  console.log('Tracking budget limit');
  try {
    const budget = await Budget.findOne({
      user: user,
    });

    if (!budget) {
      console.log('No budget found');
      return { exceeded: false, alert: null };
    }

    // Calculate total spending
    const totalSpent = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(user),
          transactionStatus: 'completed',
          transactionType: 'expense',
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    console.log('Total spent:', totalSpent);

    const spentAmount = totalSpent.length > 0 ? totalSpent[0].totalAmount : 0;
    const newTotal = spentAmount + transactionAmount;



    if (newTotal > budget.limit) {
      console.log('Budget limit exceeded');
      return {
        exceeded: true,
        alert: 'Your budget limit has been exceeded! You cannot ',
      };
    } else if (newTotal >= budget.limit * 0.9) {
      console.log('You are near to exceed your budget limit');
      return { exceeded: false, alert: 'You are about to exceed your budget!' };
    }

    return { exceeded: false, alert: null };
  } catch (err) {
    console.log(err);
    return { exceeded: false, alert: null };
  }
};