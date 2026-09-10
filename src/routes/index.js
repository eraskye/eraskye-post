const express = require('express');
const apiRouter = require('./api');
const adminRouter = require('./admin');

const router = express.Router();
router.use('/api', apiRouter);
router.use('/admin', adminRouter);

module.exports = router;
