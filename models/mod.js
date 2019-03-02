'use strict';
module.exports = (sequelize) => {
  return sequelize.define('mods', {
    id: {
      type: sequelize.Sequelize.STRING(64),
      unique: true,
      allowNull: false,
      primaryKey: true,
    },
    title: {
      type: sequelize.Sequelize.STRING,
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
    category: {
      type: sequelize.Sequelize.STRING,
      allowNull: false,
    },
    version: {
      type: sequelize.Sequelize.STRING,
      allowNull: false,
    },
    author: {
      type: sequelize.Sequelize.STRING,
      allowNull: false,
    },
    downloadUrl: {
      type: sequelize.Sequelize.TEXT,
      allowNull: false,
    },
    bannerImageUrl: {
      type: sequelize.Sequelize.TEXT,
      allowNull: true,
    },
  });
};
