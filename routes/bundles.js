'use strict';
module.exports = (logger, db, fileScanner) => {
  var express = require('express');
  var createError = require('http-errors');
  var router = express.Router();
  var convertMarkdown = require('../markdownConverter');
  var querystring = require('querystring');
  var urlRegexp = !/(http[s]?:\/\/)?[^\s(["<,>]*\.[^\s[",><]*/;
  var modBundleIncludes = [
    {model: db.User, as: 'maintainer'},
    {model: db.ModVersion, as: 'modContents'},
  ];

  /**
   * Finds the bundle from the bundleId provided in the URL path.
   */
  function bundleMiddleware(req, res, next) {
    var bundleId = req.params.bundleId;
    if (isNaN(bundleId)) next(createError(404));
    else {
      bundleId = parseInt(bundleId, 10);
      db.ModBundle.findOne({where: {id: bundleId}, include: modBundleIncludes})
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
   * Middleware function that next()s a 404 error if the logged in user does not
   * own the current mod bundle.
   */
  function requireOwnership(req, res, next) {
    if (req.userIsBundleOwner || res.locals.userIsAdmin) {
      next();
    } else {
      next(createError(404));
    }
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

  router.get('/', (req, res, next) => {
    db.ModBundle.findAll({include: modBundleIncludes})
      .then(bundles => {
        res.render('bundle/directory', {
          title: 'Mod Bundles',
          bundles,
        });
      })
      .catch(err => next(err));
  });

  router.route('/addmod')
    .get(requireLogin, (req, res, next) => {
      var mod;
      db.Mod.findOne({
        where: {id: req.query.mod},
        include: [db.ModVersion],
        order: [ [db.ModVersion, 'createdAt', 'DESC'] ],
      })
        .then(modResult => {
          if (!modResult) return Promise.reject(createError(404));
          mod = modResult;
          logger.debug(mod);
          return db.ModBundle.findAll({
            where: {maintainerId: req.session.user.id},
            include: modBundleIncludes,
          });
        })
        .then(ownedBundles => {
          res.render('bundle/addmod',
            {title: `Add ${mod ? mod.id : 'a mod'}`, mod, ownedBundles});
        })
        .catch(err => next(err));
    })
    .post(requireLogin, (req, res, next) => {
      var mod, bundle;
      db.Mod.findOne({where: {id: req.body.mod}})
        .then(modRes => {
          if (!modRes) return Promise.reject('This mod could not be found!');
          mod = modRes;
          return db.ModBundle.findOne({
            where: {id: req.body.bundle},
            include: modBundleIncludes,
          });
        })
        .then(bundleRes => {
          if (!bundleRes) {
            return Promise.reject('This bundle could not be found!');
          }
          bundle = bundleRes;
          if (bundle.maintainer.id !== req.session.user.id) {
            return Promise
              .reject('You can not add mods to bundles that you don\'t own!');
          }
          if (req.body.version === 'update') {
            return db.ModVersion.findOne({
              where: {modId: mod.id},
              order: [ ['createdAt', 'DESC'] ],
            });
          } else {
            return db.ModVersion.findOne({where: {id: req.body.version}});
          }
        })
        .then(version => {
          if (!version) {
            return Promise.reject('This mod version could not be found.');
          }
          return bundle.addModContent(version);
        })
        .then(() => {
          logger.info(`Mod ${mod.title} (${mod.id}) was added to bundle ` +
            `${bundle.title} (${bundle.id}) by user ` +
            `${req.session.user.username} (${req.session.user.id}).`);
          res.redirect(`/bundle/${bundle.id}/mods`);
        }).catch(err => {
          if (typeof err === 'string') {
            db.ModBundle.findAll({
              where: {maintainerId: req.session.user.id},
              include: modBundleIncludes,
            })
              .then(ownedBundles => res.render('bundle/addmod',
                {title: `Add ${mod ? mod.id : 'a mod'}`, mod, ownedBundles}))
              .catch(err => next(err));
          } else {
            next(err);
          }
        });
    });

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

  router.get('/:bundleId/mods', (req, res, next) => {
    var bundleId = req.params.bundleId;
    if (isNaN(bundleId)) next(createError(404));
    else {
      bundleId = parseInt(bundleId, 10);
      db.ModBundle.findOne({where: {id: bundleId}, include: [
        {model: db.User, as: 'maintainer'},
        {model: db.ModVersion, as: 'modContents', include: [
          db.Mod,
        ]},
      ]})
        .then(bundle => {
          if (!bundle) next(createError(404));
          else {
            res.render('bundle/mods', {
              title: `Mods - ${bundle.title}`,
              bundle: bundle,
              userIsBundleOwner: req.userIsBundleOwner,
            });
          }
        })
        .catch(err => next(err));
    }
  });

  router.route('/:bundleId/edit')
    .get(bundleMiddleware, requireLogin, checkOwnership,
      requireOwnership, (req, res, next) => {
        res.render('bundle/edit', {
          title: `Edit ${req.modBundle.title}`,
          bundle: req.modBundle,
          formContents: req.modBundle,
        });
      })
    .post(bundleMiddleware, requireLogin, checkOwnership, requireOwnership,
      (req, res, next) => {
        res.locals.title = `Edit ${req.modBundle.title}`;
        res.locals.bundle = req.modBundle;
        res.locals.formContents = req.modBundle;
        var error = (e) => res.render('bundle/edit', {error: e});

        if (req.body.changeOwner) {
          // transfer mod
          var user;
          db.User.findOne({where: {username: req.body.changeOwner}})
            .then(userRes => {
              if (!userRes) {
                return Promise.reject('There is no user with the specified ' +
                  'username!');
              } else {
                user = userRes;
                return req.modBundle.update({maintainerId: user.id});
              }
            })
            .then(() => {
              logger.info(`Bundle ${req.modBundle.title} ` +
                `(${req.modBundle.id}) was transferred to ${user.username} ` +
                `by ${req.session.user.username}.`);
              res.redirect(`/bundle/${req.modBundle.id}`);
            })
            .catch(err => {
              if (typeof err === 'string') error(err);
              else {
                res.render('bundle/edit', {error: 'An error occurred, ' +
                  'please try again.'});
                logger.error('An error occurred while updating owner of ' +
                  `bundle ${req.modBundle.id} in the database: `, err);
              }
            });
        } else if (req.body.action && req.body.action === 'delete') {
          // delete mod
          if (req.body.deletionCaptcha !== req.modBundle.title) {
            res.render('bundle/edit', {
              error: req.body.deletionCaptcha ?
                'Please enter the title of the bundle to delete it!' :
                'The specified title is not correct!'});
          } else {
            req.modBundle.destroy()
              .then(() => {
                logger.info(`Bundle ${req.modBundle.title} ` +
                  `(${req.modBundle.id}) was deleted by user ` +
                  `${req.session.user.username} (${req.session.user.id}).`);
                res.redirect('/');
              })
              .catch(err => {
                res.render('bundle/edit', {error: 'We\'re sorry, the ' +
                  'deletion failed! Please try again.'});
                logger.error('An error occurred while updating bundle ' +
                  `${req.modBundle.id} in the database: `, err);
              });
          }
        } else {
          // update mod
          var bundleUpdate = {
            title: req.body.title,
            description: req.body.description,
            readme: req.body.readme,
            bannerImageUrl: req.body.bannerImageUrl,
          };
          res.locals.formContents = bundleUpdate;
          if (!bundleUpdate.title ||
              !bundleUpdate.description ||
              !bundleUpdate.readme) {
            error('Please fill all required form fields to submit your ' +
              'changes!');
          } else if (bundleUpdate.title.length > 100) {
            error('The title can not be longer than 100 characters!');
          } else if (bundleUpdate.description.length > 255) {
            error('The description can not be longer than 255 characters! ' +
              'Please use the readme section for in-depth explanations.');
          } else if (bundleUpdate.bannerImageUrl &&
              !urlRegexp.test(bundleUpdate.bannerImageUrl)) {
            error('The banner image URL must be empty or a valid URL.');
          } else {
            // no errors, save to DB
            req.modBundle.update(bundleUpdate)
              .then(() => {
                logger.info(`Bundle ${req.modBundle.title} ` +
                  `(${req.modBundle.id}) was updated by user ` +
                  `${req.session.user.username} (${req.session.user.id}).`);
                res.redirect(`/bundle/${req.modBundle.id}`);
              })
              .catch(err => {
                error('We\'re sorry, your changes could not be saved.');
                logger.error('An error occurred while updating bundle ' +
                  `${req.modBundle.id} in the database: `, err);
              });
          }
        }
      });

  router.get('/:bundleId/removemod', requireLogin, bundleMiddleware,
    checkOwnership, requireOwnership, (req, res, next) => {
      db.Mod.findOne({where: {id: req.query.mod}})
        .then(mod => {
          if (!mod) next(createError(404));
          else if (req.query.confirm) {
            req.modBundle.getModContents()
              .then(contents => {
                if (!contents || contents.length === 0) {
                  next(createError(404));
                } else {
                  for (var i = 0; i < contents.length; i++) {
                    if (contents[i].modId === mod.id) {
                      req.modBundle.removeModContent(contents[i])
                        .then(() => {
                          logger.info(`Mod ${mod.id} was removed from ` +
                              `bundle ${req.modBundle.id} by user ` +
                              `${req.session.user.username}.`);
                          res.redirect(`/bundle/${req.modBundle.id}/mods`);
                          return;
                        });
                      return;
                    }
                  }
                  logger.error(`Could not remove mod ${mod.id} from bundle ` +
                      `${req.modBundle.id}: No matching entry was found!`);
                  next(createError(500));
                }
              });
          } else {
            res.render('bundle/removemod', {
              title: `Remove ${mod.title} from ${req.modBundle.title}`,
              bundle: req.modBundle,
              mod,
            });
          }
        })
        .catch(next);
    });

  return router;
};
