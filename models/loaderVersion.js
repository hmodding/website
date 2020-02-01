'use strict';
module.exports = (sequelize) => {
  return sequelize.define('loader-versions', {
    rmlVersion: {
      type: sequelize.Sequelize.STRING,
      unique: true,
      allowNull: false,
      primaryKey: true,
    },
    raftVersionId: {
      type: sequelize.Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'raft-versions',
        key: 'id',
      },
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
