# 📦⛵ raft-modding-website
This node.js-package contains the source code for [traxam's Raft-modding website](https://raftmodding.trax.am/).

## 📍 Features
This website offers features in two categories:
* mod loader:
  - administrators can upload (or link external) and manage mod loader versions
  - mod loader versions have an changelog page which enables keeping track of previous changes
  - mod loader overview: an installation guide along with a list of previous mod loader versions
* mods:
  - mods can be uploaded or linked by logged in users
  - mod pages allow presenting the mod using markdown and a banner image
  - mod authors add mod updates along with changelogs.
  - old mod versions and their changelogs are kept on a mod's versions page
  - uploaded mods are automatically scanned using [VirusTotal](https://www.virustotal.com/).

The website is backed by
* a custom user system which is protected by [reCAPTCHA](https://www.google.com/recaptcha/intro/v3.html#).
* a postgres database (all database schemas are automatically created)

## ✔️ Installation requirements
* [node](https://nodejs.org/) version 10.X.X or newer
* a [postgres](https://www.postgresql.org/) database
* Port 3000 to be used for http
* Read- and write-access for the node process in the project directory.
* Allow a sufficient upload file size in your reverse proxy (i.e. `client_max_body_size 500M` in nginx)

## 🎛️ Configuration
Create a `database.json` file at the root of this project. An example can be found in the `database.example.json` file.
All entries in the configuration are required for the application to work properly. Here's an overview over the properties:

| property name     | what it does |
| ----------------- | ------------ |
| `host`            | The postgres database host address. |
| `port`            | The postgres database's port. |
| `database`        | The postgres database name to be used by this application. |
| `user`            | The postgres database user to be used by this application. |
| `password`        | The password for the above specified postgres database user. |
| `virusTotalKey`   | The secret key used for authenticating with the VirusTotal API. |

## 📝 Copyright
Copyright (c) 2019 traxam.
# Image licenses
- GitLab project avatar: Icon by [Freepik](https://www.freepik.com/) from [Flaticon](https://www.flaticon.com), licensed CC 3.0 BY
- Icons used in the project: [FontAwesome free license](https://fontawesome.com/license/free)
