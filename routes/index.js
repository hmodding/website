'use strict';
var express = require('express');
var router = express.Router();
var fs = require('fs');
var User = require('../models/user');
var UserPrivileges = require('../models/userPrivilege');
var querystring = require('querystring');
var showdown = require('showdown');
var xssFilter = require('showdown-xss-filter');
var markdownConverter = new showdown.Converter({extensions: [xssFilter]});
var LoaderVersion = require('../models/loaderVersion');
var multer = require('multer');
var upload = multer({storage: multer.memoryStorage()});
var path = require('path');

// account
var requireLogin = function(req, res, next) {
  if (req.session.user && req.cookies.user_sid) {
    next();
  } else {
    res.redirect('/signin?' + querystring.stringify({
      redirect: req.originalUrl,
    }));
  }
};

var requireAdmin = function(req, res, next) {
  if (res.locals.userIsAdmin) {
    next();
  } else {
    res.status(403);
    res.render('error', {error: {status: 403}});
  }
};

router.use((req, res, next) => {
  res.locals.loggedIn = req.session.user && req.cookies.user_sid;
  if (res.locals.loggedIn) {
    UserPrivileges.findOne({where: {username: req.session.user.username}})
      .then(privileges => {
        res.locals.userIsAdmin = privileges != null &&
            privileges.role != null && privileges.role === 'admin';
        next();
      }).catch(err => {
        res.locals.userIsAdmin = false;
        console.error('Could not query user privileges for user ' +
            req.session.user, err);
        next();
      });
  } else {
    next();
  }
});

router.get('/', (req, res) => {
  res.render('index', {title: 'Home'});
});
router.get('/download', function(req, res, next) {
  LoaderVersion.findAll().then(versions => {
    res.render('download', {title: 'Download', versions: versions});
  }).catch(err => {
    res.error('An error occurred.');
    console.error('An error occurred while querying the database for loader ' +
        'versions:');
    console.error(err);
  });
});
router.route('/loader/add')
  .get(requireLogin, requireAdmin, (req, res) => {
    res.render('add-modloader-release', {title: 'Add loader version'});
  })
  .post(requireLogin, requireAdmin, upload.single('file'), (req, res) => {
    var version = {
      rmlVersion: req.body.rmlVersion,
      raftVersion: req.body.raftVersion,
      readme: req.body.readme,
      downloadUrl: req.body.downloadUrl || req.file,
      timestamp: new Date(),
    };
    if (!version.rmlVersion || version.rmlVersion === ''
                || !version.raftVersion
                || !version.readme
                || !version.downloadUrl) {
      res.render('add-modloader-release', {
        title: 'Add loader version',
        error: 'All fields of this form need to be filled to submit a loader ' +
            'version.',
        formContents: req.body,
      });
    } else if (!/^[a-zA-Z1-9]+$/.test(version.rmlVersion)) {
      res.render('add-modloader-release', {
        title: 'Add loader version',
        error: 'The version of the mod loader can only contain letters and ' +
            'numbers!',
        formContents: req.body,
      });
    } else if (version.rmlVersion.length > 64) {
      res.render('add-modloader-release', {
        title: 'Add loader version',
        error: 'The version of the mod loader can not be longer than 64 ' +
            'characters!',
        formContents: req.body,
      });
    } else if (version.raftVersion.length > 255) {
      res.render('add-modloader-release', {
        title: 'Add loader version',
        error: 'The raft version can not be longer than 255 characters!',
        formContents: req.body,
      });
    } else {
      version.rmlVersion = version.rmlVersion.toLowerCase();
      if (req.file) {
        // save file
        version.downloadUrl = '/loader/' + version.rmlVersion + '/' +
            req.file.originalname;
        var dir = path.join('.', 'public', 'loader', version.rmlVersion);
        fs.mkdirSync(dir, {recursive: true});
        fs.writeFileSync(path.join(dir, req.file.originalname),
          req.file.buffer);
        console.log(`File ${req.file.filename} (${version.downloadUrl}) ' +
            'was saved to disk at ${path.resolve(dir)}.`);

        // start scan for viruses
        scanFile(req.file.buffer, req.file.originalname, version.downloadUrl);
      }
      LoaderVersion.create(version)
        .then(version => {
          res.redirect('/loader/' + version.rmlVersion);
        })
        .catch(err => {
          if (err.name === 'SequelizeUniqueConstraintError') {
            res.render('add-modloader-release', {
              title: 'Add loader version',
              error: 'Sorry, but this mod loader version is already taken. ' +
                'Please choose another one!',
              formContents: req.body,
            });
          } else {
            res.render('add-modloader-release', {
              title: 'Add loader version',
              error: 'An error occurred.',
              formContents: req.body,
            });
            console.error(`An error occurred while creating database entry ' +
                'for loader version ${version.rmlVersion}:`, err);
          }
        });
    }
  });
router.get('/loader/:version', (req, res, next) => {
  LoaderVersion.findOne({where: {rmlVersion: req.params.version}})
    .then(version => {
      if (version === null) {
        next();
      } else {
      // render markdown changelog
        if (!version.readme)
          version.readme = '# Changelog for RaftModLoader version ' +
            `${version.rmlVersion}\n*No changelog was attached to this ` +
            'release.*';
        version.readmeMarkdown = markdownConverter.makeHtml(
          // replace all < and > in readme file to avoid html tags
          version.readme.replace(/</g, '&lt;').replace(/>/g, '&gt;')
        );
        res.render('modloader-release', {title: 'Download version ' +
            req.params.version, version: version});
      }
    }).catch(err => {
      res.render('error', {error: {status: 404}});
      console.error('An error occurred while querying the database for a mod:');
      console.error(err);
    });
});
router.route('/loader/:version/edit')
  .get(requireLogin, requireAdmin, (req, res, next) => {
    LoaderVersion.findOne({where: {rmlVersion: req.params.version}})
      .then(version => {
        if (version === null) {
          next();
        } else {
          res.render('edit-modloader-release', {title: 'Edit ' +
            version.rmlVersion, version: version, formContents: version});
        }
      }).catch(err => {
        res.render('error', {error: {status: 404}});
        console.error('An error occurred while querying the database for a ' +
            'loader version:');
        console.error(err);
      });
  })
  .post(requireLogin, requireAdmin, (req, res, next) => {
    LoaderVersion.findOne({where: {rmlVersion: req.params.version}})
      .then(version => {
        if (version === null) {
          next();
        } else {
          var versionUpdate = {
            readme: req.body.readme,
          };
          if (!versionUpdate.readme) {
            res.render('edit-modloader-release', {
              title: 'Edit ' + version.rmlVersion,
              error: 'All fields of this form need to be filled to submit ' +
                'changes to a mod.',
              formContents: req.body,
              version: version,
            });
          } else {
            LoaderVersion.update(versionUpdate, {where: {
              rmlVersion: version.rmlVersion,
            }}) // save changes to db
              .then(() => {
                console.log(`Loader version ${version.rmlVersion} was updated' +
                    ' by user ${req.session.user.username}`);
                res.redirect('/loader/' + version.rmlVersion);
              })
              .catch(err => {
                console.error(`Could not save loader version changes for ' +
                    'version ${version.rmlVersion}:`, err);
              });
          }
        }
      }).catch(err => {
        res.render('error', {error: {status: 404}});
        console.error('An error occurred while querying the database for a ' +
            'loader version:');
        console.error(err);
      });
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
    res.render('signin', {
      title: 'Sign in',
      redirectQuery: querystring.stringify({redirect: req.query.redirect})});
  })
  .post((req, res) => {
    var username = req.body.username;
    var password = req.body.password;

    User.findOne({ where: { username: username } }).then(function(user) {
      if (!user || !user.validPassword(password)) {
        res.render('signin', {
          title: 'Sign in',
          error: "Sorry, these login details don't seem to be correct.",
          redirectQuery: querystring.stringify({redirect: req.query.redirect}),
        });
      } else {
        req.session.user = user.dataValues;
        res.redirect(req.query.redirect || '/');
      }
    });
  });
router.route('/signup')
  .get(redirectIfLoggedIn, (req, res, next) => {
    res.render('signup', {
      title: 'Sign up',
      redirectQuery: querystring.stringify({
        redirect: req.query.redirect,
      })});
  })
  .post((req, res) => {
    User.create({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
    })
      .then(user => {
        console.log('User ' + user.username + ' was created.');
        req.session.user = user.dataValues;
        res.redirect(req.query.redirect || '/');
      })
      .catch(err => {
        let message = 'An unknown error occurred. Please try again later.';
        if (err.name === 'SequelizeUniqueConstraintError') {
          message = 'Sorry, but this username or mail address is already ' +
            'taken. Please pick another one.';
        } else {
          console.error('Unexpected error while creating user: ', err);
        }
        res.render('signup', {
          title: 'Sign up',
          error: message,
          redirectQuery: querystring.stringify({
            redirect: req.query.redirect,
          })});
      });
  });
router.get('/forgotpassword', function(req, res, next) {
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
  router.get(path, function(req, res, next) {
    res.redirect(link);
  });
}
redirect('/forum', 'https://www.raftmodding.com/forum/');
redirect('/discord', 'https://discord.gg/raft');
redirect('/docs', 'https://www.raftmodding.com/api/');

module.exports = router;
