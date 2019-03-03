'use strict';
/**
 * Basic pages.
 */
module.exports = (db) => {
  var router = require('express').Router();

  /**
   * Home page.
   */
  router.get('/', (req, res) => {
    res.render('index', {title: 'Home'});
  });

  // Redirects for the navigation bar

  /**
   * Shortcut for defining a simple redirect.
   * @param path The path on the server that should be redirected.
   * @param link The target of the redirection.
   */
  function redirect(path, link) {
    router.get(path, function(req, res, next) {
      res.redirect(link);
    });
  }

  redirect('/forum', 'https://www.raftmodding.com/forum/');
  redirect('/discord', 'https://discord.gg/raft');
  redirect('/docs', 'https://www.raftmodding.com/api/');

  return router;
};
