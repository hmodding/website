'use strict';
/**
 * Accounting and user pages.
 */
module.exports = (logger, db) => {
  var router = require('express').Router();
  var querystring = require('querystring');
  var GoogleRecaptcha = require('google-recaptcha');
  var captcha = new GoogleRecaptcha({
    secret: '6Lc_0ZYUAAAAANGjwY--0dMMKqLDsrhP01V9vPvj'});

  var User = db.User;

  /**
   * Middleware for inserting login status information in the result locals
   * (to be used in pug files).
   */
  router.use((req, res, next) => {
    res.locals.loggedIn = req.session.user && req.cookies.user_sid;
    if (res.locals.loggedIn) {
      db.UserPrivilege.findOne({where: {username: req.session.user.username}})
        .then(privileges => {
          res.locals.userIsAdmin = privileges != null &&
              privileges.role != null && privileges.role === 'admin';
          next();
        }).catch(err => {
          res.locals.userIsAdmin = false;
          logger.error('Could not query user privileges for user ' +
              req.session.user, err);
          next();
        });
    } else {
      next();
    }
  });

  /**
   * Middleware function for redirecting already logged in users.
   */
  var redirectIfLoggedIn = function(req, res, next) {
    if (res.locals.loggedIn) {
      res.redirect(req.query.redirect || '/');
    } else {
      next();
    }
  };

  var requireLogin = function(req, res, next) {
    if (req.session.user && req.cookies.user_sid) {
      next();
    } else {
      res.redirect('/signin?' + querystring.stringify({
        redirect: req.originalUrl,
      }));
    }
  };

  /**
   * Page for logging in.
   */
  router.route(['/signin', '/login'])
    .get(redirectIfLoggedIn, (req, res, next) => {
      res.render('signin', {
        title: 'Sign in',
        redirectQuery: querystring.stringify({redirect: req.query.redirect})});
    })
    .post((req, res) => {
      var username = req.body.username;
      var password = req.body.password;

      User.findOne({ where: { username: username } }).then(function(user) {
        if (!user || !user.validPassword(password)) {
          res.render('signin', {
            title: 'Sign in',
            error: "Sorry, these login details don't seem to be correct.",
            redirectQuery: querystring.stringify({
              redirect: req.query.redirect,
            }),
          });
        } else {
          req.session.user = user;
          res.redirect(req.query.redirect || '/');
        }
      });
    });

  /**
   * Page for creating a new account.
   */
  router.route('/signup')
    .get(redirectIfLoggedIn, (req, res, next) => {
      res.render('signup', {
        title: 'Sign up',
        redirectQuery: querystring.stringify({
          redirect: req.query.redirect,
        }),
        formContents: {},
      });
    })
    .post((req, res) => {
      var captchaResponse = req.body['g-recaptcha-response'];
      if (!captchaResponse) {
        res.render('signup', {
          title: 'Sign up',
          error: 'Please complete the captcha before signing up!',
          redirectQuery: querystring.stringify({
            redirect: req.query.redirect,
          }),
          formContents: req.body,
        });
      } else {
        captcha.verify({response: captchaResponse}, (err, body) => {
          if (err) {
            if (Array.isArray(body['error-codes']) &&
              body['error-codes'].includes('timeout-or-duplicate')) {
              res.render('signup', {
                title: 'Sign up',
                error: 'Please complete the captcha again.',
                redirectQuery: querystring.stringify({
                  redirect: req.query.redirect,
                }),
                formContents: req.body,
              });
            } else {
              res.render('signup', {
                title: 'Sign up',
                error: 'Sorry, there is a problem with the captcha.',
                redirectQuery: querystring.stringify({
                  redirect: req.query.redirect,
                }),
                formContents: req.body,
              });
              logger.error('An error occurred while checking the signup ' +
                'captcha:', err);
            }
          } else {
            User.create({
              username: req.body.username,
              email: req.body.email,
              password: req.body.password,
            })
              .then(user => {
                console.log('User ' + user.username + ' was created.');
                req.session.user = user;
                res.redirect(req.query.redirect || '/');
              })
              .catch(err => {
                let message = 'An unknown error occurred. Please try again ' +
                  'later.';
                if (err.name === 'SequelizeUniqueConstraintError') {
                  message = 'Sorry, but this username or mail address is ' +
                    'already taken. Please pick another one.';
                } else {
                  logger.error('Unexpected error while creating user: ', err);
                }
                res.render('signup', {
                  title: 'Sign up',
                  error: message,
                  redirectQuery: querystring.stringify({
                    redirect: req.query.redirect,
                  })});
              });
          }
        });
      }
    });

  /**
   * Page to reset a forgotten password.
   */
  router.get('/forgotpassword', function(req, res, next) {
    res.render('forgotpassword', {
      title: 'Forgot password',
      redirectQuery: querystring.stringify({
        redirect: req.query.redirect,
      }),
    });
  });

  /**
   * Page that shows information about the own account.
   */
  router.get('/account', requireLogin, (req, res, next) => {
    res.render('account', {title: 'Account', user: req.session.user});
  });

  /**
   * Page for changing your own password.
   */
  router.route('/account/password')
    .get(requireLogin, (req, res, next) => {
      res.render('change-password', {title: 'Change your password',
        formContents: {}});
    }).post(requireLogin, (req, res, next) => {
      User.findOne({where: {username: req.session.user.username}})
        .then(user => {
          if (!req.body.currentPassword ||
              !req.body.newPassword ||
              !req.body.confirmPassword) {
            res.render('change-password', {
              title: 'Change your password',
              error: 'You need to fill all fields of this form to change ' +
                'your password.',
              formContents: req.body,
            });
          } else if (!user.validPassword(req.body.currentPassword)) {
            res.render('change-password', {
              title: 'Change your password',
              error: 'Your current password is wrong.',
              formContents: req.body,
            });
            // eslint-disable-next-line max-len
          } else if (!/^(?=.*[A-Z])(?=.*[!@#$&*])(?=.*[0-9])(?=.*[a-z]).{8,}$/.test(req.body.newPassword)) {
            res.render('change-password', {
              title: 'Change your password',
              error: 'This new password is not strong enough.',
              formContents: req.body,
            });
          } else if (req.body.newPassword !== req.body.confirmPassword) {
            res.render('change-password', {
              title: 'Change your password',
              error: 'The confirm-password doesn\'t match your new password.',
              formContents: req.body,
            });
          } else {
            User.update({password: req.body.newPassword},
              {where: {username: req.session.user.username},
                individualHooks: true})
              .then(user => {
                res.render('change-password', {
                  title: 'Change your password',
                  success: 'You successfully changed your password.',
                  formContents: {},
                });
              }).catch(err => {
                res.render('change-password', {
                  title: 'Change your password',
                  error: 'An error occurred.',
                  formContents: req.body,
                });
                console.log('An error occurred while updating user password ' +
                  `for user ${req.session.user.username}:`, err);
              });
          }
        }).catch(err => {
          res.render('change-password', {
            title: 'Change your password',
            error: 'An error occurred.',
            formContents: req.body,
          });
          console.log('An error occurred while updating user password ' +
            `for user ${req.session.user.username}:`, err);
        });
    });

  /**
   * Accessing this page will log the user out (and redirect him).
   */
  router.get(['/signout', '/logout'], (req, res) => {
    if (req.session.user && req.cookies.user_sid) {
      req.session.destroy();
      res.redirect('/');
    } else {
      res.redirect('/login');
    }
  });

  /**
   * Redirect to the logged in user's own profile page.
   */
  router.get('/user/me', requireLogin, (req, res, next) => {
    res.redirect('/user/' + req.session.user.username);
  });

  /**
   * Public user page showing the user's mods.
   */
  router.get('/user/:id', function(req, res, next) {
    User.findOne({where: {username: req.params.id}})
      .then(user => {
        if (user == null) {
          next();
        } else {
          db.Mod.findAll({where: {author: user.username}})
            .then(mods => {
              res.render('user', {
                title: user.username,
                user: user,
                authoredMods: mods,
                userIsOwner: (req.session.user &&
                req.cookies.user_sid &&
                user.username === req.session.user.username),
              });
            })
            .catch(err => {
              res.render('error', {title: 'Database error',
                error: {status: 500}});
              console.log('Error while querying database for user ' +
                req.params.id + '\'s mods:', err);
            });
        }
      })
      .catch(err => {
        res.render('error', {title: 'Database error', error: {status: 500}});
        console.log('Error while querying database for user ' +
          req.params.id + ':',
        err);
      });
  });

  return router;
};
