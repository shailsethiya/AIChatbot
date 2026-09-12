const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { register, login, me } = require('../controllers/authController');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many auth attempts, please try again later.' },
});

router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().isLength({ min: 2, max: 60 }).withMessage('name 2-60 chars'),
    body('email').isEmail().normalizeEmail().withMessage('valid email required'),
    body('password').isLength({ min: 6, max: 128 }).withMessage('password 6-128 chars'),
  ],
  validate,
  register
);

router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isString().notEmpty(),
  ],
  validate,
  login
);

router.get('/me', auth, me);

module.exports = router;
