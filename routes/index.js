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
router.get('/signin', function (req, res, next) {
    res.render('signin');
});
router.post('/signin', function(req, res, next) {
    // check and redirect
    var loginCorrect = false;
    if (loginCorrect)
        res.redirect(req.param);
    else
        res.render('signin');
});
router.get('/signup', function (req, res, next) {
    res.render('signup');
});
router.post('/signup', function (req, res, next) {
    // check and redirect
    var registrationSuccessful = false;
    if (registrationSuccessful)
        res.redirect(req.param);
    else
        res.render('signup');
});
router.get('/forgotpassword', function (req, res, next) {
    res.render('forgotpassword');
});

module.exports = router;
