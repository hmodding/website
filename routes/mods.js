'use strict';
module.exports = (db, fileScanner) => {
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
  var Mod = db.Mod;
  var FileScan = db.FileScan;

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

  /* GET mods listing */
  router.get('/', function(req, res, next) {
    Mod.findAll().then(mods => {
      res.render('mods', {title: 'Mods', mods: mods});
    }).catch(err => {
      res.render('error', {title: 'An error occurred.', error: {status: 500}});
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
        downloadUrl: req.body.downloadUrl || req.file,
        bannerImageUrl: req.body.bannerImageUrl,
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
          formContents: req.body,
        });
      } else if (!/^[a-zA-Z1-9]+$/.test(mod.id)) {
        res.render('addmod', {
          title: 'Add a mod',
          error: 'The ID can only contain letters and numbers!',
          formContents: req.body,
        });
      } else if (mod.id.length > 64) {
        res.render('addmod', {
          title: 'Add a mod',
          error: 'The ID can not be longer than 64 characters!',
          formContents: req.body,
        });
      } else if (mod.title.length > 255) {
        res.render('addmod', {
          title: 'Add a mod',
          error: 'The title can not be longer than 255 characters!',
          formContents: req.body,
        });
      } else if (mod.description.length > 255) {
        res.render('addmod', {
          title: 'Add a mod',
          error: 'The description can not be longer than 255 characters! ' +
                      'Please use the readme section for longer explanations.',
          formContents: req.body,
        });
      } else if (mod.version.length > 64) {
        res.render('addmod', {
          title: 'Add a mod',
          error: 'The version can not be longer than 64 characters!',
          formContents: req.body,
        });
      } else {
        mod.id = mod.id.toLowerCase();
        mod.author = mod.author.username;
        if (req.file) {
          // save file
          mod.downloadUrl = `/mods/${mod.id}/${mod.version}/` +
            req.file.originalname;
          var dir = path.join('.', 'public', 'mods', mod.id, mod.version);
          fs.mkdirSync(dir, {recursive: true});
          fs.writeFileSync(
            path.join(dir, req.file.originalname),
            req.file.buffer
          );
          console.log(`File ${req.file.filename} (${mod.downloadUrl}) was ` +
            `saved to disk at ${path.resolve(dir)}.`);

          // start scan for viruses
          fileScanner.scanFile(req.file.buffer, req.file.originalname,
            mod.downloadUrl);
        }
        Mod.create(mod)
          .then(mod => {
            res.redirect('/mods/' + mod.id);
          }).catch(err => {
            if (err.name === 'SequelizeUniqueConstraintError') {
              res.render('addmod', {
                title: 'Add a mod',
                error: 'Sorry, but this ID is already taken. ' +
                  'Please choose another one!',
                formContents: req.body,
              });
            } else {
              res.render('addmod', {
                title: 'Add a mod',
                error: 'An error occurred.',
                formContents: req.body,
              });
              console.error('An error occurred while querying the database ' +
                'for mods:', err);
            }
          });
      }
    });

  function requireOwnage(req, res, next) {
    Mod.findOne({where: {id: req.params.id}}).then(mod => {
      if (mod &&
          req.session.user &&
          req.cookies.user_sid &&
          req.session.user.username === mod.author) {
        next();
      } else {
        res.status(403);
        res.render('error', {error: {status: 403}});
      }
    }).catch(err => {
      res.render('error', {error: {status: 404}});
      console.error('An error occurred while querying the database for a mod:');
      console.error(err);
    });
  }
  router.get('/:id/download', (req, res) => {
    Mod.findOne({where: {id: req.params.id}}).then(mod => {
      db.ModVersion.findOne({where: {modId: mod.id}, order: [
        ['createdAt', 'DESC'],
      ]})
        .then(version => {
          if (version.downloadUrl.startsWith('/'))
            res.redirect(version.downloadUrl);
          else {
            res.status(300);
            res.render('warning', {
              title: 'Warning',
              continueLink: version.downloadUrl,
              warning: {
                title: 'This might be dangerous',
                text: '<b>We could not scan the requested download for ' +
                  'viruses because it is on an external site.</b><br>' +
                  'We take no responsibility on what you do on ' +
                  'the other site and what the downloaded files might do to ' +
                  'your computer, but you can <a href="/contact">contact ' +
                  'us</a> if you think that this link is dangerous.',
              },
            });
          }
        }).catch(err => {
          res.render('error', {title: 'Internal server error',
            error: {status: 404}});
          console.error('An error occurred while querying the database for ' +
            'a mod version:', err);
        });
    }).catch(err => {
      res.render('error', {error: {status: 404}});
      console.error('An error occurred while querying the database for a mod:');
      console.error(err);
    });
  });
  router.route('/:id/edit')
    .get(requireLogin, requireOwnage, (req, res) => {
      Mod.findOne({where: {id: req.params.id}}).then(mod => {
        res.render('editmod', {
          title: 'Edit ' + mod.title,
          mod: mod,
          formContents: mod,
        });
      }).catch(err => {
        res.render('error', {error: {status: 404}});
        console.error('An error occurred while querying the database for a ' +
          'mod:');
        console.error(err);
      });
    })
    .post(requireLogin, requireOwnage, (req, res) => {
      Mod.findOne({where: {id: req.params.id}}).then(mod => {
        var modUpdate = {
          title: req.body.title,
          description: req.body.description,
          category: req.body.category,
          readme: req.body.readme,
          bannerImageUrl: req.body.bannerImageUrl,
        };
        if (!modUpdate.title
                      || !modUpdate.description
                      || !modUpdate.category
                      || !modUpdate.readme) {
          res.render('editmod', {
            title: 'Add a mod',
            error: 'All fields of this form need to be filled to submit ' +
              'changes to a mod.',
            formContents: req.body,
            mod: mod,
          });
        } else if (modUpdate.title.length > 255) {
          res.render('editmod', {
            title: 'Edit ' + mod.title,
            error: 'The title can not be longer than 255 characters!',
            formContents: req.body,
            mod: mod,
          });
        } else if (modUpdate.description.length > 255) {
          res.render('editmod', {
            title: 'Edit ' + mod.title,
            error: 'The description can not be longer than 255 characters! ' +
              'Please use the readme section for longer explanations.',
            formContents: req.body,
            mod: mod,
          });
        } else {
          // save update to db
          Mod.update(modUpdate, {where: {id: mod.id}})
            .then(() => {
              console.log(`Mod ${mod.id} was updated by user ` +
                req.session.user.username);
              res.redirect('/mods/' + mod.id);
            })
            .catch(err => {
              res.render('editmod', {
                title: 'Edit ' + mod.title,
                error: 'An error occurred.',
                formContents: req.body,
                mod: mod,
              });
              console.error(`An error occurred while updating mod ${mod.id} ` +
                'in the database', err);
            });
        }
      }).catch(err => {
        res.render('error', {error: {status: 404}});
        console.error('An error occurred while querying the database for a ' +
          'mod:');
        console.error(err);
      });
    });
  /**
   * Page for adding a new version to an existing mod.
   */
  router.route('/:id/addversion')
    .get(requireLogin, requireOwnage, (req, res) => {
      Mod.findOne({where: {id: req.params.id}}).then(mod => {
        res.render('add-mod-version', {
          title: 'Add mod version',
          mod: mod,
          formContents: {},
        });
      }).catch(err => {
        res.render('error', {title: 'Internal server error',
          error: {status: 500}});
        console.error('An error occurred while querying the database for a ' +
            'mod:', err);
      });
    })
    .post(requireLogin, requireOwnage, upload.single('file'), (req, res) => {
      Mod.findOne({where: {id: req.params.id}}).then(mod => {
        var modVersion = {
          modId: mod.id,
          version: req.body.version,
          changelog: req.body.changelog,
          downloadUrl: req.body.downloadUrl || req.file,
        };
        if (!modVersion.version
            || !modVersion.changelog
            || !modVersion.downloadUrl) {
          res.render('add-mod-version', {
            title: 'Add mod version',
            error: 'All fields of this form need to be filled to submit a ' +
              'new mod version.',
            formContents: req.body,
            mod: mod,
          });
        } else if (mod.version.length > 64) {
          res.render('add-mod-version', {
            title: 'Add mod version',
            error: 'The version can not be longer than 64 characters!',
            formContents: req.body,
            mod: mod,
          });
        } else {
          modVersion.version = modVersion.version.toLowerCase();
          if (req.file) {
            // save file
            modVersion.downloadUrl = `/mods/${mod.id}/${modVersion.version}/` +
              req.file.originalname;
            var dir = path.join('.', 'public', 'mods', mod.id,
              modVersion.version);
            fs.mkdirSync(dir, {recursive: true});
            fs.writeFileSync(path.join(dir, req.file.originalname),
              req.file.buffer);
            console.log(`File ${req.file.filename} (` +
              `${modVersion.downloadUrl}) was saved to disk at ` +
              `${path.resolve(dir)}.`);

            // start scan for viruses
            fileScanner.scanFile(req.file.buffer, req.file.originalname,
              modVersion.downloadUrl);
          }
          // create mod version in the database
          db.ModVersion.create(modVersion)
            .then(modVersion => {
              res.redirect('/mods/' + modVersion.id);
            }).catch(err => {
              if (err.name === 'SequelizeUniqueConstraintError') {
                res.render('add-mod-version', {
                  title: 'Add mod version',
                  error: 'Sorry, but this version already exists Please ' +
                    'choose another one!',
                  formContents: req.body,
                });
              } else {
                res.render('add-mod-version', {
                  title: 'Add mod version',
                  error: 'An error occurred.',
                  formContents: req.body,
                });
                console.error('An error occurred while creating mod version ' +
                  'in the database:', err);
              }
            });
        }
      }).catch(err => {
        res.render('error', {title: 'Internal server error',
          error: {status: 500}});
        console.error('An error occurred while querying the database for a ' +
            'mod:', err);
      });
    });
  router.get('/:id', function(req, res, next) {
    Mod.findOne({where: {id: req.params.id}}).then(mod => {
      db.ModVersion.findAll({where: {modId: mod.id}, order: [
        // order by creation time so that the newest version is at the top
        ['createdAt', 'DESC'],
      ]})
        .then(versions => {
          // render markdown readme
          mod.readmeMarkdown = markdownConverter.makeHtml(
            mod.readme.replace(/</g, '&lt;').replace(/>/g, '&gt;')
          );
          res.render('mod', {
            title: mod.title,
            mod: mod,
            versions: versions,
            userIsOwner: (req.session.user &&
              req.cookies.user_sid &&
              mod.author === req.session.user.username),
          });
        })
        .catch(err => {
          res.render('error', {title: 'Internal server error',
            error: {status: 500}});
          console.error('An error occurred while querying the database for ' +
            'mod versions:', err);
        });
    }).catch(err => {
      res.render('error', {error: {status: 404}});
      console.error('An error occurred while querying the database for a mod:',
        err);
    });
  });
  router.get('/:id/:version/:file', function(req, res, next) {
    if (req.query.ignoreVirusScan) {
      next(); // file will be returned by static files handler
    } else {
      FileScan.findOne({where: {fileUrl: req.originalUrl}}).then(fileScan => {
        if (!fileScan.scanResult) {
          respondVirusWarning(req, res, 'This file has not yet been scanned, ' +
            'but a scan is in progress.');
        } else if (fileScan.scanResult.positives > 0) {
          respondVirusWarning(req, res, 'VirusTotal has detected a virus in ' +
            'this file.');
        } else {
          console.log(fileScan);
          respondVirusWarning(req, res, 'VirusTotal has scanned and found no ' +
            'virus in this file (click ' +
            `<a href="${fileScan.scanResult.permalink}">here</a> for the ` +
            'report), but there could still be a virus in it.');
        }
      }).catch(err => {
        respondVirusWarning(req, res, 'A virus scan for this file could not ' +
          'be found.');
        console.error('Error while querying database for file scan:', err);
      });
    }
  });

  function respondVirusWarning(req, res, scanStateText) {
    res.status(300);
    res.render('warning', {
      title: 'Warning',
      continueLink: req.originalUrl + '?ignoreVirusScan=true',
      warning: {
        title: 'This might be dangerous',
        text: `<b>${scanStateText}</b><br>We take no responsibility on` +
          ' what this file could do to your computer, but you can but you can' +
          ' <a href="/contact">contact us</a> if you think that this link is ' +
          'dangerous.',
      },
    });
  }
  return router;
};
