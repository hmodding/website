'use strict';
module.exports = (logger, db, fileScanner) => {
  const router = require('express').Router();
  const createError = require('http-errors');
  const convertMarkdown = require('../markdownConverter');
  const multer = require('multer');
  const upload = multer({storage: multer.memoryStorage()});

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
    });

  router.get('/:serverVersion', findServerVersion, (req, res, next) => {
    req.serverVersion.changelogHTML =
      convertMarkdown(req.serverVersion.changelog);
    res.render('server/server', {
      title: 'Dedicated server ' + req.serverVersion.version
    });
  });

  return router;
};
