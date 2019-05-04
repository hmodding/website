'use strict';
module.exports = (logger) => {
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
      logging: false, // use logger.debug, for full SQL output
    });

  var FileScan = require('./models/fileScan')(sequelize);
  var LoaderVersion = require('./models/loaderVersion')(sequelize);
  var Mod = require('./models/mod')(sequelize);
  var User = require('./models/user')(sequelize);
  var UserPrivilege = require('./models/userPrivilege')(sequelize);
  var ModVersion = require('./models/modVersion')(sequelize);

  Mod.hasMany(ModVersion, {foreignKey: 'modId'});

  return {
    FileScan: FileScan,
    LoaderVersion: LoaderVersion,
    Mod: Mod,
    User: User,
    UserPrivilege: UserPrivilege,
    ModVersion: ModVersion,
    sequelize: sequelize,
  };
};
