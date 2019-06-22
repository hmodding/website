'use strict';
module.exports = (logger, db, fileScanner) => {
  var express = require('express');
  var createError = require('http-errors');
  var router = express.Router();
  var convertMarkdown = require('../markdownConverter');
  var querystring = require('querystring');
  var urlRegexp = !/(http[s]?:\/\/)?[^\s(["<,>]*\.[^\s[",><]*/;

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

  router.route('/add')
    .get(requireLogin, (req, res, next) => {
      res.render('bundle/add', {title: 'Create mod bundle'});
    })
    .post(requireLogin, (req, res, next) => {
      res.locals.formContents = req.body;
      res.locals.title = 'Add mod bundle';
      var modBundle = {
        title: req.body.title,
        description: req.body.description,
        readme: req.body.readme,
        maintainerId: req.session.user.id,
        bannerImageUrl: req.body.bannerImageUrl,
      };
      if (!modBundle.title ||
          !modBundle.description ||
          !modBundle.readme) {
        res.render('bundle/add', {error: 'All fields of this form need to be ' +
          'filled to submit a mod bundle.'});
      } else if (modBundle.title.length > 100) {
        res.render('bundle/add', {error: 'The title can not be longer than ' +
          '100 characters!'});
      } else if (modBundle.description.length > 255) {
        res.render('bundle/add', {error: 'The description can not be longer ' +
          'than 255 characters! Please use the readme section for longer ' +
          'explanations.'});
      } else if (modBundle.bannerImageUrl &&
          !urlRegexp.test(modBundle.bannerImageUrl)) {
        res.render('bundle/add', {error: 'The banner image URL must be a ' +
          'valid URL or can be left emtpy.'});
      } else {
        db.ModBundle.create(modBundle)
          .then(bundleInst => {
            res.redirect(`/bundle/${bundleInst.id}`);
            logger.info(`Mod bundle ${bundleInst.title} (${bundleInst.id}) ` +
              `was created by user ${req.session.user.username}.`);
          })
          .catch(err => {
            res.render('bundle/add', {error: 'An unexpected error occurred. ' +
              'Please try again.'});
            logger.error('Unexpected DB error in mod bundle creation: ', err);
          });
      }
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
