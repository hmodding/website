'use strict';
module.exports = (logger, db, config) => {
  /**
   * Specifies how many days to wait before actually deleting a mod.
   */
  const deletionInterval = config.modDeletionIntervalInDays;

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
      .catch(err => logger.error('Error while checking for mods to delete',
        err));
  }

  /**
   * Deletes a mod and all it's versions and files.
   * @param {*} deletion a sequelize instance from the ScheduledModDeletion
   * table.
   */
  function deleteMod(deletion) {
    logger.info(`Deleting mod ${deletion.modId} which was scheduled ` +
      `for ${deletion.deletionTime}...`);
  }

  /**
   * Schedules the deletion of a mod. Returns the Promise for the db instance
   * creation. The Promise throws string errors that can be understood by the
   * user.
   * @param {*} mod a seqelize instance of the mod to delete.
   */
  function scheduleDeletion(mod, issuer) {
    var deletionTime = new Date();
    deletionTime.setDate(deletionTime.getDate() + deletionInterval);
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
