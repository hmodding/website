'use strict';
module.exports = (logger, db, fileScanner) => {
  const router = require('express').Router();
  const createError = require('http-errors');

  /**
   * Middleware function that nexts to a 403 error if the logged in user is not
   * an admin.
   */
  router.use((req, res, next) => {
    if (res.locals.userIsAdmin) {
      next();
    } else {
      next(createError(403));
    }
  });

  /**
   * Overview page showing all Raft versions.
   */
  router.get('/', (req, res, next) => {
    db.RaftVersion.findAll()
      .then(raftVersions => {
        res.render('raft-version-management/overview', {raftVersions});
      })
      .catch(next);
  });

  /**
   * Page for adding raft versions.
   */
  router.route('/add')
    .get((req, res, next) => {
      res.render('raft-version-management/add', {formContents: {
        releasedAt: new Date(),
      }});
    })
    .post((req, res, next) => {
      res.locals.formContents = req.body;
      let respondError = error => res.render('raft-version-management/add', {error});

      let newVersion = {
        version: req.body.version,
        buildId: req.body.buildId,
        title: req.body.title,
        releasedAt: req.body.releasedAt,
      };

      if (!newVersion.version || !newVersion.buildId || !newVersion.releasedAt) {
        respondError('Please fill all required input fields!');
      } else {
        db.RaftVersion.create(newVersion)
          .then(() => {
            res.redirect('/raft-version-management');
          })
          .catch(err => {
            respondError(err);
            logger.error('error in adding raft version: ', err);
          });
      }
    });

  /**
   * Page for editing raft versions.
   */
  router.route('/:id')
    .get((req, res, next) => {
      if (!parseInt(req.params.id, 10)) next(createError(404));
      else {
        db.RaftVersion.findOne({where: {id: req.params.id}})
          .then(raftVersion => {
            if (!raftVersion) next(createError(404));
            else {
              res.render('raft-version-management/edit', {
                raftVersion,
                formContents: raftVersion,
              });
            }
          })
          .catch(next);
      }
    })
    .post((req, res, next) => {
      if (!parseInt(req.params.id, 10)) next(createError(404));
      else {
        db.RaftVersion.findOne({where: {id: req.params.id}})
          .then(raftVersion => {
            res.locals.formContents = req.body;
            res.locals.raftVersion = raftVersion;
            if (!raftVersion) next(createError(404));
            else {
              let respondError =
              error => res.render('raft-version-management/edit', {error});
              let update = {
                buildId: req.body.buildId,
                title: req.body.title,
                releasedAt: req.body.releasedAt,
              };

              if (!update.buildId || !update.releasedAt) {
                respondError('All fields of this forms are required!');
              } else {
                raftVersion.update(update)
                  .then(newValues => {
                    res.render('raft-version-management/edit', {
                      success: 'Updated successfully!',
                      raftVersion: newValues,
                      formContents: newValues,
                    });
                  })
                  .catch(err => {
                    respondError(err);
                    logger.error(err);
                  });
              }
            }
          })
          .catch(next);
      }
    });

  return router;
};
