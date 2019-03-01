'use strict';
module.exports = (fileScanner) => {
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
  var Mod = require('../models/mod');

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
      console.error('An error occurred while querying the database for ' +
          'loader versions:');
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
          error: 'All fields of this form need to be filled to submit a ' +
              'loader version.',
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
          fileScanner.scanFile(req.file.buffer, req.file.originalname,
            version.downloadUrl);
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
        console.error('An error occurred while querying the database for a ' +
          'mod:');
        console.error(err);
      });
  });
  router.get('/loader/:version/download', (req, res, next) => {
    LoaderVersion.findOne({where: {rmlVersion: req.params.version}})
      .then(version => {
        if (version.downloadUrl.startsWith('/'))
          res.redirect(version.downloadUrl); // disclaimer is displayed there
        else {
          res.status(300);
          res.render('warning', {
            title: 'Warning',
            continueLink: version.downloadUrl,
            warning: {
              title: 'This might be dangerous',
              text: '<b>We could not scan the requested download for viruses ' +
                'because it is on an external site.</b> Click ' +
                `<a href="${version.downloadUrl}">here</a> if you want to ` +
                'download it now anyways. We take no responsibility on what ' +
                'you do on the other site and what the downloaded files ' +
                'might do to your computer, but you can <a href="/contact">' +
                'contact us</a> if you think that this link is dangerous.',
            },
          });
        }
      })
      .catch(err => {
        res.render('error', {error: {status: 404}});
        console.error('An error occurred while querying the database for ' +
          `loader version ${req.params.version}:`, err);
      });
  });
  function respondVirusWarning(req, res, scanStateText) {
    res.status(300);
    res.render('warning', {
      title: 'Warning',
      continueLink: req.originalUrl + '?ignoreVirusScan=true',
      warning: {
        title: 'This might be dangerous',
        text: `<b>${scanStateText}</b> Click ` +
          `<a href="${req.originalUrl + '?ignoreVirusScan=true'}">here</a> if` +
          ' you want to download it now anyways. We take no responsibility on' +
          ' what this file could do to your computer, but you can but you can' +
          ' <a href="/contact">contact us</a> if you think that this link is ' +
          'dangerous.',
      },
    });
  }
  router.get('/loader/:version/:file', (req, res, next) => {
    if (req.query.ignoreVirusScan) {
      next(); // file will be returned by static files handler
    } else {
      fileScanner.FileScan.findOne({where: {fileUrl: req.originalUrl}})
        .then(fileScan => {
          if (!fileScan.scanResult) {
            respondVirusWarning(req, res, 'This file has not yet been ' +
              'scanned, but a scan is in progress.');
          } else if (fileScan.scanResult.positives > 0) {
            respondVirusWarning(req, res, 'VirusTotal has detected a virus ' +
              'in this file.');
          } else {
            console.log(fileScan);
            respondVirusWarning(req, res, 'VirusTotal has scanned and found ' +
              'no virus in this file (click ' +
              `<a href="${fileScan.scanResult.permalink}">here</a> for the ` +
              'report), but there could still be a virus in it.');
          }
        }).catch(err => {
          respondVirusWarning(req, res, 'A virus scan for this file could ' +
            'not be found.');
          console.error('Error while querying database for file scan:', err);
        });
    }
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
                  console.log(`Loader version ${version.rmlVersion} was ' +
                      'updated by user ${req.session.user.username}`);
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
            redirectQuery: querystring.stringify({
              redirect: req.query.redirect,
            }),
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
  router.get('/user/:id', function(req, res, next) {
    var userVar;
    User.findOne({where: {username: req.params.id}})
      .then(user => {
        if (user == null) {
          next();
        } else {
          userVar = user;
          return Mod.findAll({where: {author: user.username}});
        }
      })
      .then(mods => {
        res.render('user', {
          title: userVar.username,
          user: userVar,
          authoredMods: mods,
          userIsOwner: (req.session.user &&
            req.cookies.user_sid &&
            userVar.username === req.session.user.username),
        });
      })
      .catch(err => {
        res.render('error', {title: 'Database error', error: {status: 500}});
        console.log('Error while querying database for user ' +
          req.params.id + '\'s mods:',
        err);
      });
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

  return router;
};
