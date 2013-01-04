///<reference path='fileUtils.ts'/>
///<reference path='../typings/commander.d.ts'/>

function main() {
    var commander: Commander = require("commander");

    commander
        .version("0.0.1")
        .usage("[options]")
        .option("-f, --fromDir <dir path>", "Source directory to sync")
        .option("-t, --toDir <dir path>", "Destination directory to sync")
        .option("-n, --nextManifest <manifest file path>", "Next manifest file path")
        .option("-p, --previousManifest [manifest file path]", "Previous manifest file path")
        .option("-i, --ignore [patterns]", "List of files/directories to ignore and not sync, delimited by ;")
        .option("-q, --quiet", "No logging")
        .option("-v, --verbose [maxLines]", "Verbose logging with maximum number of output lines")
        .option("-w, --whatIf", "Only log without actual copy/remove of files")
        .parse(process.argv);

    var commanderValues: any = commander;
    var fromDir = commanderValues.fromDir;
    var toDir = commanderValues.toDir;
    var previousManifest = commanderValues.previousManifest;
    var nextManifest = commanderValues.nextManifest;
    var ignore = commanderValues.ignore;
    var quiet = commanderValues.quiet;
    var verbose = commanderValues.verbose;
    var whatIf = commanderValues.whatIf;

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

    var counter = 0;
    if (verbose && verbose > 0) {
        log = (msg) => {
            if (counter < verbose) {
                console.log(msg);
            }
            else if (counter == verbose) {
                console.log("Omitting next output lines...");
            }
            counter++;
        };
    }

    kuduSync(
        fromDir,
        toDir,
        nextManifest,
        previousManifest,
        ignore,
        whatIf).then(
            () => {
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
