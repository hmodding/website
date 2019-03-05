'use strict';
/**
 * Accounting and user pages.
 */
module.exports = (db) => {
  var router = require('express').Router();
  var querystring = require('querystring');

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
          console.error('Could not query user privileges for user ' +
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
          req.session.user = user.dataValues;
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
        })});
    })
    .post((req, res) => {
      User.create({
        username: req.body.username,
        email: req.body.email,
        password: req.body.password,
      })
        .then(user => {
          console.log('User ' + user.username + ' was created.');
          req.session.user = user.dataValues;
          res.redirect(req.query.redirect || '/');
        })
        .catch(err => {
          let message = 'An unknown error occurred. Please try again later.';
          if (err.name === 'SequelizeUniqueConstraintError') {
            message = 'Sorry, but this username or mail address is already ' +
              'taken. Please pick another one.';
          } else {
            console.error('Unexpected error while creating user: ', err);
          }
          res.render('signup', {
            title: 'Sign up',
            error: message,
            redirectQuery: querystring.stringify({
              redirect: req.query.redirect,
            })});
        });
    });

  /**
   * Page to reset a forgotten password.
   */
  router.get('/forgotpassword', function(req, res, next) {
    res.render('forgotpassword', {title: 'Forgot password'});
  });

  /**
   * Accessing this page will log the user out (and redirect him).
   */
  router.get(['/signout', '/logout'], (req, res) => {
    if (req.session.user && req.cookies.user_sid) {
      res.clearCookie('user_sid');
      res.redirect('/');
    } else {
      res.redirect('/login');
    }
  });

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
