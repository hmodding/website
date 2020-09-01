'use strict';
module.exports = (sequelize) => {
  return sequelize.define('user-privileges', {
    username: {
      type: sequelize.Sequelize.STRING,
      unique: true,
      allowNull: false,
    },
    role: {
      type: sequelize.Sequelize.STRING,
      unique: false,
      allowNull: false,
    },
  });
};
