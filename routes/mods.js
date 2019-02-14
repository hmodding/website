var express = require('express');
var router = express.Router();
var fs = require('fs');
var showdown = require('showdown');
var xssFilter = require('showdown-xss-filter');
var markdownConverter = new showdown.Converter({extensions: [xssFilter]});
var querystring = require('querystring');
var multer = require('multer');
var upload = multer({storage: multer.memoryStorage()});
var path = require('path');
var Mod = require('../models/mod');

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
    Mod.findAll().then(mods => {
        res.render('mods', {title: 'Mods', mods: mods});
    }).catch(err => {
        res.error('An error occurred.');
        console.error('An error occurred while querying the database for mods:');
        console.error(err);
    });
});
router.route('/add')
    .get(requireLogin, (req, res) => {
        res.render('addmod', {title: 'Add a mod'});
    })
    .post(requireLogin, upload.single('file'), (req, res) => {
        var mod = {
            id: req.body.id,
            title: req.body.title,
            description: req.body.description,
            category: req.body.category,
            version: req.body.version,
            readme: req.body.readme,
            author: req.session.user,
            downloadUrl: req.body.downloadUrl || req.file
        };
        if (!mod.id || mod.id === ''
                || !mod.title
                || !mod.description
                || !mod.category
                || !mod.version
                || !mod.readme
                || !mod.author
                || !mod.downloadUrl) {
            res.render('addmod', {
                title: 'Add a mod',
                error: 'All fields of this form need to be filled to submit a mod.',
                formContents: req.body
            });
        } else if (!/^[a-zA-Z1-9]+$/.test(mod.id)) {
            res.render('addmod', {
                title: 'Add a mod',
                error: 'The ID can only contain letters and numbers!',
                formContents: req.body
            });
        } else if (mod.id.length > 64) {
            res.render('addmod', {
                title: 'Add a mod',
                error: 'The ID can not be longer than 64 characters!',
                formContents: req.body
            });
        } else if (mod.title.length > 255) {
            res.render('addmod', {
                title: 'Add a mod',
                error: 'The title can not be longer than 255 characters!',
                formContents: req.body
            });
        } else if (mod.description.length > 255) {
            res.render('addmod', {
                title: 'Add a mod',
                error: 'The description can not be longer than 255 characters! ' +
                    'Please use the readme section for longer explanations.',
                formContents: req.body
            });
        } else if (mod.version.length > 64) {
            res.render('addmod', {
                title: 'Add a mod',
                error: 'The version can not be longer than 255 characters!',
                formContents: req.body
            });
        } else {
            mod.id = mod.id.toLowerCase();
            mod.author = mod.author.username;
            if (req.file) {
                var dir = path.join('.', 'public', 'mods', mod.id, mod.version);
                console.log(dir);
                fs.mkdirSync(dir, {recursive: true});
                fs.writeFileSync(path.join(dir, req.file.originalname), req.file.buffer);
                mod.downloadUrl = '/mods/' + mod.id + '/' + mod.version + '/' + req.file.originalname;
            }
            Mod.create(mod)
                .then(mod => {
                    res.redirect('/mods/' + mod.id);
                }).catch(err => {
                    if (err.name === 'SequelizeUniqueConstraintError') {
                        res.render('addmod', {
                            title: 'Add a mod',
                            error: 'Sorry, but this ID is already taken. Please choose another one!',
                            formContents: req.body
                        });
                    } else {
                        res.render('addmod', {
                            title: 'Add a mod',
                            error: 'An error occurred.',
                            formContents: req.body
                        });
                        console.error('An error occurred while querying the database for mods:');
                        console.error(err);
                    }
                });

        }
    });
router.get('/:id', function (req, res, next) {
    Mod.findOne({where: {id: req.params.id}}).then(mod => {
        // render markdown readme
        mod.readmeMarkdown = markdownConverter.makeHtml(mod.readme.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        res.render('mod', {title: mod.title, mod: mod});
    }).catch(err => {
        res.render('error', {error: {status: 404}});
        console.error('An error occurred while querying the database for a mod:');
        console.error(err);
    });
});

module.exports = router;
