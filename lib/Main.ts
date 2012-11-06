///<reference path='fileUtils.ts'/>

try {
    if (process.argv.length < 5) {
        console.log("Usage: kuduSync [from directory path] [to directory path] [next manifest file path] [previous manifest file path (optional)]");
    }
    else {
        var from = process.argv[2];
        var to = process.argv[3];
        var nextManifestPath = process.argv[4];
        var previousManifestPath = null;

        if (process.argv.length > 5) {
            var previousManifestPath = process.argv[5];
        }

        kuduSync(
            from,
            to,
            nextManifestPath,
            previousManifestPath);
    }
}
catch (e) {
    log("Error: " + e);
}
