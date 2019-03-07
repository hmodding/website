'use strict';
var fs = require('fs');
var credentials = JSON.parse(fs.readFileSync('database.json'));

var Sequelize = require('sequelize');
var sequelize = new Sequelize(
  credentials.database,
  credentials.user,
  credentials.password,
  {
    host: credentials.host,
    dialect: 'postgres',
    logging: false,
  });

var FileScan = require('./models/fileScan')(sequelize);
var LoaderVersion = require('./models/loaderVersion')(sequelize);
var Mod = require('./models/mod')(sequelize);
var User = require('./models/user')(sequelize);
var UserPrivilege = require('./models/userPrivilege')(sequelize);
var ModVersion = require('./models/modVersion')(sequelize);

// create all defined tables in the actual database
sequelize.sync()
  .then(() => {
    console.log('Database tables have successfully been created if they ' +
      'didn\'t already exist.');
  })
  .catch(error => {
    console.log('Error while syncing database with ORM:', error);
  });

module.exports = {
  FileScan: FileScan,
  LoaderVersion: LoaderVersion,
  Mod: Mod,
  User: User,
  UserPrivilege: UserPrivilege,
  ModVersion: ModVersion,
};
