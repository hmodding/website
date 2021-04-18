/**
 * The Sentry configuration specifies whether and how to access the Sentry API.
 */
export interface SentryConfiguration {
  /**
   * Whether Sentry should be enabled.
   */
  enabled: boolean
  /**
   * The dsn connection string. This value has no meaning if `enabled` is
   * `false`.
   */
  dsn: string
}

/**
 * A database configuration contains all data necessary to connect to the
 * database.
 */
export interface DatabaseConfiguration {
  /**
   * The hostname or IP of the database server.
   */
  host: string
  /**
   * The port of the database server.
   */
  port: number
  /**
   * The name of the database user to use for connecting to the database server.
   */
  username: string
  /**
   * The password of the database user to use for connecting to the database
   * server.
   */
  password: string
  /**
   * The name of the database (schema) to use.
   */
  database: string
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
  enabled: boolean
  /**
   * The users map is a collection of username <-> password pairs. In each pair,
   * the username is the key and the password is the value in the object.
   */
  users: {[key: string]: string}
}

/**
 * The SSL configuration specifies whether and how to host a HTTPS-server in
 * addition to the HTTP server.
 */
export interface SslConfiguration {
  /**
   * Whether the additional HTTPS server should be enabled.
   */
  enabled: boolean
  /**
   * Path to the private key used for the SSL certificate.
   */
  privateKeyPath: string
  /**
   * Path to the SSL certificate.
   */
  certificatePath: string
  /**
   * The port used for the additional HTTPS server.
   */
  httpsPort: number
}

/**
 * The http confiuration specifies all properties of the http server.
 */
export interface HttpConfiguration {
  /**
   * The port to host a http server on.
   */
  port: number
  /**
   * The authentication configuration specifies whether and how the http access
   * to the site is limited by static user credentials.
   */
  authentication: HttpAuthenticationConfiguration
  /**
   * The SSL configuration specifies whether and how to host an additional
   * HTTPS server.
   */
  ssl: SslConfiguration
}

/**
 * The ReCaptcha configuration specifies the keys used for captchas.
 */
export interface ReCaptchaConfiguration {
  /**
   * The secret key used by the server to validate captcha responses.
   */
  secret: string
  /**
   * The public key used by the client to create captcha responses.
   */
  publicKey: string
}

/**
 * This configuration specifies Discord-related values.
 */
export interface DiscordConfiguration {
  /**
   * The ID of the client to use for connecting to the Discord API.
   */
  clientId: string
  /**
   * The secret for accessing the Discord API with a client.
   */
  clientSecret: string
  /**
   * An invitation link to the Discord support server for this site.
   */
  supportInviteLink: string
}

/**
 * The SMTP mail configuration specifies the access credentials for a mail
 * server that can be used to send account service emails.
 */
export interface SmtpMailConfiguration {
  /**
   * The hostname or IP of the SMTP server.
   */
  host: string
  /**
   * The port of the SMTP server.
   */
  port: number
  /**
   * Whether to use a secure connection to the SMTP server.
   */
  secure: boolean
  /**
   * The name of the user on the SMTP server.
   */
  user: string
  /**
   * The password for the specified user.
   */
  password: string
}

/**
 * The feature configuration specifies which features of the site are enabled
 * or disabled.
 */
export interface FeatureConfiguration {
  /**
   * Whether to use GreenHell branding instead of Raft branding.
   */
  useGreenhellBranding: boolean
  /**
   * Whether to enable the bundles section.
   */
  enableBundlesSection: boolean
  /**
   * Whether to enable the plugins section. The server section must be enabled
   * too for this setting to take effect.
   */
  enablePluginsSection: boolean
  /**
   * Whether to use the server section.
   */
  enableServerSection: boolean
}

/**
 * The configuration contains all statically configurable data such as API keys,
 * and feature settings.
 */
export interface Configuration {
  sentry: SentryConfiguration
  database: DatabaseConfiguration
  http: HttpConfiguration
  reCaptcha: ReCaptchaConfiguration
  discord: DiscordConfiguration
  smtpMail: SmtpMailConfiguration
  feature: FeatureConfiguration
  baseUrl: string
  /**
   * API key for VirusTotal.
   */
  virusTotalKey: string
  /**
   * The Google Analytics ID to be inserted to the client-side analytics script.
   */
  googleAnalyticsId: string
  /**
   * The amount of days to wait before deleting a mod.
   */
  modDeletionInterval: number
  /**
   * Whether to disallow downloading old versions of the launcher.
   */
  disallowOldLauncherDownloads: boolean
  /**
   * A comma-separated list of file extensions (including the dot) that are
   * allowed for mod uploads.
   */
  acceptedModFileTypes: string
  /**
   * The file extension (including the dot) that can be used for installation
   * links.
   */
  installableModFileType: string
}
