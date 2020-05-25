'use strict';
module.exports = (sequelize) => {
  return sequelize.define('download-tracker', {
    ipHash: {
      type: sequelize.Sequelize.STRING(32),
      allowNull: false,
    },
    path: {
      type: sequelize.Sequelize.TEXT,
      allowNull: false,
    },
    expiresAt: {
      type: sequelize.Sequelize.DATE,
      allowNull: false,
    },
  }, {
    indexes: [
      {
        unique: true,
        fields: ['ipHash', 'path'],
      },
    ],
  });
};
