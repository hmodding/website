#!/usr/bin/env node
'use strict';

const app = require('../app');
const debug = require('debug')('raft-modding-website:server');
const http = require('http');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('database.json'));

// normalize and set port
var port = normalizePort(process.env.PORT ||
  JSON.parse(require('fs').readFileSync('database.json')).httpPort || '3000');
app.set('port', port);

// create http server
var server = http.createServer(app);

// create https server
if (config.https && config.https.enabled) {
  const https = require('https');
  var key = fs.readFileSync(config.https.privateKeyPath);
  var cert = fs.readFileSync(config.https.certificatePath);
  var credentials = {key, cert};
  const httpsServer = https.createServer(credentials, app);
  httpsServer.listen(config.https.port);
  httpsServer.on('error', onError);
  httpsServer.on('listening', onListening);
}

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
