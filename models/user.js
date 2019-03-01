'use strict';
module.exports = (sequelize) => {
  var bcrypt = require('bcryptjs');
  var User = sequelize.define('users', {
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
  User.prototype.validPassword = function(password) {
    return bcrypt.compareSync(password, this.password);
  };
  return User;
};
