'use strict';
module.exports = (sequelize) => {
  return sequelize.define('mod-versions', {
    modId: {
      type: sequelize.Sequelize.STRING(64),
      allowNull: false,
      references: {
        model: 'mods',
        key: 'id',
      },
    },
    version: {
      // limited length because of file system restrictions
      type: sequelize.Sequelize.STRING(64),
      allowNull: false,
    },
    changelog: {
      type: sequelize.Sequelize.TEXT, // markdown
      allowNull: false,
    },
    downloadUrl: {
      type: sequelize.Sequelize.TEXT,
      allowNull: false,
    },
    downloadCount: {
      type: sequelize.Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    minCompatibleRmlVersion: {
      type: sequelize.Sequelize.STRING,
      allowNull: true,
    },
    maxCompatibleRmlVersion: {
      type: sequelize.Sequelize.STRING,
      allowNull: true,
    },
    definiteMaxCompatibleRmlVersion: {
      type: sequelize.Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
