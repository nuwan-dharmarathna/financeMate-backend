const express = require('express');

const budgetController = require('../controllers/budgetController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(authController.protect);

router
  .route('/')
  .get(budgetController.getAllBudgets)
  .post(budgetController.createBudget);

router
  .route('/:id')
  .get(budgetController.getBudget)
  .patch(budgetController.updateBudget)
  .delete(budgetController.deleteBudget);

module.exports = router;