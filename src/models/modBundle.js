'use strict';
module.exports = (sequelize) => {
  return sequelize.define('mod-bundles', {
    title: {
      type: sequelize.Sequelize.STRING(100),
      allowNull: false,
    },
    description: {
      type: sequelize.Sequelize.STRING,
      allowNull: false,
    },
    readme: {
      type: sequelize.Sequelize.TEXT,
      allowNull: false,
    },
    maintainerId: {
      type: sequelize.Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    bannerImageUrl: {
      type: sequelize.Sequelize.TEXT,
      allowNull: true,
    },
  });
};
