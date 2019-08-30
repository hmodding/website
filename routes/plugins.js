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

  function validatePluginUpdate(plugin, update) {
    var pluginObj = Object.assign({}, plugin); // copy plugin
    Object.assign(pluginObj, update); // update plugin
    return validatePlugin(pluginObj); // check update
  }

  function validatePlugin(plugin) {
    if (!plugin) throw new Error('Error in plugin validation: no plugin given');
    else if (!plugin.slug) {
      return 'Please provide a slug.';
    } else if (!validate.isSlug(plugin.slug)) {
      return 'The slug can only contain lowercase letters, numbers, dashes, ' +
        'dots and underscores and must be at most 64 characters long.';
    } else if (!plugin.title) {
      return 'Please provide a title.';
    } else if (plugin.title.length > 255) {
      return 'The title may not be longer than 255 characters.';
    } else if (!plugin.description) {
      return 'Please provide a description.';
    } else if (plugin.description.length > 255) {
      return 'The description can not be longer than 255 characters! Please ' +
        'use the readme section for longer explanations.';
    } else if (!plugin.bannerImageUrl) {
      return 'Please provide a banner image URL.';
    } else if (!validate.isUrl(plugin.bannerImageUrl)) {
      return 'The banner image URL is not a valid URL';
    } else if (!plugin.readme) {
      return 'Please provide a readme document.';
    } else if (plugin.repositoryUrl && !validate.isUrl(plugin.repositoryUrl)) {
      return 'The repository URL is not a valid URL!';
    } else {
      return true;
    }
  }

  function validatePluginVersion(version) {
    if (!version) throw new Error('Error in plugin version validation: no ' +
      'given plugin version');
    else if (!version.version) {
      return 'Please provide a version.';
    } else if (!validate.isSlug(version.version)) {
      return 'The version can only contain lowercase letters, numbers, ' +
        'dashes, dots and underscores and must be at most 64 characters long.';
    } else if (!version.changelog) {
      return 'Please provide a changelog.';
    } else if (!version.downloadUrl) {
      return 'Please provide a download URL.';
    } else if (!validate.isUrl(version.downloadUrl)) {
      return 'The download URL is invalid.';
    } else if (!version.minServerVersionId) {
      return 'Please select a minimum compatible server version.';
    } else if (!version.maxServerVersionId) {
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
          downloadUrl: req.file ? 'https://raft-mods.trax.am/' : req.body.downloadUrl,
          minServerVersionId: req.body.minServerVersionId,
          maxServerVersionId: req.body.maxServerVersionId,
          definiteMaxServerVersion: req.body.definiteMaxServerVersion === 'on',
        };
        var pluginValidation = validatePlugin(plugin);
        var pluginVersionValidation = validatePluginVersion(pluginVersion);
        if (typeof pluginValidation === 'string') {
          respondError(pluginValidation);
        } else if (typeof pluginVersionValidation === 'string') {
          respondError(pluginVersionValidation);
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
    });

  router.route('/:pluginId/addversion')
    .get(findPlugin, requireOwnage, withServerVersions, (req, res, next) => {
      res.render('plugin/version-add', {formContents: {}});
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
      });

  return router;
};
