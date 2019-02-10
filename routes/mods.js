var express = require('express');
var router = express.Router();
var fs = require('fs');
var showdown = require('showdown');
var xssFilter = require('showdown-xss-filter');
var markdownConverter = new showdown.Converter({extensions: [xssFilter]});
var mods = JSON.parse(fs.readFileSync('mods.json'));

function getModById(id) {
  for (var i = 0; i < mods.length; i++) {
    if (mods[i].id.toLowerCase() === id.toLowerCase())
      return mods[i];
  }
  return null;
}

/* GET mods listing */
router.get('/', function(req, res, next) {
  res.render('mods', {title: 'Mods', mods: mods});
});
router.get('/:id', function (req, res, next) {
  var mod = getModById(req.params.id);
  if (mod === null)
    res.render('error', {error: {status: 404}});
  else {
    // render markdown readme
    mod.readmeMarkdown = markdownConverter.makeHtml(mod.readme.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
    res.render('mod', {title: mod.title, mod: mod});
  }
});

module.exports = router;
