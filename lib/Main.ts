///<reference path='fileUtils.ts'/>
///<reference path='../typings/commander.d.ts'/>

function main() {
    var commander: Commander = require("commander");

    commander
        .version("0.0.1")
        .option("-f, --fromDir <dir path>", "Source directory to sync")
        .option("-t, --toDir <dir path>", "Destination directory to sync")
        .option("-p, --previousManifest <manifest file path>", "Previous manifest file path")
        .option("-n, --nextManifest [manifest file path]", "Next manifest file path")
        .option("-q, --quiet", "No logging")
        .option("-w, --whatIf", "Only log without actual copy/remove of files")
        .parse(process.argv);

    var commanderValues: any = commander;
    var fromDir = commanderValues.fromDir;
    var toDir = commanderValues.toDir;
    var previousManifest = commanderValues.previousManifest;
    var nextManifest = commanderValues.nextManifest;
    var quiet = commanderValues.quiet;
    var whatIf = commanderValues.whatIf;

    if (quiet) {
        // Change log to be no op
        log = () => { };
    }

    if (!fromDir || !toDir || !nextManifest) {
        console.log("Error: Missing required argument");
        commander.help();

        // Exit with an error code
        process.exit(1);

        return;
    }

    kuduSync(
        fromDir,
        toDir,
        nextManifest,
        previousManifest,
        whatIf,
        (err) => {
            if (err) {
                // Errors should always be logged
                console.log("" + err);

                // Exit with an error code
                process.exit(1);
            }
        });
}

exports.main = main;
