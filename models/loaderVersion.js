'use strict';
module.exports = (sequelize) => {
  return sequelize.define('loader-versions', {
    rmlVersion: {
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
    readme: {
      type: sequelize.Sequelize.TEXT,
      allowNull: true,
    },
  });
};
