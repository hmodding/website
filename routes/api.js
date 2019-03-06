'use strict';
/**
 * A REST API for accessing data from this site.
 */
module.exports = (db) => {
  var router = require('express').Router();

  router.get('/mods', (req, res) => {
    db.Mod.findAll({attributes: [
      'id',
      'title',
      'description',
      'category',
      'author',
      'downloadUrl',
    ]}).then(mods => {
      res.status(200).json(mods);
    }).catch(err => {
      res.send(JSON.stringify({
        error: {
          status: 500,
          message: 'Internal server error.',
        },
      }));
      res.status(200);
      console.error('An error occurred while querying the database for mods:',
        err);
    });
  });

  return router;
};
