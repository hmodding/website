'use strict';
module.exports = (logger) => {
  var fs = require('fs');
  var credentials = JSON.parse(fs.readFileSync('database.json')).smtpMail;

  var transport = require('nodemailer').createTransport({
    host: credentials.host,
    port: credentials.port,
    secure: credentials.secure,
    auth: {
      user: credentials.user,
      pass: credentials.password,
    },
  });

  return {
    transport: transport,
    send: (to, subject, text) => {
      transport.sendMail({
        from: credentials.user,
        to: to,
        subject: subject,
        text: text,
      }, (err, info) => {
        if (err) {
          logger.error('Error in sending mail: ', err);
        } else {
          logger.info(`Successfully sent mail to ${to}:`, info);
        }
      });
    },
  };
};
