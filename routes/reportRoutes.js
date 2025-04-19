const express = require('express');

const reportController = require('../controllers/reportController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(authController.protect);

router.route('/').get(reportController.generateReport);

module.exports = router;
