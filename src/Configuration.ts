const configurationObject = JSON.parse(require('fs').readFileSync('database.json'));

/**
 * The Sentry configuration specifies whether and how to access the Sentry API.
 */
export interface SentryConfiguration {
  /**
   * Whether Sentry should be enabled.
   */
  enabled: boolean;
  /**
   * The dsn connection string
   */
  dsn: string;
}

/**
 * @returns the sentry configuration.
 */
export function getSentryConfiguration (): SentryConfiguration {
  const sentryCfgInput = configurationObject ? configurationObject.sentry : {};
  const enabled = sentryCfgInput === true; // only accept literal true (no true-ish values)
  const dsn = sentryCfgInput.dsn ? sentryCfgInput.dsn : null;

  return {
    enabled,
    dsn
  };
}

/**
 * A database configuration contains all data necessary to connect to the
 * database.
 */
export interface DatabaseConfiguration {
  /**
   * The hostname or IP of the database server.
   */
  host: string;
  /**
   * The port of the database server.
   */
  port: number;
  /**
   * The name of the database user to use for connecting to the database server.
   */
  username: string;
  /**
   * The password of the database user to use for connecting to the database
   * server.
   */
  password: string;
  /**
   * The name of the database (schema) to use.
   */
  database: string;
}

/**
 * @returns the database configuration.
 */
export function getDatabaseConfiguration (): DatabaseConfiguration {
  const host = configurationObject.host;
  const port = configurationObject.port;
  const username = configurationObject.user;
  const password = configurationObject.password;
  const database = configurationObject.database;

  return {
    host,
    port,
    username,
    password,
    database
  };
}

/**
 * The http authentication configuration specifies if and how http access to the
 * site should be limited by http authentication.
 */
export interface HttpAuthenticationConfiguration {
  /**
   * If http authentication is enabled, users need to enter the one of the
   * specified http credentials to connect to the site.
   */
  enabled: boolean;
  /**
   * The users map is a collection of username <-> password pairs. In each pair,
   * the username is the key and the password is the value in the object.
   */
  users: {[key: string]: string};
}

/**
 * @returns the http authentication configuration.
 */
export function getHttpAuthenticationConfiguration (): HttpAuthenticationConfiguration {
  const enabled = configurationObject.httpAuthentication ? configurationObject.httpAuthentication.enabled === true : false;
  const users = configurationObject.httpAuthentication ? configurationObject.httpAuthentication.users : {};

  return {
    enabled,
    users
  };
}

/**
 * The SSL configuration specifies whether and how to host a HTTPS-server in
 * addition to the HTTP server.
 */
export interface SslConfiguration {
  /**
   * Whether the additional HTTPS server should be enabled.
   */
  enabled: boolean;
  /**
   * Path to the private key used for the SSL certificate.
   */
  privateKeyPath: string;
  /**
   * Path to the SSL certificate.
   */
  certificatePath: string;
  /**
   * The port used for the additional HTTPS server.
   */
  httpsPort: number;
}

/**
 * @returns the SSL configuration.
 */
export function getSslConfiguration (): SslConfiguration {
  const configured = typeof configurationObject.https === 'object' && configurationObject.https != null;

  const enabled = configured ? configurationObject.https.enabled === true : false;
  const privateKeyPath = configured ? configurationObject.https.privateKeyPath : null;
  const certificatePath = configured ? configurationObject.https.certificatePath : null;
  const httpsPort = configured ? configurationObject.https.port : 443;

  return {
    enabled,
    privateKeyPath,
    certificatePath,
    httpsPort
  };
}

/**
 * The http confiuration specifies all properties of the http server.
 */
export interface HttpConfiguration {
  /**
   * The port to host a http server on.
   */
  port: number;
  /**
   * The authentication configuration specifies whether and how the http access
   * to the site is limited by static user credentials.
   */
  authentication: HttpAuthenticationConfiguration;
  /**
   * The SSL configuration specifies whether and how to host an additional
   * HTTPS server.
   */
  ssl: SslConfiguration;
}

/**
 * @returns the http configuration.
 */
export function getHttpConfiguration (): HttpConfiguration {
  const port = configurationObject.httpPort;
  const authentication = getHttpAuthenticationConfiguration();
  const ssl = getSslConfiguration();

  return {
    port,
    authentication,
    ssl
  };
}

/**
 * The ReCaptcha configuration specifies the keys used for captchas.
 */
export interface ReCaptchaConfiguration {
  /**
   * The secret key used by the server to validate captcha responses.
   */
  secret: string;
  /**
   * The public key used by the client to create captcha responses.
   */
  publicKey: string;
}

/**
 * @returns the ReCaptcha configuration.
 */
export function getReCaptchaConfiguration (): ReCaptchaConfiguration {
  const secret = configurationObject.captchaSecret;
  const publicKey = configurationObject.captchaPublicKey;

  return {
    secret,
    publicKey
  };
}

/**
 * This configuration specifies Discord-related values.
 */
export interface DiscordConfiguration {
  /**
   * The ID of the client to use for connecting to the Discord API.
   */
  clientId: string;
  /**
   * The secret for accessing the Discord API with a client.
   */
  clientSecret: string;
  /**
   * Discord webhook URLs to push mod updates and releases to.
   */
  updateWebhookUrls: string[];
  /**
   * An invitation link to the Discord support server for this site.
   */
  supportInviteLink: string;
}

/**
 * @returns the Discord configuration.
 */
export function getDiscordConfiguration (): DiscordConfiguration {
  const discordObj = configurationObject.discord || {};

  const clientId = discordObj.clientId;
  const clientSecret = discordObj.clientSecret;
  const updateWebhookUrls = discordObj.webhooks;
  const supportInviteLink = discordObj.inviteLink;

  return {
    clientId,
    clientSecret,
    updateWebhookUrls,
    supportInviteLink
  };
}

/**
 * The SMTP mail configuration specifies the access credentials for a mail
 * server that can be used to send account service emails.
 */
export interface SmtpMailConfiguration {
  /**
   * The hostname or IP of the SMTP server.
   */
  host: string;
  /**
   * The port of the SMTP server.
   */
  port: number;
  /**
   * Whether to use a secure connection to the SMTP server.
   */
  secure: boolean;
  /**
   * The name of the user on the SMTP server.
   */
  user: string;
  /**
   * The password for the specified user.
   */
  password: string;
}

/**
 * @returns the SMTP mail configuration.
 */
export function getSmtpMailConfiguration (): SmtpMailConfiguration {
  const smtpObj = configurationObject.smtpMail || {};

  const host = smtpObj.host;
  const port = smtpObj.port;
  const secure = smtpObj.secure;
  const user = smtpObj.user;
  const password = smtpObj.password;

  return {
    host,
    port,
    secure,
    user,
    password
  };
}

/**
 * The feature configuration specifies which features of the site are enabled
 * or disabled.
 */
export interface FeatureConfiguration {
  /**
   * Whether to use the new branding. The old branding is "Raft-Mods", the new
   * branding is "RaftModding".
   */
  useNewBranding: boolean;
  /**
   * Whether to use GreenHell branding instead of Raft branding.
   */
  useGreenhellBranding: boolean;
  /**
   * Whether to enable the bundles section.
   */
  enableBundlesSection: boolean;
  /**
   * Whether to enable the plugins section. The server section must be enabled
   * too for this setting to take effect.
   */
  enablePluginsSection: boolean;
  /**
   * Whether to use the server section.
   */
  enableServerSection: boolean;
}

/**
 * @returns the feature configuration.
 */
export function getFeatureConfiguration (): FeatureConfiguration {
  const useNewBranding = configurationObject.newBranding;
  const useGreenhellBranding = configurationObject.greenhellBranding;
  const enableBundlesSection = configurationObject.enableBundlesSection;
  const enablePluginsSection = configurationObject.enablePluginsSection;
  const enableServerSection = configurationObject.enableServerSection;

  return {
    useNewBranding,
    useGreenhellBranding,
    enableBundlesSection,
    enablePluginsSection,
    enableServerSection
  };
}

/**
 * Returns the base URL the site is hosted on.
 */
export function getBaseUrl (): string {
  return configurationObject.baseUrl;
}

/**
 * @returns the configured key for the VirusTotal API.
 */
export function getVirusTotalKey (): string {
  return configurationObject.virusTotalKey;
}

/**
 * @returns the configured Google Analytics ID.
 */
export function getGoogleAnalyticsId (): string {
  return configurationObject.googleAnalyticsId;
}

/**
 * @returns the amount of days to wait before deleting a mod.
 */
export function getModDeletionInterval (): number {
  return configurationObject.modDeletionIntervalInDays;
}

/**
 * @returns whether to disallow downloading old versions of the launcher.
 */
export function getDisallowOldLauncherDownloads (): boolean {
  return configurationObject.disallowOldLauncherDownloads;
}

/**
 * The configuration contains all statically configurable data such as API keys,
 * and feature settings.
 */
export interface Configuration {
  sentry: SentryConfiguration;
  database: DatabaseConfiguration;
  http: HttpConfiguration;
  discord: DiscordConfiguration;
  smtpMail: SmtpMailConfiguration;
  feature: FeatureConfiguration;
  baseUrl: string;
  /**
   * API key for VirusTotal.
   */
  virusTotalKey: string;
  /**
   * The Google Analytics ID to be inserted to the client-side analytics script.
   */
  googleAnalyticsId: string;
  /**
   * The amount of days to wait before deleting a mod.
   */
  modDeletionInterval: number;
  /**
   * Whether to disallow downloading old versions of the launcher.
   */
  disallowOldLauncherDownloads: boolean;
}

/**
 * @returns the configuration.
 */
export function getConfiguration (): Configuration {
  return {
    sentry: getSentryConfiguration(),
    database: getDatabaseConfiguration(),
    http: getHttpConfiguration(),
    discord: getDiscordConfiguration(),
    smtpMail: getSmtpMailConfiguration(),
    feature: getFeatureConfiguration(),
    baseUrl: getBaseUrl(),
    virusTotalKey: getVirusTotalKey(),
    googleAnalyticsId: getGoogleAnalyticsId(),
    modDeletionInterval: getModDeletionInterval(),
    disallowOldLauncherDownloads: getDisallowOldLauncherDownloads()
  };
}
