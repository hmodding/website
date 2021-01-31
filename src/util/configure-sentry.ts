import { init } from '@sentry/node';
import { SentryConfiguration } from '../config/Configuration';
import { createModuleLogger } from '../logger';

const logger = createModuleLogger('sentry');

/**
 * Configures Sentry with the given configuration.
 * @param config the configuration to use.
 */
export function configureSentry(config: SentryConfiguration): void {
  if (config.enabled) {
    init({
      dsn: config.dsn,
      tracesSampleRate: 1.0 // default value from Sentry docs
    });
    logger.info('Sentry initialized!');
  } else {
    logger.warn('Sentry is disabled!');
  }
}
