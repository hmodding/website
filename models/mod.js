var Sequelize = require('sequelize');
var bcrypt = require('bcryptjs');
var fs = require('fs');
var databaseCfg = JSON.parse(fs.readFileSync('database.json'));
var sequelize = new Sequelize(databaseCfg.database, databaseCfg.user, databaseCfg.password, {
    host: databaseCfg.host,
    dialect: 'postgres'
});
var Mod = sequelize.define('mods', {
    id: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false,
        primaryKey: true
    },
    title: {
        type: Sequelize.STRING,
        allowNull: false
    },
    description: {
        type: Sequelize.STRING,
        allowNull: false
    },
    readme: {
        type: Sequelize.STRING,
        allowNull: false
    },
    category: {
        type: Sequelize.STRING,
        allowNull: false
    },
    version: {
        type: Sequelize.STRING,
        allowNull: false
    },
    author: {
        type: Sequelize.STRING,
        allowNull: false
    },
    downloadUrl: {
        type: Sequelize.STRING,
        allowNull: false
    }
});

// create all the defined tables in the specified database
sequelize.sync()
    .then(() => console.log('mods table has been successfully created, if one doesn\'t exist'))
    .catch(error => console.log('This error occurred', error));

// export User model for use in other files
module.exports = Mod;