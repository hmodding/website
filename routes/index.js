var express = require('express');
var router = express.Router();
var fs = require('fs');
var User = require('../models/user');
var querystring = require('querystring');
var versions = JSON.parse(fs.readFileSync('versions.json'));
var showdown = require('showdown');
var xssFilter = require('showdown-xss-filter');
var markdownConverter = new showdown.Converter({extensions: [xssFilter]});

router.use((req, res, next) => {
    res.locals.loggedIn = req.session.user && req.cookies.user_sid;
    next();
});

router.get('/', (req, res) => {
    res.render('index', {title: 'Home'});
});
router.get('/download', function(req, res, next) {
    res.render('download', {title: 'Download', versions: versions});
});
router.get('/loader/:version', (req, res, next) => {
    var version = null;
    for (var i = 0; i < versions.length; i++) {
        if (versions[i].rmlVersion === req.params.version) {
            version = versions[i];
        }
    }
    if (version === null) {
        next();
    } else {
        // render markdown changelog
        if (!version.readme)
            version.readme = `# Changelog for RaftModLoader version ${version.rmlVersion}\n*No changelog was attached to this release.*`;
        version.readmeMarkdown = markdownConverter.makeHtml(version.readme.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        res.render('modloader-release', {title: `Download version ${req.params.version}`, version: version});
    }
});

// account pages
var redirectIfLoggedIn = function(req, res, next) {
    if (res.locals.loggedIn) {
        res.redirect(req.query.redirect || '/');
    } else {
        next();
    }
};
router.route('/signin')
    .get(redirectIfLoggedIn, (req, res, next) => {
        res.render('signin', {title: 'Sign in', redirectQuery: querystring.stringify({redirect: req.query.redirect})});
    })
    .post((req, res) => {
        var username = req.body.username,
            password = req.body.password;

        User.findOne({ where: { username: username } }).then(function (user) {
            if (!user || !user.validPassword(password)) {
                res.render('signin', {
                    title: 'Sign in',
                    error: "Sorry, these login details don't seem to be correct.",
                    redirectQuery: querystring.stringify({redirect: req.query.redirect})
                });
            } else {
                req.session.user = user.dataValues;
                res.redirect(req.query.redirect ||  '/');
            }
        });
    });
router.route('/signup')
    .get(redirectIfLoggedIn, (req, res, next) => {
        res.render('signup', {title: 'Sign up', redirectQuery: querystring.stringify({redirect: req.query.redirect})});
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
                res.redirect(req.query.redirect ||  '/');
            })
            .catch(err => {
                let message = 'An unknown error occurred. Please try again later.';
                if (err.name === 'SequelizeUniqueConstraintError') {
                    message = 'Sorry, but this username or mail address is already taken. Please pick another one.';
                } else {
                    console.error('Unexpected error while creating user: ', err);
                }
                res.render('signup', {title: 'Sign up', error: message, redirectQuery: querystring.stringify({redirect: req.query.redirect})});
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
redirect('/forum', 'https://www.raftmodding.com/forum/');
redirect('/discord', 'https://discord.gg/raft');
redirect('/docs', 'https://www.raftmodding.com/api/');

module.exports = router;
