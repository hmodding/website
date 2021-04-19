# raft-modding-website
This node.js-package contains the source code for the
[RaftModding](https://raftmodding.com/) website. This website allows managing
releases for the Raft Mod Loader (including changelogs and file management) as
well as a mod directory where users can upload, browse and download mods. This
application also contains a data backend that is used for the
`rmllauncher`-protocol which allows for easy mod installation.

## Table of Contents
* [Technology](#Technology)
* [Installation](#Installation)
* [Configuration](#Configuration)
* [Initial Database data](#Initial-Database-data)
* [Copyright](#Copyright)
* [Image licenses](#Image-licenses)

## Technology
This application is backed by loads of services and libraries. For a full list,
check out the dependencies in the [`package.json`](./package.json) file.
* [node.js](https://nodejs.org/) - as a serverside JS environment
* [express.js](https://expressjs.com/) - for serving http requests
* [pug](https://pugjs.org/) - for rendering HTML templates
* [typescript](https://www.typescriptlang.org/) - for type-safe JS code
* [PostgreSQL](https://www.postgresql.org/) - as a database
* [Sequelize](https://sequelize.org/) - as an ORM
* [Bootstrap](https://getbootstrap.com/) - as a CSS framework
* [ReCAPTCHA](https://www.google.com/recaptcha/about/) - to protect our website from bots
* [Cloudflare](https://www.cloudflare.com/) - as a DNS provider and reverse proxy
* [winston](https://github.com/winstonjs/winston) - for logging

## Installation
1. Make sure you have a recent version of [node.js](https://nodejs.org/) and NPM
installed. The application has been tested with node 13 but newer versions should
work too.
2. Create a [PostgreSQL](https://www.postgresql.org/) database and user for the
website. The website has been tested with postgres 12.
3. Clone this repository and run `npm install`.
4. Build the project: `npm run build`
5. Create a `database.json` configuration file [configure](#Configuration) the
application.
6. Start up the application using `npm start` and stop it once it has created
the required database schema (this will be indicated by a log message).
7. Initialize the database. (see [Initial Database data](#Initial-Database-data))
9. Done! For development environments, you can use the `npm run dev` command to
run the site without building it.

## Configuration
Create a `database.json` file at the root of this project. An example can be
found in the `database.example.json` file. All entries in the configuration are
required for the application to work properly. Here's an overview over the
properties:

| property name     | what it does |
| ----------------- | ------------ |
| `host` | The postgres database host address. |
| `port` | The postgres database's port. |
| `database` | The postgres database name to be used by this application. |
| `user` | The postgres database user to be used by this application. |
| `password` | The password for the above specified postgres database user. |
| `virusTotalKey` | The secret key used for authenticating with the VirusTotal API. If the key is invalid, the site will still work but print errors when scanning files. |
| `featuredMods` | Not used any more but also not patched away yet. Use an empty array `[]` to avoid errors. |
| `smtpMail` | An object that contains credentials for an SMTP server that will be used to send out account service emails. |
| `smtpMail.host` | The host name or address of the SMTP server. |
| `smtpMail.port` | The port of the SMTP server. |
| `smtpMail.secure` | Whether to use a secure connection or not when connecting to the SMTP server. |
| `smtpMail.user` | The user for the SMTP server. |
| `smtpMail.password` | The password for the SMTP server user. |
| `captchaSecret` | The ReCAPTCHA V2 secret key. Generate one [here](https://www.google.com/recaptcha/admin/). |
| `captchaPublicKey` | The ReCAPTCHA V2 public key. |
| `discord` | An object containing credentials for the [Discord application](https://discord.com/developers/applications) to use for authorization. |
| `discord.clientId` | The client ID of the Discord application (as a string). |
| `discord.secret` | The secret key for the Discord application. |
| `discord.inviteLink` | An invite link to the support Discord server. |
| `baseUrl` | The URL where the site will be hosted, without a trailing slash. |
| `docsUrl` | URL to the modding documentation site. |
| `googleAnalyticsId` | A [Google Analytics](http://analytics.google.com/) ID. |
| `enableBundlesSection` | Whether to enable the bundle / modpack functionality of the site. Please note that this feature is not in use and might be broken. |
| `enableServerSection` | Whether to enable the "dedicated server software" section on the website. Also not in use on the main site. |
| `enablePluginsSection` | Whether to enable the plugins (server mods) section and features on the website. `enableServerSection` must be enabled too for this to work. |
| `httpPort` | The port to serve the website on. |
| `httpAuthentication` | An object to configure [Basic HTTP authentication](https://en.wikipedia.org/wiki/Basic_access_authentication) to restrict access to all parts of the site. This is useful for publicly available development versions of the site. |
| `httpAuthentication.enabled` | Whether Basic HTTP authentication is enabled. Please note that this type of authentication is independent from any user accounts on the site itself. |
| `httpAuthentication.users` | An object that declares access credentials as key-value pairs (key = user, value = password). |
| `https` | An object used to configure an optional HTTPS server. |
| `https.enabled` | Whether to enable an additional HTTPS server. |
| `https.privateKeyPath` | Path to your SSL certificate key. |
| `https.certificatePath` | Path to your SSL certificate. |
| `https.port` | The port to use for the HTTPS server. |
| `modDeletionIntervalInDays` | The amount of days to wait before deleting mods. |
| `sentry` | An object to configure [Sentry](https://sentry.io/) error logging. |
| `sentry.enabled` | Whether to enable Sentry logging. |
| `sentry.dsn` | The DSN (key) for your Sentry environment. |
| `disallowOldLauncherDownloads` | Whether to disallow downloads of old mod loader launcher versions. |
| `acceptedModFileTypes` | A comma-separated (no whitespaces) list of file types that should be allowed for uploads (including the dot). |
| `installableModFileType` | The file type extension (incl. the dot) for mod files that can be installed via the `rmllauncher` protocol. |
| `notificationService` | An object that stores credentials for a [Discord Notification Service](https://github.com/raftmodding/discord-notification-service) instance. |
| `notificationService.baseUrl` | The base URL of the notification service. |
| `notificationService.token` | The access token for the notification service. |

## Initial Database data
After setting up your Configuration properly 
and having run the app at least once (so the initial tables are present) 
run these scripts on your database:
```sql
INSERT INTO users(id, username, email, password, "createdAt", "updatedAt")VALUES (0, 'admin', 'admin-0000000000000000000', '$2a$04$2JkewxGRqEZhSDhN4p.Xgu/vsy3vWWDdpRzFKgxUwCylpBnFgMvzS', '2019-01-01 00:00:00.000000', '2019-01-01 00:00:00.000000');
INSERT INTO "raft-versions"(id, version, "buildId", title, "releasedAt", "createdAt", "updatedAt")VALUES (0, '0.0.1', 1, 'Version 0.0.1', '2019-01-01 00:00:00.000000', '2019-01-01 00:00:00.000000', '2019-01-01 00:00:00.000000');
INSERT INTO "launcher-versions"(version, timestamp, "downloadUrl", "downloadCount", changelog, "createdAt", "updatedAt")VALUES ('0.0.1', '2019-01-01 00:00:00.000000', '', 0, '', '2019-01-01 00:00:00.000000', '2019-01-01 00:00:00.000000');
INSERT INTO "user-privileges" ("username", "role", "createdAt", "updatedAt") VALUES('admin', 'admin', '2019-01-01 00:00:00.000000', '2019-01-01 00:00:00.000000');
```

You can then login with `admin:admin`

## Copyright
Copyright (c) 2019-2021 traxam and contributors.

## Image licenses
- GitLab project avatar: Icon by [Freepik](https://www.freepik.com/) from [Flaticon](https://www.flaticon.com), licensed CC 3.0 BY
- Icons used in the project: [FontAwesome free license](https://fontawesome.com/license/free)
