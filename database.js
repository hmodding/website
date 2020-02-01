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
      operatorsAliases: false,
    });

  const RaftVersion = require('./models/raftVersion')(sequelize);
  var FileScan = require('./models/fileScan')(sequelize);
  var LoaderVersion = require('./models/loaderVersion')(sequelize);
  var Mod = require('./models/mod')(sequelize);
  var User = require('./models/user')(sequelize);
  var UserPrivilege = require('./models/userPrivilege')(sequelize);
  var ModVersion = require('./models/modVersion')(sequelize);
  var AccountCreation = require('./models/accountCreation')(sequelize);
  var PasswordReset = require('./models/passwordReset')(sequelize);
  var DiscordSignOn = require('./models/discordSignOn')(sequelize);
  var DiscordAccountCreation =
    require('./models/discordAccountCreation')(sequelize);
  var ModBundle = require('./models/modBundle')(sequelize);
  var ScheduledModDeletion =
    require('./models/scheduledModDeletion')(sequelize);
  var ServerVersion = require('./models/serverVersion')(sequelize);
  var Plugin = require('./models/plugin')(sequelize);
  var PluginVersion = require('./models/pluginVersion')(sequelize);
  const ScheduledPluginDeletion =
    require('./models/scheduledPluginDeletion')(sequelize);
  const LauncherVersion =
    require('./models/launcherVersion')(sequelize);

  LoaderVersion.belongsTo(RaftVersion,
    {foreignKey: 'raftVersionId', as: 'raftVersion'});

  Mod.hasMany(ModVersion, {foreignKey: 'modId'});
  ModVersion.belongsTo(Mod, {foreignKey: 'modId'});

  Plugin.hasMany(PluginVersion, {foreignKey: 'pluginId', as: 'versions'});
  PluginVersion.belongsTo(Plugin, {foreignKey: 'pluginId'});

  Plugin.belongsTo(User, {foreignKey: 'maintainerId', as: 'maintainer'});
  User.hasMany(Plugin, {foreignKey: 'maintainerId'});

  ScheduledPluginDeletion.belongsTo(Plugin,
    {foreignKey: 'pluginId'});
  Plugin.hasOne(ScheduledPluginDeletion, {foreignKey: 'pluginId',
    as: 'deletion'});

  ModBundle.belongsTo(User,
    {as: 'maintainer', foreignKey: 'maintainerId', targetKey: 'id'});
  User.hasMany(ModBundle,
    {as: 'modBundles', foreignKey: 'maintainerId', sourceKey: 'id'});

  ModBundle.belongsToMany(ModVersion,
    {through: 'ModBundleContents', as: 'modContents'});
  ModVersion.belongsToMany(ModBundle,
    {through: 'ModBundleContents', as: 'containingModBundles'});

  User.belongsToMany(Mod, {through: 'ModLikes', as: 'likedMods'});
  Mod.belongsToMany(User, {through: 'ModLikes', as: 'likes'});

  ScheduledModDeletion.belongsTo(Mod,
    {as: 'mod', foreignKey: 'modId', targetKey: 'id'});
  Mod.hasOne(ScheduledModDeletion,
    {as: 'deletion', foreignKey: 'modId', sourceKey: 'id'});

  /**
   * Finds the current RML version in the database.
   * @returns the current RML version as a string or undefined if no RML version
   *          could be found.
   */
  function findCurrentRmlVersion() {
    return LoaderVersion.findAll({
      limit: 1,
      order: [ ['createdAt', 'DESC'] ],
    })
      .then(loaderVersions => {
        if (loaderVersions && loaderVersions.length > 0) {
          return loaderVersions[0].rmlVersion;
        } else {
          return undefined;
        }
      });
  }

  /**
   * Finds the current server version in the database.
   * @returns a Promise that returns the current server version as a (unique)
   *          string or undefined if no server version could be found.
   */
  function findCurrentServerVersion() {
    return ServerVersion.findAll({
      order: [['createdAt', 'DESC']],
      limit: 1,
    })
      .then(versions => {
        if (!versions || versions.length === 0) {
          return undefined;
        } else {
          return versions[0];
        }
      });
  }

  return {
    RaftVersion,
    FileScan: FileScan,
    LoaderVersion: LoaderVersion,
    Mod: Mod,
    User: User,
    UserPrivilege: UserPrivilege,
    ModVersion: ModVersion,
    AccountCreation: AccountCreation,
    PasswordReset,
    DiscordSignOn,
    DiscordAccountCreation,
    ModBundle,
    ScheduledModDeletion,
    ServerVersion,
    Plugin,
    PluginVersion,
    ScheduledPluginDeletion,
    LauncherVersion,
    sequelize: sequelize,
    findCurrentRmlVersion,
    findCurrentServerVersion,
  };
};
