///<reference path='fileUtils.ts'/>
///<reference path='../typings/commander.d.ts'/>

var commander: Commander = require("commander");

commander
    .version("0.0.1")
    .option("-f, --fromDir [dir path]", "Source directory to sync (* required)")
    .option("-t, --toDir [dir path]", "Destination directory to sync (* required)")
    .option("-p, --previousManifest [manifest file path]", "Previous manifest file path (* required)")
    .option("-n, --nextManifest [manifest file path]", "Next manifest file path (optional)")
    .option("-q, --quiet", "No logging")
    .option("-w, --whatIf", "Only log without actual copy/remove of files")
    .parse(process.argv);

try {
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

    kuduSync(
        fromDir,
        toDir,
        nextManifest,
        previousManifest,
        whatIf);
}
catch (e) {
    // Errors should always be logged
    console.log("" + e);

    // Exit with an error code
    process.exit(1);
}
