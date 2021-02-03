import { transports, format, configure, child, Logger } from 'winston';

/**
 * Creates a logger for a module with a given name.
 * @param module the name of the module this logger is for.
 * @returns the created logger
 */
export function createModuleLogger (module: string): Logger {
  return child({
    module
  });
}

/**
 * The length that module names will be padded / cut to.
 */
const paddedModuleLength = 16;

/**
 * Pads / cuts a module name to the `paddedModuleLength`.
 * @param module the module name to pad.
 * @remarks It is recommended to store the padded module name somewhere.
 */
function padModule (module: string): string {
  if (module.length >= paddedModuleLength) {
    return module.substr(0, paddedModuleLength);
  } else {
    return module + ' '.repeat(paddedModuleLength - module.length);
  }
}

/**
 * Configures the default logger that is available through the winston module
 * itself.
 */
export function configureDefaultLogger (): void {
  const nodeEnv = process.env.NODE_ENV;
  // in production, log only info and below
  const defaultLevel = nodeEnv !== 'production' ? 'debug' : 'info';
  const environment = nodeEnv !== 'production' ? 'development' : 'production';

  const modulePaddingMap = new Map<string, string>();

  configure({
    level: defaultLevel,
    format: format.combine(
      format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      format.errors({ stack: true }),
      format.splat(),
      format.json(),
      format.align()
    ),
    defaultMeta: {
      service: 'modding-website',
      environment
    },
    transports: [
      new transports.File({ filename: 'error.log', level: 'error' }),
      new transports.File({ filename: 'combined.log' }),
      new transports.Console({
        format: format.combine(
          format.colorize(),
          format.printf((info) => {
            let module = modulePaddingMap.get(info.module);
            if (module === undefined) {
              module = padModule(info.module);
              modulePaddingMap.set(info.module, module);
            }

            // we know that the timestamp string property was inserted in the
            // format.timestamp operation
            const timestamp = info.timestamp as string;

            let string = `${timestamp} [${module}] ${info.level}: ` +
              (info.message === undefined ? '' : info.message.trim());
            if (typeof info.stack === 'string') {
              string += `\n${info.stack}`;
            }
            return string;
          })
        )
      })
    ]
  });
}
