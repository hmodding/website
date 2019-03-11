'use strict';
module.exports = (logger, db, fileScanner) => {
  var router = require('express').Router();
  var fs = require('fs');
  var querystring = require('querystring');
  var showdown = require('showdown');
  var xssFilter = require('showdown-xss-filter');
  var markdownConverter = new showdown.Converter({extensions: [xssFilter]});
  var multer = require('multer');
  var upload = multer({storage: multer.memoryStorage()});
  var path = require('path');

  var LoaderVersion = db.LoaderVersion;

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

  /**
   * Root page for a full list of all available loader versions.
   */
  router.get(['/download', '/loader'], function(req, res, next) {
    LoaderVersion.findAll({
      order: [
        // order by timestamp so that the newest version is at the top
        ['timestamp', 'DESC'],
      ],
    })
      .then(versions => {
        res.render('download', {title: 'Download', versions: versions});
      })
      .catch(err => {
        res.render('error', {
          title: 'An error occurred.',
          error: {status: 500},
        });
        logger.error('An error occurred while querying the database for ' +
          'loader versions:', err);
      });
  });

  /**
   * Page for adding a new loader version to the list.
   */
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
        timestamp: new Date(), // current date
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
      } else if (!/^[a-zA-Z0-9\-\_\.]+$/.test(version.rmlVersion)) {
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
          logger.info(`File ${req.file.filename} (${version.downloadUrl}) ` +
              `was saved to disk at ${path.resolve(dir)}.`);

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
              logger.error(`An error occurred while creating database entry ' +
                  'for loader version ${version.rmlVersion}:`, err);
            }
          });
      }
    });

  /**
   * Page displaying a single loader version.
   */
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
        logger.error('An error occurred while querying the database for a ' +
          'mod:');
        logger.error(err);
      });
  });

  /**
   * Page displaying a warning before redirecting to the download.
   */
  router.get('/loader/:version/download', (req, res, next) => {
    LoaderVersion.findOne({where: {rmlVersion: req.params.version}})
      .then(version => {
        if (version.downloadUrl.startsWith('/')) {
          res.redirect(version.downloadUrl); // disclaimer is displayed there
        } else if (version.downloadUrl.startsWith(
          'https://www.raftmodding.com/')) {
          res.status(300);
          res.render('warning', {
            title: 'Warning',
            continueLink: version.downloadUrl,
            warning: {
              title: 'You are leaving this site',
              text: '<b>This redirect leads to the official RaftModLoader ' +
                'site.</b><br>We take no responsibility on what ' +
                'you do on the other site and what the downloaded files ' +
                'might do to your computer, but you can <a href="/contact">' +
                'contact us</a> if you think that this link is dangerous.',
            },
          });
        } else {
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
        logger.error('An error occurred while querying the database for ' +
          `loader version ${req.params.version}:`, err);
      });
  });

  /**
   * Responds with the scanStateText along with a disclaimer.
   * @param req The original request object.
   * @param res The original response object.
   * @param scanStateText A short text describing the status of a possible file
   *    scan.
   */
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

  /**
   * Page for editing a loader version.
   */
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
          logger.error('An error occurred while querying the database for a ' +
              'loader version:');
          logger.error(err);
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
                  logger.info(`Loader version ${version.rmlVersion} was ` +
                      `updated by user ${req.session.user.username}`);
                  res.redirect('/loader/' + version.rmlVersion);
                })
                .catch(err => {
                  logger.error(`Could not save loader version changes for ' +
                      'version ${version.rmlVersion}:`, err);
                });
            }
          }
        }).catch(err => {
          res.render('error', {error: {status: 404}});
          logger.error('An error occurred while querying the database for a ' +
              'loader version:');
          logger.error(err);
        });
    });

  /**
   * Page for displaying a disclaimer or sending the requested file.
   */
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
            respondVirusWarning(req, res, 'VirusTotal has scanned and found ' +
              'no virus in this file (click ' +
              `<a href="${fileScan.scanResult.permalink}">here</a> for the ` +
              'report), but there could still be a virus in it.');
          }
        }).catch(err => {
          respondVirusWarning(req, res, 'A virus scan for this file could ' +
            'not be found.');
          logger.error('Error while querying database for file scan:', err);
        });
    }
  });

  return router;
};
