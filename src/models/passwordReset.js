'use strict';
module.exports = (sequelize) => {
  var PasswordReset = sequelize.define('password-reset', {
    userId: {
      type: sequelize.Sequelize.INTEGER,
      unique: true,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    token: {
      type: sequelize.Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
  });
  return PasswordReset;
};
