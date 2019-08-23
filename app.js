'use strict';
var logger = require('./logger');
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var lessMiddleware = require('less-middleware');
var morgan = require('morgan');
var session = require('express-session');
var querystring = require('querystring');
var fs = require('fs');
var credentials = JSON.parse(fs.readFileSync('database.json'));

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(morgan('dev', {stream: {write: (msg) => logger.debug(msg.trim())}}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(lessMiddleware(path.join(__dirname, 'public')));

var database = require('./database')(logger);
/* initialize express-session to allow tracing the logged-in user across
 * sessions.
 */
var SequelizeStore = require('connect-session-sequelize')(session.Store);
app.use(session({
  store: new SequelizeStore({
    db: database.sequelize,
  }),
  key: 'user_sid',
  secret: 'somerandomstuff',
  resave: false,
  saveUninitialized: false,
  cookie: {
    expires: 30 * 24 * 60 * 60 * 1000,
  },
}));

// clear cookie if the server does not have a corresponding session
app.use((req, res, next) => {
  if (req.cookies.user_sid && !req.session.user) {
    res.clearCookie('user_sid');
  }
  next();
});
app.use((req, res, next) => {
  res.locals.baseUrl = credentials.baseUrl;
  res.locals.currentUrl = req.originalUrl;
  res.locals.currentUrlQuery = querystring.stringify({
    redirect: req.originalUrl,
  });
  res.locals.googleAnalyticsId = credentials.googleAnalyticsId;
  res.locals.enableBundlesSection = credentials.enableBundlesSection;
  res.locals.enablePluginsSection = credentials.enablePluginsSection;
  res.locals.newBranding = credentials.newBranding;
  next();
});

// lock page with http authentication if enabled
if (credentials.httpAuthentication && credentials.httpAuthentication.enabled) {
  var basicAuth = require('express-basic-auth');
  app.use(basicAuth({
    users: credentials.httpAuthentication.users,
    challenge: true,
    unauthorizedResponse: req => 'Sorry, this site is only available for ' +
      'authorized people!',
  }));
}

// create all defined tables in the actual database
database.sequelize.sync()
  .then(() => {
    logger.info('Database tables have successfully been created if they ' +
        'didn\'t already exist.');
    var fileScanner = require('./fileScanner')(logger, database);
    var mail = require('./mailTransport')(logger);
    var modDeleter = require('./modDeleter')(logger, database, credentials);
    var pluginDeleter = {};

    app.use('/', require('./routes/accounts')(logger, database, mail));
    app.use('/', require('./routes/index')(database));
    app.use('/mods', require('./routes/mods')(logger, database, fileScanner,
      modDeleter));
    if (credentials.enableBundlesSection)
      app.use('/bundle',
        require('./routes/bundles')(logger, database, fileScanner));
    app.use('/server', require('./routes/server')(logger, database,
      fileScanner));
    app.use('/plugins', require('./routes/plugins')(logger, database,
      fileScanner, pluginDeleter));
    app.use('/', require('./routes/loader')(logger, database, fileScanner));
    app.use('/api/v1', require('./routes/api')(logger, database));

    app.use(express.static(path.join(__dirname, 'public')));

    // serve framework and library assets
    app.use('/assets/fontawesome', express.static(path.join(__dirname,
      'node_modules', '@fortawesome', 'fontawesome-free')));
    app.use('/assets/bootstrap', express.static(path.join(__dirname,
      'node_modules', 'bootstrap', 'dist')));
    app.use('/assets/cookieconsent', express.static(path.join(__dirname,
      'node_modules', 'cookieconsent', 'src')));
    app.use('/assets/jquery', express.static(path.join(__dirname,
      'node_modules', 'jquery', 'dist')));

    // if no route mached, throw 404
    app.use(function(req, res, next) {
      next(createError(404));
    });

    // error handler
    app.use(function(err, req, res, next) {
      // render the error page
      res.status(err.status || 500);
      res.render('error', {
        title: res.statusCode,
        message: err.message,
        error: req.app.get('env') === 'development' ? err : {},
      });

      if (err.status !== 404) {
        // prints the error
        logger.error('Error in express request: ', err);
        if (process.env.NODE_ENV !== 'production') {
          console.log(err);
        }
      }
    });
  })
  .catch(error => {
    logger.error('Error while syncing database with ORM:', error);
  });

module.exports = app;
