///<reference path='FileUtils.ts'/>
///<reference path='../typings/commander.d.ts'/>

function main() {
    var commander: Commander = require("commander");
    var package = require("../package.json");
    var path = require("path");

    commander
        .version(package.version)
        .usage("[options]")
        .option("-f, --fromDir <dir path>", "Source directory to sync")
        .option("-t, --toDir <dir path>", "Destination directory to sync")
        .option("-s, --targetSubFolder <dir path>", "A relative sub folder in the destination to create and copy files to")
        .option("-n, --nextManifest <manifest file path>", "Next manifest file path")
        .option("-p, --previousManifest [manifest file path]", "Previous manifest file path")
        .option("-x, --ignoreManifest", "Disables the processing of the manifest file")
        .option("-i, --ignore [patterns]", "List of files/directories to ignore and not sync, delimited by ;")
        .option("-q, --quiet", "No logging")
        .option("-v, --verbose [maxLines]", "Verbose logging with maximum number of output lines")
        .option("-w, --whatIf", "Only log without actual copy/remove of files")
        .option("--perf", "Print out the time it took to complete KuduSync operation")
        .parse(process.argv);

    var commanderValues: any = commander;
    var fromDir = commanderValues.fromDir;
    var toDir = commanderValues.toDir;
    var targetSubFolder = commanderValues.targetSubFolder;
    var previousManifest = commanderValues.previousManifest;
    var nextManifest = commanderValues.nextManifest;
    var ignoreManifest = commanderValues.ignoreManifest;
    var ignore = commanderValues.ignore;
    var quiet = commanderValues.quiet;
    var verbose = commanderValues.verbose;
    var whatIf = commanderValues.whatIf;
    var perf = commanderValues.perf;

    if (quiet && verbose) {
        console.log("Error: Cannot use --quiet and --verbose arguments together");

        // Exit with an error code
        process.exit(1);

        return;
    }

    if (!fromDir || !toDir || !nextManifest) {
        console.log("Error: Missing required argument");
        commander.help();

        // Exit with an error code
        process.exit(1);

        return;
    }

    if (quiet) {
        // Change log to be no op
        log = () => { };
    }

    if (targetSubFolder) {
        toDir = path.join(toDir, targetSubFolder);
    }

    var counter = 0;
    var nextLogTime: Date = null;
    if (verbose && verbose > 0) {
        log = (msg) => {
            var updateLogTime: bool = false;

            if (counter < verbose) {
                console.log(msg);
            }
            else if (counter == verbose) {
                console.log("Omitting next output lines...");
                updateLogTime = true;
            }
            else {
                if (new Date().getTime() >= nextLogTime.getTime()) {
                    console.log("Processed " + (counter - 1) + " files...");
                    updateLogTime = true;
                }
            }

            if (updateLogTime) {
                var currentDate = new Date();
                nextLogTime = new Date(currentDate.getTime() + 20000);
            }

            counter++;
        };
    }

    var start = new Date();
    kuduSync(
        fromDir,
        toDir,
        targetSubFolder,
        nextManifest,
        previousManifest,
        ignoreManifest,
        ignore,
        whatIf).then(
            () => {
                if (perf) {
                    var stop = new Date();
                    console.log("Operation took " + ((stop.getTime() - start.getTime()) / 1000) + " seconds");
                }
                process.exit(0);
            },
            function (err?) {
                if (err) {
                    // Errors should always be logged
                    console.log("" + err);
                }

                // Exit with an error code
                process.exit(1);
            });
}

exports.main = main;

