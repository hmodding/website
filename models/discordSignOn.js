'use strict';
module.exports = (sequelize) => {
  var DiscordSignOn = sequelize.define('discord-sign-ons', {
    userId: {
      type: sequelize.Sequelize.INTEGER,
      unique: true,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
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
  });
  return DiscordSignOn;
};
