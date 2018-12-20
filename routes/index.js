var express = require('express');
var router = express.Router();
var fs = require('fs');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index');
});
router.get('/forum', function(req, res, next) {
  res.redirect('https://forum.raftmodding.com/');
});
router.get('/discord', function(req, res, next) {
  res.redirect('https://discord.gg/raft');
});
router.get('/docs', function(req, res, next) {
  res.redirect('https://docs.raftmodding.com/');
});
router.get('/download', function(req, res, next) {
  res.render('download', {versions: JSON.parse(fs.readFileSync('versions.json'))});
});

module.exports = router;
