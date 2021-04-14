'use strict';
module.exports = (sequelize) => {
  const types = sequelize.Sequelize;
  return sequelize.define('launcher-versions', {
    version: {
      type: types.STRING,
      unique: true,
      allowNull: false,
      primaryKey: true,
    },
    timestamp: {
      type: types.DATE,
      allowNull: false,
    },
    downloadUrl: {
      type: types.TEXT,
      allowNull: false,
    },
    downloadCount: {
      type: types.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    changelog: {
      type: types.TEXT,
      allowNull: false,
    },
  });
};
