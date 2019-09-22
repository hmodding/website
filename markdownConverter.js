'use strict';
var showdown = require('showdown');
var markdownConverter = new showdown.Converter({extensions: [
  require('showdown-htmlescape'),
  require('showdown-xss-filter'),
]});

module.exports = function(markdownInput) {
  return markdownConverter.makeHtml(markdownInput);
};
