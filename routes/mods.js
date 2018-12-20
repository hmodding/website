var express = require('express');
var router = express.Router();

/* GET mods listing */
router.get('/', function(req, res, next) {
  res.render('mods');
});

module.exports = router;
