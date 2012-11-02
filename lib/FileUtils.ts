///<reference path='directoryInfo.ts'/>
///<reference path='manifest.ts'/>

function smartCopy(fromPath: string, toPath: string, previousManifestPath: string, currentManifestPath: string) {
    Ensure.argNotNull(fromPath, "fromPath");
    Ensure.argNotNull(toPath, "toPath");
    Ensure.argNotNull(previousManifestPath, "manifestPath");

    var from = new DirectoryInfo(fromPath);
    var to = new DirectoryInfo(toPath);

    var currentManifest = new Manifest();

    smartCopyDirectory(from, to, from.path(), to.path(), Manifest.load(previousManifestPath), currentManifest);

    Manifest.save(currentManifest, currentManifestPath);
}

function simpleCopy(fromFile: FileInfo, toFilePath: string) {
    Ensure.argNotNull(fromFile, "fromFile");
    Ensure.argNotNull(toFilePath, "toFilePath");

    log("Copy file from: " + fromFile.path() + " to: " + toFilePath);
    fs.createReadStream(fromFile.path()).pipe(fs.createWriteStream(toFilePath));
}

function deleteFile(file: FileInfo) {
    Ensure.argNotNull(file, "file");

    var path = file.path();
    log("Deleting file: " + path);
    fs.unlinkSync(path);
}

function deleteDirectoryRecursive(directory: DirectoryInfo) {
    Ensure.argNotNull(directory, "directory");

    var path = directory.path();
    log("Deleting directory: " + path);

    var files = directory.files();
    for (var fileKey in files) {
        var file = files[fileKey];
        deleteFile(file);
    }

    var subDirectories = directory.subDirectories();
    for (var subDirectoryKey in subDirectories) {
        var subDirectory = subDirectories[subDirectoryKey];
        deleteDirectoryRecursive(subDirectory);
    }

    fs.rmdirSync(path);
}

function smartCopyDirectory(from: DirectoryInfo, to: DirectoryInfo, fromRootPath: string, toRootPath: string, manifest: Manifest, outManifest: Manifest) {
    Ensure.argNotNull(from, "from");
    Ensure.argNotNull(to, "to");
    Ensure.argNotNull(fromRootPath, "fromRootPath");
    Ensure.argNotNull(toRootPath, "toRootPath");
    Ensure.argNotNull(manifest, "manifest");
    Ensure.argNotNull(outManifest, "outManifest");

    // TODO: Generalize files to ignore
    if (from.isSourceControl()) {
        // No need to copy the source control directory (.git).
        return;
    }

    log("Copy directory from: " + from.path() + " to: " + to.path());

    to.ensureCreated();

    var fromFiles = from.files();
    var toFiles = to.files();

    // If the file doesn't exist in the source, only delete if:
    // 1. We have no previous directory
    // 2. We have a previous directory and the file exists there
    for (var toFileKey in toFiles) {
        var toFile: FileInfo = toFiles[toFileKey];
        var toFilePath = toFile.path();

        if (!fromFiles[toFilePath]) {
            if (manifest.isEmpty() || manifest.isPathInManifest(toFilePath, toRootPath)) {
                deleteFile(toFile);
            }
        }
    }

    // Copy files
    for (var fromFileKey in fromFiles) {
        var fromFile: FileInfo = fromFiles[fromFileKey];
        outManifest.addFileToManifest(fromFile.path(), fromRootPath);

        // Skip deployment files

        // if the file exists in the destination then only copy it again if it's
        // last write time is different than the same file in the source (only if it changed)
        var toFile = toFiles[fromFile.name()];

        if (toFile == null || fromFile.modifiedTime() > toFile.modifiedTime()) {
            simpleCopy(fromFile, pathUtil.join(to.path(), fromFile.name()));
        }
    }

    var fromSubDirectories = from.subDirectories();
    var toSubDirectories = to.subDirectories();

    // If the file doesn't exist in the source, only delete if:
    // 1. We have no previous directory
    // 2. We have a previous directory and the file exists there
    for (var toSubDirectoryKey in toSubDirectories) {
        var toSubDirectory: DirectoryInfo = toSubDirectories[toSubDirectoryKey];
        var toSubDirectoryPath = toSubDirectory.path();

        if (!fromSubDirectories[toSubDirectoryPath]) {
            if (manifest.isEmpty() || manifest.isPathInManifest(toSubDirectoryPath, toRootPath)) {
                deleteDirectoryRecursive(toSubDirectory);
            }
        }
    }

    // Copy directories
    for (var fromSubDirectoryKey in fromSubDirectories) {
        var fromSubDirectory: DirectoryInfo = fromSubDirectories[fromSubDirectoryKey];
        outManifest.addFileToManifest(fromSubDirectory.path(), fromRootPath);

        var toSubDirectory = new DirectoryInfo(pathUtil.join(to.path(), fromSubDirectory.name()));
        smartCopyDirectory(
            fromSubDirectory,
            toSubDirectory,
            fromRootPath,
            toRootPath,
            manifest,
            outManifest);
    }
}
