'use strict';
module.exports = (sequelize) => {
  return sequelize.define('mod-versions', {
    modId: {
      type: sequelize.Sequelize.STRING(64),
      allowNull: false,
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
  });
};
