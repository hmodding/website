'use strict';
module.exports = (logger, db, fileScanner) => {
  var router = require('express').Router();

  router.get('/', (req, res, next) => {
    db.ServerVersion.findAll({order: [['timestamp', 'DESC']]})
      .then(versions => {
        res.render('server/list', {title: 'Dedicated server', versions});
      })
      .catch(next);
  });

  return router;
};
