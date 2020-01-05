'use strict';

const axios = require('axios');
var fs = require('fs');
var credentials = JSON.parse(fs.readFileSync('database.json'));

module.exports = function(logger,
  title,
  url,
  description,
  author,
  authorUrl,
  version,
  thumbnail,
  banner,
  changeLog,
  update = false) {

  var postDataNew = ({
    embeds: [
      {
        title: title,
        url: url,
        description: description,
        fields: [
          {
            name: 'Author',
            value: '[' + author + ']' + '(' + authorUrl + ')',
            inline: true,
          },
          {
            name: 'Version',
            value: version,
            inline: true,
          },
          {
            name: 'Change log',
            value: changeLog,
          },
        ],
        thumbnail: {
          url: thumbnail,
        },
        image: {
          url: banner,
        },
      },
    ],
  });

  var postDataUpdate = ({
    embeds: [
      {
        title: title,
        url: url,
        description: description,
        fields: [
          {
            name: 'Author',
            value: '[' + author + ']' + '(' + authorUrl + ')',
            inline: true,
          },
          {
            name: 'Version',
            value: version,
            inline: true,
          },
          {
            name: 'Change log',
            value: changeLog,
          },
        ],
        thumbnail: {
          url: thumbnail,
        },
      },
    ],
  });

  credentials.discord.webhooks.forEach((webhook) => {
    axios.post(webhook, update ? postDataUpdate : postDataNew)
      .then((res) => {
        logger.info('Discord request status code:', res.statusCode);
      })
      .catch((error) => {
        logger.error('Discord notification error:', error);
      });
  });

};
