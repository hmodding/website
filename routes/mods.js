'use strict';
module.exports = (logger, db, fileScanner) => {
  var express = require('express');
  var router = express.Router();
  var fs = require('fs');
  var convertMarkdown = require('../markdownConverter');
  var querystring = require('querystring');
  var multer = require('multer');
  var upload = multer({storage: multer.memoryStorage()});
  var path = require('path');
  var Mod = db.Mod;
  var FileScan = db.FileScan;
  var createError = require('http-errors');
  var urlModule = require('url');

  /**
   * Thrown in a promise chain if the requested resource could not be found.
   */
  function NotFoundError() {
    this.message = 'The requested page could not be found.';
  }

  // account
  var requireLogin = function(req, res, next) {
    if (req.session.user && req.cookies.user_sid) {
      next();
    } else {
      res.redirect('/signin?' + querystring.stringify({
        redirect: req.originalUrl,
      }));
    }
  };

  /* GET mods listing */
  router.get('/', function(req, res, next) {
    res.locals.search = {
      query: req.query.q,
      compatible: req.query.compatible,
    };
    res.locals.search.anyFilter = (res.locals.search.compatible &&
      (res.locals.search.compatible !== 'off'));
    var query = {};
    if (req.query.q) {
      query.where = {
        [db.sequelize.Sequelize.Op.or]: [
          {
            title: {
              [db.sequelize.Sequelize.Op.iLike]: `%${req.query.q}%`,
            },
          },
          {
            id: {
              [db.sequelize.Sequelize.Op.iLike]: `%${req.query.q}%`,
            },
          },
          {
            author: {
              [db.sequelize.Sequelize.Op.iLike]: `%${req.query.q}%`,
            },
          },
          {
            description: {
              [db.sequelize.Sequelize.Op.iLike]: `%${req.query.q}%`,
            },
          },
          {
            readme: {
              [db.sequelize.Sequelize.Op.iLike]: `%${req.query.q}%`,
            },
          },
        ],
      };
    }
    query.include = [db.ModVersion];
    query.order = [
      [db.ModVersion, 'createdAt', 'DESC'],
    ];

    var currentRmlVersion;
    db.findCurrentRmlVersion()
      .then(currVerRes => {
        currentRmlVersion = currVerRes;
        return Mod.findAll(query);
      })
      .then(mods => {
        var filteredMods = [];
        for (var i = 0; i < mods.length; i++) {
          var accept = true;
          if (res.locals.search.compatible === 'strict') {
            // eslint-disable-next-line max-len
            if (mods[i]['mod-versions'][0].maxCompatibleRmlVersion !== currentRmlVersion) {
              accept = false;
            }
          } else if (res.locals.search.compatible === 'light') {
            if (mods[i]['mod-versions'][0].minCompatibleRmlVersion &&
                // eslint-disable-next-line max-len
                mods[i]['mod-versions'][0].maxCompatibleRmlVersion !== currentRmlVersion &&
                mods[i]['mod-versions'][0].definiteMaxCompatibleRmlVersion) {
              accept = false;
            }
          } else if (res.locals.search.compatible === 'outdated') {
            // eslint-disable-next-line max-len
            if (mods[i]['mod-versions'][0].maxCompatibleRmlVersion === currentRmlVersion ||
                !mods[i]['mod-versions'][0].definiteMaxCompatibleRmlVersion) {
              accept = false;
            }
          } else if (res.locals.search.compatible === 'unknown') {
            if (mods[i]['mod-versions'][0].minCompatibleRmlVersion &&
                // eslint-disable-next-line max-len
                (mods[i]['mod-versions'][0].maxCompatibleRmlVersion === currentRmlVersion ||
                  mods[i]['mod-versions'][0].definiteMaxCompatibleRmlVersion)) {
              accept = false;
            }
          }
          if (accept)
            filteredMods.push(mods[i]);
        }
        mods = filteredMods;
        res.render('mods', {title: 'Mods', mods, currentRmlVersion});
      })
      .catch(err => {
        res.render('error',
          {title: 'An error occurred.', error: {status: 500}});
        logger.error('An error occurred while querying the database for mods:',
          err);
      });
  });
  router.route('/add')
    .get(requireLogin, (req, res) => {
      var rmlVersions;
      db.LoaderVersion.findAll({
        order: [
        // order by timestamp so that the newest version is at the top
          ['timestamp', 'DESC'],
        ],
      })
        .then(rmlVersionsResult => {
          rmlVersions = rmlVersionsResult || [];
          res.render('mod/add', {title: 'Add a mod', rmlVersions,
            formContents: {}});
        })
        .catch(err => {
          res.render('error', {title: 'Internal server error',
            error: {status: 500}});
          logger.error('An error occurred while querying the database for' +
            ' loader versions:', err);
        });
    })
    .post(requireLogin, upload.single('file'), (req, res) => {
      var rmlVersions;
      db.LoaderVersion.findAll({
        order: [
        // order by timestamp so that the newest version is at the top
          ['timestamp', 'DESC'],
        ],
      })
        .then(rmlVersionsResult => {
          rmlVersions = rmlVersionsResult || [];
          res.locals.rmlVersions = rmlVersions;

          var mod = {
            id: req.body.id ? req.body.id.toLowerCase() : req.body.id,
            title: req.body.title,
            description: req.body.description,
            category: req.body.category,
            readme: req.body.readme,
            author: req.session.user,
            bannerImageUrl: req.body.bannerImageUrl,
            repositoryUrl: req.body.repositoryUrl,
            originalWebsiteUrl: req.body.originalWebsiteUrl,
          };
          var modVersion = {
            modId: mod.id,
            version: req.body.version,
            changelog: 'This is the first version.',
            downloadUrl: req.body.downloadUrl || req.file,
            minCompatibleRmlVersion: req.body.minCompatibleRmlVersion,
            maxCompatibleRmlVersion: req.body.maxCompatibleRmlVersion,
            definiteMaxCompatibleRmlVersion:
              (req.body.definiteMaxCompatibleRmlVersion === 'on'),
          };
          if (!mod.id || mod.id === ''
                      || !mod.title
                      || !mod.description
                      || !mod.category
                      || !mod.readme
                      || !mod.author
                      || !modVersion.version
                      || !modVersion.downloadUrl) {
            res.render('mod/add', {
              title: 'Add a mod',
              error: 'All fields of this form need to be filled to submit a ' +
                'mod.',
              formContents: req.body,
            });
          } else if (!/^[a-zA-Z1-9]+$/.test(mod.id)) {
            res.render('mod/add', {
              title: 'Add a mod',
              error: 'The ID can only contain letters and numbers!',
              formContents: req.body,
            });
          } else if (mod.id.length > 64) {
            res.render('mod/add', {
              title: 'Add a mod',
              error: 'The ID can not be longer than 64 characters!',
              formContents: req.body,
            });
          } else if (mod.title.length > 255) {
            res.render('mod/add', {
              title: 'Add a mod',
              error: 'The title can not be longer than 255 characters!',
              formContents: req.body,
            });
          } else if (mod.description.length > 255) {
            res.render('mod/add', {
              title: 'Add a mod',
              error: 'The description can not be longer than 255 characters! ' +
                          'Please use the readme section for longer ' +
                          'explanations.',
              formContents: req.body,
            });
          } else if (modVersion.version.length > 64) {
            res.render('mod/add', {
              title: 'Add a mod',
              error: 'The version can not be longer than 64 characters!',
              formContents: req.body,
            });
          // eslint-disable-next-line max-len
          } else if (mod.originalWebsiteUrl && !/(http[s]?:\/\/)?[^\s(["<,>]*\.[^\s[",><]*/.test(mod.originalWebsiteUrl)) {
            res.render('mod/add', {
              title: 'Add a mod',
              error: 'The original website URL must be empty or a valid URL!',
              formContents: req.body,
            });
          // eslint-disable-next-line max-len
          } else if (mod.repositoryUrl && !/(http[s]?:\/\/)?[^\s(["<,>]*\.[^\s[",><]*/.test(mod.repositoryUrl)) {
            res.render('mod/add', {
              title: 'Add a mod',
              error: 'The repository URL must be empty or a valid URL!',
              formContents: req.body,
            });
          } else if (modVersion.minCompatibleRmlVersion
            // eslint-disable-next-line max-len
            && (!isVersionValid(rmlVersions, modVersion.minCompatibleRmlVersion)
            // eslint-disable-next-line max-len
            || !isVersionValid(rmlVersions, modVersion.maxCompatibleRmlVersion))) {
            res.render('mod/add', {
              title: 'Add a mod',
              error: 'Please select a minimal AND a maximal RML version.',
              formContents: req.body,
            });
          } else {
            mod.id = mod.id.toLowerCase();
            mod.author = mod.author.username;
            if (req.file) {
              // save file
              modVersion.downloadUrl = `/mods/${mod.id}/${modVersion.version}` +
                `/${req.file.originalname}`;
              var dir = path.join('.', 'public', 'mods', mod.id,
                modVersion.version);
              fs.mkdirSync(dir, {recursive: true});
              fs.writeFileSync(
                path.join(dir, req.file.originalname),
                req.file.buffer
              );
              logger.info(`File ${req.file.filename} ` +
                `(${modVersion.downloadUrl}) was saved to disk at ` +
                `${path.resolve(dir)}.`);

              // start scan for viruses
              fileScanner.scanFile(req.file.buffer, req.file.originalname,
                modVersion.downloadUrl);
            }
            Mod.create(mod)
              .then(mod => {
                db.ModVersion.create(modVersion)
                  .then(version => {
                    res.redirect('/mods/' + mod.id);
                    logger.info(`Mod ${mod.id} was created by user ` +
                      `${req.session.user.username}`);
                  })
                  .catch(err => {
                    res.render('mod/add', {
                      title: 'Add a mod',
                      error: 'An error occurred.',
                      formContents: req.body,
                    });
                    logger.error('An error occurred while creating mod ' +
                      'version entry in the database. Mod entry was already ' +
                      'created:', err);
                  });
              }).catch(err => {
                if (err.name === 'SequelizeUniqueConstraintError') {
                  res.render('mod/add', {
                    title: 'Add a mod',
                    error: 'Sorry, but this ID is already taken. ' +
                      'Please choose another one!',
                    formContents: req.body,
                  });
                } else {
                  res.render('mod/add', {
                    title: 'Add a mod',
                    error: 'An error occurred.',
                    formContents: req.body,
                  });
                  logger.error('An error occurred while querying the ' +
                    'database for mods:', err);
                }
              });
          }
        })
        .catch(err => {
          res.render('error', {title: 'Internal server error',
            error: {status: 500}});
          logger.error('An error occurred while querying the database for' +
            ' loader versions:', err);
        });
    });

  /**
   * Middleware function to check whether the logged in user is allowed to edit
   * a mod.
   */
  function requireOwnage(req, res, next) {
    Mod.findOne({where: {id: req.params.id}}).then(mod => {
      if (mod &&
          (req.session.user &&
          req.cookies.user_sid &&
          req.session.user.username === mod.author) || res.locals.userIsAdmin) {
        next();
      } else {
        res.status(403).render('error', {title: 'Access unallowed',
          error: {status: 403}});
      }
    }).catch(err => {
      res.status(500).render('error', {title: 'Internal server error',
        error: {status: 500}});
      logger.error('An error occurred while querying the database for a mod:',
        err);
    });
  }
  function incrementDownloadCount(modId, version) {
    db.ModVersion.update({
      downloadCount: db.sequelize.literal('"downloadCount" + 1'),
    }, {where: {
      modId: modId,
      version: version,
    }}).catch(err => {
      logger.error('Error while incrementing download counter for mod version:',
        err);
    });
  }

  /**
   * Finds the mod from the modId provided in the URL path and saves it to
   * req.mod and res.locals.mod. Will next() with a 404 error if no mod was
   * found.
   * This function will also check if the logged in user owns the mod and save
   * this as a boolean to req.userIsModOwner and res.locals.userIsModOwner.
   */
  function findMod(req, res, next) {
    var modId = req.params.modId;
    db.Mod.findOne({where: {id: modId}, include: [db.ModVersion]})
      .then(mod => {
        if (!mod) next(createError(404));
        else {
          req.mod = res.locals.mod = mod;
          req.userIsModOwner = res.locals.userIsModOwner = req.session &&
            req.session.user &&
            mod.author === req.session.user.username;
          next();
        }
      })
      .catch(next);
  }

  router.get('/:id/download', (req, res, next) => {
    Mod.findOne({where: {id: req.params.id}}).then(mod => {
      if (!mod) next(); // will create a 404 page
      else {
        db.ModVersion.findOne({where: {modId: mod.id}, order: [
          ['createdAt', 'DESC'],
        ]})
          .then(version => {
            if (!version) {
              next(createError(404));
            } else if (version.downloadUrl.startsWith('/')) {
              res.redirect(version.downloadUrl);
            } else {
              incrementDownloadCount(version.modId, version.version);
              res.status(300);
              res.render('warning', {
                title: 'Warning',
                continueLink: version.downloadUrl,
                warning: {
                  title: 'This might be dangerous',
                  text: '<b>We could not scan the requested download for ' +
                    'viruses because it is on an external site.</b><br>' +
                    'We take no responsibility on what you do on ' +
                    'the other site and what the downloaded files might do ' +
                    'to your computer, but you can <a href="/contact">' +
                    'contact us</a> if you think that this link is dangerous.',
                },
              });
            }
          }).catch(err => {
            next(err);
            logger.error('An error occurred while querying the database for ' +
              'a mod version:', err);
          });
      }
    }).catch(err => {
      res.render('error', {error: {status: 404}});
      logger.error('An error occurred while querying the database for a mod:',
        err);
    });
  });
  router.get('/:id/:version/download', (req, res) => {
    Mod.findOne({where: {id: req.params.id}}).then(mod => {
      db.ModVersion.findOne({where: {modId: mod.id,
        version: req.params.version}})
        .then(version => {
          if (version.downloadUrl.startsWith('/'))
            res.redirect(version.downloadUrl);
          else {
            incrementDownloadCount(req.params.id, req.params.version);
            res.status(300);
            res.render('warning', {
              title: 'Warning',
              continueLink: version.downloadUrl,
              warning: {
                title: 'This might be dangerous',
                text: '<b>We could not scan the requested download for ' +
                  'viruses because it is on an external site.</b><br>' +
                  'We take no responsibility on what you do on ' +
                  'the other site and what the downloaded files might do to ' +
                  'your computer, but you can <a href="/contact">contact ' +
                  'us</a> if you think that this link is dangerous.',
              },
            });
          }
        }).catch(err => {
          res.render('error', {title: 'Internal server error',
            error: {status: 500}});
          logger.error('An error occurred while querying the database for ' +
            'a mod version:', err);
        });
    }).catch(err => {
      res.render('error', {error: {status: 404}});
      logger.error('An error occurred while querying the database for a mod:',
        err);
    });
  });
  router.route('/:modId/edit')
    .get(requireLogin, findMod, requireOwnage, (req, res, next) => {
      res.render('mod/edit', {
        title: `Edit ${req.mod.title}`,
        formContents: req.mod,
      });
    })
    .post(requireLogin, findMod, requireOwnage, (req, res) => {
      res.locals.title = `Edit ${req.mod.title}`;
      res.locals.formContents = req.mod;
      if (req.body.changeOwner !== undefined) {
        var newOwner = req.body.changeOwner;
        db.User.findOne({where: {username: newOwner}}).then(user => {
          if (!user) {
            res.render('mod/edit', {
              error: 'There is no user with the specified username.',
            });
          } else {
            req.mod.update({author: newOwner})
              .then(() => {
                logger.info(`Mod ${req.mod.id} was transferred to user ` +
                    newOwner + `by ${req.session.user.username}.`);
                res.redirect('/mods/' + req.mod.id);
              })
              .catch(err => {
                res.render('mod/edit', {error: 'An error occurred.'});
                logger.error('An error occurred while transferring mod ' +
                    `${req.mod.id} in the database.`, err);
              });
          }
        });
      } else if (req.body.deleteMod !== undefined) {
        if (req.body.deleteMod !== req.mod.id) {
          res.render('mod/edit', {
            error: (req.body.deleteMod ? 'The specified id is not correct.'
              : 'You have to enter the mod id to delete this mod.'),
          });
        } else {
          req.mod.destroy()
            .then(() => {
              logger.info(`Mod ${req.mod.id} was deleted by ` +
                  `${req.session.user.username}.`);
              res.redirect('/');
            })
            .catch(err => {
              res.render('mod/edit', {error: 'An error occurred.'});
              logger.error('An error occurred while deleting mod ' +
                    `${req.mod.id} from the database.`, err);
            });
        }
      } else {
        res.locals.formContents = req.body;
        var modUpdate = {
          title: req.body.title,
          description: req.body.description,
          category: req.body.category,
          readme: req.body.readme,
          bannerImageUrl: req.body.bannerImageUrl,
          repositoryUrl: req.body.repositoryUrl,
          originalWebsiteUrl: req.body.originalWebsiteUrl,
        };
        if (!modUpdate.title
                      || !modUpdate.description
                      || !modUpdate.category
                      || !modUpdate.readme) {
          res.render('mod/edit', {
            error: 'All fields of this form need to be filled to submit ' +
              'changes to a mod.',
          });
        } else if (modUpdate.title.length > 255) {
          res.render('mod/edit', {
            error: 'The title can not be longer than 255 characters!',
          });
        } else if (modUpdate.description.length > 255) {
          res.render('mod/edit', {
            error: 'The description can not be longer than 255 characters! ' +
              'Please use the readme section for longer explanations.',
          });
          // eslint-disable-next-line max-len
        } else if (modUpdate.originalWebsiteUrl && !/(http[s]?:\/\/)?[^\s(["<,>]*\.[^\s[",><]*/.test(modUpdate.originalWebsiteUrl)) {
          res.render('mod/edit', {
            error: 'The original website URL must be empty or a valid URL!',
          });
          // eslint-disable-next-line max-len
        } else if (modUpdate.repositoryUrl && !/(http[s]?:\/\/)?[^\s(["<,>]*\.[^\s[",><]*/.test(modUpdate.repositoryUrl)) {
          res.render('mod/edit', {
            error: 'The repository URL must be empty or a valid URL!',
          });
        } else {
          // save update to db
          req.mod.update(modUpdate)
            .then(() => {
              logger.info(`Mod ${req.mod.id} was updated by user ` +
                req.session.user.username);
              res.redirect('/mods/' + req.mod.id);
            })
            .catch(err => {
              res.render('mod/edit', {
                error: 'An error occurred.',
              });
              logger.error('An error occurred while updating mod ' +
                `${req.mod.id}  in the database: `, err);
            });
        }
      }
    });

  /**
   * Page for adding a new version to an existing mod.
   */
  router.route('/:id/addversion')
    .get(requireLogin, requireOwnage, (req, res, next) => {
      var mod, rmlVersions;
      db.Mod.findOne({where: {id: req.params.id}})
        .then(modResult => {
          if (!modResult) throw new NotFoundError();
          else {
            mod = modResult;
            return db.LoaderVersion.findAll({
              order: [
              // order by timestamp so that the newest version is at the top
                ['timestamp', 'DESC'],
              ],
            });
          }
        })
        .then(rmlVersionsResult => {
          rmlVersions = rmlVersionsResult || [];
          res.render('mod/version-add', {
            title: 'Add mod version',
            mod: mod,
            formContents: {},
            rmlVersions: rmlVersions,
          });
        })
        .catch(err => {
          if (err instanceof NotFoundError) next(); // will create 404 page
          else {
            res.render('error', {title: 'Internal server error',
              error: {status: 500}});
            logger.error('An error occurred while querying the database for' +
            ' a mod:', err);
          }
        });
    })
    .post(requireLogin, requireOwnage, upload.single('file'),
      (req, res, next) => {
        var mod, rmlVersions;
        Mod.findOne({where: {id: req.params.id}})
          .then(modResult => {
            if (!modResult) throw new NotFoundError();
            else {
              mod = modResult;
              return db.LoaderVersion.findAll({
                order: [
                  // order by timestamp so that the newest version is at the top
                  ['timestamp', 'DESC'],
                ],
              });
            }
          })
          .then(rmlVersionsResult => {
            rmlVersions = rmlVersionsResult || [];
            res.locals.rmlVersions = rmlVersions;

            var modVersion = {
              modId: mod.id,
              version: req.body.version,
              changelog: req.body.changelog,
              downloadUrl: req.body.downloadUrl || req.file,
              minCompatibleRmlVersion: req.body.minCompatibleRmlVersion,
              maxCompatibleRmlVersion: req.body.maxCompatibleRmlVersion,
              definiteMaxCompatibleRmlVersion:
                (req.body.definiteMaxCompatibleRmlVersion === 'on'),
            };
            if (!modVersion.version
              || !modVersion.changelog
              || !modVersion.downloadUrl) {
              res.render('mod/version-add', {
                title: 'Add mod version',
                error: 'All fields of this form need to be filled to submit ' +
                'a new mod version.',
                formContents: req.body,
                mod: mod,
              });
            } else if (modVersion.version.length > 64) {
              res.render('mod/version-add', {
                title: 'Add mod version',
                error: 'The version can not be longer than 64 characters!',
                formContents: req.body,
                mod: mod,
              });
            } else if (modVersion.minCompatibleRmlVersion
              // eslint-disable-next-line max-len
              && (!isVersionValid(rmlVersions, modVersion.minCompatibleRmlVersion)
              // eslint-disable-next-line max-len
              || !isVersionValid(rmlVersions, modVersion.maxCompatibleRmlVersion))) {
              res.render('mod/version-add', {
                title: 'Add mod version',
                error: 'Please select a minimal AND a maximal RML version.',
                formContents: req.body,
                mod: mod,
              });
            } else {
              modVersion.version = modVersion.version.toLowerCase();
              if (req.file) {
              // save file
                modVersion.downloadUrl = `/mods/${mod.id}/` +
                  `${modVersion.version}/${req.file.originalname}`;
                var dir = path.join('.', 'public', 'mods', mod.id,
                  modVersion.version);
                fs.mkdirSync(dir, {recursive: true});
                fs.writeFileSync(path.join(dir, req.file.originalname),
                  req.file.buffer);
                logger.info(`File ${req.file.filename} (` +
                `${modVersion.downloadUrl}) was saved to disk at ` +
                `${path.resolve(dir)}.`);

                // start scan for viruses
                fileScanner.scanFile(req.file.buffer, req.file.originalname,
                  modVersion.downloadUrl);
              }
              // create mod version in the database
              db.ModVersion.create(modVersion)
                .then(modVersion => {
                  res.redirect('/mods/' + modVersion.modId);
                }).catch(err => {
                  if (err.name === 'SequelizeUniqueConstraintError') {
                    res.render('mod/version-add', {
                      title: 'Add mod version',
                      error: 'Sorry, but this version already exists Please ' +
                      'choose another one!',
                      formContents: req.body,
                    });
                  } else {
                    res.render('mod/version-add', {
                      title: 'Add mod version',
                      error: 'An error occurred.',
                      formContents: req.body,
                    });
                    logger.error('An error occurred while creating mod ' +
                    'version in the database:', err);
                  }
                });
            }
          })
          .catch(err => {
            if (err instanceof NotFoundError) next(); // will create 404 page
            else {
              res.render('error', {title: 'Internal server error',
                error: {status: 500}});
              logger.error('An error occurred while querying the database for' +
            ' a mod:', err);
            }
          });
      });

  /**
   * Page for editing an existing version.
   */
  router.route('/:id/:version/edit')
    .get(requireLogin, requireOwnage, (req, res, next) => {
      var mod, version, rmlVersions;
      Mod.findOne({where: {id: req.params.id}})
        .then(modResult => {
          if (!modResult) throw new NotFoundError();
          else {
            mod = modResult;
            return db.ModVersion.findOne({where: {modId: mod.id,
              version: req.params.version}});
          }
        })
        .then(versionResult => {
          if (!versionResult) throw new NotFoundError();
          else {
            version = versionResult;
            return db.LoaderVersion.findAll({
              order: [
                // order by timestamp so that the newest version is at the top
                ['timestamp', 'DESC'],
              ],
            });
          }
        })
        .then(rmlVersionsResult => {
          rmlVersions = rmlVersionsResult || [];
          res.render('mod/version-edit', {
            title: 'Edit mod version',
            mod: mod,
            version: version,
            formContents: version,
            rmlVersions: rmlVersions,
          });
        })
        .catch(err => {
          if (err instanceof NotFoundError) next(); // will create a 404 page
          else {
            res.render('error', {title: 'Internal server error',
              error: {status: 500}});
            logger.error('An error occurred while querying the database for ' +
              'a mod:', err);
          }
        });
    })
    .post(requireLogin, requireOwnage, (req, res, next) => {
      var mod, version, rmlVersions;
      db.Mod.findOne({where: {id: req.params.id}})
        .then(modResult => {
          if (!modResult) throw new NotFoundError();
          else {
            mod = modResult;
            return db.ModVersion.findOne({where: {modId: mod.id,
              version: req.params.version}});
          }
        })
        .then(versionResult => {
          if (!versionResult) throw new NotFoundError();
          else {
            version = versionResult;
            return db.LoaderVersion.findAll({
              order: [
                // order by timestamp so that the newest version is at the top
                ['timestamp', 'DESC'],
              ],
            });
          }
        })
        .then(rmlVersionsResult => {
          rmlVersions = rmlVersionsResult || [];

          var versionUpdate = {
            changelog: req.body.changelog,
            minCompatibleRmlVersion: req.body.minCompatibleRmlVersion,
            maxCompatibleRmlVersion: req.body.maxCompatibleRmlVersion,
            definiteMaxCompatibleRmlVersion:
              (req.body.definiteMaxCompatibleRmlVersion === 'on'),
          };
          if (!versionUpdate.changelog) {
            res.render('mod/version-edit', {
              title: 'Edit mod version',
              error: 'All fields of this form need to be filled to submit ' +
                  'changes to a mod.',
              mod: mod,
              version: version,
              formContents: req.body,
              rmlVersions: rmlVersions,
            });
          } else if (versionUpdate.minCompatibleRmlVersion
              // eslint-disable-next-line max-len
              && (!isVersionValid(rmlVersions, versionUpdate.minCompatibleRmlVersion)
              // eslint-disable-next-line max-len
              || !isVersionValid(rmlVersions, versionUpdate.maxCompatibleRmlVersion))) {
            res.render('mod/version-edit', {
              title: 'Edit mod version',
              error: 'Please select a minimal AND a maximal RML version.',
              mod: mod,
              version: version,
              formContents: req.body,
              rmlVersions: rmlVersions,
            });
          } else {
            db.ModVersion.update(versionUpdate, {where: {modId: mod.id,
              version: version.version}})
              .then(() => {
                logger.info(`Mod ${mod.id}'s version ${version.version} ` +
                    `was updated by user ${req.session.user.username}.`);
                res.redirect('/mods/' + mod.id + '/versions');
              }).catch(err => {
                res.render('mod/version-edit', {
                  title: 'Edit mod version',
                  error: 'An error occurred.',
                  mod: mod,
                  version: version,
                  formContents: req.body,
                  rmlVersions: rmlVersions,
                });
                logger.error('An error occurred while updating mod ' +
                    `${mod.id}'s version ${version.version} in the database:`,
                err);
              });
          }
        })
        .catch(err => {
          if (err instanceof NotFoundError) next(); // will create 404 page
          else {
            res.status(500).render('error', {title: 'Internal server error',
              error: {status: 500}});
            logger.error('An error occurred while querying the database for ' +
              'a mod:', err);
          }
        });
    });

  function isVersionValid(rmlVersions, versionKey) {
    for (var i = 0; i < rmlVersions.length; i++) {
      if (rmlVersions[i].rmlVersion === versionKey) {
        return true;
      }
    }
    return false;
  }

  router.get('/:id', function(req, res, next) {
    Mod.findOne({where: {id: req.params.id}}).then(mod => {
      if (!mod) next(); // will create a 404 page
      else {
        db.ModVersion.findAll({where: {modId: mod.id}, order: [
          // order by creation time so that the newest version is at the top
          ['createdAt', 'DESC'],
        ]})
          .then(versions => {
            mod.readmeMarkdown = convertMarkdown(mod.readme);
            res.render('mod', {
              title: mod.title,
              mod: mod,
              versions: versions,
              userIsOwner: (req.session.user &&
                req.cookies.user_sid &&
                mod.author === req.session.user.username),
            });
          })
          .catch(err => {
            res.render('error', {title: 'Internal server error',
              error: {status: 500}});
            logger.error('An error occurred while querying the database for ' +
              'mod versions:', err);
          });
      }
    }).catch(err => {
      res.render('error', {error: {status: 404}});
      logger.error('An error occurred while querying the database for a mod:',
        err);
    });
  });
  router.get('/:id/versions', (req, res, next) => {
    var mod, versions;
    Mod.findOne({where: {id: req.params.id}})
      .then(modResult => {
        if (!modResult) throw createError(404);
        else {
          mod = modResult;
          return db.ModVersion.findAll({where: {modId: mod.id}, order: [
            // order by creation time so that the newest version is at the top
            ['createdAt', 'DESC'],
          ]});
        }
      })
      .then(versionsResult => {
        versions = versionsResult;
        return db.findCurrentRmlVersion();
      })
      .then(currentRmlVersion => {
        // render markdown changelogs
        for (var i = 0; i < versions.length; i++) {
          versions[i].changelogMarkdown =
            convertMarkdown(versions[i].changelog);
        }
        // respond
        res.render('mod/versions', {
          title: mod.title,
          mod: mod,
          versions: versions,
          userIsOwner: (req.session.user &&
          req.cookies.user_sid &&
          mod.author === req.session.user.username),
          currentRmlVersion: currentRmlVersion,
        });
      })
      .catch(err => {
        if (err instanceof createError.HttpError) next(err);
        else {
          logger.error('An error occurred while querying the database for ' +
            'mod versions:', err);
          next(createError(err));
        }
      });
  });
  router.get('/:id/:version/:file', function(req, res, next) {
    var urlPath = urlModule.parse(req.originalUrl).pathname;
    FileScan.findOne({where: {fileUrl: urlPath}}).then(fileScan => {
      if (!fileScan) {
        logger.debug('not found');
        next();
      } else if (req.query.ignoreVirusScan) {
        incrementDownloadCount(req.params.id, req.params.version);
        // forbid indexing of downloads
        res.setHeader('X-Robots-Tag', 'noindex');
        next(); // file will be returned by static files handler
      } else if (!fileScan.scanResult) {
        respondVirusWarning(req, res, 'This file has not yet been scanned, ' +
          'but a scan is in progress.');
      } else if (fileScan.scanResult.positives > 0) {
        respondVirusWarning(req, res, 'VirusTotal has detected a virus in ' +
          'this file.');
      } else {
        respondVirusWarning(req, res, 'VirusTotal has scanned and found no ' +
          'virus in this file (click ' +
          `<a href="${fileScan.scanResult.permalink}">here</a> for the ` +
          'report), but there could still be a virus in it.');
      }
    }).catch(err => {
      next(err);
      logger.error('Error while querying database for file scan:', err);
    });
  });

  function respondVirusWarning(req, res, scanStateText) {
    res.status(300);
    res.render('warning', {
      title: 'Warning',
      continueLink: req.originalUrl + '?ignoreVirusScan=true',
      warning: {
        title: 'This might be dangerous',
        text: `<b>${scanStateText}</b><br>We take no responsibility on` +
          ' what this file could do to your computer, but you can' +
          ' <a href="/contact">contact us</a> if you think that this link is ' +
          'dangerous.',
      },
    });
  }
  return router;
};
