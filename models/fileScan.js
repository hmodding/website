'use strict';
module.exports = (sequelize) => {
  return sequelize.define('file-scans', {
    fileUrl: {
      type: sequelize.Sequelize.TEXT,
      unique: true,
      allowNull: false,
      primaryKey: true,
    },
    scanId: {
      // (sha256 = 64 chars) + (scan id ~ 10 chars) + buffer
      type: sequelize.Sequelize.STRING(96),
      allowNull: true,
    },
    scanResult: {
      type: sequelize.Sequelize.JSON,
      allowNull: true,
    },
  });
};
