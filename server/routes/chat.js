const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  listChats,
  getChat,
  createChat,
  deleteChat,
  renameChat,
  sendMessage,
  streamMessage,
} = require('../controllers/chatController');

const router = express.Router();

router.use(auth);

const idRule = param('id').isMongoId().withMessage('invalid chat id');
const msgRule = body('message').isString().trim().isLength({ min: 1, max: 8000 });

router.get('/', listChats);
router.post('/', createChat);
router.get('/:id', idRule, validate, getChat);
router.delete('/:id', idRule, validate, deleteChat);
router.patch(
  '/:id',
  idRule,
  body('title').isString().trim().isLength({ min: 1, max: 120 }),
  validate,
  renameChat
);

router.post('/message', msgRule, validate, sendMessage);
router.post('/:id/message', idRule, msgRule, validate, sendMessage);

// SSE streaming endpoints
router.post('/stream', msgRule, validate, streamMessage);
router.post('/:id/stream', idRule, msgRule, validate, streamMessage);

module.exports = router;
