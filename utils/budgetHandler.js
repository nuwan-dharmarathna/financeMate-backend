const mongoose = require('mongoose');

const Budget = require('../models/budgetModel');
const Category = require('../models/categoryModel');

exports.trackBudgetLimit = async function (user, category, transactionAmount) {
  console.log('Tracking budget limit for category');
  try {
    // Check if the category exists
    const categoryExists = await Category.findOne({
      user: user,
      _id: category,
    });

    if (!categoryExists) {
      console.log('Category not found');
      return { exceeded: false, alert: 'Category not found' };
    }

    // Check if the budget exists for the user and category
    const budget = await Budget.findOne({
      user: user,
      category: categoryExists._id,
    });

    if (!budget) {
      console.log('No budget found for this category');
      return { exceeded: false, alert: 'No budget for selected category' };
    }

    // get the category type
    if (categoryExists.type === 'income') {
      console.log('Category type is income');
      return { exceeded: false, alert: 'Cannot update income budgets' };
    } else {
      // remaining limit
      const remainingLimit = budget.remainingLimit;
      console.log(
        `Remaining limit of the category [${categoryExists.name}] : ${remainingLimit}`,
      );

      console.log('Category type is expense');
      // check if the transaction amount is less than the remaining limit
      if (transactionAmount > remainingLimit) {
        console.log('Transaction amount is greater than remaining limit');
        return {
          exceeded: true,
          alert: 'Your budget limit has been exceeded!',
        };
      } else if (transactionAmount >= remainingLimit * 0.9) {
        console.log(`Your ${categoryExists.name} budget is about to exceed!`);

        // reduce the remaining limit
        const newRemainingLimit = remainingLimit - transactionAmount;
        budget.remainingLimit = newRemainingLimit;
        await budget.save();

        return {
          exceeded: false,
          alert: 'success',
        };
      } else {
        console.log('Transaction amount is within the remaining limit');

        // reduce the remaining limit
        const newRemainingLimit = remainingLimit - transactionAmount;
        budget.remainingLimit = newRemainingLimit;
        await budget.save();

        return { exceeded: false, alert: 'success' };
      }
    }
  } catch (err) {
    console.log(err);
    return { exceeded: false, alert: err.message };
  }
};
