'use strict';
var showdown = require('showdown');
var xssFilter = require('showdown-xss-filter');
var markdownConverter = new showdown.Converter({extensions: [xssFilter]});

module.exports = function(markdownInput) {
  markdownConverter.makeHtml(
    markdownInput
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  );
};
