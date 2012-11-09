///<reference path='directoryInfo.ts'/>
///<reference path='manifest.ts'/>

function kuduSync(fromPath: string, toPath: string, nextManifestPath: string, previousManifestPath: string, whatIf: bool, callback: (err) => void) {
    Ensure.argNotNull(fromPath, "fromPath");
    Ensure.argNotNull(toPath, "toPath");
    Ensure.argNotNull(nextManifestPath, "nextManifestPath");
    Ensure.argNotNull(callback, "callback");

    var from = new DirectoryInfo(fromPath);
    var to = new DirectoryInfo(toPath);

    var nextManifest = new Manifest();

    log("Kudu sync from: " + from.path() + " to: " + to.path());

    Manifest.load(previousManifestPath, (err, manifest) => {
        if (err) {
            callback(err);
            return;
        }

        kuduSyncDirectory(from, to, from.path(), to.path(), manifest, nextManifest, whatIf, (innerErr) => {
            if (innerErr) {
                callback(innerErr);
                return;
            }

            if (!whatIf) {
                Manifest.save(nextManifest, nextManifestPath, callback);
                return;
            }

            callback(null);
        });
    });
}

exports.kuduSync = kuduSync;

function copyFile(fromFile: FileInfo, toFilePath: string, whatIf: bool, callback: (err) => void) {
    Ensure.argNotNull(fromFile, "fromFile");
    Ensure.argNotNull(toFilePath, "toFilePath");
    Ensure.argNotNull(callback, "callback");

    log("Copy file from: " + fromFile.path() + " to: " + toFilePath);

    try {
        if (!whatIf) {
            fs.createReadStream(fromFile.path()).pipe(fs.createWriteStream(toFilePath));
        }

        callback(null);
    }
    catch (err) {
        callback(err);
    }
}

function deleteFile(file: FileInfo, whatIf: bool, callback: (err) => void) {
    Ensure.argNotNull(file, "file");
    Ensure.argNotNull(callback, "callback");

    var path = file.path();

    log("Deleting file: " + path);

    if (!whatIf) {
        fs.unlink(path, callback);
        return;
    }

    callback(null);
}

function deleteDirectoryRecursive(directory: DirectoryInfo, whatIf: bool, callback: (err) => void) {
    Ensure.argNotNull(directory, "directory");
    Ensure.argNotNull(callback, "callback");

    var path = directory.path();
    log("Deleting directory: " + path);

    var files = directory.files();
    var subDirectories = directory.subDirectories();

    // Delete all files under this directory
    async.forEach(
        files,
        (file, fileCallback) => {
            deleteFile(file, whatIf, fileCallback);
        },
        (forEachErr) => {
            if (forEachErr) {
                callback(forEachErr);
                return;
            }

            // Delete all subdirectories recirsively
            async.forEach(
                subDirectories,
                (subDirectory, subDirectoryCallback) => {
                    // HACK: Without this setter, typescript compiler fails to compile this with the error: RangeError: Maximum call stack size exceeded
                    var __delDirRecursive: any = deleteDirectoryRecursive;
                    __delDirRecursive(subDirectory, whatIf, subDirectoryCallback);
                },
                (innerForEachErr) => {
                    if (innerForEachErr) {
                        callback(innerForEachErr);
                        return;
                    }

                    // Delete current directory
                    if (!whatIf) {
                        fs.rmdir(path, callback);
                        return;
                    }

                    callback(null);
                }
            );
        }
    );
}

function kuduSyncDirectory(from: DirectoryInfo, to: DirectoryInfo, fromRootPath: string, toRootPath: string, manifest: Manifest, outManifest: Manifest, whatIf: bool, callback: (err) => void) {
    Ensure.argNotNull(from, "from");
    Ensure.argNotNull(to, "to");
    Ensure.argNotNull(fromRootPath, "fromRootPath");
    Ensure.argNotNull(toRootPath, "toRootPath");
    Ensure.argNotNull(manifest, "manifest");
    Ensure.argNotNull(outManifest, "outManifest");
    Ensure.argNotNull(callback, "callback");

    // TODO: Generalize files to ignore
    if (from.isSourceControl()) {
        // No need to copy the source control directory (.git).
        callback(null);
        return;
    }

    var fromFiles: FileInfo[];
    var toFiles: FileInfo[];
    var fromSubDirectories: DirectoryInfo[];
    var toSubDirectories: DirectoryInfo[];

    // Do the following actions one after the other (serialized)
    async.series([
        (seriesCallback) => {
            if(!whatIf) {
                to.ensureCreated(seriesCallback);
                return;
            }

            seriesCallback(null);
        },

        (seriesCallback) => {
            try {
                fromFiles = from.files();
                toFiles = getFilesConsiderWhatIf(to, whatIf);
                fromSubDirectories = from.subDirectories();
                toSubDirectories = getSubDirectoriesConsiderWhatIf(to, whatIf);

                seriesCallback(null);
            }
            catch (err) {
                seriesCallback(err);
            }
        },

        (seriesCallback) => {
            // If the file doesn't exist in the source, only delete if:
            // 1. We have no previous directory
            // 2. We have a previous directory and the file exists there
            async.forEach(
                toFiles,
                (toFile: FileInfo, fileCallback) => {
                    // TODO: handle case sensitivity
                    if (!fromFiles[toFile.name()]) {
                        if (manifest.isEmpty() || manifest.isPathInManifest(toFile.path(), toRootPath)) {
                            deleteFile(toFile, whatIf, fileCallback);
                            return;
                        }
                    }

                    fileCallback();
                },
                seriesCallback
            );
        },

        (seriesCallback) => {
            // Copy files
            async.forEach(
                fromFiles,
                (fromFile: FileInfo, fileCallback) => {
                    outManifest.addFileToManifest(fromFile.path(), fromRootPath);

                    // TODO: Skip deployment files

                    // if the file exists in the destination then only copy it again if it's
                    // last write time is different than the same file in the source (only if it changed)
                    var toFile = toFiles[fromFile.name()];

                    if (toFile == null || fromFile.modifiedTime() > toFile.modifiedTime()) {
                        copyFile(fromFile, pathUtil.join(to.path(), fromFile.name()), whatIf, fileCallback);
                        return;
                    }

                    fileCallback();
                },
                seriesCallback
            );
        },

        (seriesCallback) => {
            async.forEach(
                toSubDirectories,
                (toSubDirectory: DirectoryInfo, directoryCallback) => {
                    // If the file doesn't exist in the source, only delete if:
                    // 1. We have no previous directory
                    // 2. We have a previous directory and the file exists there
                    if (!fromSubDirectories[toSubDirectory.name()]) {
                        if (manifest.isEmpty() || manifest.isPathInManifest(toSubDirectory.path(), toRootPath)) {
                            deleteDirectoryRecursive(toSubDirectory, whatIf, directoryCallback);
                            return;
                        }
                    }

                    directoryCallback();
                },
                seriesCallback
            );
        },

        (seriesCallback) => {
            // Copy directories
            async.forEach(
                fromSubDirectories,
                (fromSubDirectory: DirectoryInfo, directoryCallback) => {
                    outManifest.addFileToManifest(fromSubDirectory.path(), fromRootPath);

                    var toSubDirectory = new DirectoryInfo(pathUtil.join(to.path(), fromSubDirectory.name()));
                    kuduSyncDirectory(
                        fromSubDirectory,
                        toSubDirectory,
                        fromRootPath,
                        toRootPath,
                        manifest,
                        outManifest,
                        whatIf,
                        directoryCallback);
                },
                seriesCallback
            );
        }], callback);
}

function getFilesConsiderWhatIf(dir: DirectoryInfo, whatIf: bool): FileInfo[] {
    try {
        return dir.files();
    }
    catch (e) {
        if (whatIf) {
            return [];
        }

        throw e;
    }
}

function getSubDirectoriesConsiderWhatIf(dir: DirectoryInfo, whatIf: bool): DirectoryInfo[] {
    try {
        return dir.subDirectories();
    }
    catch (e) {
        if (whatIf) {
            return [];
        }

        throw e;
    }
}
