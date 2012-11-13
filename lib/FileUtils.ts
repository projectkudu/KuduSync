///<reference path='directoryInfo.ts'/>
///<reference path='manifest.ts'/>

function kuduSync(fromPath: string, toPath: string, nextManifestPath: string, previousManifestPath: string, whatIf: bool) : Promise {
    Ensure.argNotNull(fromPath, "fromPath");
    Ensure.argNotNull(toPath, "toPath");
    Ensure.argNotNull(nextManifestPath, "nextManifestPath");

    var from = new DirectoryInfo(fromPath);
    var to = new DirectoryInfo(toPath);

    var nextManifest = new Manifest();

    log("Kudu sync from: " + from.path() + " to: " + to.path());

    return Manifest.load(previousManifestPath)
                    .then((manifest) => kuduSyncDirectory(from, to, from.path(), to.path(), manifest, nextManifest, whatIf))
                    .then(() => Manifest.save(nextManifest, nextManifestPath));
}

exports.kuduSync = kuduSync;

function copyFile(fromFile: FileInfo, toFilePath: string, whatIf: bool) : Promise {
    Ensure.argNotNull(fromFile, "fromFile");
    Ensure.argNotNull(toFilePath, "toFilePath");

    log("Copy file from: " + fromFile.path() + " to: " + toFilePath);

    return Utils.attempt(() => {
        try {
            if (!whatIf) {
                fs.createReadStream(fromFile.path()).pipe(fs.createWriteStream(toFilePath));
            }
            return Q.resolve();
        }
        catch (err) {
            return Q.reject(err);
        }
    });
}

function deleteFile(file: FileInfo, whatIf: bool) : Promise {
    Ensure.argNotNull(file, "file");

    var path = file.path();

    log("Deleting file: " + path);

    if (!whatIf) {
        return Utils.attempt(() => Q.ncall(fs.unlink, fs, path));
    }
    
    return Q.resolve();
}

function deleteDirectoryRecursive(directory: DirectoryInfo, whatIf: bool) {
    Ensure.argNotNull(directory, "directory");

    var path = directory.path();
    log("Deleting directory: " + path);

    var files = directory.files();
    var subDirectories = directory.subDirectories();

    // Delete all files under this directory
    return Q.all(Utils.map(files, (file) => deleteFile(file, whatIf)))
            .then(() => Q.all(Utils.map(subDirectories, (subDir) => deleteDirectoryRecursive(subDir, whatIf))))
            .then(() => {
                // Delete current directory
                  if (!whatIf) {
                      return Utils.attempt(() => Q.ncall(fs.rmdir, fs, path));
                  }
                  return Q.resolve();
             });
}

function kuduSyncDirectory(from: DirectoryInfo, to: DirectoryInfo, fromRootPath: string, toRootPath: string, manifest: Manifest, outManifest: Manifest, whatIf: bool) {
    Ensure.argNotNull(from, "from");
    Ensure.argNotNull(to, "to");
    Ensure.argNotNull(fromRootPath, "fromRootPath");
    Ensure.argNotNull(toRootPath, "toRootPath");
    Ensure.argNotNull(manifest, "manifest");
    Ensure.argNotNull(outManifest, "outManifest");

    // TODO: Generalize files to ignore
    if (from.isSourceControl()) {
        // No need to copy the source control directory (.git).
        return Q.resolve();
    }

    var fromFiles: FileInfo[];
    var toFiles: FileInfo[];
    var fromSubDirectories: DirectoryInfo[];
    var toSubDirectories: DirectoryInfo[];

    // Do the following actions one after the other (serialized)
    return Utils.serialize(
        () => {
            if(!whatIf) {
                return to.ensureCreated();
            }
            return Q.resolve();
        },

        () => {
            fromFiles = from.files();
            toFiles = getFilesConsiderWhatIf(to, whatIf);
            fromSubDirectories = from.subDirectories();
            toSubDirectories = getSubDirectoriesConsiderWhatIf(to, whatIf);
            return Q.resolve();
        },

        () => {
            // If the file doesn't exist in the source, only delete if:
            // 1. We have no previous directory
            // 2. We have a previous directory and the file exists there
            return Q.all(Utils.map(
                toFiles,
                (toFile: FileInfo) => {
                    // TODO: handle case sensitivity
                    if (!fromFiles[toFile.name()]) {
                        if (manifest.isEmpty() || manifest.isPathInManifest(toFile.path(), toRootPath)) {
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
                fromFiles,
                (fromFile: FileInfo) => {
                    outManifest.addFileToManifest(fromFile.path(), fromRootPath);

                    // TODO: Skip deployment files

                    // if the file exists in the destination then only copy it again if it's
                    // last write time is different than the same file in the source (only if it changed)
                    var toFile = toFiles[fromFile.name()];

                    if (toFile == null || fromFile.modifiedTime() > toFile.modifiedTime()) {
                        return copyFile(fromFile, pathUtil.join(to.path(), fromFile.name()), whatIf);
                    }
                    return Q.resolve();
                }
            ));
        },

        () => {
            return Q.all(Utils.map(
                toSubDirectories,
                (toSubDirectory: DirectoryInfo) => {
                    // If the file doesn't exist in the source, only delete if:
                    // 1. We have no previous directory
                    // 2. We have a previous directory and the file exists there
                    if (!fromSubDirectories[toSubDirectory.name()]) {
                        if (manifest.isEmpty() || manifest.isPathInManifest(toSubDirectory.path(), toRootPath)) {
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
                fromSubDirectories,
                (fromSubDirectory: DirectoryInfo) => {
                    outManifest.addFileToManifest(fromSubDirectory.path(), fromRootPath);

                    var toSubDirectory = new DirectoryInfo(pathUtil.join(to.path(), fromSubDirectory.name()));
                    return kuduSyncDirectory(
                        fromSubDirectory,
                        toSubDirectory,
                        fromRootPath,
                        toRootPath,
                        manifest,
                        outManifest,
                        whatIf);
                }
            ));
        });
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
