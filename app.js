'use strict';
var logger = require('./logger');
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var lessMiddleware = require('less-middleware');
var morgan = require('morgan');
var session = require('express-session');

var database = require('./database')(logger);

var fileScanner = require('./fileScanner')(logger, database);
var accountRouter = require('./routes/accounts')(logger, database);
var indexRouter = require('./routes/index')(database);
var modsRouter = require('./routes/mods')(logger, database, fileScanner);
var loaderRouter = require('./routes/loader')(logger, database, fileScanner);
var apiRouter = require('./routes/api')(logger, database);

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(morgan('dev', {stream: {write: (msg) => logger.debug(msg.trim())}}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(lessMiddleware(path.join(__dirname, 'public')));
/* initialize express-session to allow tracing the logged-in user across
 * sessions.
 */
app.use(session({
  key: 'user_sid',
  secret: 'somerandomstuff',
  resave: false,
  saveUninitialized: false,
  cookie: {
    expires: 600000,
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
  res.locals.currentUrl = req.originalUrl;
  next();
});
app.use('/', accountRouter);
app.use('/', indexRouter);
app.use('/mods', modsRouter);
app.use('/', loaderRouter); // needs root ('/') access to handle /download
app.use('/api/v1', apiRouter);

app.use(express.static(path.join(__dirname, 'public')));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error', {title: res.statusCode});

  if (err.status !== 404) {
    // prints the error
    logger.error(err);
  }
});

module.exports = app;
