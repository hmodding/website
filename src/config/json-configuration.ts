import { Configuration, DatabaseConfiguration, DiscordConfiguration, FeatureConfiguration, HttpAuthenticationConfiguration, HttpConfiguration, ReCaptchaConfiguration, SentryConfiguration, SmtpMailConfiguration, SslConfiguration } from './Configuration';
import { readFileSync } from 'fs';
import { array, boolean, number, object, string } from 'yup';

const configurationJson = readFileSync('database.json').toString();
const configurationObject = JSON.parse(configurationJson);

const configurationSchema = object().required().shape({
  host: string().required(),
  port: number().required(),
  database: string().required(),
  user: string().required(),
  password: string().required(),
  virusTotalKey: string().required(),
  featuredMods: array().required().of(string()),
  smtpMail: object().required().shape({
    host: string().required(),
    port: number().required(),
    secure: boolean().required(),
    user: string().required(),
    password: string().required()
  }),
  captchaSecret: string().required(),
  captchaPublicKey: string().required(),
  discord: object().required().shape({
    clientId: string().required(),
    secret: string().required(),
    inviteLink: string().required()
  }),
  baseUrl: string().required(),
  docsUrl: string().required(),
  googleAnalyticsId: string().optional(),
  enableBundlesSection: boolean().default(false),
  enablePluginsSection: boolean().default(false),
  enableServerSection: boolean().default(false),
  newBranding: boolean().default(true),
  greenhellBranding: boolean().default(false),
  httpPort: number().integer().default(3000),
  httpAuthentication: object().optional().shape({
    enabled: boolean().required(),
    users: object().required()
  }),
  https: object().optional().shape({
    enabled: boolean().required(),
    privateKeyPath: string().required(),
    certificatePath: string().required(),
    port: number().required()
  }),
  modDeletionInterval: number().integer().default(10),
  sentry: object().optional().shape({
    enabled: boolean().required(),
    dsn: string().required()
  }),
  disallowOldLauncherDownloads: boolean().default(true),
  acceptedModFileTypes: string().default('.rmod'),
  installableModFileType: string().default('.rmod'),
  notificationService: object().required().shape({
    baseUrl: string().required(),
    token: string().required()
  })
});

const config = configurationSchema.validateSync(configurationObject);

/**
 * @returns the sentry configuration.
 */
export function getSentryConfiguration (): SentryConfiguration {
  if (config.sentry !== null && config.sentry !== undefined) {
    return {
      enabled: config.sentry.enabled,
      dsn: config.sentry.dsn
    };
  } else {
    return {
      enabled: false,
      dsn: 'sentry is not configured'
    };
  }
}

/**
 * @returns the database configuration.
 */
export function getDatabaseConfiguration (): DatabaseConfiguration {
  return {
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: config.database
  };
}

/**
 * @returns the http authentication configuration.
 */
export function getHttpAuthenticationConfiguration (): HttpAuthenticationConfiguration {
  if (config.httpAuthentication !== null && config.httpAuthentication !== undefined) {
    return {
      enabled: config.httpAuthentication.enabled,
      users: config.httpAuthentication.users
    };
  } else {
    return {
      enabled: false,
      users: {}
    };
  }
}

/**
 * @returns the SSL configuration.
 */
export function getSslConfiguration (): SslConfiguration {
  if (config.https !== null && config.https !== undefined) {
    return {
      enabled: config.https.enabled,
      privateKeyPath: config.https.privateKeyPath,
      certificatePath: config.https.certificatePath,
      httpsPort: config.https.port
    };
  } else {
    return {
      enabled: false,
      privateKeyPath: 'ssl is not configured',
      certificatePath: 'ssl is not configured',
      httpsPort: 443
    };
  }
}

/**
 * @returns the http configuration.
 */
export function getHttpConfiguration (): HttpConfiguration {
  return {
    port: config.httpPort,
    authentication: getHttpAuthenticationConfiguration(),
    ssl: getSslConfiguration()
  };
}

/**
 * @returns the ReCaptcha configuration.
 */
export function getReCaptchaConfiguration (): ReCaptchaConfiguration {
  return {
    secret: config.captchaSecret,
    publicKey: config.captchaPublicKey
  };
}

/**
 * @returns the Discord configuration.
 */
export function getDiscordConfiguration (): DiscordConfiguration {
  return {
    clientId: config.discord.clientId,
    clientSecret: config.discord.secret,
    supportInviteLink: config.discord.inviteLink
  };
}

/**
 * @returns the SMTP mail configuration.
 */
export function getSmtpMailConfiguration (): SmtpMailConfiguration {
  return {
    host: config.smtpMail.host,
    port: config.smtpMail.port,
    secure: config.smtpMail.secure,
    user: config.smtpMail.user,
    password: config.smtpMail.password
  };
}

/**
 * @returns the feature configuration.
 */
export function getFeatureConfiguration (): FeatureConfiguration {
  return {
    useNewBranding: config.newBranding,
    useGreenhellBranding: config.greenhellBranding,
    enableBundlesSection: config.enableBundlesSection,
    enablePluginsSection: config.enablePluginsSection,
    enableServerSection: config.enableServerSection
  };
}

/**
 * @returns the configuration.
 */
export function getConfiguration (): Configuration {
  return {
    sentry: getSentryConfiguration(),
    database: getDatabaseConfiguration(),
    http: getHttpConfiguration(),
    reCaptcha: getReCaptchaConfiguration(),
    discord: getDiscordConfiguration(),
    smtpMail: getSmtpMailConfiguration(),
    feature: getFeatureConfiguration(),
    baseUrl: config.baseUrl,
    virusTotalKey: config.virusTotalKey,
    googleAnalyticsId:
      config.googleAnalyticsId === undefined ? '' : config.googleAnalyticsId,
    modDeletionInterval: config.modDeletionInterval,
    disallowOldLauncherDownloads: config.disallowOldLauncherDownloads,
    acceptedModFileTypes: config.acceptedModFileTypes,
    installableModFileType: config.installableModFileType
  };
}
