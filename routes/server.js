'use strict';
module.exports = (logger, db, fileScanner) => {
  const router = require('express').Router();
  const createError = require('http-errors');
  const convertMarkdown = require('../markdownConverter');

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

  router.get('/', (req, res, next) => {
    db.ServerVersion.findAll({order: [['timestamp', 'DESC']]})
      .then(versions => {
        res.render('server/list', {title: 'Dedicated server', versions});
      })
      .catch(next);
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
