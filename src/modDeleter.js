'use strict';
module.exports = (logger, db, config, Sentry) => {
  /**
   * Specifies how many days to wait before actually deleting a mod.
   */
  const deletionInterval = config.modDeletionIntervalInDays || 10;
  const rimraf = require('rimraf');
  const path = require('path');

  /**
   * Checks the database for all mods whose deletion time has been reached and
   * initiates deletion for those mods.
   */
  function deleteExpiredMods() {
    logger.debug('Checking for mods to delete...');
    db.ScheduledModDeletion.findAll({where: {
      deletionTime: {[db.sequelize.Sequelize.Op.lt]: new Date()},
    }})
      .then(deletions => {
        for (var i = 0; i < deletions.length; i++) {
          deleteMod(deletions[i]);
        }
        logger.debug('Deleted ' + deletions.length + ' mods.');
      })
      .catch(err => {
        Sentry.captureException(err);
        logger.error('Error while checking for mods to delete', err);
      });
  }

  /**
   * Deletes a mod and all it's versions and files.
   * @param {*} del a sequelize instance from the ScheduledModDeletion
   * table.
   */
  function deleteMod(del) {
    logger.info(`Deleting mod ${del.modId} which was scheduled ` +
      `for ${del.deletionTime}...`);
    var dir = path.join('.', 'public', 'mods', del.modId);
    return new Promise((resolve, reject) => rimraf(dir, err => {
      if (err) reject(err);
      else {
        logger.debug(`Files of mod ${del.modId} were deleted.`);
        resolve();
      }
    }))
      .then(() => {
        logger.debug(`Deleting file scans for files from mod ${del.modId}...`);
        return db.FileScan.destroy({where: {
          fileUrl: {[db.sequelize.Sequelize.Op.iLike]: `/mods/${del.modId}/%`},
        }});
      })
      .then((result) => {
        logger.debug(`File scans of mod ${del.modId} were deleted.`, result);
        logger.debug(`Deleting mod version entries of mod ${del.modId}...`);
        return db.ModVersion.destroy({where: {modId: del.modId}});
      })
      .then(result => {
        logger.debug(`Deleted ${result.affectedRows} versions for mod ` +
          `${del.modId}.`);
        logger.debug(`Deleting deletion schedule for mod ${del.modId}...`);
        return del.destroy();
      })
      .then(() => {
        logger.debug(`Deletion schedule for mod ${del.modId} was ` +
          'deleted.');
        return db.Mod.destroy({where: {id: del.modId}});
      })
      .then(() => {
        logger.debug(`Database entries of mod ${del.modId} were removed.`);
        logger.info(`Mod ${del.modId} was deleted.`);
      })
      .catch(err => {
        Sentry.captureException(err);
        logger.error(`Unexpected error while deleting mod ${del.modId}: `,
          err);
      });
  }

  /**
   * Schedules the deletion of a mod. Returns the Promise for the db instance
   * creation. The Promise throws string errors that can be understood by the
   * user.
   * @param {*} mod a seqelize instance of the mod to delete.
   */
  function scheduleDeletion(mod, issuer) {
    var deletionTime = new Date();
    deletionTime.setDate(new Date().getDate() + deletionInterval);
    return db.ScheduledModDeletion.create({modId: mod.id, deletionTime})
      .then(deletion => {
        logger.info(`Deletion of mod ${mod.id} was scheduled by user ` +
          `user ${issuer.username} for ${deletion.deletionTime}.`);
        return deletion;
      })
      .catch(err => {
        if (err.name === 'SequelizeUniqueConstraintError') {
          return Promise.reject('This mod is alread scheduled for deletion.');
        } else {
          Sentry.captureException(err);
          logger.error('Unexpected error while scheduling deletion of mod ' +
            mod.id + ': ', err);
          return Promise.reject('An error occurred.');
        }
      });
  }

  /**
   * Calls itself every hour and then executes the deleteExpiredMods function.
   */
  function deletionLoop() {
    deleteExpiredMods();
    setTimeout(deletionLoop, 60 * 60 * 1000);
  }

  deletionLoop();

  return {
    deleteExpiredMods,
    scheduleDeletion,
    deletionInterval,
  };
};
