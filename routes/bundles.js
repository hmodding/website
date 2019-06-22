'use strict';
module.exports = (logger, db, fileScanner) => {
  var express = require('express');
  var createError = require('http-errors');
  var router = express.Router();
  var convertMarkdown = require('../markdownConverter');
  var querystring = require('querystring');

  /**
   * Finds the bundle from the bundleId provided in the URL path.
   */
  function bundleMiddleware(req, res, next) {
    var bundleId = req.params.bundleId;
    if (isNaN(bundleId)) next(createError(404));
    else {
      bundleId = parseInt(bundleId, 10);
      db.ModBundle.findOne({where: {id: bundleId}, include: [
        {model: db.User, as: 'maintainer'},
        {model: db.ModVersion, as: 'modContents'},
      ]})
        .then(bundle => {
          if (!bundle) next(createError(404));
          else {
            req.modBundle = bundle;
            next();
          }
        })
        .catch(err => next(err));
    }
  }

  /**
   * Middleware function for checking whether the logged in user owns the
   * current mod bundle.
   */
  function checkOwnership(req, res, next) {
    req.userIsBundleOwner = req.bundle &&
      req.bundle.maintainer &&
      req.bundle.maintainer.username === req.session.user.username;
    next();
  }

  /**
   * Middleware for checking login status and redirecting to the sign-in page if
   * necessary.
   */
  function requireLogin(req, res, next) {
    if (req.session.user && req.cookies.user_sid) {
      next();
    } else {
      res.redirect('/signin?' + querystring.stringify({
        redirect: req.originalUrl,
      }));
    }
  };

  router.get('/add', requireLogin, (req, res, next) => {
    res.locals.formContents = req.query;
    res.render('bundle/add', {title: 'Create mod bundle'});
  });

  router.get('/:bundleId', bundleMiddleware, checkOwnership,
    (req, res, next) => {
      var bundle = req.modBundle;
      bundle.readmeMarkdown = convertMarkdown(bundle.readme);
      res.render('bundle/bundle', {
        title: bundle.title,
        bundle,
        userIsBundleOwner: req.userIsBundleOwner,
      });
    });

  return router;
};
