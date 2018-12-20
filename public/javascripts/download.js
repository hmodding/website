var shown = false;
var toggleButton = document.getElementById('versionstoggle'),
    toggleVerb = toggleButton.getElementsByTagName('span')[0],
    table = document.getElementById('versions-table');
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