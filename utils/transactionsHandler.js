const cron = require('node-cron');
const AppError = require('./appError');
const catchAsync = require('./catchAsync');

const Transaction = require('../models/transactionModel');
const Account = require('../models/accountModel');

const { trackBudgetLimit } = require('../utils/budgetHandler');

const processPendingTransactions = async () => {
  try {
    let today = new Date();

    // Find all pending transactions where date has arrived
    const pendingTransactions = await Transaction.find({
      transactionStatus: 'pending',
      date: { $lte: today },
    });

    for (let transaction of pendingTransactions) {
      let account = await Account.findById(transaction.account);

      console.log(`Processing transaction ${transaction._id}`);

      // If account doesn't exist
      if (!account) {
        transaction.transactionStatus = 'failed';
        await transaction.save();
        console.log(`Transaction ${transaction._id} failed: Account not found`);
        continue;
      }

      // Track budget limit
      const budgetLimit = await trackBudgetLimit(
        transaction.user,
        transaction.category,
        transaction.amount,
      );

      if (budgetLimit.exceeded === false && budgetLimit.alert === 'success') {
        // Process transactions
        if (transaction.transactionType === 'income') {
          account.balance += transaction.amount;
          transaction.transactionStatus = 'completed';
        } else if (transaction.transactionType === 'expense') {
          if (account.balance < transaction.amount) {
            transaction.transactionStatus = 'failed';
            console.log(
              `Transaction ${transaction._id} failed: Insufficient balance`,
            );
            await transaction.save();
            continue; // Skip further processing
          }

          account.balance -= transaction.amount; // Deduct only for successful expenses
          transaction.transactionStatus = 'completed';
        }
      } else {
        console.log(`Budget limit exceeded for user ${transaction.user}`);
        transaction.transactionStatus = 'failed';
        await transaction.save();
        continue; // Skip further processing
      }

      // Save only if the transaction was successful
      await account.save();
      await transaction.save();

      console.log(
        `Transaction ${transaction._id} processed: ${transaction.transactionStatus}`,
      );
    }
  } catch (error) {
    console.error('❌ Error processing pending transactions:', error);
  }
};

const processRecurringTransactions = async () => {
  try {
    let today = new Date();

    // Find all recurring transactions
    const recurringTransactions = await Transaction.find({
      isRecurring: true,
      nextRecurringDate: { $lte: today },
    });

    for (let transaction of recurringTransactions) {
      let account = await Account.findById(transaction.account);

      // Budget limit check for expense transactions
      if (transaction.transactionType === 'expense') {
        const budgetLimit = await trackBudgetLimit(
          transaction.user,
          transaction.category,
          transaction.amount,
        );

        if (budgetLimit.exceeded === true) {
          console.log(
            `Skipping transaction ${transaction._id} - Budget limit exceeded`,
          );
          continue;
        }

        // Check if the account has enough balance
        if (!account || account.balance < transaction.amount) {
          console.log(
            `Skipping transaction ${transaction._id} - Insufficient balance`,
          );
          continue;
        }

        account.balance -= transaction.amount; // Deduct balance only if valid
      } else if (transaction.transactionType === 'income') {
        account.balance += transaction.amount;
      }

      // Save account details
      await account.save();

      // Create a new actual transaction
      await Transaction.create({
        user: transaction.user,
        transactionType: transaction.transactionType,
        amount: transaction.amount,
        account: transaction.account,
        description: transaction.description,
        date: today,
        category: transaction.category,
        transactionStatus: 'completed',
      });

      // Calculate the next recurring date
      let nextRecurringDate = new Date(today);
      switch (transaction.recurringInterval) {
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

      // Update the transaction with the next recurring date
      await Transaction.findByIdAndUpdate(transaction._id, {
        nextRecurringDate,
      });

      console.log(
        `Recurring transaction ${transaction._id} processed successfully.`,
      );
    }
  } catch (error) {
    console.error('❌ Error processing recurring transactions:', error);
  }
};

// Schedule cron jobs
module.exports = {
  processPendingTransactions,
  processRecurringTransactions,
};
