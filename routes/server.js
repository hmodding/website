'use strict';
module.exports = (logger, db, fileScanner) => {
  var router = require('express').Router();

  router.get('/', (req, res, next) => {
    res.render('server/list', {title: 'Dedicated server'});
  });

  return router;
};
