'use strict';
var Sequelize = require('sequelize');
var bcrypt = require('bcryptjs');
var fs = require('fs');
var databaseCfg = JSON.parse(fs.readFileSync('database.json'));
var sequelize = new Sequelize(databaseCfg.database, databaseCfg.user,
  databaseCfg.password, {host: databaseCfg.host, dialect: 'postgres'});
var User = sequelize.define('users', {
  username: {
    type: Sequelize.STRING,
    unique: true,
    allowNull: false,
  },
  email: {
    type: Sequelize.STRING,
    unique: true,
    allowNull: false,
  },
  password: {
    type: Sequelize.STRING,
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

// create all the defined tables in the specified database
sequelize.sync()
  .then(() => console.log('users table has been successfully created, if one ' +
    'doesn\'t exist.'))
  .catch(error => console.log('This error occurred', error));

// export User model for use in other files
module.exports = User;
