import { createModuleLogger } from './logger';
import { createTransport } from 'nodemailer';
import { getSmtpMailConfiguration } from './config/json-configuration';
import { captureException } from '@sentry/node';

const logger = createModuleLogger('mail');

const smtpConfig = getSmtpMailConfiguration();

const transport = createTransport({
  host: smtpConfig.host,
  port: smtpConfig.port,
  secure: smtpConfig.secure,
  auth: {
    user: smtpConfig.user,
    pass: smtpConfig.password
  }
});

/**
 * Sends an e-mail.
 * @param to the mail address to send the e-mail to.
 * @param subject the subject line of the e-mail.
 * @param text the content of the e-mail
 */
export function send (to: string, subject: string, text: string): void {
  transport.sendMail({
    from: smtpConfig.user,
    to,
    subject,
    text
  }, (err, info) => {
    if (err !== null) {
      logger.error('Error in sending mail', err);
      captureException(err);
    } else {
      // info contains metadata of the e-mail according to nodemailer docs
      logger.debug(`Successfully sent mail to ${to}`, info);
    }
  });
}
