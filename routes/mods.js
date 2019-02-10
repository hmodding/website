var express = require('express');
var router = express.Router();
var fs = require('fs');
var showdown = require('showdown');
var xssFilter = require('showdown-xss-filter');
var markdownConverter = new showdown.Converter({extensions: [xssFilter]});
var mods = JSON.parse(fs.readFileSync('mods.json'));
var querystring = require('querystring');

function getModById(id) {
    for (var i = 0; i < mods.length; i++) {
        if (mods[i].id.toLowerCase() === id.toLowerCase())
            return mods[i];
    }
    return null;
}

// account
var requireLogin = function(req, res, next) {
    if (req.session.user && req.cookies.user_sid) {
        next();
    } else {
        res.redirect('/signin?' + querystring.stringify({redirect: req.originalUrl}));
    }
};

/* GET mods listing */
router.get('/', function(req, res, next) {
    res.render('mods', {title: 'Mods', mods: mods});
});
router.route('/add')
    .get(requireLogin, (req, res) => {
        res.render('addmod', {title: 'Add a mod'});
    })
    .post(requireLogin, (req, res) => {
        var mod = {
            id: req.body.id,
            title: req.body.title,
            description: req.body.description,
            category: req.body.category,
            version: req.body.version,
            readme: req.body.readme,
            author: req.session.user
        };
        if (!mod.id || mod.id === ''
                || !mod.title
                || !mod.description
                || !mod.category
                || !mod.version
                || !mod.readme
                || !mod.author) {
            res.render('addmod', {
                title: 'Add a mod',
                error: 'All fields of this form need to be filled to submit a mod.',
                formContents: mod
            });
        } else if (!/^[a-zA-Z1-9]+$/.test(mod.id)) {
            res.render('addmod', {
                title: 'Add a mod',
                error: 'The ID can only contain letters and numbers!',
                formContents: mod
            });
        } else if (getModById(mod.id.toLowerCase()) !== null) {
            res.render('addmod', {
                title: 'Add a mod',
                error: 'Sorry, but this ID is already taken. Please choose another one!',
                formContents: mod
            });
        } else {
            mod.id = mod.id.toLowerCase();
            mods.push(mod);
            fs.writeFileSync('mods.json', JSON.stringify(mods));
            res.redirect('/mods/' + mod.id);
        }
    });
router.get('/:id', function (req, res, next) {
    var mod = getModById(req.params.id);
    if (mod === null)
        res.render('error', {error: {status: 404}});
    else {
        // render markdown readme
        mod.readmeMarkdown = markdownConverter.makeHtml(mod.readme.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        res.render('mod', {title: mod.title, mod: mod});
    }
});

module.exports = router;
