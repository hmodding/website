'use strict';
module.exports = (logger, db, fileScanner, pluginDeleter) => {
  const router = require('express').Router();
  const createError = require('http-errors');
  const convertMarkdown = require('../markdownConverter');
  const pluginIncludes = [{model: db.User, as: 'maintainer'},
    {model: db.PluginVersion, as: 'versions'},
    {model: db.ScheduledPluginDeletion, as: 'deletion'}];
  const querystring = require('querystring');
  const multer = require('multer');
  const upload = multer({storage: multer.memoryStorage()});
  const validate = require('../util/validation');
  const path = require('path');
  const fs = require('fs');

  /**
   * Middleware function to find a plugin based on the url path and save the
   * corresponding database instance to req.plugin and res.locals.plugin. Plugin
   * versions (`versions`) and the maintainer user (`maintainer`) are included.
   *
   * Will next() to a 404 error if no plugin could be found or if
   * the user is not allowed to access it.
   *
   * Checks whether the logged in user owns the plugin and saves this to
   * `plugin.ownedByCurrentUser`.
   */
  function findPlugin(req, res, next) {
    var pluginId = req.params.pluginId;
    var where = isNaN(pluginId) ?
      {slug: pluginId} : {id: parseInt(pluginId, 10)};
    db.Plugin.findOne({where, include: pluginIncludes})
      .then(plugin => {
        if (!plugin) next(createError(404));
        else {
          plugin.ownedByCurrentUser = req.session && req.session.user &&
            req.session.user.id === plugin.maintainerId;
          req.plugin = res.locals.plugin = plugin;

          if (plugin.deletion &&
              !(plugin.ownedByCurrentUser || res.locals.userIsAdmin)) {
            return Promise.reject(createError(404));
          } else {
            next();
          }
        }
      })
      .catch(next);
  }

  function findVersion(req, res, next) {
    var versionId = req.params.version;
    req.plugin.getVersions({where: {version: versionId}})
      .then(pluginVersions => {
        if (pluginVersions.length === 0) next(createError(404));
        else {
          req.pluginVersion = res.locals.pluginVersion = pluginVersions[0];
          next();
        }
      })
      .catch(next);
  }

  /**
   * Middleware function that redirects to the login page if the user is not
   * logged in.
   */
  function requireLogin(req, res, next) {
    if (req.session.user && req.cookies.user_sid) {
      next();
    } else {
      res.redirect('/signin?' + querystring.stringify({
        redirect: req.originalUrl,
      }));
    }
  }

  /**
   * Middleware function that `next()`s to a 403 if the logged-in user does not
   * own the plugin or is an admin. The `findPlugin` middleware function must be
   * called before this function.
   */
  function requireOwnage(req, res, next) {
    if (req.plugin.ownedByCurrentUser || res.locals.userIsAdmin) {
      next();
    } else {
      next(createError(403));
    }
  }

  function withServerVersions(req, res, next) {
    db.ServerVersion.findAll({order: [['timestamp', 'DESC']]})
      .then(serverVersions => {
        res.locals.serverVersions = serverVersions;
        next();
      })
      .catch(next);
  }

  function validatePluginCreation(plugin) {
    if (!plugin) throw new Error('Error in plugin creation validation: no ' +
      'plugin given');
    else if (!plugin.slug) {
      return 'Please provide a slug.';
    } else if (!validate.isSlug(plugin.slug)) {
      return 'The slug can only contain lowercase letters, numbers, dashes, ' +
        'dots and underscores and must be at most 64 characters long.';
    } else {
      return validatePluginUpdate(plugin);
    }
  }

  function validatePluginUpdate(update) {
    if (!update) throw new Error('Error in plugin update validation: no ' +
      'update given');
    else if (!update.title) {
      return 'Please provide a title.';
    } else if (update.title.length > 255) {
      return 'The title may not be longer than 255 characters.';
    } else if (!update.description) {
      return 'Please provide a description.';
    } else if (update.description.length > 255) {
      return 'The description can not be longer than 255 characters! Please ' +
        'use the readme section for longer explanations.';
    } else if (!update.bannerImageUrl) {
      return 'Please provide a banner image URL.';
    } else if (!validate.isUrl(update.bannerImageUrl)) {
      return 'The banner image URL is not a valid URL';
    } else if (!update.readme) {
      return 'Please provide a readme document.';
    } else if (update.repositoryUrl && !validate.isUrl(update.repositoryUrl)) {
      return 'The repository URL is not a valid URL!';
    } else {
      return true;
    }
  }

  function validatePluginVersionCreation(creation) {
    if (!creation) throw new Error('Error in plugin version creation ' +
      'validation: no given plugin version update');
    else if (!creation.version) {
      return 'Please provide a version.';
    } else if (!validate.isSlug(creation.version)) {
      return 'The version can only contain lowercase letters, numbers, ' +
        'dashes, dots and underscores and must be at most 64 characters long.';
    } else if (!creation.downloadUrl) {
      return 'Please provide a download URL.';
    } else if (!validate.isUrl(creation.downloadUrl)) {
      return 'The download URL is invalid.';
    } else {
      return validatePluginVersionUpdate(creation);
    }
  }

  function validatePluginVersionUpdate(update) {
    if (!update) throw new Error('Error in plugin version update validation: ' +
      'no given plugin version update');
    else if (!update.changelog) {
      return 'Please provide a changelog.';
    } else if (!update.minServerVersionId) {
      return 'Please select a minimum compatible server version.';
    } else if (!update.maxServerVersionId) {
      return 'Please select a maximum compatible server version.';
    } else {
      return true;
    }
  }

  function saveAndScan(plugin, version, file) {
    var dir = path.join('.', 'public', 'plugins', plugin.slug, version.version);
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, file.originalname), file.buffer);
    version.downloadUrl = `/plugins/${plugin.slug}/${version.version}/` +
      file.originalname;
    logger.info(`File ${file.originalname} (${version.downloadUrl}) was ` +
      `saved to disk at ${path.resolve(dir)}`);
    fileScanner.scanFile(file.buffer, file.originalname, version.downloadUrl);
  }

  router.get('/', (req, res, next) => {
    db.findCurrentServerVersion()
      .then(currentServerVersion => {
        res.locals.currentServerVersion = currentServerVersion;
        return db.Plugin.findAll({include: [
          {model: db.User, as: 'maintainer'},
          {model: db.PluginVersion, as: 'versions'},
          {model: db.ScheduledPluginDeletion, as: 'deletion'},
        ]});
      })
      .then(plugins => res.render('plugin/directory', {plugins}))
      .catch(next);
  });

  router.route('/add')
    .get(requireLogin, withServerVersions, (req, res, next) => {
      res.render('plugin/add', {formContents: {}});
    })
    .post(requireLogin, withServerVersions, upload.single('file'),
      (req, res, next) => {
        res.locals.formContents = req.body;
        var respondError = error => res.render('plugin/add', {error});
        var plugin = {
          slug: req.body.slug,
          title: req.body.title,
          description: req.body.description,
          readme: req.body.readme,
          maintainerId: req.session.user.id,
          bannerImageUrl: req.body.bannerImageUrl,
          repositoryUrl: req.body.repositoryUrl,
        };
        var pluginVersion = {
          version: req.body.version,
          changelog: 'This is the first version.',
          downloadUrl: req.file ? 'https://raft-mods.trax.am/' :
            req.body.downloadUrl,
          minServerVersionId: req.body.minServerVersionId,
          maxServerVersionId: req.body.maxServerVersionId,
          definiteMaxServerVersion: req.body.definiteMaxServerVersion === 'on',
        };
        var pluginValidation = validatePluginCreation(plugin);
        var versionValidation = validatePluginVersionCreation(pluginVersion);
        if (typeof pluginValidation === 'string') {
          respondError(pluginValidation);
        } else if (typeof versionValidation === 'string') {
          respondError(versionValidation);
        } else {
          if (req.file) {
            saveAndScan(plugin, pluginVersion, req.file);
          }
          db.Plugin.create(plugin)
            .then(plugin => {
              pluginVersion.pluginId = plugin.id;
              return db.PluginVersion.create(pluginVersion);
            })
            .then(() => {
              res.redirect(`/plugins/${plugin.slug}`);
              logger.info(`Plugin ${plugin.title} (${plugin.id}) was created ` +
                `by user ${req.session.user.username} ` +
                `(${req.session.user.id}).`);
            })
            .catch(err => {
              if (err.name === 'SequelizeUniqueConstraintError') {
                respondError('Sorry, this slug is already taken. Please ' +
                  'choose another one.');
              } else {
                respondError('An error occurred.');
                logger.error('Unknown error while creating plugin: ', err);
              }
            });
        }
      });

  router.get('/:pluginId', findPlugin, (req, res, next) => {
    req.plugin.readmeHtml = convertMarkdown(req.plugin.readme);
    res.render('plugin/plugin');
  });

  router.route('/:pluginId/edit')
    .get(findPlugin, requireOwnage, (req, res, next) => {
      res.render('plugin/edit', {
        formContents: req.plugin,
        deletionInterval: pluginDeleter.deletionInterval,
      });
    })
    .post(findPlugin, requireOwnage, (req, res, next) => {
      res.locals.formContents = req.body;
      var respondError = error => res.render('plugin/edit', {error});
      var pluginUpdate = {
        title: req.body.title,
        description: req.body.description,
        readme: req.body.readme,
        bannerImageUrl: req.body.bannerImageUrl,
        repositoryUrl: req.body.repositoryUrl,
      };
      var pluginValidation = validatePluginUpdate(pluginUpdate);
      if (typeof pluginValidation === 'string') {
        respondError(pluginValidation);
      } else {
        req.plugin.update(pluginUpdate)
          .then(plugin => {
            res.redirect(`/plugins/${plugin.slug}`);
            var user = req.session.user;
            logger.info(`Plugin ${plugin.title} (${plugin.id}) was updated` +
              `by user ${user.username} (${user.id}).`);
          })
          .catch(err => {
            respondError('An error occurred.');
            logger.error('Unknown error while updating plugin: ', err);
          });
      }
    });

  router.route('/:pluginId/addversion')
    .get(findPlugin, requireOwnage, withServerVersions, (req, res, next) => {
      res.render('plugin/version-add', {formContents: {}});
    })
    .post(findPlugin, requireOwnage, withServerVersions, upload.single('file'),
      (req, res, next) => {
        res.locals.formContents = req.body;
        var respondError = error => res.render('plugin/version-add', {error});
        var pluginVersion = {
          version: req.body.version,
          changelog: req.body.changelog,
          downloadUrl: req.file ? 'https://raft-mods.trax.am/' :
            req.body.downloadUrl,
          minServerVersionId: req.body.minServerVersionId,
          maxServerVersionId: req.body.maxServerVersionId,
          definiteMaxServerVersion: req.body.definiteMaxServerVersion === 'on',
        };
        var versionValidation = validatePluginVersionCreation(pluginVersion);
        if (typeof versionValidation === 'string') {
          respondError(versionValidation);
        } else {
          if (req.file) {
            saveAndScan(req.plugin, pluginVersion, req.file);
          }
          pluginVersion.pluginId = req.plugin.id;
          db.PluginVersion.create(pluginVersion)
            .then(() => {
              res.redirect(`/plugins/${req.plugin.slug}`);
              var user = req.session.user;
              logger.info(`Plugin version ${pluginVersion.version} for ` +
                `plugin ${req.plugin.title} (${req.plugin.id}) was created ` +
                `by user ${user.username} (${user.id}).`);
            })
            .catch(err => {
              if (err.name === 'SequelizeUniqueConstraintError') {
                respondError('Sorry, this plugin version already exists. ' +
                  'Please choose another version name.');
              } else {
                respondError('An error occurred.');
                logger.error('Unknown error while creating plugin version: ',
                  err);
              }
            });
        }
      });

  router.get('/:pluginId/versions', findPlugin, (req, res, next) => {
    for (var i = 0; i < req.plugin.versions.length; i++) {
      var version = req.plugin.versions[i];
      version.changelogHtml = convertMarkdown(version.changelog);
    }
    db.findCurrentServerVersion()
      .then(currentServerVersion => res.render('plugin/versions',
        {currentServerVersion}))
      .catch(next);
  });

  router.route('/:pluginId/:version/edit')
    .get(findPlugin, findVersion, withServerVersions, requireOwnage,
      (req, res, next) => {
        res.render('plugin/version-edit', {formContents: req.pluginVersion});
      })
    .post(findPlugin, findVersion, withServerVersions, requireOwnage,
      (req, res, next) => {
        res.locals.formContents = req.body;
        var respondError = error => res.render('plugin/version-edit', {error});
        var versionUpdate = {
          changelog: req.body.changelog,
          minServerVersionId: req.body.minServerVersionId,
          maxServerVersionId: req.body.maxServerVersionId,
          definiteMaxServerVersion: req.body.definiteMaxServerVersion === 'on',
        };
        var versionValidation = validatePluginVersionUpdate(versionUpdate);
        if (typeof versionValidation === 'string') {
          respondError(versionValidation);
        } else {
          req.pluginVersion.update(versionUpdate)
            .then(version => {
              res.redirect(`/plugins/${req.plugin.slug}/versions`);
              var user = req.session.user;
              logger.info(`Plugin version ${version.version} for ` +
                `plugin ${req.plugin.title} (${req.plugin.id}) was updated ` +
                `by user ${user.username} (${user.id}).`);
            })
            .catch(err => {
              respondError('An error occurred.');
              logger.error('Unknown error while updating plugin version: ',
                err);
            });
        }
      });

  return router;
};
