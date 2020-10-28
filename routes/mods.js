'use strict';

const { createModuleLogger } = require('../src/logger');

const logger = createModuleLogger('mods-router');

module.exports = (mainLogger, db, fileScanner, modDeleter, downloadTracker) => {
  const router = require('express').Router();
  var fs = require('fs');
  var convertMarkdown = require('../markdownConverter');
  var querystring = require('querystring');
  var multer = require('multer');
  var upload = multer({storage: multer.memoryStorage()});
  var path = require('path');
  var createError = require('http-errors');
  const urlModule = require('url');
  const validate = require('../util/validation');
  var credentials = JSON.parse(fs.readFileSync('database.json'));
  const acceptedModFileTypes = credentials.acceptedModFileTypes
    || '.cs,.dll,.zip,.rar,.7z,.bzip2,.gzip,.tar,.wim,.xz';
  const installableModFileType = credentials.installableModFileType || '.rmod';
  const Sentry = require('@sentry/node');

  const { DiscordNotificationServiceClient } =
    require('@raftmodding/discord-notification-client');
  const notificationClient = new DiscordNotificationServiceClient(
    credentials.notificationService.baseUrl,
    credentials.notificationService.token);

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

  /**
   * Middleware function for collecting the latest raft update and storing it to
   * `res.locals.currentRaftVersion`.
   */
  const withCurrentRaftVersion = (req, res, next) => {
    db.RaftVersion.findOne({
      order: [ ['releasedAt', 'DESC' ]],
    })
      .then(currentRaftVersion => {
        res.locals.currentRaftVersion = currentRaftVersion;
        next();
      })
      .catch(next);
  };

  /**
   * Middleware function for collecting all raft updates and storing them to
   * `res.locals.raftVersions`.
   */
  const withRaftVersions = (req, res, next) => {
    db.RaftVersion.findAll({
      order: [ ['releasedAt', 'DESC' ]],
    })
      .then(raftVersions => {
        res.locals.raftVersions = raftVersions;
        next();
      })
      .catch(next);
  };

  /* GET mods listing */
  router.get('/', withCurrentRaftVersion, function(req, res, next) {
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
    query.include = [
      {model: db.ModVersion, include: [
        {model: db.RaftVersion, as: 'minRaftVersion'},
        {model: db.RaftVersion, as: 'maxRaftVersion'},
      ]},
      {model: db.ScheduledModDeletion, as: 'deletion'},
    ];
    query.order = [
      [db.ModVersion, 'createdAt', 'DESC'],
    ];

    // id of the latest raft version
    let currRaftId = res.locals.currentRaftVersion.id;
    db.Mod.findAll(query)
      .then(mods => {
        var filteredMods = [];
        for (var i = 0; i < mods.length; i++) {
          var accept = true;
          if (mods[i].deletion !== null && !res.locals.userIsAdmin &&
            !(req.session && req.session.user &&
              req.session.user.username === mods[i].author)) {
            accept = false;
          }
          if (res.locals.search.compatible === 'strict') {
            if (mods[i]['mod-versions'][0].maxRaftVersionId !== currRaftId) {
              accept = false;
            }
          } else if (res.locals.search.compatible === 'light') {
            if (mods[i]['mod-versions'][0].minRaftVersionId &&
                mods[i]['mod-versions'][0].maxRaftVersionId !== currRaftId &&
                mods[i]['mod-versions'][0].definiteMaxRaftVersion) {
              accept = false;
            }
          } else if (res.locals.search.compatible === 'outdated') {
            if (mods[i]['mod-versions'][0].maxRaftVersionId === currRaftId ||
                !mods[i]['mod-versions'][0].definiteMaxRaftVersion) {
              accept = false;
            }
          } else if (res.locals.search.compatible === 'unknown') {
            if (mods[i]['mod-versions'][0].minRaftVersionId &&
                (mods[i]['mod-versions'][0].maxRaftVersionId === currRaftId ||
                  mods[i]['mod-versions'][0].definiteMaxRaftVersion)) {
              accept = false;
            }
          }
          if (accept)
            filteredMods.push(mods[i]);
        }
        mods = filteredMods;
        res.render('mods', {title: 'Mods', mods});
      })
      .catch(err => {
        res.render('error',
          {title: 'An error occurred.', error: {status: 500}});
        logger.error('An error occurred while querying the database for mods:',
          err);
      });
  });
  router.route('/add')
    .get(requireLogin, withRaftVersions, (req, res) => {
      var latestVersionId = res.locals.raftVersions.length === 0 ?
        undefined : res.locals.raftVersions[0].id;
      res.render('mod/add', {
        title: 'Add a mod',
        formContents: {
          minRaftVersionId: latestVersionId,
          maxRaftVersionId: latestVersionId,
        },
        acceptedModFileTypes,
      });
    })
    .post(requireLogin, withRaftVersions, upload.single('file'),
      (req, res) => {
        res.locals.title = 'Add a mod';
        res.locals.formContents = req.body;
        res.locals.acceptedModFileTypes = acceptedModFileTypes;

        var respondError = error => res.render('mod/add', {error});

        var mod = {
          id: req.body.slug ? req.body.slug.toLowerCase() : req.body.slug,
          title: req.body.title,
          description: req.body.description,
          category: req.body.category,
          readme: req.body.readme,
          author: req.session.user,
          bannerImageUrl: req.body.bannerImageUrl,
          iconImageUrl: req.body.iconImageUrl,
          repositoryUrl: req.body.repositoryUrl,
        };
        var modVersion = {
          modId: mod.id,
          version: req.body.version,
          changelog: 'This is the first version.',
          downloadUrl: req.file,
          minRaftVersionId: parseInt(req.body.minRaftVersionId, 10),
          maxRaftVersionId: parseInt(req.body.maxRaftVersionId, 10),
          definiteMaxRaftVersion:
              (req.body.definiteMaxRaftVersion === 'on'),
        };
        if (!mod.id || mod.id === ''
                      || !mod.title
                      || !mod.description
                      || !mod.category
                      || !mod.readme
                      || !mod.author
                      || !modVersion.version
                      || !modVersion.downloadUrl) {
          respondError('All fields of this form need to be filled to ' +
                'submit a mod.');
        } else if (!validate.isSlug(mod.id)) {
          respondError('The mod slug can only contain lowercase letters, ' +
            'numbers, dashes, underscores and dots. It must be between 1 and ' +
            '64 characters long.');
        } else if (mod.title.length > 255) {
          respondError('The title can not be longer than 255 characters!');
        } else if (mod.description.length > 255) {
          respondError('The description can not be longer than ' +
              '255 characters! Please use the readme section for longer ' +
              'explanations.');
        } else if (!validate.isSlug(modVersion.version)) {
          respondError('The mod version must be a slug!');
          // eslint-disable-next-line max-len
        } else if (mod.repositoryUrl && !/(http[s]?:\/\/)?[^\s(["<,>]*\.[^\s[",><]*/.test(mod.repositoryUrl)) {
          respondError('The repository URL must be empty or a valid URL!');
        } else if (mod.iconImageUrl && !validate.isUrl(mod.iconImageUrl)) {
          respondError('The icon image URL is not a valid URL.');
        } else if (modVersion.minRaftVersionId
            // eslint-disable-next-line max-len
            && (!isRaftVersionIdValid(res.locals.raftVersions, modVersion.minRaftVersionId)
            // eslint-disable-next-line max-len
            || !isRaftVersionIdValid(res.locals.raftVersions, modVersion.maxRaftVersionId))) {
          respondError('Please select a minimal AND a maximal RML version.');
        } else if (!isValidModFileType(req.file)) {
          respondError('The mod file has an invalid file type.');
        } else {
          mod.id = mod.id.toLowerCase();
          mod.author = mod.author.username;
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
          db.Mod.create(mod)
            .then(mod => {
              db.ModVersion.create(modVersion)
                .then(version => {
                  res.redirect('/mods/' + mod.id);
                  logger.info(`Mod ${mod.id} was created by user ` +
                      `${req.session.user.username}`);
                  sendVersionReleaseNotification(mod, version, true);
                })
                .catch(err => {
                  respondError('An error occurred.');
                  logger.error('An error occurred while creating mod ' +
                      'version entry in the database. Mod entry was already ' +
                      'created:', err);
                });
            }).catch(err => {
              if (err.name === 'SequelizeUniqueConstraintError') {
                respondError('Sorry, but this ID is already taken. ' +
                      'Please choose another one!');
              } else {
                respondError('An error occurred.');
                logger.error('An error occurred while querying the ' +
                    'database for mods:', err);
              }
            });
        }
      });

  /**
   * Middleware function to check whether the logged in user is allowed to edit
   * a mod.
   */
  function requireOwnage(req, res, next) {
    if (req.userIsModOwner || res.locals.userIsAdmin) {
      next();
    } else {
      res.status(403).render('error', {title: 'Access unallowed',
        error: {status: 403}});
    }
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
   * req.mod and res.locals.mod (mod versions are included in the 'mod-versions'
   * array property). Will next() with a 404 error if no mod was
   * found.
   * This function will also check if the logged in user owns the mod and save
   * this as a boolean to req.userIsModOwner and res.locals.userIsModOwner.
   */
  function findMod(req, res, next) {
    var modId = req.params.modId;
    db.Mod.findOne({
      where: {id: modId},
      include: [{
        model: db.ModVersion,
        include: [
          {model: db.RaftVersion, as: 'minRaftVersion'},
          {model: db.RaftVersion, as: 'maxRaftVersion'},
        ],
      }],
      order: [[db.ModVersion, 'createdAt', 'DESC']],
    })
      .then(mod => {
        if (!mod) return Promise.reject(createError(404));
        else {
          req.mod = res.locals.mod = mod;
          req.userIsModOwner = res.locals.userIsModOwner = req.session &&
            req.session.user &&
            mod.author === req.session.user.username;
          req.mod.downloadCount = 1;
          return req.mod.countLikes();
        }
      })
      .then(likeCount => {
        req.mod.likeCount = likeCount;
        if (res.locals.loggedIn) {
          return req.mod.getLikes({where: {id: req.session.user.id}})
            .then(userLike => {
              req.mod.likedByUser = userLike && userLike.length > 0;
            });
        }
      })
      .then(() => {
        return db.ScheduledModDeletion.findOne({where: {modId}});
      })
      .then(modDeletion => {
        if (modDeletion) {
          if (req.userIsModOwner || res.locals.userIsAdmin) {
            res.locals.modDeletion = modDeletion;
          } else {
            return Promise.reject(createError(404));
          }
        }
      })
      .then(() => {
        if (req.mod['mod-versions'] && req.mod['mod-versions'].length > 0) {
          var downloadCount = 0;
          for (var i = 0; i < req.mod['mod-versions'].length; i++) {
            downloadCount += req.mod['mod-versions'][i].downloadCount;
          }
          req.mod.downloadCount = downloadCount;
          var version = req.mod['mod-versions'][0];
          if (version.downloadUrl.startsWith('/')) {
            return db.FileScan.findOne({where: {fileUrl: version.downloadUrl}})
              .then(fileScan => {
                if (fileScan) {
                  res.locals.downloadWarning = {fileScan};
                }
              })
              .catch(next);
          } else {
            res.locals.downloadWarning = {externalDownloadLink:
              `/mods/${req.mod.id}/${version.version}/download`};
          }
        }
      })
      .then(() => next())
      .catch(next);
  }

  router.post('/:modId/like', findMod, requireLogin, (req, res, next) => {
    db.User.findOne({where: {id: req.session.user.id}})
      .then(user => {
        if (req.query.like === 'true') {
          return req.mod.addLike(user)
            .then(() => {
              res.status(200).json({ok: true});
              logger.debug(`User ${user.username} liked mod ${req.mod.id}.`);
            });
        } else {
          return req.mod.removeLike(user)
            .then(() => {
              res.status(200).json({ok: true});
              logger.debug(`User ${user.username} un-liked mod ${req.mod.id}.`);
            });
        }
      })
      .catch(next);
  });

  /**
   * Redirect to the latest download.
   */
  router.get('/:modId/download', findMod, (req, res, next) => {
    var version = req.mod['mod-versions'][0];
    if (!version) {
      next(createError(404));
    } else {
      res.redirect(`/mods/${req.mod.id}/${version.version}/download` +
        (req.query.ignoreVirusScan === 'true' ? '?ignoreVirusScan=true' : ''));
    }
  });

  router.get('/:modId/:version/download', findMod, (req, res, next) => {
    req.params.id = req.params.modId;
    db.ModVersion.findOne({where: {modId: req.mod.id,
      version: req.params.version}})
      .then(version => {
        if (version.downloadUrl.startsWith('/'))
          res.redirect(version.downloadUrl +
            (req.query.ignoreVirusScan === 'true' ? '?ignoreVirusScan=true'
              : ''));
        else {
          if (req.query.ignoreVirusScan === 'true') {
            let ip = req.header('cf-connecting-ip') || req.ip;
            downloadTracker.trackDownload(ip, version.downloadUrl,
              () => incrementDownloadCount(req.params.id, req.params.version));
            res.redirect(version.downloadUrl);
          } else {
            res.status(300).render('download-warning/full-page', {
              downloadWarning: {externalDownloadLink:
                `/mods/${req.mod.id}/${version.version}/download`},
            });
          }
        }
      }).catch(next);
  });
  router.route('/:modId/edit')
    .get(requireLogin, findMod, requireOwnage, (req, res, next) => {
      res.render('mod/edit', {
        title: `Edit ${req.mod.title}`,
        formContents: req.mod,
        deletionInterval: modDeleter.deletionInterval,
      });
    })
    .post(requireLogin, findMod, requireOwnage, (req, res, next) => {
      res.locals.title = `Edit ${req.mod.title}`;
      res.locals.formContents = req.mod;
      res.locals.deletionInterval = modDeleter.deletionInterval;

      var respondError = error => res.render('mod/edit', {error});

      if (req.body.action === 'cancel-deletion') {
        db.ScheduledModDeletion.findOne({where: {modId: req.mod.id}})
          .then(deletion => {
            if (!deletion) {
              return Promise.reject('This mod is not scheduled for deletion!');
            } else {
              return deletion.destroy();
            }
          })
          .then(() => {
            delete res.locals.modDeletion;
            res.render('mod/edit', {success: 'The mod deletion was ' +
              'cancelled! The mod is now publicly visible again.'});
          })
          .catch(err => {
            if (typeof err === 'string') {
              respondError(err);
            } else {
              next(err);
            }
          });
      } else if (req.body.changeOwner !== undefined) {
        var newOwner = req.body.changeOwner;
        db.User.findOne({where: {username: newOwner}}).then(user => {
          if (!user) {
            respondError('There is no user with the specified username.');
          } else {
            req.mod.update({author: newOwner})
              .then(() => {
                logger.info(`Mod ${req.mod.id} was transferred to user ` +
                    newOwner + `by ${req.session.user.username}.`);
                res.redirect('/mods/' + req.mod.id);
              })
              .catch(err => {
                respondError('An error occurred.');
                logger.error('An error occurred while transferring mod ' +
                    `${req.mod.id} in the database.`, err);
              });
          }
        });
      } else if (req.body.deleteMod !== undefined) {
        if (req.body.deleteMod !== req.mod.id) {
          respondError((req.body.deleteMod ? 'The specified id is not correct.'
            : 'You have to enter the mod id to delete this mod.'));
        } else {
          modDeleter.scheduleDeletion(req.mod, req.session.user)
            .then(modDeletion => res.render('mod/edit', {modDeletion}))
            .catch(respondError);
        }
      } else {
        res.locals.formContents = req.body;
        var modUpdate = {
          title: req.body.title,
          description: req.body.description,
          category: req.body.category,
          readme: req.body.readme,
          bannerImageUrl: req.body.bannerImageUrl,
          iconImageUrl: req.body.iconImageUrl,
          repositoryUrl: req.body.repositoryUrl,
        };
        if (!modUpdate.title
                      || !modUpdate.description
                      || !modUpdate.category
                      || !modUpdate.readme) {
          respondError('All fields of this form need to be filled to submit ' +
              'changes to a mod.');
        } else if (modUpdate.title.length > 255) {
          respondError('The title can not be longer than 255 characters!');
        } else if (modUpdate.description.length > 255) {
          respondError('The description can not be longer than ' +
              '255 characters! Please use the readme section for longer ' +
              'explanations.');
          // eslint-disable-next-line max-len
        } else if (modUpdate.repositoryUrl &&
            !validate.isUrl(modUpdate.repositoryUrl)) {
          respondError('The repository URL must be empty or a valid URL!');
        } else if (modUpdate.iconImageUrl &&
            !validate.isUrl(modUpdate.iconImageUrl)) {
          respondError('The icon image URL is not a valid URL.');
        } else {
          // save update to db
          req.mod.update(modUpdate)
            .then(() => {
              logger.info(`Mod ${req.mod.id} was updated by user ` +
                req.session.user.username);
              res.redirect('/mods/' + req.mod.id);
            })
            .catch(err => {
              respondError('An error occurred.');
              logger.error('An error occurred while updating mod ' +
                `${req.mod.id}  in the database: `, err);
            });
        }
      }
    });

  function isValidModFileType(file) {
    let types = acceptedModFileTypes.split(',');
    for (let i = 0; i < types.length; i++) {
      if (file.originalname.endsWith(types[i])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Page for adding a new version to an existing mod.
   */
  router.route('/:modId/addversion')
    .get(requireLogin, findMod, requireOwnage, withRaftVersions,
      (req, res, next) => {
        var latestVersionId = res.locals.raftVersions.length === 0 ?
          undefined : res.locals.raftVersions[0].id;
        res.render('mod/version-add', {
          title: 'Add mod version',
          formContents: {
            minRaftVersionId: latestVersionId,
            maxRaftVersionId: latestVersionId,
          },
          acceptedModFileTypes,
        });
      })
    .post(requireLogin, findMod, requireOwnage, upload.single('file'),
      withRaftVersions, (req, res, next) => {
        var mod = req.mod;
        res.locals.formContents = req.body;
        res.locals.acceptedModFileTypes = acceptedModFileTypes;

        var respondError = error => res.render('mod/version-add', {error});

        var modVersion = {
          modId: mod.id,
          version: req.body.version,
          changelog: req.body.changelog,
          downloadUrl: req.file,
          minRaftVersionId: parseInt(req.body.minRaftVersionId, 10),
          maxRaftVersionId: parseInt(req.body.maxRaftVersionId, 10),
          definiteMaxRaftVersion:
                (req.body.definiteMaxRaftVersion === 'on'),
        };
        if (!modVersion.version
            || !modVersion.changelog
            || !modVersion.downloadUrl) {
          respondError('All fields of this form need to be filled to submit ' +
                'a new mod version.');
        } else if (!validate.isSlug(modVersion.version)) {
          respondError('The version must be a valid slug!');
        } else if (modVersion.minRaftVersionId
            // eslint-disable-next-line max-len
            && (!isRaftVersionIdValid(res.locals.raftVersions, modVersion.minRaftVersionId)
            // eslint-disable-next-line max-len
            || !isRaftVersionIdValid(res.locals.raftVersions, modVersion.maxRaftVersionId))) {
          respondError('Please select a minimal AND a maximal RML version.');
        } else if (!isValidModFileType(req.file)) {
          respondError('The mod file has an invalid file type.');
        } else {
          modVersion.version = modVersion.version.toLowerCase();
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
          // create mod version in the database
          db.ModVersion.create(modVersion)
            .then(modVersion => {
              res.redirect('/mods/' + modVersion.modId);
              sendVersionReleaseNotification(mod, modVersion, false);
            }).catch(err => {
              if (err.name === 'SequelizeUniqueConstraintError') {
                respondError('Sorry, but this version already exists Please ' +
                      'choose another one!');
              } else {
                respondError('An error occurred.');
                logger.error('An error occurred while creating mod ' +
                    'version in the database:', err);
              }
            });
        }
      });

  /**
   * Page for editing an existing version.
   */
  router.route('/:modId/:version/edit')
    .get(requireLogin, findMod, requireOwnage, withRaftVersions,
      (req, res, next) => {
        var version;
        db.ModVersion.findOne({where: {modId: req.mod.id,
          version: req.params.version}})
          .then(versionResult => {
            if (!versionResult) return Promise.reject(createError(404));
            else {
              version = versionResult;
              res.render('mod/version-edit', {
                title: 'Edit mod version',
                version,
                formContents: version,
              });
            }
          })
          .catch(next);
      })
    .post(requireLogin, findMod, requireOwnage, withRaftVersions,
      (req, res, next) => {
        var mod = req.mod;
        var version;
        db.ModVersion.findOne({where: {modId: mod.id,
          version: req.params.version}})
          .then(versionResult => {
            if (!versionResult) return Promise.reject(createError(404));
            else {
              version = versionResult;
            }
          })
          .then(() => {
            var versionUpdate = {
              changelog: req.body.changelog,
              minRaftVersionId: parseInt(req.body.minRaftVersionId, 10),
              maxRaftVersionId: parseInt(req.body.maxRaftVersionId, 10),
              definiteMaxRaftVersion:
                (req.body.definiteMaxRaftVersion === 'on'),
            };
            res.locals.version = version;
            res.locals.formContents = req.body;
            res.locals.title = 'Edit mod version';
            if (!versionUpdate.changelog) {
              res.render('mod/version-edit', {error: 'All fields of this ' +
              'form need to be filled to submit changes to a mod.'});
            } else if (versionUpdate.minRaftVersionId
              // eslint-disable-next-line max-len
              && (!isRaftVersionIdValid(res.locals.raftVersions, versionUpdate.minRaftVersionId)
              // eslint-disable-next-line max-len
              || !isRaftVersionIdValid(res.locals.raftVersions, versionUpdate.maxRaftVersionId))) {
              res.render('mod/version-edit', {error: 'Please select a ' +
              'minimal AND a maximal RML version.'});
            } else {
              db.ModVersion.update(versionUpdate, {where: {modId: mod.id,
                version: version.version}})
                .then(() => {
                  logger.info(`Mod ${mod.id}'s version ${version.version} ` +
                    `was updated by user ${req.session.user.username}.`);
                  res.redirect('/mods/' + mod.id + '/versions');
                }).catch(err => {
                  res.render('mod/version-edit', {error: 'An error occurred.'});
                  logger.error('An error occurred while updating mod ' +
                    `${mod.id}'s version ${version.version} in the database:`,
                  err);
                });
            }
          })
          .catch(err => {
            if (err instanceof NotFoundError) next(); // will create 404 page
            else {
              next(err);
            }
          });
      });

  /**
   * Checks whether a version id is contained in a set of raft versions.
   */
  function isRaftVersionIdValid(raftVersions, versionId) {
    for (var i = 0; i < raftVersions.length; i++) {
      if (raftVersions[i].id === versionId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Mod overview page.
   */
  router.get('/:modId', findMod, (req, res) => {
    req.mod.readmeMarkdown = convertMarkdown(req.mod.readme);
    res.render('mod/mod', {
      versions: req.mod['mod-versions'],
      userIsOwner: req.userIsModOwner,
      installableModFileType,
    });
  });

  /**
   * Versions list page for a mod.
   */
  router.get('/:modId/versions', findMod, withCurrentRaftVersion,
    (req, res, next) => {
      req.params.id = req.params.modId;
      var mod = req.mod;
      var versions = req.mod['mod-versions'];
      // render markdown changelogs
      for (var i = 0; i < versions.length; i++) {
        versions[i].changelogMarkdown =
        convertMarkdown(versions[i].changelog);
      }
      res.render('mod/versions', {
        title: mod.title,
        versions,
        userIsOwner: req.userIsModOwner,
        installableModFileType,
      });
    });

  router.get('/:id/:version/:file', function(req, res, next) {
    var urlPath = decodeURIComponent(urlModule.parse(req.originalUrl).pathname);
    db.FileScan.findOne({where: {fileUrl: urlPath}}).then(fileScan => {
      if (!fileScan) {
        next(createError(404));
      } else if (req.query.ignoreVirusScan) {
        let ip = req.header('cf-connecting-ip') || req.ip;
        downloadTracker.trackDownload(ip, urlPath,
          () => incrementDownloadCount(req.params.id, req.params.version));
        // forbid indexing of downloads
        res.setHeader('X-Robots-Tag', 'noindex');
        var fileName = fileScan.fileUrl.split('/').pop();
        res.setHeader('Content-Disposition',
          `attachment; filename="${fileName}"`);
        res.sendFile(`./public${fileScan.fileUrl}`,
          {root: __dirname + '/../'});
      } else {
        res.status(300).render('download-warning/full-page',
          {downloadWarning: {fileScan}});
      }
    }).catch(err => {
      next(err);
      logger.error('Error while querying database for file scan:', err);
    });
  });

  /**
   * Sends a mod version release notification.
   * @param {object} mod the mod (sequelize instance) with a new version.
   * @param {object} version the new mod version (sequelize instance).
   * @param {boolean} initial whether the version is the first version of the
   * mod.
   * @returns the promise posts the notification.
   * @remarks it's not necessary to wait for the notification completion
   * before carrying on. Errors will be logged but not thrown.
   */
  function sendVersionReleaseNotification(mod, version, initial) {
    return notificationClient.sendModVersionReleaseNotification({
      modTitle: mod.title,
      modDescription: mod.description,
      modBannerUrl: mod.bannerImageUrl ||
      `${credentials.baseUrl}/images/banner-default.png`,
      modIconUrl: mod.iconImageUrl ||
        `${credentials.baseUrl}/images/raftmodding.png`,
      modUrl: `${credentials.baseUrl}/mods/${mod.id}`,
      modAuthorName: mod.author,
      modAuthorUrl: `${credentials.baseUrl}/user/` +
        encodeURIComponent(mod.author),
      version: version.version,
      changelog: version.changelog,
      initial: initial,
    }).then(() => {
      logger.debug('Sent mod version release notification!');
    }).catch(err => {
      Sentry.captureException(err);
      logger.error('Error in sending mod version release notification', err);
    });
  }

  return router;
};
