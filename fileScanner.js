'use strict';
module.exports = (logger, database) => {
  var fs = require('fs');
  var path = require('path');
  var databaseCredentials = JSON.parse(fs.readFileSync('database.json'));
  var VirusTotalApi = require('virustotal-api');
  var virusTotal = new VirusTotalApi(databaseCredentials.virusTotalKey);

  // request queue for VirusTotal
  // max 4 requests per minute --> works smoother with 1 per 15sec
  var virusTotalQueue = require('throttled-queue')(1, 15 * 1000);

  // ORM for file-scans table
  var FileScan = database.FileScan;

  // setTimeout as a promise - https://stackoverflow.com/q/39538473
  function delay(delayInMs, value) {
    return new Promise(resolve => {
      setTimeout(resolve.bind(null, value), delayInMs);
    });
  }

  /**
   * Ensures that a file scan entry exists for the given URL.
   * @param {*} fileUrl the URL of the file to scan.
   * @returns the file scan database instance.
   */
  function createEntryIfNotExists(fileUrl) {
    return FileScan.findOne({where: {fileUrl}})
      .then(scan => {
        if (!scan) {
          return FileScan.create({ fileUrl: fileUrl })
            .then(scan => {
              logger.debug('Created file scan db entry for ' +
                `file ${scan.fileUrl}`);
            })
            .catch(err => {
              logger.error('Error while creating file scan db entry: ', err);
            });
        } else {
          return scan;
        }
      });
  }

  /**
   * Enqueues a file scan for the buffered file.
   * @param buffer the buffer of the file to scan
   * @param fileName the original file name
   * @param fileUrl the url to the file
   */
  function scanFile(buffer, fileName, fileUrl) {
    createEntryIfNotExists(fileUrl)
      .then(fileScan => {
        // enqueue actual file scan
        virusTotalQueue(() => {
          logger.info(`Submitting file ${fileUrl} to VirusTotal...`);
          virusTotal.fileScan(buffer, fileName)
            .then(result => {
              var scanId = result.scan_id;
              logger.info(`Scan result of file ${fileName} (${fileUrl}) ` +
                      'using VirusTotal:', result);
              // save scan id to db
              fileScan.update({scanId})
                .catch(err => {
                  logger.error(`Could not save scan id (${scanId}) for file ` +
                              `${fileName} (${fileUrl}): `, err);
                });
              return delay(60 * 1000, scanId);
            }).then(resourceId => {
              enqueueReportCheck(resourceId, fileName, fileUrl);
            }).catch(err => {
              logger.error(`Scanning file ${fileName} (${fileUrl}) using ` +
                      'VirusTotal failed: ', err);
            });
        });
      })
      .catch(logger.error);
  }
  /**
   * Enqueues a check for the resource report.
   * @param scanId the resource id / sha256 hash of the scanned file.
   * @param fileName the original file name
   * @param fileUrl the url to the file
   */
  function enqueueReportCheck(scanId, fileName, fileUrl) {
    virusTotalQueue(() => {
      logger.info(`Checking VirusTotal file report for file ${fileUrl}...`);
      virusTotal.fileReport(scanId)
        .then(report => {
          if (report.response_code !== 1) {
            logger.info(`VirusTotal report for file ${fileUrl} is not yet ` +
                          ' ready, trying again in a minute...');
            return delay(60 * 1000, scanId).then(scanId => {
              enqueueReportCheck(scanId, fileName, fileUrl);
            });
          } else {
            delete report.scans;
            // save scan report to db
            FileScan.update({scanResult: report}, {where: {fileUrl: fileUrl}})
              .catch(err => {
                logger.error('Could not save scan report for file ' +
                                  `${fileName} (${fileUrl}): `, err);
              });
            if (report.positives > 0) {
              logger.info(`VirusTotal found a virus in ${fileName} ` +
                `(${fileUrl}):`, report);
            } else {
              logger.info(`VirusTotal didn't find any virus in ${fileName} ` +
                              `(${fileUrl}).`);
            }
          }
        }).catch(err => {
          logger.error(`Scanning file ${fileName} (${fileUrl}) using ` +
                      'VirusTotal failed:', err);
        });
    });
  }

  FileScan.findAll()
    .then(fileScans => {
      var numRescans = 0;
      for (var i = 0; i < fileScans.length; i++) {
        if (!fileScans[i].scanId) {
          var fileName = fileScans[i].fileUrl
            .substr(fileScans[i].fileUrl.lastIndexOf('/') + 1);
          if (fileScans[i].fileUrl.startsWith('/')) {
            scanFile(fs.readFileSync(path.join('public', fileScans[i].fileUrl)),
              fileName, fileScans[i].fileUrl);
          } else {
            logger.error('There is an unresolved file scan entry for ' +
              fileScans[i].fileUrl + ' in the file scans table, but external ' +
                'files can\'t be scanned!');
          }
          // start file scan
          numRescans++;
        } else if (!fileScans[i].scanResult) {
          enqueueReportCheck(fileScans[i].scanId, fileName,
            fileScans[i].fileUrl);
          numRescans++;
        }
      }
      if (numRescans > 0) {
        logger.info(`Resuming ${numRescans} file scans...`);
      }
    }).catch(err => {
      logger.error('Error while resuming unfinished file scans:', err);
    });

  return {
    FileScan: FileScan,
    scanFile: scanFile,
    enqueueReportCheck: enqueueReportCheck,
  };
};
