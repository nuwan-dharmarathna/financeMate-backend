const express = require('express');

const accountController = require('../controllers/accountController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(authController.protect);

router
  .route('/')
  .get(accountController.getAllAccounts)
  .post(accountController.createAccount);

router
  .route('/:id')
  .get(accountController.getAccount)
  .patch(accountController.updateAccount)
  .delete(accountController.deleteAccount);

// get transactions of the account
router
  .route('/:id/transactions')
  .get(accountController.getTransactionsOfAccount);

module.exports = router;
