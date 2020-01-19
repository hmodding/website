'use strict';
module.exports = (logger, db, fileScanner) => {
  const router = require('express').Router();
  const createError = require('http-errors');

  /**
   * Middleware function that nexts to a 403 error if the logged in user is not
   * an admin.
   */
  router.use((req, res, next) => {
    if (res.locals.userIsAdmin) {
      next();
    } else {
      next(createError(403));
    }
  });

  /**
   * Overview page showing all Raft versions.
   */
  router.get('/', (req, res, next) => {
    db.RaftVersion.findAll()
      .then(raftVersions => {
        res.render('raft-version-management/overview', {raftVersions});
      })
      .catch(next);
  });

  return router;
};
