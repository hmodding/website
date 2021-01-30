'use strict';
module.exports = (logger, db, fileScanner) => {
  const router = require('express').Router();
  const createError = require('http-errors');
  const convertMarkdown = require('../markdownConverter');
  const multer = require('multer');
  const upload = multer({storage: multer.memoryStorage()});
  const validate = require('../util/validation');
  const path = require('path');
  const fs = require('fs');

  /**
   * Middleware function to find a server version based on the url path and
   * save the corresponding database instance to req.serverVersion and
   * res.locals.serverVersion.
   */
  function findServerVersion(req, res, next) {
    var version = req.params.serverVersion;
    db.ServerVersion.findOne({where: {version}})
      .then(serverVersion => {
        if (!serverVersion) return Promise.reject(createError(404));
        else {
          req.serverVersion = res.locals.serverVersion = serverVersion;
          next();
        }
      })
      .catch(next);
  }

  /**
   * Middleware function that nexts to a 403 error if the logged in user is not
   * an admin.
   */
  function requireAdmin(req, res, next) {
    if (res.locals.userIsAdmin) {
      next();
    } else {
      res.status(403).render('error', {error: {status: 403}});
    }
  }

  router.get('/', (req, res, next) => {
    db.ServerVersion.findAll({order: [['timestamp', 'DESC']]})
      .then(versions => {
        res.render('server/list', {title: 'Dedicated server', versions});
      })
      .catch(next);
  });

  router.route('/add')
    .get(requireAdmin, (req, res, next) => {
      res.render('server/add', {
        title: 'Add a server version',
        formContents: {},
      });
    })
    .post(requireAdmin, upload.single('file'), (req, res, next) => {
      res.locals.title = 'Add a server version';
      res.locals.formContents = req.body;
      var respondError = error => res.render('server/add', {error});

      var version = {
        version: req.body.version,
        raftVersion: req.body.raftVersion,
        changelog: req.body.changelog,
        downloadUrl: req.body.downloadUrl || req.file,
        timestamp: new Date(),
      };
      if (!version.version || version.version === '' ||
          !version.raftVersion ||
          !version.changelog ||
          !version.downloadUrl) {
        respondError('Please fill all fields of this form to submit a server ' +
          'release.');
      } else if (!validate.isSlug(version.version)) {
        respondError('The version must have between 1 and 64 characters and ' +
          'can only contain lowercase letters, numbers, dashes, dots and ' +
          'underscores.');
      } else if (version.raftVersion.length > 255) {
        respondError('The Raft version can not be longer than 255 characters!');
      } else {
        if (req.file) {
          version.downloadUrl = `/server/${version.version}/` +
            req.file.originalname;
          var dir = path.join('.', 'public', 'server', version.version);
          fs.mkdirSync(dir);
          fs.writeFileSync(path.join(dir, req.file.originalname),
            req.file.buffer);
          logger.info(`File ${version.downloadUrl} was saved to disk at ` +
            path.resolve(dir));
          fileScanner.scanFile(req.file.buffer, req.file.originalname,
            version.downloadUrl);
        }
        db.ServerVersion.create(version)
          .then(() => res.redirect(`/server/${version.version}`))
          .catch(err => {
            if (err.name === 'SequelizeUniqueConstraintError') {
              respondError('This version already exists. Please choose ' +
                'another version.');
            } else {
              respondError('An error occurred.');
              logger.error('Unexpected error while creating server version: ',
                err);
            }
          });
      }
    });

  router.get('/:serverVersion', findServerVersion, (req, res, next) => {
    req.serverVersion.changelogHTML =
      convertMarkdown(req.serverVersion.changelog);
    res.render('server/server', {
      title: 'Dedicated server ' + req.serverVersion.version,
    });
  });

  router.route('/:serverVersion/edit')
    .get(findServerVersion, requireAdmin, (req, res, next) => {
      res.render('server/edit', {
        title: 'Edit server version',
        formContents: req.serverVersion,
      });
    })
    .post(findServerVersion, requireAdmin, (req, res, next) => {
      res.locals.title = 'Edit server version';
      res.locals.formContents = req.body;
      var respondError = error => res.render('server/edit', {error});

      var update = {
        changelog: req.body.changelog,
      };
      if (!update.changelog) {
        respondError('The changelog can not be empty!');
      } else {
        req.serverVersion.update(update)
          .then(() => {
            logger.info(`Server version ${req.serverVersion.version} was ` +
              `updated by user ${req.session.user.username} ` +
              `(${req.session.user.id}).`);
            res.redirect(`/server/${req.serverVersion.version}`);
          })
          .catch(err => {
            logger.error('Unexpected error while updating server version ' +
              `${req.serverVersion.version}: `, err);
            respondError('An error occurred.');
          });
      }
    });

  router.get('/:serverVersion/download', findServerVersion,
    (req, res, next) => res.redirect(req.serverVersion.downloadUrl));

  return router;
};
