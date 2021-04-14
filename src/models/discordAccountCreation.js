'use strict';
module.exports = (sequelize) => {
  var DiscordAccountCreation = sequelize.define('discord-account-creations', {
    discordUserId: {
      type: sequelize.Sequelize.STRING,
      unique: true,
      allowNull: false,
    },
    accessToken: {
      type: sequelize.Sequelize.STRING,
      allowNull: false,
    },
    refreshToken: {
      type: sequelize.Sequelize.STRING,
      allowNull: false,
    },
    token: {
      type: sequelize.Sequelize.STRING,
      allowNull: false,
    },
    discordUserObject: {
      type: sequelize.Sequelize.JSON,
      allowNull: false,
    },
  });
  return DiscordAccountCreation;
};
