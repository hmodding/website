'use strict';
/**
 * Basic pages.
 */
module.exports = (db) => {
  var router = require('express').Router();
  var fs = require('fs');
  var config = JSON.parse(fs.readFileSync('database.json'));

  /**
   * Returns the favicon on the default favicon path.
   */
  router.get('/favicon.ico', (req, res) => {
    res.sendFile('./public/images/' +
      (res.locals.newBranding ? 'raftmodding_favicon.ico' : 'favicon.ico'),
    {root: __dirname + '/../'});
  });

  /**
   * Home page.
   */
  router.get('/', (req, res) => {
    db.RaftVersion.findOne({
      order: [ ['releasedAt', 'DESC' ]],
    })
      .then(currentRaftVersion => {
        res.locals.currentRaftVersion = currentRaftVersion;
      })
      .then(() => db.Mod.findAll({
        where: {
          id: config.featuredMods,
        },
        include: [db.ModVersion],
        order: [
          [db.ModVersion, 'createdAt', 'DESC'],
        ],
      })
      )
      .then(featuredMods => {
        res.locals.featuredMods = featuredMods;
        return db.sequelize.query(
          'SELECT "modId", SUM("downloadCount") AS "totalDownloads" ' +
          'FROM "mod-versions" ' +
          'GROUP BY "modId" ' +
          'ORDER BY "totalDownloads" DESC ' +
          'LIMIT 3;',
          {type: db.sequelize.QueryTypes.SELECT});
      })
      .then(popularModsIdsRes => {
        var popularModsIds = [];
        for (var i = 0; i < popularModsIdsRes.length; i++) {
          popularModsIds.push(popularModsIdsRes[i].modId);
        }
        return db.Mod.findAll({
          where: {
            id: popularModsIds,
          },
          include: [{model: db.ModVersion, include: [
            {model: db.RaftVersion, as: 'minRaftVersion'},
            {model: db.RaftVersion, as: 'maxRaftVersion'},
          ]}],
          order: [[db.ModVersion, 'createdAt', 'DESC']],
        });
      })
      .then(popularMods => {
        res.locals.popularMods = popularMods;
        return db.sequelize.query(
          'SELECT "modId", COUNT("userId") as likes ' +
          'FROM "ModLikes" ' +
          'GROUP BY "modId" ' +
          'ORDER BY likes DESC ' +
          'LIMIT 3;',
          {type: db.sequelize.QueryTypes.SELECT}
        );
      })
      .then(mostLikesIdsRes => {
        var mostLikesIds = [];
        for (var i = 0; i < mostLikesIdsRes.length; i++) {
          mostLikesIds.push(mostLikesIdsRes[i].modId);
        }
        return db.Mod.findAll({
          where: {
            id: mostLikesIds,
          },
          include: [{model: db.ModVersion, include: [
            {model: db.RaftVersion, as: 'minRaftVersion'},
            {model: db.RaftVersion, as: 'maxRaftVersion'},
          ]}],
          order: [[db.ModVersion, 'createdAt', 'DESC']],
        });
      })
      .then(mostLikedMods => {
        res.locals.mostLikedMods = mostLikedMods;
        res.render('index', {title: 'Home'});
      })
      .catch(err => {
        throw err;
      });
  });

  /**
   * Contact page.
   */
  router.get('/contact', (req, res) => {
    res.render('contact', {title: 'Contact'});
  });

  /**
   * Page containing legal information such as the terms of service.
   */
  router.get('/terms', (req, res) => {
    res.render('terms', {title: 'Terms of Service'});
  });

  /**
   * Page containing the privacy policy.
   */
  router.get('/privacy', (req, res) => {
    res.render('privacy', {title: 'Privacy policy'});
  });

  /**
   * Page containing the privacy policy.
   */
  router.get('/donate', (req, res) => {
    res.render('donation/full-page');
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

  redirect('/discord', config.discord.inviteLink);
  redirect('/docs', config.docsUrl);

  return router;
};
