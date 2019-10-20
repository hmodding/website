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
   * Middleware function to find a launcher version based on the url path and
   * save the corresponding database instance to req.launcherVersion and
   * res.locals.launcherVersion.
   */
  function findLauncherVersion(req, res, next) {
    var version = req.params.launcherVersion;
    db.LauncherVersion.findOne({where: {version}})
      .then(launcherVersion => {
        if (!launcherVersion) return Promise.reject(createError(404));
        else {
          req.launcherVersion = res.locals.launcherVersion = launcherVersion;
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

  router.route('/add')
    .get(requireAdmin, (req, res, next) => {
      res.render('launcher/add', {
        formContents: {},
      });
    })
    .post(requireAdmin, upload.single('file'), (req, res, next) => {
      res.locals.formContents = req.body;
      var respondError = error => res.render('launcher/add', {error});

      var version = {
        version: req.body.version,
        changelog: req.body.changelog,
        downloadUrl: req.body.downloadUrl || req.file,
        timestamp: new Date(),
      };
      if (!version.version || version.version === '' ||
          !version.changelog ||
          !version.downloadUrl) {
        respondError('Please fill all fields of this form to submit a ' +
          'launcher release.');
      } else if (!validate.isSlug(version.version)) {
        respondError('The version must have between 1 and 64 characters and ' +
          'can only contain lowercase letters, numbers, dashes, dots and ' +
          'underscores.');
      } else {
        if (req.file) {
          version.downloadUrl = `/launcher/${version.version}/` +
            req.file.originalname;
          var dir = path.join('.', 'public', 'launcher', version.version);
          fs.mkdirSync(dir);
          fs.writeFileSync(path.join(dir, req.file.originalname),
            req.file.buffer);
          logger.info(`File ${version.downloadUrl} was saved to disk at ` +
            path.resolve(dir));
          fileScanner.scanFile(req.file.buffer, req.file.originalname,
            version.downloadUrl);
        }
        db.LauncherVersion.create(version)
          .then(() => res.redirect(`/launcher/${version.version}`))
          .catch(err => {
            if (err.name === 'SequelizeUniqueConstraintError') {
              respondError('This version already exists. Please choose ' +
                'another version.');
            } else {
              respondError('An error occurred.');
              logger.error('Unexpected error while creating launcher version: ',
                err);
            }
          });
      }
    });

  router.get('/:launcherVersion', findLauncherVersion, (req, res, next) => {
    req.launcherVersion.changelogHTML =
      convertMarkdown(req.launcherVersion.changelog);
    res.render('launcher/view');
  });

  return router;
};
