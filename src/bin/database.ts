import dotenv = require('dotenv');
import cp = require('child_process');
import colors = require('colors');

dotenv.config();

const psqlServiceName = process.env.PSQL_SERVICE_NAME ?? '';

function envVarExists (): boolean {
  if (psqlServiceName !== null && psqlServiceName !== undefined && psqlServiceName !== '') {
    return true;
  } else {
    console.log(colors.red.bold('Could not find env "PSQL_SERVICE_NAME!"'), '\n', 'Please check your .env file.', '\n', 'If you do not have one run "npm run dotenv:init"');
  }
  return false;
}

function pgCtl (operation: string): string {
  if (envVarExists()) {
    console.log(colors.green.bold(`database ${operation} ...\n`));

    try {
      cp.execSync(`net ${operation} ${psqlServiceName}`);
      console.log(colors.green.bold.underline(`database ${operation} success!`));
    } catch (err) {
      console.log(colors.red('An error occured (see above)\n'), 'Make sure you are running with admin priviliges');
    }
  }
  return '';
}

module.exports = {
  start: () => pgCtl('start'),
  stop: () => pgCtl('stop')
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('make-runnable/custom')({
  printOutputFrame: false
});
