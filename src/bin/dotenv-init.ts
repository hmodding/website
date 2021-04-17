import fs = require('fs');
import path = require('path');
import colors = require('colors');

const file = path.resolve(__dirname, '../../.env');

function run (): void {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, 'PSQL_SERVICE_NAME="<EXAMPLE: postgresql-x64-13>"', 'utf8');
    console.log(colors.green.bold('.env file has been initialised.'), '\n', 'Check your project files');
  } else {
    console.warn(colors.yellow.bold('.env file already exists!'));
  }
}

run();
