const Goal = require('../models/goalModel');
const Transaction = require('../models/transactionModel');
const Account = require('../models/accountModel');

const processPendingGoals = async () => {
  try {
    let today = new Date();

    // Find all pending goals where date has arrived
    const pendingGoals = await Goal.find({
      goalStatus: 'pending',
      date: { $lte: today },
    });

    for (let goal of pendingGoals) {
      let account = await Account.findById(goal.account);

      // If account doesn't exist,
      if (!account) {
        console.log(`Goal ${goal._id} failed: Account not found`);
        continue;
      }

      console.log(`Processing goal ${goal._id}`);

      if (goal.noOfInstallments > goal.currentInstallment) {
        goal.balance -= goal.contributionAmount;
        goal.currentInstallment += 1;

        let amountToReturn = goal.contributionAmount;

        if (goal.balance < 0) {
          amountToReturn = goal.contributionAmount - goal.balance * -1;
        }

        // process goals
        if (account.balance < amountToReturn) {
          console.log(`Goal ${goal._id} failed: Insufficient balance`);
          continue;
        }

        if (
          goal.noOfInstallments === goal.currentInstallment ||
          goal.balance < 0
        ) {
          goal.balance = 0;
          goal.goalStatus = 'completed';
        }

        account.balance -= amountToReturn;

        //   set the next installment date
        let nextInstallmentDate = new Date(today);
        switch (goal.contributionInterval) {
          case 'daily':
            nextInstallmentDate.setDate(nextInstallmentDate.getDate() + 1);
            break;
          case 'weekly':
            nextInstallmentDate.setDate(nextInstallmentDate.getDate() + 7);
            break;
          case 'monthly':
            nextInstallmentDate.setMonth(nextInstallmentDate.getMonth() + 1);
            break;
          default:
            console.warn(
              `Unknown contribution interval: ${goal.contributionInterval}`,
            );
        }

        goal.nextInstallmentDate = nextInstallmentDate;

        // Save account and goal
        await account.save();
        await goal.save();

        //   create a new Transaction
        await Transaction.create({
          user: goal.user,
          account: account.id,
          amount: amountToReturn,
          category: 'Savings',
          transactionType: 'expense',
          description: `Contribution for goal: ${goal.name}`,
          transactionStatus: 'completed',
        });

        console.log(`Goal ${goal._id} processed successfully`);
      }
    }
  } catch (err) {
    console.error('Error processing pending goals: ', err);
  }
};

module.exports = processPendingGoals;
