'use strict';
const types = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('mod-versions', {
    modId: {
      type: types.STRING(64),
      allowNull: false,
      references: {
        model: 'mods',
        key: 'id',
      },
    },
    version: {
      // limited length because of file system restrictions
      type: types.STRING(64),
      allowNull: false,
    },
    changelog: {
      type: types.TEXT, // markdown
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
    minRaftVersionId: {
      type: types.INTEGER,
      allowNull: true,
      references: {
        model: 'raft-versions',
        key: 'id',
      },
    },
    maxRaftVersionId: {
      type: types.INTEGER,
      allowNull: true,
      references: {
        model: 'raft-versions',
        key: 'id',
      },
    },
    definiteMaxRaftVersion: {
      type: types.BOOLEAN,
      allowNull: false,
    },
  }, {
    indexes: [
      {
        unique: true,
        fields: ['modId', 'version'],
      },
    ],
  });
};
