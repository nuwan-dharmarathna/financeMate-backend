const express = require('express');

const accountController = require('../controllers/accountContraller');
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
  .patch(accountController.updateAccount);
// .delete(accountController.deleteAccount);

module.exports = router;
