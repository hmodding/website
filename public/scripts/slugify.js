/* eslint-disable */

function generateSlug() {
    var slugGeneratorField = document.getElementById('slug');
    var titleGeneratorField = document.getElementById('title');

    if ((titleGeneratorField.value).length <= 64) {
        slugGeneratorField.value = slugify(titleGeneratorField.value);
    }
}

// credits: https://gist.githubusercontent.com/hagemann/382adfc57adbd5af078dc93feef01fe1/raw/1072598b9e13e34ac431081541aafe7301193e74/slugify.js
function slugify(string) {
    const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
    const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
    const p = new RegExp(a.split('').join('|'), 'g')

    return string.toString().toLowerCase()
        .replace(/\s+/g, '-') // Replace spaces with -
        .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
        .replace(/&/g, '-and-') // Replace & with 'and'
        .replace(/[^\w\-]+/g, '') // Remove all non-word characters
        .replace(/\-\-+/g, '-') // Replace multiple - with single -
        .replace(/^-+/, '') // Trim - from start of text
        .replace(/-+$/, '') // Trim - from end of text
}