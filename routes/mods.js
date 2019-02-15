var express = require('express');
var router = express.Router();
var fs = require('fs');
var showdown = require('showdown');
var xssFilter = require('showdown-xss-filter');
var markdownConverter = new showdown.Converter({extensions: [xssFilter]});
var querystring = require('querystring');
var multer = require('multer');
var upload = multer({storage: multer.memoryStorage()});
var path = require('path');
var Mod = require('../models/mod');
var FileScan = require('../models/fileScan');
var virusTotal = new (require('virustotal-api'))(JSON.parse(fs.readFileSync('database.json')).virusTotalKey);
var virusTotalQueue = require('throttled-queue')(1, 15 * 1000); // max 4 requests per minute --> works smoother with 1 per 15sec

// account
var requireLogin = function(req, res, next) {
    if (req.session.user && req.cookies.user_sid) {
        next();
    } else {
        res.redirect('/signin?' + querystring.stringify({redirect: req.originalUrl}));
    }
};

/** setTimeout as a promise - https://stackoverflow.com/questions/39538473/using-settimeout-on-promise-chain **/
function delay(delayInMs, value) {
    return new Promise(resolve => {
        setTimeout(resolve.bind(null, value), delayInMs);
    });
}

/* GET mods listing */
router.get('/', function(req, res, next) {
    Mod.findAll().then(mods => {
        res.render('mods', {title: 'Mods', mods: mods});
    }).catch(err => {
        res.error('An error occurred.');
        console.error('An error occurred while querying the database for mods:');
        console.error(err);
    });
});
router.route('/add')
    .get(requireLogin, (req, res) => {
        res.render('addmod', {title: 'Add a mod'});
    })
    .post(requireLogin, upload.single('file'), (req, res) => {
        var mod = {
            id: req.body.id,
            title: req.body.title,
            description: req.body.description,
            category: req.body.category,
            version: req.body.version,
            readme: req.body.readme,
            author: req.session.user,
            downloadUrl: req.body.downloadUrl || req.file
        };
        if (!mod.id || mod.id === ''
                || !mod.title
                || !mod.description
                || !mod.category
                || !mod.version
                || !mod.readme
                || !mod.author
                || !mod.downloadUrl) {
            res.render('addmod', {
                title: 'Add a mod',
                error: 'All fields of this form need to be filled to submit a mod.',
                formContents: req.body
            });
        } else if (!/^[a-zA-Z1-9]+$/.test(mod.id)) {
            res.render('addmod', {
                title: 'Add a mod',
                error: 'The ID can only contain letters and numbers!',
                formContents: req.body
            });
        } else if (mod.id.length > 64) {
            res.render('addmod', {
                title: 'Add a mod',
                error: 'The ID can not be longer than 64 characters!',
                formContents: req.body
            });
        } else if (mod.title.length > 255) {
            res.render('addmod', {
                title: 'Add a mod',
                error: 'The title can not be longer than 255 characters!',
                formContents: req.body
            });
        } else if (mod.description.length > 255) {
            res.render('addmod', {
                title: 'Add a mod',
                error: 'The description can not be longer than 255 characters! ' +
                    'Please use the readme section for longer explanations.',
                formContents: req.body
            });
        } else if (mod.version.length > 64) {
            res.render('addmod', {
                title: 'Add a mod',
                error: 'The version can not be longer than 255 characters!',
                formContents: req.body
            });
        } else {
            mod.id = mod.id.toLowerCase();
            mod.author = mod.author.username;
            if (req.file) {
                // save file
                mod.downloadUrl = '/mods/' + mod.id + '/' + mod.version + '/' + req.file.originalname;
                var dir = path.join('.', 'public', 'mods', mod.id, mod.version);
                fs.mkdirSync(dir, {recursive: true});
                fs.writeFileSync(path.join(dir, req.file.originalname), req.file.buffer);
                console.log(`File ${req.file.filename} (${mod.downloadUrl}) was saved to disk at ${path.resolve(dir)}.`);

                // start scan for viruses
                scanFile(req.file.buffer, req.file.originalname, mod.downloadUrl);
            }
            Mod.create(mod)
                .then(mod => {
                    res.redirect('/mods/' + mod.id);
                }).catch(err => {
                    if (err.name === 'SequelizeUniqueConstraintError') {
                        res.render('addmod', {
                            title: 'Add a mod',
                            error: 'Sorry, but this ID is already taken. Please choose another one!',
                            formContents: req.body
                        });
                    } else {
                        res.render('addmod', {
                            title: 'Add a mod',
                            error: 'An error occurred.',
                            formContents: req.body
                        });
                        console.error('An error occurred while querying the database for mods:');
                        console.error(err);
                    }
                });

        }
    });

/**
 * Enqueues a file scan for the buffered file.
 * @param buffer the buffer of the file to scan
 * @param fileName the original file name
 * @param fileUrl the url to the file
 */
function scanFile(buffer, fileName, fileUrl) {
    FileScan.create({fileUrl: fileUrl})
        .then(scan => console.log('Saved scan: ' + scan))
        .catch(err => console.error('Error while creating file scan db entry: ', err));

    // enqueue actual file scan
    virusTotalQueue(() => {
        console.log(`Submitting file ${fileUrl} to VirusTotal...`);
        virusTotal.fileScan(buffer, fileName)
            .then(result => {
                var scanId = result.scan_id;
                console.log(`Scan result of file ${fileName} (${fileUrl}) using VirusTotal:`, result);
                FileScan.update({scanId: scanId}, {where: {fileUrl: fileUrl}}) // save scan id to db
                    .catch(err => {
                        console.error(`Could not save scan id (${scanId}) for file ${fileName} (${fileUrl}): `, err)
                    });
                return delay(60 * 1000, scanId);
            }).then(resourceId => {
                enqueueReportCheck(resourceId, fileName, fileUrl);
            }).catch(err => {
                console.error(`Scanning file ${fileName} (${fileUrl}) using VirusTotal failed:`, err);
            });
    });
}

/**
 * Enqueues a check for the resource report.
 * @param scanId the resource id / sha256 hash of the scanned file.
 * @param fileName the original file name
 * @param fileUrl the url to the file
 */
function enqueueReportCheck(scanId, fileName, fileUrl) {
    virusTotalQueue(() => {
        console.log(`Checking VirusTotal file report for file ${fileUrl}...`);
        virusTotal.fileReport(scanId)
            .then(report => {
                if (report.response_code !== 1) {
                    console.log(`VirusTotal report for file ${fileUrl} is not yet ready, trying again in a minute...`);
                    return delay(60 * 1000, scanId).then(scanId => {
                        enqueueReportCheck(scanId, fileName, fileUrl);
                    });
                } else {
                    delete report.scans;
                    FileScan.update({scanResult: report}, {where: {fileUrl: fileUrl}}) // save scan report to db
                        .catch(err => {
                            console.error(`Could not save scan report for file ${fileName} (${fileUrl}): `, err)
                        });
                    if (report.positives > 0) {
                        console.log(`VirusTotal found a virus in ${fileName} (${fileUrl}):`, report);
                    } else {
                        console.log(`VirusTotal didn't find any virus in ${fileName} (${fileUrl}).`);
                    }
                }
            }).catch(err => {
                console.error(`Scanning file ${fileName} (${fileUrl}) using VirusTotal failed:`, err);
        });
    });
}
router.get('/:id', function (req, res, next) {
    Mod.findOne({where: {id: req.params.id}}).then(mod => {
        // render markdown readme
        mod.readmeMarkdown = markdownConverter.makeHtml(mod.readme.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        res.render('mod', {title: mod.title, mod: mod});
    }).catch(err => {
        res.render('error', {error: {status: 404}});
        console.error('An error occurred while querying the database for a mod:');
        console.error(err);
    });
});
router.get('/:id/:version/:file', function (req, res, next) {
    if (req.query.ignoreVirusScan) {
        next();
    } else {
        var downloadDisclaimer = `Click <a href="${req.originalUrl + '?ignoreVirusScan=true'}">here</a> if you want to `
            + 'download it now anyways. We take no responsibility on what this file could do to your computer.';
        FileScan.findOne({where: {fileUrl: req.originalUrl}}).then(fileScan => {
            if (!fileScan.scanResult) {
                res.status(300);
                res.send('<b>This file has not yet been scanned, but a scan is in progress.</b> ' + downloadDisclaimer);
            } else if(fileScan.scanResult.positives !== 0) {
                res.status(300);
                res.send('<b>VirusTotal has detected a virus in this file.</b> ' + downloadDisclaimer);
            } else {
                next(); // file will be returned by static files handler
            }
        }).catch(err => {
            res.status(300);
            res.send('<b>A virus scan for this file could not be found.</b> ' + downloadDisclaimer);
        });
    }
});

module.exports = router;
