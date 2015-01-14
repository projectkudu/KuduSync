///<reference path='directoryInfo.ts'/>
///<reference path='manifest.ts'/>

function kuduSync(fromPath: string, toPath: string, nextManifestPath: string, previousManifestPath: string, ignore: string, whatIf: boolean) : Promise {
    Ensure.argNotNull(fromPath, "fromPath");
    Ensure.argNotNull(toPath, "toPath");
    Ensure.argNotNull(nextManifestPath, "nextManifestPath");

    var from = new DirectoryInfo(fromPath, fromPath);
    var to = new DirectoryInfo(toPath, toPath);

    if (!from.exists()) {
        return Q.reject(new Error("From directory doesn't exist"));
    }

    if (from.isSubdirectoryOf(to) || to.isSubdirectoryOf(from)) {
        return Q.reject(new Error("Source and destination directories cannot be sub-directories of each other"));
    }

    var nextManifest = new Manifest();

    var ignoreList = parseIgnoreList(ignore);

    log("Kudu sync from: '" + from.path() + "' to: '" + to.path() + "'");

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

function shouldIgnore(path: string, rootPath: string, ignoreList: string[]): boolean {
    if (!ignoreList) {
        return false;
    }

    var relativePath = pathUtil.relative(rootPath, path);

    for (var i = 0; i < ignoreList.length; i++) {
        var ignore = ignoreList[i];
        if (minimatch(relativePath, ignore, { matchBase: true, nocase: true })) {
            log("Ignoring: " + relativePath);
            return true;
        }
    }

    return false;
}

function copyFile(fromFile: FileInfo, toFilePath: string, whatIf: boolean) : Promise {
    Ensure.argNotNull(fromFile, "fromFile");
    Ensure.argNotNull(toFilePath, "toFilePath");

    log("Copying file: '" + fromFile.relativePath() + "'");

    if (!whatIf) {
        return Utils.attempt(() => {
            var promise = copyFileInternal(fromFile, toFilePath);
            promise = promise.then(function () {
                return Q.nfcall(fs.utimes, toFilePath, new Date(), fromFile.modifiedTime());
            }, null);

            return promise;
        });
    }

    return Q.resolve();
}

function copyFileInternal(fromFile: FileInfo, toFilePath: string): Promise {
    var deffered = Q.defer();
    try {
        var readStream = fs.createReadStream(fromFile.path());
        var writeStream = fs.createWriteStream(toFilePath);
        readStream.pipe(writeStream);
        readStream.on("error", deffered.reject);
        writeStream.on("error", deffered.reject);
        writeStream.on("close", deffered.resolve);
    }
    catch (err) {
        deffered.reject(err);
    }

    return deffered.promise;
}

function deleteFileIfInManifest(file: FileInfo, manifest: Manifest, rootPath: string, whatIf: boolean) : Promise {
    Ensure.argNotNull(file, "file");

    var path = file.path();

    // Remove file only if it was in previous manifest
    if (manifest.isPathInManifest(file.path(), rootPath)) {
        log("Deleting file: '" + file.relativePath() + "'");

        if (!whatIf) {
            return Utils.attempt(() => Q.nfcall(fs.unlink, path));
        }
    }
    
    return Q.resolve();
}

function deleteDirectoryRecursive(directory: DirectoryInfo, manifest: Manifest, rootPath: string, whatIf: boolean) {
    Ensure.argNotNull(directory, "directory");

    var path = directory.path();
    var relativePath = directory.relativePath();

    // Remove directory only if it was in previous manifest
    if (!manifest.isPathInManifest(path, rootPath)) {
        return Q.resolve();
    }

    return Utils.serialize(
        () => {
            return directory.initializeFilesAndSubDirectoriesLists();
        },

        () => {
            return Utils.mapSerialized(directory.filesList(), (file: FileInfo) => deleteFileIfInManifest(file, manifest, rootPath, whatIf));
        },

        () => {
            return Utils.mapSerialized(directory.subDirectoriesList(), (subDir) => deleteDirectoryRecursive(subDir, manifest, rootPath, whatIf));
        },

        () => {
            return directory.updateFilesAndSubDirectoriesLists();
        },

        () => {
            var filesCount = directory.filesList().length + directory.subDirectoriesList().length;
            if (filesCount > 0) {
                return Q.resolve();
            }

            // Delete current directory
            log("Deleting directory: '" + relativePath + "'");
            if (!whatIf) {
                return Utils.attempt(() => Q.nfcall(fs.rmdir, path));
            }
            return Q.resolve();
        });
}

function kuduSyncDirectory(from: DirectoryInfo, to: DirectoryInfo, fromRootPath: string, toRootPath: string, manifest: Manifest, outManifest: Manifest, ignoreList: string[], whatIf: boolean) {
    Ensure.argNotNull(from, "from");
    Ensure.argNotNull(to, "to");
    Ensure.argNotNull(fromRootPath, "fromRootPath");
    Ensure.argNotNull(toRootPath, "toRootPath");
    Ensure.argNotNull(manifest, "manifest");
    Ensure.argNotNull(outManifest, "outManifest");

    try {
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
                return to.initializeFilesAndSubDirectoriesLists();
            },

            () => {
                return from.initializeFilesAndSubDirectoriesLists();
            },

            () => {
                // Copy files
                return Utils.mapParallelized(
                    5,
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
                );
            },

            () => {
                // If the file doesn't exist in the source, only delete if:
                // 1. We have no previous directory
                // 2. We have a previous directory and the file exists there
                return Utils.mapSerialized(
                    to.filesList(),
                    (toFile: FileInfo) => {
                        if (shouldIgnore(toFile.path(), toRootPath, ignoreList)) {
                            // Ignore files in ignore list
                            return Q.resolve();
                        }

                        if (!from.getFile(toFile.name())) {
                            return deleteFileIfInManifest(toFile, manifest, toRootPath, whatIf);
                        }
                        return Q.resolve();
                    }
                );
            },

            () => {
                return Utils.mapSerialized(
                    to.subDirectoriesList(),
                    (toSubDirectory: DirectoryInfo) => {
                        // If the file doesn't exist in the source, only delete if:
                        // 1. We have no previous directory
                        // 2. We have a previous directory and the file exists there
                        if (!from.getSubDirectory(toSubDirectory.name())) {
                            if (manifest.isPathInManifest(toSubDirectory.path(), toRootPath)) {
                                return deleteDirectoryRecursive(toSubDirectory, manifest, toRootPath, whatIf);
                            }
                        }
                        return Q.resolve();
                    }
                );
            },

            () => {
                // Copy directories
                return Utils.mapSerialized(
                    from.subDirectoriesList(),
                    (fromSubDirectory: DirectoryInfo) => {
                        var toSubDirectory = new DirectoryInfo(pathUtil.join(to.path(), fromSubDirectory.name()), toRootPath);
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
                );
            });
    }
    catch (err) {
        return Q.reject(err);
    }
}
