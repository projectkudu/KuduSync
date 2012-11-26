///<reference path='directoryInfo.ts'/>
///<reference path='manifest.ts'/>

function kuduSync(fromPath: string, toPath: string, nextManifestPath: string, previousManifestPath: string, ignore: string, whatIf: bool) : Promise {
    Ensure.argNotNull(fromPath, "fromPath");
    Ensure.argNotNull(toPath, "toPath");
    Ensure.argNotNull(nextManifestPath, "nextManifestPath");

    var from = new DirectoryInfo(fromPath);
    var to = new DirectoryInfo(toPath);

    var nextManifest = new Manifest();

    var ignoreList = parseIgnoreList(ignore);

    log("Kudu sync from: " + from.path() + " to: " + to.path());

    return Manifest.load(previousManifestPath)
                    .then((manifest) => kuduSyncDirectory(from, to, from.path(), to.path(), manifest, nextManifest, ignoreList, whatIf))
                    .then(() => {
                        if (!whatIf) {
                            return Manifest.save(nextManifest, nextManifestPath);
                        }
                    });
}

exports.kuduSync = kuduSync;

function parseIgnoreList(ignore: string): string[] {
    if (!ignore) {
        return null;
    }

    return ignore.split(";");
}

function shouldIgnore(path: string, rootPath: string, ignoreList: string[]): bool {
    if (!ignoreList) {
        return false;
    }

    var relativePath = pathUtil.relative(rootPath, path);

    for (var i = 0; i < ignoreList.length; i++) {
        var ignore = ignoreList[i];
        if (minimatch(relativePath, ignore, { matchBase: true, nocase: true })) {
            log("Ignoring: " + path);
            return true;
        }
    }

    return false;
}

function copyFile(fromFile: FileInfo, toFilePath: string, whatIf: bool) : Promise {
    Ensure.argNotNull(fromFile, "fromFile");
    Ensure.argNotNull(toFilePath, "toFilePath");

    log("Copying file from: " + fromFile.path() + " to: " + toFilePath);

    return Utils.attempt(() => {
        var deffered = Q.defer();
        try {
            if (!whatIf) {
                var readStream = fs.createReadStream(fromFile.path());
                readStream.pipe(fs.createWriteStream(toFilePath));
                readStream.on("end", () => {
                    // Update the destination modified time to be the same as the source
                    var toFileStat = fs.statSync(toFilePath);
                    fs.utimesSync(toFilePath, toFileStat.atime, fromFile.modifiedTime());
                    deffered.resolve();
                });
            }
            else {
                deffered.resolve();
            }

            return deffered.promise;
        }
        catch (err) {
            return deffered.reject(err);
        }
    });
}

function deleteFile(file: FileInfo, whatIf: bool) : Promise {
    Ensure.argNotNull(file, "file");

    var path = file.path();

    log("Deleting file: " + path);

    if (!whatIf) {
        return Utils.attempt(() => Q.nfcall(fs.unlink, path));
    }
    
    return Q.resolve();
}

function deleteDirectoryRecursive(directory: DirectoryInfo, whatIf: bool) {
    Ensure.argNotNull(directory, "directory");

    var path = directory.path();
    log("Deleting directory: " + path);

    return directory.initializeFilesAndSubDirectoriesLists()
        .then(() => {
            var files = directory.filesList();
            var subDirectories = directory.subDirectoriesList();

            // Delete all files under this directory
            return Q.all(Utils.map(files, (file) => deleteFile(file, whatIf)))
                    .then(() => Q.all(Utils.map(subDirectories, (subDir) => deleteDirectoryRecursive(subDir, whatIf))))
                    .then(() => {
                        // Delete current directory
                        if (!whatIf) {
                            return Utils.attempt(() => Q.nfcall(fs.rmdir, path));
                        }
                        return Q.resolve();
                    });
        });
}

function kuduSyncDirectory(from: DirectoryInfo, to: DirectoryInfo, fromRootPath: string, toRootPath: string, manifest: Manifest, outManifest: Manifest, ignoreList: string[], whatIf: bool) {
    Ensure.argNotNull(from, "from");
    Ensure.argNotNull(to, "to");
    Ensure.argNotNull(fromRootPath, "fromRootPath");
    Ensure.argNotNull(toRootPath, "toRootPath");
    Ensure.argNotNull(manifest, "manifest");
    Ensure.argNotNull(outManifest, "outManifest");

    try {
        if (!from.exists()) {
            return Q.reject(new Error("From directory doesn't exist"));
        }

        if (shouldIgnore(from.path(), fromRootPath, ignoreList)) {
            // Ignore directories in ignore list
            return Q.resolve();
        }

        if (!pathUtil.relative(from.path(), toRootPath)) {
            // No need to copy the destination path itself (if contained within the source directory)
            return Q.resolve();
        }

        if (from.path() != fromRootPath) {
            outManifest.addFileToManifest(from.path(), fromRootPath);
        }

        // Do the following actions one after the other (serialized)
        return Utils.serialize(
            () => {
                if (!whatIf) {
                    return to.ensureCreated();
                }
                return Q.resolve();
            },

            () => {
                to.initializeFilesAndSubDirectoriesLists();
            },

            () => {
                from.initializeFilesAndSubDirectoriesLists();
            },

            () => {
                // If the file doesn't exist in the source, only delete if:
                // 1. We have no previous directory
                // 2. We have a previous directory and the file exists there
                return Q.all(Utils.map(
                    to.filesList(),
                    (toFile: FileInfo) => {
                        if (shouldIgnore(toFile.path(), toRootPath, ignoreList)) {
                            // Ignore files in ignore list
                            return Q.resolve();
                        }

                        if (!from.getFile(toFile.name())) {
                            if (manifest.isPathInManifest(toFile.path(), toRootPath)) {
                                return deleteFile(toFile, whatIf);
                            }
                        }
                        return Q.resolve();
                    }
                ));
            },

            () => {
                // Copy files
                return Q.all(Utils.map(
                    from.filesList(),
                    (fromFile: FileInfo) => {
                        if (shouldIgnore(fromFile.path(), fromRootPath, ignoreList)) {
                            // Ignore files in ignore list
                            return Q.resolve();
                        }

                        outManifest.addFileToManifest(fromFile.path(), fromRootPath);

                        // if the file exists in the destination then only copy it again if it's
                        // last write time is different than the same file in the source (only if it changed)
                        var toFile = to.getFile(fromFile.name());

                        if (toFile == null || !fromFile.equals(toFile)) {
                            return copyFile(fromFile, pathUtil.join(to.path(), fromFile.name()), whatIf);
                        }

                        return Q.resolve();
                    }
                ));
            },

            () => {
                return Q.all(Utils.map(
                    to.subDirectoriesList(),
                    (toSubDirectory: DirectoryInfo) => {
                        // If the file doesn't exist in the source, only delete if:
                        // 1. We have no previous directory
                        // 2. We have a previous directory and the file exists there
                        if (!from.getSubDirectory(toSubDirectory.name())) {
                            if (manifest.isPathInManifest(toSubDirectory.path(), toRootPath)) {
                                return deleteDirectoryRecursive(toSubDirectory, whatIf);
                            }
                        }
                        return Q.resolve();
                    }
                ));
            },

            () => {
                // Copy directories
                return Q.all(Utils.map(
                    from.subDirectoriesList(),
                    (fromSubDirectory: DirectoryInfo) => {
                        var toSubDirectory = new DirectoryInfo(pathUtil.join(to.path(), fromSubDirectory.name()));
                        return kuduSyncDirectory(
                            fromSubDirectory,
                            toSubDirectory,
                            fromRootPath,
                            toRootPath,
                            manifest,
                            outManifest,
                            ignoreList,
                            whatIf);
                    }
                ));
            });
    }
    catch (err) {
        return Q.reject(err);
     }
}
