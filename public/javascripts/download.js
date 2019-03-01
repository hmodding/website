/* eslint-env browser*/
'use strict';
var shown = false;
var toggleButton = document.getElementById('versionstoggle');
var toggleVerb = toggleButton.getElementsByTagName('span')[0];
var table = document.getElementById('versions-table');
toggleButton.addEventListener('click', function() {
  shown = !shown;
  if (shown) {
    table.classList.remove('hide');
    toggleVerb.innerText = 'Hide';
  } else {
    table.classList.add('hide');
    toggleVerb.innerText = 'Show';
  }
});
