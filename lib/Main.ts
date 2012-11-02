///<reference path='fileUtils.ts'/>

if (process.argv.length != 6) {
    console.log("Usage: smartCopy [from directory path] [to directory path] [previous manifest file path] [current manifest file path]");
}
else {
    var from = process.argv[2];
    var to = process.argv[3];
    var previousManifestPath = process.argv[4];
    var currentManifestPath = process.argv[5];

    smartCopy(
        from,
        to,
        previousManifestPath,
        currentManifestPath);
}
