'use strict';
/**
 * A REST API for accessing data from this site.
 */
module.exports = (logger, db) => {
  var router = require('express').Router();

  router.get('/mods', (req, res) => {
    db.Mod.findAll({attributes: [
      'id',
      'title',
      'description',
      'category',
      'author',
      'bannerImageUrl',
    ], include: [db.ModVersion]}).then(mods => {
      res.status(200).json(mods);
    }).catch(err => {
      res.send(JSON.stringify({
        error: {
          status: 500,
          message: 'Internal server error.',
        },
      }));
      res.status(200);
      logger.error('An error occurred while querying the database for mods:',
        err);
    });
  });

  router.get('/mods/:modId', (req, res) => {
    db.Mod.findOne({
      attributes: [
        'id',
        'title',
        'description',
        'category',
        'author',
        'bannerImageUrl',
      ],
      include: [db.ModVersion],
      where: {
        id: req.params.modId,
      },
    }).then(mod => {
      res.status(200).json(mod);
    }).catch(err => {
      res.status(500).send(JSON.stringify({
        error: {
          status: 500,
          message: 'Internal server error.',
        },
      }));
      logger.error('An error occurred while querying the database for mods:',
        err);
    });
  });

  router.get('/mods/:id/version.txt', (req, res, next) => {
    db.ModVersion.findAll({where: {modId: req.params.id}, order: [
      // order by creation time so that the newest version is at the top
      ['createdAt', 'DESC'],
    ], limit: 1})
      .then(versions => {
        if (versions.length === 0) {
          next();
        } else {
          res.status(200).send(versions[0].version).end();
        }
      })
      .catch(err => {
        res.status(500).json({
          error: {
            status: 500,
            message: 'Internal server error.',
          },
        });
        logger.error('An error occurred while querying the database for mods:',
          err);
      });
  });

  router.use((req, res) => {
    res.status(404).json({
      error: {
        status: 404,
        message: 'Resource not found.',
      },
    });
  });

  return router;
};
