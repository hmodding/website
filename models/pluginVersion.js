'use strict';
module.exports = sequelize => {
  const types = sequelize.Sequelize;
  return sequelize.define('plugin-versions', {
    pluginId: {
      type: types.INTEGER,
      allowNull: false,
      references: {
        model: 'plugins',
        key: 'id',
      },
    },
    version: {
      type: types.STRING(64),
      allowNull: false,
    },
    changelog: {
      type: types.TEXT,
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
    minServerVersionId: {
      type: types.STRING(64),
      allowNull: false,
      references: {
        model: 'server-versions',
        key: 'version',
      },
    },
    maxServerVersionId: {
      type: types.STRING(64),
      allowNull: false,
      references: {
        model: 'server-versions',
        key: 'version',
      },
    },
    definiteMaxServerVersion: {
      type: types.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  }, {
    indexes: [
      {
        unique: true,
        fields: ['pluginId', 'version'],
      },
    ],
  });
};
