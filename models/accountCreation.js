'use strict';
module.exports = (sequelize) => {
  var bcrypt = require('bcryptjs');
  var AccountCreation = sequelize.define('account-creation', {
    username: {
      type: sequelize.Sequelize.STRING,
      unique: true,
      allowNull: false,
    },
    email: {
      type: sequelize.Sequelize.STRING,
      unique: true,
      allowNull: false,
    },
    password: {
      type: sequelize.Sequelize.STRING,
      allowNull: false,
    },
    token: {
      type: sequelize.Sequelize.STRING,
      allowNull: false,
      unique: true,
    },
  }, {
    hooks: {
      beforeCreate: (user) => {
        const salt = bcrypt.genSaltSync();
        user.password = bcrypt.hashSync(user.password, salt);
      },
    },
    instanceMethods: {
      validPassword: function(password) {
        return bcrypt.compareSync(password, this.password);
      },
    },
  });
  AccountCreation.prototype.validPassword = function(password) {
    return bcrypt.compareSync(password, this.password);
  };
  return AccountCreation;
};
