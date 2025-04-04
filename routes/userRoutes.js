const express = require('express');

const authController = require('../controllers/authController');
const userController = require('../controllers/userController');

const router = express.Router();

router.post('/signup', authController.signUp);
router.route('/login').post(authController.signIn);
router.post('/google', authController.signInWithGoogle);

router.use(authController.protect);
router.route('/me').get(userController.getMe);
router.route('/updateMe').patch(userController.updateMe);
router.route('/deleteMe').patch(userController.deleteMe);

module.exports = router;
