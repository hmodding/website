var Sequelize = require('sequelize');
var bcrypt = require('bcryptjs');
var fs = require('fs');
var databaseCfg = JSON.parse(fs.readFileSync('database.json'));
var sequelize = new Sequelize(databaseCfg.database, databaseCfg.user, databaseCfg.password, {
    host: databaseCfg.host,
    dialect: 'postgres'
});
var FileScan = sequelize.define('file-scans', {
    fileUrl: {
        type: Sequelize.TEXT,
        unique: true,
        allowNull: false,
        primaryKey: true
    },
    scanId: {
        type: Sequelize.STRING(96), // (sha256 = 64 chars) + (scan id ~ 10 chars) + buffer
        allowNull: true
    },
    scanResult: {
        type: Sequelize.JSON,
        allowNull: true
    }
});

// create all the defined tables in the specified database
sequelize.sync()
    .then(() => console.log('file-scans table has been successfully created, if one doesn\'t exist'))
    .catch(error => console.log('This error occurred', error));

// export FileScan model for use in other files
module.exports = FileScan;