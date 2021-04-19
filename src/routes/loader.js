'use strict';

const { createModuleLogger } = require('../logger');
const { DiscordNotificationServiceClient } =
  require('@raftmodding/discord-notification-client');

const logger = createModuleLogger('loader-router');

module.exports = (mainLogger, db, fileScanner) => {
  var router = require('express').Router();
  var fs = require('fs');
  var querystring = require('querystring');
  var convertMarkdown = require('../markdownConverter');
  var multer = require('multer');
  var upload = multer({storage: multer.memoryStorage()});
  var path = require('path');
  const createError = require('http-errors');
  const urlModule = require('url');
  const credentials = JSON.parse(fs.readFileSync('database.json'));
  const disallowOldLauncherDownloads = credentials
    .disallowOldLauncherDownloads;
  const notificationClient = new DiscordNotificationServiceClient(
    credentials.notificationService.baseUrl,
    credentials.notificationService.token);
  const Sentry = require('@sentry/node');

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
   * Middleware function for collecting raft versions and storing them to
   * `res.locals.raftVersions`.
   */
  const withRaftVersions = (req, res, next) => {
    db.RaftVersion.findAll({
      order: [ ['releasedAt', 'DESC'] ],
    })
      .then(raftVersions => {
        res.locals.raftVersions = raftVersions || [];
        next();
      })
      .catch(next);
  };

  /**
   * Checks whether the given Raft version id belongs to any of the given
   * Raft versions.
   */
  const isRaftVersionValid = (versionId, versions) => {
    return getRaftVersionById(versionId, versions) !== undefined;
  };

  /**
   * Finds a Raft version in an array of Raft versions by its identifier.
   * @param versionId the identifier of the Raft version to find.
   * @param versions the array of Raft version sequelize instances to search.
   */
  const getRaftVersionById = (versionId, versions) => {
    for (let i = 0; i < versions.length; i++) {
      if (versions[i].id === versionId) {
        return versions[i];
      }
    }
    return undefined;
  }

  /**
   * Root page for a full list of all available loader versions.
   */
  router.get(['/download', '/loader'], function(req, res, next) {
    res.locals.disallowOldLauncherDownloads = disallowOldLauncherDownloads;
    db.LauncherVersion.findAll({order: [['timestamp', 'DESC']]})
      .then(launcherVersions => {
        res.locals.launcherVersions = launcherVersions;
        return LoaderVersion.findAll({
          order: [['timestamp', 'DESC']],
          include: [{model: db.RaftVersion, as: 'raftVersion'}],
        });
      })
      .then(loaderVersions => {
        res.locals.loaderVersions = loaderVersions;
        if (loaderVersions.length > 0) {
          var version = loaderVersions[0];
          if (version.downloadUrl !== null &&
              version.downloadUrl.startsWith('/')) {
            db.FileScan.findOne({where: {fileUrl: version.downloadUrl}})
              .then(fileScan => {
                if (fileScan) res.locals.downloadWarning = {fileScan};
                res.render('download');
              })
              .catch(next);
          } else if (version.downloadUrl !== null && version.downloadUrl
            .startsWith('https://www.raftmodding.com/')) {
            res.render('download', {downloadWarning: {
              externalDownloadLink: version.downloadUrl,
              boldText: 'This redirect leads to the official RaftModLoader ' +
                'site.',
            }});
          } else {
            res.render('download',
              {downloadWarning: {externalDownloadLink: version.downloadUrl}});
          }
        } else {
          res.render('download');
        }
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
    .get(requireLogin, requireAdmin, withRaftVersions, (req, res) => {
      res.render('loader/add');
    })
    .post(requireLogin, requireAdmin, withRaftVersions, upload.single('file'),
      (req, res) => {
        var version = {
          rmlVersion: req.body.rmlVersion,
          raftVersionId: parseInt(req.body.raftVersionId, 10),
          readme: req.body.readme,
          downloadUrl: req.body.downloadUrl || req.file,
          timestamp: new Date(), // current date
        };
        if (!version.downloadUrl) {
          version.downloadUrl = null;
        }
        if (!version.rmlVersion || version.rmlVersion === ''
                  || !version.readme) {
          res.render('loader/add', {
            error: 'All fields of this form need to be filled to submit a ' +
              'loader version.',
            formContents: req.body,
          });
        } else if (!isRaftVersionValid(version.raftVersionId,
          res.locals.raftVersions)) {
          res.render('loader/add', {
            error: 'The selected Raft version does not exist!',
            formContents: req.body,
          });
        } else if (version.rmlVersion.length > 64) {
          res.render('loader/add', {
            error: 'The version of the mod loader can not be longer than 64 ' +
              'characters!',
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
              const path = `/loader/${version.rmlVersion}`;
              res.redirect(path);

              logger.info(`Loader version ${version.version} was created by ` +
                `user ${req.session.user.username} (${req.session.user.id})`);

              notificationClient.sendLoaderVersionReleaseNotification({
                version: version.rmlVersion,
                gameVersion: 'Update ' + getRaftVersionById(version.raftVersionId,
                  res.locals.raftVersions).version,
                changelog: version.readme,
                url: credentials.baseUrl + path
              }).then(() => {
                logger.debug('Sent mod loader version release notification ' +
                  `for loader v${version.rmlVersion}!`);
              }).catch(err => {
                Sentry.captureException(err);
                logger.error('Error in sending mod loader version release ' +
                  `notification for loader v${version.rmlVersion}.`, err);
              });
            })
            .catch(err => {
              if (err.name === 'SequelizeUniqueConstraintError') {
                res.render('loader/add', {
                  error: 'Sorry, but this mod loader version is already ' +
                  'taken. Please choose another one!',
                  formContents: req.body,
                });
              } else {
                res.render('loader/add', {
                  error: 'An error occurred.',
                  formContents: req.body,
                });
                logger.error(`An error occurred while creating database ' +
                  'entry for loader version ${version.rmlVersion}:`, err);
              }
            });
        }
      });

  /**
   * Page displaying a single loader version.
   */
  router.get('/loader/:version', (req, res, next) => {
    LoaderVersion.findOne({
      where: {rmlVersion: req.params.version},
      include: [{model: db.RaftVersion, as: 'raftVersion'}],
    })
      .then(version => {
        if (!version) next(createError(404));
        else {
          res.locals.version = version;
          // render markdown changelog
          if (!version.readme) {
            version.readme = '# Changelog for RaftModLoader version ' +
              `${version.rmlVersion}\n*No changelog was attached to this ` +
              'release.*';
          }
          version.readmeMarkdown = convertMarkdown(version.readme);
          if (version.downloadUrl !== null &&
              version.downloadUrl.startsWith('/')) {
            db.FileScan.findOne({where: {fileUrl: version.downloadUrl}})
              .then(fileScan => {
                if (fileScan) res.locals.downloadWarning = {fileScan};
                res.render('modloader-release');
              })
              .catch(next);
          } else if (version.downloadUrl !== null && version.downloadUrl
            .startsWith('https://www.raftmodding.com/')) {
            res.render('modloader-release', {downloadWarning: {
              externalDownloadLink: version.downloadUrl,
              boldText: 'This redirect leads to the official RaftModLoader ' +
                  'site.',
            }});
          } else {
            res.render('modloader-release',
              {downloadWarning: {externalDownloadLink: version.downloadUrl}});
          }
        }
      })
      .catch(next);
  });

  /**
   * Page displaying a warning before redirecting to the download.
   */
  router.get('/loader/:version/download', (req, res, next) => {
    LoaderVersion.findOne({where: {rmlVersion: req.params.version}})
      .then(version => {
        if (!version || version.downloadUrl === null) next(createError(404));
        else {
          res.redirect(version.downloadUrl +
            (req.query.ignoreVirusScan === 'true'
              ? '?ignoreVirusScan=true'
              : '')); // disclaimer is displayed there
        }
      })
      .catch(next);
  });


  /**
   * Page for editing a loader version.
   */
  router.route('/loader/:version/edit')
    .get(requireLogin, requireAdmin, withRaftVersions, (req, res, next) => {
      LoaderVersion.findOne({where: {rmlVersion: req.params.version}})
        .then(version => {
          if (version === null) {
            next();
          } else {
            res.render('loader/edit', {title: 'Edit ' +
              version.rmlVersion, version: version, formContents: version});
          }
        }).catch(err => {
          res.render('error', {error: {status: 404}});
          logger.error('An error occurred while querying the database for a ' +
              'loader version:');
          logger.error(err);
        });
    })
    .post(requireLogin, requireAdmin, withRaftVersions, (req, res, next) => {
      LoaderVersion.findOne({where: {rmlVersion: req.params.version}})
        .then(version => {
          if (version === null) {
            next();
          } else {
            var versionUpdate = {
              readme: req.body.readme,
            };
            if (!versionUpdate.readme) {
              res.render('loader/edit', {
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
    var urlPath = decodeURIComponent(urlModule.parse(req.originalUrl).pathname);
    db.FileScan.findOne({where: {fileUrl: urlPath}})
      .then(fileScan => {
        if (!fileScan) {
          next(createError(404));
        } else {
          // forbid indexing of downloads
          res.setHeader('X-Robots-Tag', 'noindex');
          next(); // file will be returned by static files handler
        }
      })
      .catch(next);
  });

  return router;
};
