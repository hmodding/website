'use strict';
/**
 * Accounting and user pages.
 */
module.exports = (logger, db, mail) => {
  var router = require('express').Router();
  var querystring = require('querystring');
  var GoogleRecaptcha = require('google-recaptcha');
  var fs = require('fs');
  var credentials = JSON.parse(fs.readFileSync('database.json'));
  var captchaSecret = credentials.captchaSecret;
  var captchaPublicKey = credentials.captchaPublicKey;
  var captcha = new GoogleRecaptcha({
    secret: captchaSecret});
  var nanoid = require('nanoid');
  var discordAuth = credentials.discord;
  var baseUrl = credentials.baseUrl;
  var createError = require('http-errors');

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
    .post((req, res, next) => {
      var username = req.body.username;
      var password = req.body.password;

      User.findOne({where: {
        username: {[db.sequelize.Sequelize.Op.iLike]: username},
      }})
        .then(user => {
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
            req.session.save(err => {
              if (err) next(err);
              else {
                res.redirect(req.query.redirect || '/');
              }
            });
          }
        })
        .catch(err => next(err));
    });

  /**
   * Checks if a string contains a number.
   */
  function containsNumber(string) {
    return /\d/.test(string);
  }

  /**
   * Checks if a string contains a lower-case letter.
   */
  function containsLowerCase(string) {
    return /[a-z]/.test(string);
  }

  /**
   * Checks if a string contains a lower-case letter.
   */
  function containsUpperCase(string) {
    return /[A-Z]/.test(string);
  }

  /**
   * Checks if a string is a valid password. Valid passwords must contain at
   * leasteight characters of which at least one is a number, a lower-case
   * letter and an upper-case letter.
   */
  function validatePassword(password) {
    return new Promise((resolve, reject) => {
      if (!password || typeof password !== 'string') {
        reject('Please enter a password!');
      } else if (password.length < 8) {
        reject('Your password must be at least eight characters long!');
      } else if (!containsNumber(password)) {
        reject('Your password must contain at least one number!');
      } else if (!containsLowerCase(password)) {
        reject('Your password must contain at least one lower-case letter!');
      } else if (!containsUpperCase(password)) {
        reject('Your password must contain at least one upper-case letter!');
      } else {
        resolve();
      }
    });
  }

  /**
   * Page for creating a new account.
   */
  router.route('/signup')
    .get(redirectIfLoggedIn, (req, res, next) => {
      res.locals.title = 'Sign up';
      res.locals.redirectQuery = querystring
        .stringify({redirect: req.query.redirect});
      res.locals.formContents = req.body;
      res.locals.captchaPublicKey = captchaPublicKey;

      var accountCreation, user;
      if (req.query.confirm) {
        db.AccountCreation.findOne({where: {token: req.query.confirm}})
          .then(accountCreationResult => {
            if (!accountCreationResult) {
              return Promise.reject('This confirmation link is invalid.');
            } else {
              accountCreation = accountCreationResult;
              return db.User.create({
                username: accountCreation.username,
                email: accountCreation.email,
                password: accountCreation.password,
              });
            }
          })
          .then(userResult => {
            user = userResult;
            logger.info(`Account for user ${user.username} was confirmed.`);
            req.session.user = user;
            req.session.save(err => {
              if (err) next(err);
              else {
                res.redirect(req.query.redirect || '/');
              }
            });
            db.AccountCreation.destroy({where: {id: accountCreation.id}})
              .then(() => {
                logger.debug(`Account creation of user ${user.username} was ` +
                  'completed. Account was moved to users table.');
              });
          })
          .catch(err => {
            var userMessage;
            if (typeof err === 'string') {
              userMessage = err;
            } else {
              userMessage = 'An unknown error occurred. Please try again ' +
              'later.';
              logger.error('Unexpected error while creating user: ', err);
            }
            res.render('signup', {error: userMessage});
          });
      } else {
        res.render('signup', {
          formContents: {},
        });
      }
    })
    .post((req, res) => {
      // common variables for response rendering
      res.locals.title = 'Sign up';
      res.locals.redirectQuery = querystring
        .stringify({redirect: req.query.redirect});
      res.locals.formContents = req.body;
      res.locals.captchaPublicKey = captchaPublicKey;

      var username = req.body.username;
      var email = req.body.email;
      var password = req.body.password;

      // verify captcha
      verifyCaptcha(req.body['g-recaptcha-response'])
        .then(() => {
          if (!username) {
            return Promise.reject('Please provide a username!');
          } else if (!/^[a-zA-Z1-9]+$/.test(username)) {
            return Promise
              .reject('Your username can only contain letters and numbers!');
          } else if (!email) {
            return Promise.reject('Please provide an email address!');
          // eslint-disable-next-line max-len
          } else if (!/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email)) {
            return Promise.reject('The provided email address is invalid!');
          // eslint-disable-next-line max-len
          } else {
            return validatePassword(password);
          }
        })
        .then(() => {
          // check whether a user with the given name or email already exists
          return db.User.findOne({where: {
            [db.sequelize.Sequelize.Op.or]: [
              {
                username: {[db.sequelize.Sequelize.Op.iLike]: username},
              },
              {
                email: email,
              },
            ],
          }});
        })
        .then(user => {
          if (user) {
            return Promise.reject('Sorry, but this username or mail address ' +
              'is already taken. Please pick another one.');
          }
        })
        // begin account creation
        .then(() => db.AccountCreation.create({
          username: username,
          email: email,
          password: password,
          token: nanoid(),
        }))
        // create user session and redirect
        .then(accountCreation => {
          logger.info('Began account creation for user '
            + `${accountCreation.username}.`);

          // build links
          var verifyLink = `${baseUrl}/signup?confirm=${accountCreation.token}`;
          if (res.locals.redirectQuery) {
            verifyLink += `&${res.locals.redirectQuery}`;
          }

          // send confirmation mail
          var siteName = res.locals.newBranding ? 'RaftModding' : 'Raft-Mods';
          mail.send(accountCreation.email,
            `Account confirmation for user ${accountCreation.username} ` +
              `on the ${siteName} site`,
            `Hi ${accountCreation.username},\n\n` +
              `You have requested an account creation on ${baseUrl}. Please ` +
              'click (or copy and paste it into a browser) the following ' +
              `link to confirm that this (${accountCreation.email}) is your ` +
              'email address:\n\n' +
              `\t${verifyLink}\n\n` +
              'If you have not requested an account on our site, you can ' +
              'safely ignore and delete this email. Sorry for the ' +
              'inconveniece!\n\n' +
              `Yours, the ${siteName} team.`
          );

          // render confirmation notice
          res.render('signup', {verify: true});
        })
        .catch(err => {
          var userMessage;
          if (err instanceof db.sequelize.Sequelize.UniqueConstraintError) {
            userMessage = 'The creation of an account with the given username' +
              ' or email address is already in process.';
          } else if (typeof err === 'string') {
            // string errors should be from verifyCaptcha
            userMessage = err;
          } else {
            userMessage = 'An unknown error occurred. Please try again ' +
            'later.';
            logger.error('Unexpected error while creating user: ', err);
          }
          res.render('signup', {error: userMessage});
        });
    });

  function verifyCaptcha(captchaResponse) {
    return new Promise((resolve, reject) => {
      // check whether the captcha was answered
      if (!captchaResponse)
        return reject('Please complete the captcha.');

      // verify correct captcha
      captcha.verify({response: captchaResponse}, (err, body) => {
        if (err) {
          // handle timeout or duplicate error
          if (body &&
              Array.isArray(body['error-codes']) &&
              body['error-codes'].includes('timeout-or-duplicate')) {
            return reject('Please complete the captcha again.');
          } else {
            // any other error
            logger.error('An error occurred while checking the signup ' +
              'captcha:', err);
            return reject('Sorry, there is a problem with the captcha.');
          }
        } else {
          // no error --> correct captcha
          return resolve();
        }
      });
    });
  }

  /**
   * Page to reset a forgotten password.
   */
  router.route('/forgotpassword')
    .get(redirectIfLoggedIn, (req, res, next) => {
      res.locals.title = 'Forgot password';
      res.locals.redirectQuery = querystring
        .stringify({redirect: req.query.redirect});
      res.locals.formContents = {};
      res.locals.captchaPublicKey = captchaPublicKey;

      if (req.query.resetToken) {
        db.PasswordReset.findOne({where: {token: req.query.resetToken}})
          .then(passwordReset => {
            if (!passwordReset) {
              return Promise.reject('This confirmation link is invalid.');
            } else {
              res.render('account/forgotpassword',
                {resetToken: passwordReset.token});
            }
          })
          .catch(err => {
            var userMessage;
            if (typeof err === 'string') {
              userMessage = err;
            } else {
              userMessage = 'An unknown error occurred. Please try again ' +
              'later.';
              logger.error('Unexpected error while querying db for password ' +
                'reset: ', err);
            }
            res.render('account/forgotpassword', {error: userMessage});
          });
      } else {
        res.render('account/forgotpassword');
      }
    })
    .post(redirectIfLoggedIn, (req, res, next) => {
      res.locals.title = 'Forgot password';
      res.locals.redirectQuery = querystring
        .stringify({redirect: req.query.redirect});
      res.locals.formContents = req.body;
      res.locals.captchaPublicKey = captchaPublicKey;

      if (req.body.resetToken) {
        res.locals.resetToken = req.body.resetToken;
        var passwordReset;
        verifyCaptcha(req.body['g-recaptcha-response'])
          .then(() => db.PasswordReset
            .findOne({where: {token: req.body.resetToken}}))
          .then(passwordResetResult => {
            if (!passwordResetResult) {
              res.locals.reset = true;
              return Promise.reject('This password reset link is invalid.');
            } else {
              passwordReset = passwordResetResult;
              if (!req.body.newPassword ||
                !req.body.confirmPassword) {
                return Promise.reject('Please enter your new password twice.');
                // eslint-disable-next-line max-len
              } else {
                return validatePassword(req.body.newPassword);
              }
            }
          })
          .then(() => {
            if (req.body.newPassword !== req.body.confirmPassword) {
              return Promise.reject('The passwords do not match. Please ' +
                'enter your new password twice.');
            } else {
              return db.User.update({password: req.body.newPassword},
                {where: {id: passwordReset.userId}, individualHooks: true});
            }
          })
          .then(user => {
            if (user[0] === 0) return Promise.reject('Could not update ' +
              'password. Does the account still exist?');
            res.locals.formContents.newPassword = '********';
            res.locals.formContents.confirmPassword = '********';
            res.render('account/forgotpassword', {reset: true});
            db.PasswordReset.destroy({where: {userId: passwordReset.userId}})
              .then(() => {
                logger.debug('Password reset for user (' + passwordReset.userId
                  + ') was completed. Password reset entry was deleted.');
              });
          })
          .catch(err => {
            var userMessage;
            if (typeof err === 'string') {
              userMessage = err;
            } else {
              userMessage = 'An unknown error occurred. Please try again ' +
              'later.';
              logger.error('Unexpected error while querying the database for ' +
                'password resets: ', err);
            }
            res.render('account/forgotpassword', {error: userMessage});
          });
      } else if (!req.body.email) {
        res.render('account/forgotpassword',
          {error: 'Please enter an email address to proceed.'});
      } else {
        var user;
        verifyCaptcha(req.body['g-recaptcha-response'])
          .then(() => db.User.findOne({where: {email: req.body.email}}))
          .then(userResult => {
            if (!userResult) return Promise.reject('Sorry, we couldn\'t find ' +
              'an account with that address.');
            else {
              user = userResult;
              if (!user.email.includes('@') &&
                  user.email.startsWith('discord-')) {
                return Promise.reject('How in the world are we supposed to ' +
                  'reset a password for a user without a password?');
              }
              return db.PasswordReset.create({
                userId: user.id,
                token: nanoid(),
              });
            }
          })
          .then(passwordReset => {
            logger.info('Began password reset for user '
              + `(${passwordReset.userId}).`);

            // build links
            var resetLink = `${baseUrl}/forgotpassword?resetToken=` +
              passwordReset.token;
            if (res.locals.redirectQuery) {
              resetLink += `&${res.locals.redirectQuery}`;
            }

            // send reset mail
            var siteName = res.locals.newBranding ? 'RaftModding' : 'Raft-Mods';
            mail.send(user.email,
              `Password for user ${user.username} ` +
                `on the ${siteName} site`,
              `Hi ${user.username},\n\n` +
                `You have requested to reset your password on ${baseUrl}. ` +
                'Please click (or copy and paste it into a browser) the ' +
                'following link to enter a new password:\n\n' +
                `\t${resetLink}\n\n` +
                'If you have not requested to reset your password, you can ' +
                'safely ignore and delete this email. Sorry for the ' +
                'inconveniece!\n\n' +
                `Yours, the ${siteName} team.`
            );

            // render confirmation notice
            res.render('account/forgotpassword', {
              reset: true,
            });
          })
          .catch(err => {
            var userMsg;
            if (err instanceof db.sequelize.Sequelize.UniqueConstraintError) {
              userMsg = 'A password reset for your account is already in ' +
                'progress! Please check your mailbox (and your spam folder).';
            } else if (typeof err === 'string') {
              // string errors should be from verifyCaptcha
              userMsg = err;
            } else {
              userMsg = 'An unknown error occurred. Please try again ' +
              'later.';
              logger.error('Unexpected error while beginning password reset: ',
                err);
            }
            res.render('account/forgotpassword', {error: userMsg});
          });
      }
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
    })
    .post(requireLogin, (req, res, next) => {
      res.locals.title = 'Change your password';
      res.locals.formContents = req.body;
      var respondError = error => res.render('change-password', {error});
      User.findOne({where: {username: req.session.user.username}})
        .then(user => {
          if (!req.body.currentPassword ||
              !req.body.newPassword ||
              !req.body.confirmPassword) {
            respondError('You need to fill all fields of this form to change ' +
              'your password.');
          } else if (!user.validPassword(req.body.currentPassword)) {
            respondError('Your current password is wrong.');
            // eslint-disable-next-line max-len
          } else {
            return validatePassword(req.body.newPassword);
          }
        })
        .then(() => {
          if (req.body.newPassword !== req.body.confirmPassword) {
            respondError('The confirm-password doesn\'t match your new ' +
              'password.');
          } else {
            User.update({password: req.body.newPassword},
              {where: {username: req.session.user.username},
                individualHooks: true})
              .then(user => {
                res.render('change-password', {
                  success: 'You successfully changed your password.',
                  formContents: {},
                });
              }).catch(err => {
                respondError('An error occurred.');
                logger.error('An error occurred while updating user password ' +
                  `for user ${req.session.user.username}:`, err);
              });
          }
        })
        .catch(err => {
          if (err && typeof err === 'string') {
            respondError(err);
          } else {
            respondError('An error occurred.');
            logger.error('An error occurred while updating user password ' +
              `for user ${req.session.user.username}:`, err);
          }
        });
    });

  /**
   * Accessing this page will log the user out (and redirect him).
   */
  router.get(['/signout', '/logout'], (req, res, next) => {
    if (req.session.user && req.cookies.user_sid) {
      req.session.destroy(err => {
        if (err) next(err);
        else {
          res.redirect('/');
        }
      });
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
   * Public user page showing the user's visibleMods.
   */
  router.get('/user/:id', (req, res, next) => {
    User.findOne({where: {
      username: {[db.sequelize.Sequelize.Op.iLike]: req.params.id},
    }})
      .then(user => {
        if (!user) return Promise.reject(createError(404));
        else {
          res.locals.user = user;
          return db.RaftVersion.findOne({
            order: [ ['releasedAt', 'DESC' ]],
          });
        }
      })
      .then(currentRaftVersion => {
        res.locals.currentRaftVersion = currentRaftVersion;
      })
      .then(() => db.Mod.findAll({
        where: {author: res.locals.user.username},
        include: [
          {model: db.ModVersion, include: [
            {model: db.RaftVersion, as: 'minRaftVersion'},
            {model: db.RaftVersion, as: 'maxRaftVersion'},
          ]},
          {model: db.ScheduledModDeletion, as: 'deletion'}],
        order: [
          [db.ModVersion, 'createdAt', 'DESC'],
        ],
      })
      )
      .then(mods => {
        var visibleMods = [];
        for (var i = 0; i < mods.length; i++) {
          if (mods[i].deletion !== null && !res.locals.userIsAdmin &&
            !(req.session && req.session.user &&
              req.session.user.username === mods[i].author)) {
            // do not add to visibleMods
          } else {
            visibleMods.push(mods[i]);
          }
        }
        res.locals.authoredMods = visibleMods;
        return db.ModBundle.findAll({
          where: {maintainerId: res.locals.user.id},
          include: [{model: db.User, as: 'maintainer'}],
        });
      })
      .then(maintainedBundles => {
        res.locals.maintainedBundles = maintainedBundles;
        return db.findCurrentServerVersion();
      })
      .then(currentServerVersion => {
        res.locals.currentServerVersion = currentServerVersion;
        return db.Plugin.findAll({
          where: {maintainerId: res.locals.user.id},
          include: [
            {model: db.PluginVersion, as: 'versions'},
            {model: db.ScheduledPluginDeletion, as: 'deletion'},
            {model: db.User, as: 'maintainer'},
          ],
          order: [
            [{model: db.PluginVersion, as: 'versions'}, 'createdAt', 'DESC'],
          ],
        });
      })
      .then(plugins => {
        var visiblePlugins = [];
        for (var i = 0; i < plugins.length; i++) {
          if (plugins[i].deletion !== null && !res.locals.userIsAdmin &&
            !(req.session && req.session.user &&
              req.session.user.id === plugins[i].maintainerId)) {
            // do not add to visibleMods
          } else {
            visiblePlugins.push(plugins[i]);
          }
        }
        res.locals.maintainedPlugins = visiblePlugins;
        res.render('user', {
          userIsOwner: (req.session.user &&
            req.cookies.user_sid &&
            res.locals.user.username === req.session.user.username),
        });
      })
      .catch(next);
  });

  const fetch = require('node-fetch');
  const btoa = require('btoa');

  router.route('/auth/discord')
    .get(redirectIfLoggedIn, (req, res, next) => {
      if (req.query.code) {
        res.locals.redirect = '';
        res.locals.formContents = {};

        const code = req.query.code;
        const creds = btoa(`${discordAuth.clientId}:${discordAuth.secret}`);
        let params = new URLSearchParams();
        params.append('grant_type', 'authorization_code');
        params.append('code', code);
        params.append('redirect_uri', `${baseUrl}/auth/discord`);

        var tokens, discordUser;
        fetch('https://discord.com/api/oauth2/token', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${creds}`,
          },
          body: params,
        })
          .then(res => res.json())
          .then(tokenResponse => {
            if (tokenResponse.error) {
              res.locals.retry = true;
              return Promise.reject('Invalid code.');
            } else {
              tokens = tokenResponse;
              return fetch('https://discordapp.com/api/users/@me', {
                method: 'GET',
                headers: {
                  Authorization: `Bearer ${tokenResponse.access_token}`,
                },
              });
            }
          })
          .then(res => res.json())
          .then(discordUserResult => {
            if (!discordUserResult) {
              res.locals.retry = true;
              return Promise.reject('Could not fetch discord user.');
            } else {
              discordUser = discordUserResult;
              return db.DiscordSignOn.findOne({where: {
                discordUserId: discordUser.id,
              }});
            }
          })
          .then(discordSignOn => {
            if (discordSignOn) {
              // user exists --> login
              return db.User.findOne({where: {id: discordSignOn.userId}})
                .then(loginUser => {
                  req.session.user = loginUser;
                  req.session.save(err => {
                    if (err) next(err);
                    else {
                      res.redirect('/');
                    }
                  });
                });
            } else {
              // user does not exist --> select username and create account
              return db.DiscordAccountCreation.findOne({where: {
                discordUserId: discordUser.id,
              }})
                .then(oldDAC => {
                  if (oldDAC) {
                    return oldDAC.update({ // update discord tokens
                      accessToken: tokens.access_token,
                      refreshToken: tokens.refresh_token,
                      token: nanoid(), // create new choose-username token
                    });
                  } else {
                    return db.DiscordAccountCreation.create({
                      discordUserId: discordUser.id,
                      accessToken: tokens.access_token,
                      refreshToken: tokens.refresh_token,
                      token: nanoid(),
                      discordUserObject: discordUser,
                    });
                  }
                })
                .then(discordAccountCreation => {
                  res.render('account/signup-discord', {
                    discordAccountCreation: discordAccountCreation,
                  });
                });
            }
          })
          .catch(err => {
            if (typeof err === 'string') {
              res.render('account/signup-discord', {error: err});
            } else {
              res.render('account/signup-discord', {
                error: 'An unexpected error occurred. Please try again later.',
              });
              logger.error('Unexpected error while beginning discord account ' +
                'creation:', err);
            }
          });
      } else {
        var params2 = querystring.stringify({
          client_id: discordAuth.clientId,
          response_type: 'code',
          scope: 'identify',
          redirect_uri: `${baseUrl}/auth/discord`,
        });
        res.redirect(`https://discordapp.com/oauth2/authorize?${params2}`);
      }
    })
    .post(redirectIfLoggedIn, (req, res, next) => {
      if (req.body.token) {
        res.locals.formContents = req.body;

        if (!req.body.username) {
          res.render('account/signup-discord', {
            error: 'Please choose a user name to sign up!',
          });
        } else {
          var discordAccountCreation, newUser;
          db.DiscordAccountCreation.findOne({where: {token: req.body.token}})
            .then(discordAccountCreationResult => {
              if (!discordAccountCreationResult) {
                res.locals.retry = true;
                return Promise.reject('Invalid creation token.');
              } else {
                discordAccountCreation = discordAccountCreationResult;
                res.locals.discordAccountCreation = discordAccountCreation;
                return db.User.findOne({where: {
                  [db.sequelize.Sequelize.Op.or]: [
                    {
                      username: req.body.username,
                    },
                    {
                      email: `discord-${discordAccountCreation.discordUserId}`,
                    },
                  ],
                }});
              }
            })
            .then(userResult => {
              if (userResult) return Promise.reject('Sorry, but this ' +
                'username is already taken. Please pick another one.');
              else {
                return db.User.create({
                  username: req.body.username,
                  email: `discord-${discordAccountCreation.discordUserId}`,
                  password: nanoid(), // random password
                });
              }
            })
            .then(newUserResult => {
              newUser = newUserResult;
              return db.DiscordSignOn.create({
                userId: newUser.id,
                discordUserId: discordAccountCreation.discordUserId,
                accessToken: discordAccountCreation.accessToken,
                refreshToken: discordAccountCreation.refreshToken,
              });
            })
            .then(discordSignOn => {
              req.session.user = newUser;
              req.session.save(err => {
                if (err) next(err);
                else {
                  res.redirect('/');
                }
              });
              logger.info('Discord account creation for user ' +
                `${newUser.username} was completed. Deleting account creation` +
                ' database entry.');
              db.DiscordAccountCreation
                .destroy({where: {id: discordAccountCreation.id}})
                .catch(err => console.error('Error while deleting discord ' +
                  'account creation database entry.', err));
            })
            .catch(err => {
              if (typeof err === 'string') {
                res.render('account/signup-discord', {error: err});
              } else {
                next(err);
              }
            });
        }
      } else {
        res.render('account/signup-discord', {retry: true});
      }
    });

  return router;
};
