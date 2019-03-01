'use strict';
var Sequelize = require('sequelize');
var fs = require('fs');
var databaseCfg = JSON.parse(fs.readFileSync('database.json'));
var sequelize = new Sequelize(databaseCfg.database, databaseCfg.user,
  databaseCfg.password, {host: databaseCfg.host, dialect: 'postgres'});
var LoaderVersion = sequelize.define('loader-versions', {
  rmlVersion: {
    type: Sequelize.STRING,
    unique: true,
    allowNull: false,
    primaryKey: true,
  },
  raftVersion: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  timestamp: {
    type: Sequelize.DATE,
    allowNull: false,
  },
  downloadUrl: {
    type: Sequelize.TEXT,
    allowNull: false,
  },
  readme: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
});

// create all the defined tables in the specified database
sequelize.sync()
  .then(() => console.log('loader-versions table has been successfully ' +
    'created, if one doesn\'t exist'))
  .catch(error => console.log('This error occurred', error));

// export LoaderVersion model for use in other files
module.exports = LoaderVersion;
