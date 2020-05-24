'use strict';
const RESET_INTERVAL = 1000 * 60 * 60; // 1 hour
const TRACK_DURATION = 1000 * 60 * 60; // 1 hour
// random string as our ip salt (this is not cryptographically secure but we
// are only hashing temporary ip )
const IP_HASH_SALT = 'C0AayiNoVJJPzhm58v4W';
const Sequelize = require('sequelize');
const crypto = require('crypto');

module.exports = (logger, database) => {
  function resetTrackers() {
    database.DownloadTracker.destroy({where: {
      expiresAt: { [Sequelize.Op.gt]: new Date() },
    }})
      .then(removedTrackers => {
        logger.debug(`Removed ${removedTrackers} expired download trackers.`);
      });
  }

  function incrementDownloadCount(path) {
    console.log(path); // TODO
  }

  /**
   * Creates an MD5 hash from the given text in hexadecimal values.
   * @param {string} text the text to hash.
   */
  function hashMd5Hex(text) {
    return crypto.createHash('md5')
      .update(IP_HASH_SALT)
      .update(text)
      .digest('hex');
  }

  function trackDownload(ip, path) {
    let ipHash = hashMd5Hex(ip);
    database.DownloadTracker.findOne({where: {
      ipHash,
      path,
    }})
      .then(tracker => {
        let now = new Date();
        if (!tracker || tracker.expiresAt < now) {
          incrementDownloadCount(path);
        }

        let newExpiry = new Date(now);
        newExpiry.setTime(newExpiry.getTime() + TRACK_DURATION);
        if (tracker) {
          return tracker.update({expiresAt: now + TRACK_DURATION});
        } else {
          return database.DownloadTracker.create({
            ip,
            path,
            expiresAt: newExpiry,
          });
        }
      });
  }

  // automatically remove expired download trackers
  resetTrackers();
  setInterval(resetTrackers, RESET_INTERVAL);

  return {
    trackDownload,
  };
};
