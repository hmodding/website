import { BelongsToManyOptions, BelongsToOptions, FindOptions, HasManyOptions, HasOneOptions, Sequelize } from 'sequelize';
import { getDatabaseConfiguration } from './config/json-configuration';
import setupRaftVersion from './models/raftVersion';
import setupFileScan from './models/fileScan';
import setupLoaderVersion from './models/loaderVersion';
import setupMod from './models/mod';
import setupUser from './models/user';
import setupUserPrivilege from './models/userPrivilege';
import setupModVersion from './models/modVersion';
import setupAccountCreation from './models/accountCreation';
import setupPasswordReset from './models/passwordReset';
import setupDiscordSignOn from './models/discordSignOn';
import setupDiscordAccountCreation from './models/discordAccountCreation';
import setupModBundle from './models/modBundle';
import setupScheduledModDeletion from './models/scheduledModDeletion';
import setupServerVersion from './models/serverVersion';
import setupPlugin from './models/plugin';
import setupPluginVersion from './models/pluginVersion';
import setupScheduledPluginDeletion from './models/scheduledPluginDeletion';
import setupLauncherVersion from './models/launcherVersion';
import setupDownloadTracker from './models/downloadTracker';

const config = getDatabaseConfiguration();

export const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  dialect: 'postgres',
  logging: false // use logger.debug, for full SQL output
});

interface Schema<Data> {
  findAll: (options: FindOptions) => Promise<Data[]>
  belongsTo: (schema: Schema<any>, options: BelongsToOptions) => void
  hasMany: (schema: Schema<any>, options: HasManyOptions) => void
  belongsToMany: (schema: Schema<any>, options: BelongsToManyOptions) => void
  hasOne: (schema: Schema<any>, options: HasOneOptions) => void
}

interface RaftVersionData {
  version: string
  buildId: number
  title: string
  releasedAt: Date
}
export const RaftVersion: Schema<RaftVersionData> = setupRaftVersion(sequelize);

interface FileScanData {
  fileUrl: string
  scanId: string
  scanResult: object
}
export const FileScan: Schema<FileScanData> = setupFileScan(sequelize);

interface LoaderVersionData {
  rmlVersion: string
  raftVersionId: number
  timestamp: Date
  downloadUrl: string
  readme: string
}
export const LoaderVersion: Schema<LoaderVersionData> = setupLoaderVersion(sequelize);

interface ModData {
  id: string
  title: string
  description: string
  readme: string
  category: string
  author: string
  bannerImageUrl: string
  iconImageUrl: string
  repositoryUrl: string
}
export const Mod: Schema<ModData> = setupMod(sequelize);

interface UserData {
  username: string
  email: string
  password: string
}
export const User: Schema<UserData> = setupUser(sequelize);

interface UserPrivilegeData {
  username: string
  role: string
}
export const UserPrivilege: Schema<UserPrivilegeData> = setupUserPrivilege(sequelize);

interface ModVersionData {
  modId: string
  version: string
  changelog: string
  downloadUrl: string
  downloadCount: number
  minRaftVersionId: number
  maxRaftVersionId: number
  definiteMaxRaftVersion: boolean
}
export const ModVersion: Schema<ModVersionData> = setupModVersion(sequelize);

interface AccountCreationData {
  username: string
  email: string
  password: string
  token: string
}
export const AccountCreation: Schema<AccountCreationData> = setupAccountCreation(sequelize);

interface PasswordResetData {
  userId: number
  token: string
}
export const PasswordReset: Schema<PasswordResetData> = setupPasswordReset(sequelize);

interface DiscordSignOnData {
  userId: number
  discordUserId: string
  accessToken: string
  refreshToken: string
}
export const DiscordSignOn: Schema<DiscordSignOnData> = setupDiscordSignOn(sequelize);

interface DiscordAccountCreationData {
  discordUserId: string
  accessToken: string
  refreshToken: string
  token: string
  discordUserObject: object
}
export const DiscordAccountCreation: Schema<DiscordAccountCreationData> = setupDiscordAccountCreation(sequelize);

interface ModBundleData {
  title: string
  description: string
  readme: string
  maintainerId: number
  bannerImageUrl: string
}
export const ModBundle: Schema<ModBundleData> = setupModBundle(sequelize);

interface ScheduledModDeletionData {
  modId: number
  deletionTime: Date
}
export const ScheduledModDeletion: Schema<ScheduledModDeletionData> = setupScheduledModDeletion(sequelize);

interface ServerVersionData {
  version: string
  raftVersion: string
  timestamp: Date
  downloadUrl: string
  changelog: string
}
export const ServerVersion: Schema<ServerVersionData> = setupServerVersion(sequelize);

interface PluginData {
  slug: string
  title: string
  description: string
  readme: string
  maintainerId: number
  bannerImageUrl: string
  repositoryUrl: string
}
export const Plugin: Schema<PluginData> = setupPlugin(sequelize);

interface PluginVersionData {
  pluginId: number
  version: string
  changelog: string
  downloadUrl: string
  downloadCount: number
  minServerVersionId: number
  maxServerVersionId: number
  definiteMaxServerVersion: boolean
}
export const PluginVersion: Schema<PluginVersionData> = setupPluginVersion(sequelize);

interface ScheduledPluginDeletionData {
  pluginId: number
  deletionTime: Date
}
export const ScheduledPluginDeletion: Schema<ScheduledPluginDeletionData> = setupScheduledPluginDeletion(sequelize);

interface LauncherVersionData {
  version: string
  timestamp: Date
  downloadUrl: string
  downloadCount: number
  changelog: string
}
export const LauncherVersion: Schema<LauncherVersionData> = setupLauncherVersion(sequelize);

interface DownloadTrackerData {
  ipHash: string
  path: string
  expiresAt: Date
}
export const DownloadTracker: Schema<DownloadTrackerData> = setupDownloadTracker(sequelize);

LoaderVersion.belongsTo(RaftVersion,
  { foreignKey: 'raftVersionId', as: 'raftVersion' });

Mod.hasMany(ModVersion, { foreignKey: 'modId' });
ModVersion.belongsTo(Mod, { foreignKey: 'modId' });
ModVersion.belongsTo(RaftVersion,
  { foreignKey: 'minRaftVersionId', as: 'minRaftVersion' });
ModVersion.belongsTo(RaftVersion,
  { foreignKey: 'maxRaftVersionId', as: 'maxRaftVersion' });

Plugin.hasMany(PluginVersion, { foreignKey: 'pluginId', as: 'versions' });
PluginVersion.belongsTo(Plugin, { foreignKey: 'pluginId' });

Plugin.belongsTo(User, { foreignKey: 'maintainerId', as: 'maintainer' });
User.hasMany(Plugin, { foreignKey: 'maintainerId' });

ScheduledPluginDeletion.belongsTo(Plugin, { foreignKey: 'pluginId' });
Plugin.hasOne(ScheduledPluginDeletion, { foreignKey: 'pluginId', as: 'deletion' });

ModBundle.belongsTo(User,
  { as: 'maintainer', foreignKey: 'maintainerId', targetKey: 'id' });
User.hasMany(ModBundle,
  { as: 'modBundles', foreignKey: 'maintainerId', sourceKey: 'id' });

ModBundle.belongsToMany(ModVersion,
  { through: 'ModBundleContents', as: 'modContents' });
ModVersion.belongsToMany(ModBundle,
  { through: 'ModBundleContents', as: 'containingModBundles' });

User.belongsToMany(Mod, { through: 'ModLikes', as: 'likedMods' });
Mod.belongsToMany(User, { through: 'ModLikes', as: 'likes' });

ScheduledModDeletion.belongsTo(Mod,
  { as: 'mod', foreignKey: 'modId', targetKey: 'id' });
Mod.hasOne(ScheduledModDeletion,
  { as: 'deletion', foreignKey: 'modId', sourceKey: 'id' });

/**
 * Finds the current RML version in the database.
 * @returns the current RML version as a string or undefined if no RML version
 *          could be found.
 */
export async function findCurrentRmlVersion (): Promise<string | undefined> {
  const loaderVersions = await LoaderVersion.findAll({
    limit: 1,
    order: [['createdAt', 'DESC']]
  });

  if (loaderVersions.length > 0) {
    return loaderVersions[0].rmlVersion;
  } else {
    return undefined;
  }
}

/**
 * Finds the current server version in the database.
 * @returns a Promise that returns the current server version or undefined if no
 * server version could be found.
 */
export async function findCurrentServerVersion (): Promise<ServerVersionData | undefined> {
  const versions = await ServerVersion.findAll({
    order: [['createdAt', 'DESC']],
    limit: 1
  });

  if (versions.length === 0) {
    return undefined;
  } else {
    return versions[0];
  }
}
