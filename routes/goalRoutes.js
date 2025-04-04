const express = require('express');

const goalController = require('../controllers/goalController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(authController.protect);

router
  .route('/')
  .get(goalController.getAllGoals)
  .post(goalController.createGoal);

router
  .route('/:id')
  .get(goalController.getGall)
  .patch(goalController.updateGoal)
  .delete(goalController.deleteGoal);

module.exports = router;
