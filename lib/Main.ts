///<reference path='fileUtils.ts'/>

if (process.argv.length != 5) {
    console.log("Usage: node smartCopy.js [from directory path] [to directory path] [manifest file path]");
}
else {
    var from = process.argv[2];
    var to = process.argv[3];
    var manifestPath = process.argv[4];

    smartCopy(
        from,
        to,
        manifestPath);
}
