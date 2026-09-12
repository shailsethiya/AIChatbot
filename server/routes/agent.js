const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { streamAgent } = require('../controllers/agentController');

const router = express.Router();

router.use(auth);

router.post(
  '/stream',
  body('message').isString().trim().isLength({ min: 1, max: 4000 }),
  validate,
  streamAgent
);

module.exports = router;
