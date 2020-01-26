'use strict';
module.exports = (sequelize) => {
  return sequelize.define('raft-versions', {
    version: {
      type: sequelize.Sequelize.STRING,
      unique: true,
      allowNull: false,
    },
    buildId: {
      type: sequelize.Sequelize.INTEGER,
      allowNull: false,
    },
    title: {
      type: sequelize.Sequelize.STRING,
      allowNull: true,
    },
    releasedAt: {
      type: sequelize.Sequelize.DATE,
      allowNull: false,
    },
  });
};
