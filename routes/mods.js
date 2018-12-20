var express = require('express');
var router = express.Router();

/* GET mods listing */
router.get('/', function(req, res, next) {
  res.render('mods');
});
router.get('/:id', function (req, res, next) {
  var mod = {
    id: req.id,
    title: 'Mod Title',
    description: 'This is a mod about whatever and something else, that has a long description.',
    readme: 'asdf',
    category: 'Utility',
    version: '1.0',
    author: 'traxam'
  };
  res.render('mod', {mod: mod});
});

module.exports = router;
