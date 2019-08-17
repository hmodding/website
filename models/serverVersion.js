'use strict';
module.exports = (sequelize) => {
  return sequelize.define('server-versions', {
    version: {
      type: sequelize.Sequelize.STRING,
      unique: true,
      allowNull: false,
      primaryKey: true,
    },
    raftVersion: {
      type: sequelize.Sequelize.STRING,
      allowNull: false,
    },
    timestamp: {
      type: sequelize.Sequelize.DATE,
      allowNull: false,
    },
    downloadUrl: {
      type: sequelize.Sequelize.TEXT,
      allowNull: false,
    },
    changelog: {
      type: sequelize.Sequelize.TEXT,
      allowNull: true,
    },
  });
};
