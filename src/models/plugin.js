'use strict';
module.exports = sequelize => {
  const types = sequelize.Sequelize;
  return sequelize.define('plugins', {
    slug: {
      type: types.STRING(64),
      unique: true,
      allowNull: false,
    },
    title: {
      type: types.STRING,
      allowNull: false,
    },
    description: {
      type: types.STRING,
      allowNull: false,
    },
    readme: {
      type: types.TEXT,
      allowNull: false,
    },
    maintainerId: {
      type: types.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    bannerImageUrl: {
      type: types.TEXT,
      allowNull: false,
    },
    repositoryUrl: {
      type: types.TEXT,
      allowNull: true,
    },
  });
};
