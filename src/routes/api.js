'use strict';
/**
 * A REST API for accessing data from this site.
 */
module.exports = (logger, db) => {
  var router = require('express').Router();

  router.get('/mods', (req, res) => {
    db.Mod.findAll({
      attributes: [
        'id',
        'title',
        'description',
        'category',
        'author',
        'bannerImageUrl',
        'iconImageUrl',
      ],
      include: [db.ModVersion],
      order: [
        [db.ModVersion, 'createdAt', 'desc'],
      ],
    }).then(mods => {
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

  router.get('/mods/:modId', (req, res, next) => {
    db.ScheduledModDeletion.findOne({where: {modId: req.params.modId}})
      .then(deletion => {
        if (deletion) {
          res.status(404).send(JSON.stringify(null));
        } else {
          let mod;
          db.Mod.findOne({
            attributes: [
              'id',
              'title',
              'description',
              'category',
              'author',
              'bannerImageUrl',
              'iconImageUrl',
            ],
            include: [db.ModVersion],
            where: {
              id: req.params.modId,
            },
            order: [
              [db.ModVersion, 'createdAt', 'desc'],
            ],
          }).then(modResult => {
            if (!modResult) {
              res.status(404).json(mod);
            }
            mod = modResult;
            let latestVersion = mod['mod-versions'][0];
            if (latestVersion) {
              db.FileScan.findOne({where: {fileUrl: latestVersion.downloadUrl}})
                .then(fileScan => {
                  let result = JSON.parse(JSON.stringify(mod))
                  if (fileScan) {
                    result['mod-versions'][0].fileHashSha256 =
                    fileScan.scanResult ? fileScan.scanResult.sha256 : null;
                    console.log(result);
                  }
                  res.status(200).json(result);
                })
                .catch(err => {
                  res.status(500).send(JSON.stringify({
                    error: {
                      status: 500,
                      message: 'Internal server error.',
                    },
                  }));
                  logger.error('An error occurred while querying the ' +
                    'database for file scans:', err);
                });
            } else {
              res.status(200).json(mod);
            }
          }).catch(err => {
            res.status(500).send(JSON.stringify({
              error: {
                status: 500,
                message: 'Internal server error.',
              },
            }));
            logger.error('An error occurred while querying the database for ' +
              'mods:', err);
          });
        }
      })
      .catch(next);
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
