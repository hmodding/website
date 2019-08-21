'use strict';
module.exports = (logger, db, fileScanner, pluginDeleter) => {
  const router = require('express').Router();
  const createError = require('http-errors');
  const convertMarkdown = require('../markdownConverter');
  const pluginIncludes = [{model: db.User, as: 'maintainer'},
    {model: db.PluginVersion, as: 'versions'},
    {model: db.ScheduledPluginDeletion, as: 'deletion'}];

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

  router.get('/:pluginId', findPlugin,
    (req, res, next) => {
      req.plugin.readmeHtml = convertMarkdown(req.plugin.readme);
      res.render('plugin/plugin');
    });

  return router;
};
