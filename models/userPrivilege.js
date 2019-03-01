'use strict';
var Sequelize = require('sequelize');
var fs = require('fs');
var databaseCfg = JSON.parse(fs.readFileSync('database.json'));
var sequelize = new Sequelize(databaseCfg.database, databaseCfg.user,
  databaseCfg.password, {host: databaseCfg.host, dialect: 'postgres'});
var UserPrivilege = sequelize.define('user-privileges', {
  username: {
    type: Sequelize.STRING,
    unique: true,
    allowNull: false,
  },
  role: {
    type: Sequelize.STRING,
    unique: false,
    allowNull: false,
  },
});

// create all the defined tables in the specified database
sequelize.sync()
  .then(() => console.log('user-privileges table has been successfully ' +
    'created, if one doesn\'t exist.'))
  .catch(error => console.log('This error occurred', error));

// export UserPrivilege model for use in other files
module.exports = UserPrivilege;
