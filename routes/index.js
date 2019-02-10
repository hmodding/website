var express = require('express');
var router = express.Router();
var fs = require('fs');
var User = require('../models/user');

router.get('/', (req, res) => {
    res.render('index', {title: 'Home'});
});
router.get('/download', function(req, res, next) {
    res.render('download', {title: 'Download', versions: JSON.parse(fs.readFileSync('versions.json'))});
});

// account pages
var redirectIfLoggedIn = function(req, res, next) {
    if (req.session.user && req.cookies.user_sid) {
        res.redirect(req.body.redirect || req.query.redirect || '/');
    } else {
        next();
    }
};
router.route('/signin')
    .get(redirectIfLoggedIn, (req, res, next) => {
        res.render('signin', {title: 'Sign in', redirect: req.query.redirect});
    })
    .post((req, res) => {
        var username = req.body.username,
            password = req.body.password;

        User.findOne({ where: { username: username } }).then(function (user) {
            if (!user || !user.validPassword(password)) {
                res.render('signin', {title: 'Sign in', error: "Sorry, these login details don't seem to be correct."});
            } else {
                req.session.user = user.dataValues;
                res.redirect(req.body.redirect ? req.body.redirect : '/');
            }
        });
    });
router.route('/signup')
    .get(redirectIfLoggedIn, (req, res, next) => {
        res.render('signup', {title: 'Sign up'});
    })
    .post((req, res) => {
        User.create({
            username: req.body.username,
            email: req.body.email,
            password: req.body.password
        })
            .then(user => {
                console.log('User ' + user.username + ' was created.');
                req.session.user = user.dataValues;
                res.redirect('/');
            })
            .catch(err => {
                let message = 'An unknown error occurred. Please try again later.';
                if (err.name === 'SequelizeUniqueConstraintError') {
                    message = 'Sorry, but this username or mail address is already taken. Please pick another one.';
                } else {
                    console.error('Unexpected error while creating user: ', err);
                }
                res.render('signup', {title: 'Sign up', error: message});
            });
    });
router.get('/forgotpassword', function (req, res, next) {
    res.render('forgotpassword', {title: 'Forgot password'});
});
router.get('/logout', (req, res) => {
    if (req.session.user && req.cookies.user_sid) {
        res.clearCookie('user_sid');
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
});

// redirects
function redirect(path, link) {
    router.get(path, function (req, res, next) {
        res.redirect(link);
    });
}
redirect('/forum', 'https://forum.raftmodding.com/');
redirect('/discord', 'https://discord.gg/raft');
redirect('/docs', 'https://docs.raftmodding.com/');

module.exports = router;
