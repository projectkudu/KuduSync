var fs = require('fs');
var pathUtil = require('path');
var async = require('async');
var log = console.log;
if(!fs.existsSync) {
    fs.existsSync = pathUtil.existsSync;
}
var Ensure;
(function (Ensure) {
    function argNotNull(arg, argName) {
        if(arg === null || arg === undefined) {
            throw new Error("The argument '" + argName + "' is null");
        }
    }
    Ensure.argNotNull = argNotNull;
})(Ensure || (Ensure = {}));

var DefaultRetries = 3;
var DefaultDelayBeforeRetry = 250;
function attempt(action, callback, retries, delayBeforeRetry, currentTry) {
    if (typeof retries === "undefined") { retries = DefaultRetries; }
    if (typeof delayBeforeRetry === "undefined") { delayBeforeRetry = DefaultDelayBeforeRetry; }
    if (typeof currentTry === "undefined") { currentTry = 1; }
    Ensure.argNotNull(action, "action");
    Ensure.argNotNull(callback, "callback");
    action(function (err) {
        if(err && retries >= currentTry) {
            setTimeout(function () {
                return attempt(action, callback, retries, delayBeforeRetry, currentTry + 1);
            }, delayBeforeRetry);
            return;
        }
        if(err) {
            log("Error: Failed operation after " + retries + " retries.");
        }
        callback(err);
    });
}
exports.attempt = attempt;
var FileInfoBase = (function () {
    function FileInfoBase(path) {
        Ensure.argNotNull(path, "path");
        this._path = path;
        this._name = pathUtil.relative(pathUtil.dirname(path), path);
    }
    FileInfoBase.prototype.name = function () {
        return this._name;
    };
    FileInfoBase.prototype.path = function () {
        return this._path;
    };
    FileInfoBase.prototype.exists = function () {
        return fs.existsSync(this.path());
    };
    return FileInfoBase;
})();
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
}
var FileInfo = (function (_super) {
    __extends(FileInfo, _super);
    function FileInfo(path, modifiedTime) {
        _super.call(this, path);
        Ensure.argNotNull(modifiedTime, "modifiedTime");
        this._modifiedTime = modifiedTime;
    }
    FileInfo.prototype.modifiedTime = function () {
        return this._modifiedTime;
    };
    return FileInfo;
})(FileInfoBase);
var DirectoryInfo = (function (_super) {
    __extends(DirectoryInfo, _super);
    function DirectoryInfo(path) {
        _super.call(this, path);
        this._files = null;
        this._directories = null;
    }
    DirectoryInfo.prototype.isSourceControl = function () {
        return this.name().indexOf(".git") == 0;
    };
    DirectoryInfo.prototype.ensureCreated = function (callback) {
        var _this = this;
        if(!this.exists()) {
            this.parent().ensureCreated(function (err) {
                if(err) {
                    callback(err);
                    return;
                }
                attempt(function (attemptCallback) {
                    return fs.mkdir(_this.path(), attemptCallback);
                }, callback);
            });
            return;
        }
        callback(null);
    };
    DirectoryInfo.prototype.parent = function () {
        return new DirectoryInfo(pathUtil.dirname(this.path()));
    };
    DirectoryInfo.prototype.ensureFilesDirectories = function () {
        var self = this;
        if(this._files === null || this._directories === null) {
            var fileInfos = new Array();
            var directoryInfos = new Array();
            if(this.exists()) {
                var files = fs.readdirSync(this.path());
                files.forEach(function (fileName) {
                    var path = pathUtil.join(self.path(), fileName);
                    var stat = fs.statSync(path);
                    if(stat.isDirectory()) {
                        directoryInfos[fileName] = new DirectoryInfo(path);
                        directoryInfos.push(directoryInfos[fileName]);
                    } else {
                        fileInfos[fileName] = new FileInfo(path, stat.mtime);
                        fileInfos.push(fileInfos[fileName]);
                    }
                });
            }
            this._files = fileInfos;
            this._directories = directoryInfos;
        }
    };
    DirectoryInfo.prototype.files = function () {
        this.ensureFilesDirectories();
        return this._files;
    };
    DirectoryInfo.prototype.subDirectories = function () {
        this.ensureFilesDirectories();
        return this._directories;
    };
    return DirectoryInfo;
})(FileInfoBase);
var Manifest = (function () {
    function Manifest() {
        this._files = new Array();
        this._isEmpty = true;
    }
    Manifest.load = function load(manifestPath, callback) {
        var manifest = new Manifest();
        if(manifestPath == null) {
            callback(null, manifest);
            return;
        }
        fs.readFile(manifestPath, 'utf8', function (err, content) {
            if(err) {
                if(err.errno == 34) {
                    callback(null, manifest);
                } else {
                    callback(err, null);
                }
                return;
            }
            var filePaths = content.split("\n");
            var files = new Array();
            filePaths.forEach(function (filePath) {
                var file = filePath.trim();
                if(file != "") {
                    files[file] = file;
                    manifest._isEmpty = false;
                }
            });
            callback(null, manifest);
        });
    }
    Manifest.save = function save(manifest, manifestPath, callback) {
        Ensure.argNotNull(manifest, "manifest");
        Ensure.argNotNull(manifestPath, "manifestPath");
        var manifestFileContent = "";
        var filesForOutput = new Array();
        var i = 0;
        for(var file in manifest._files) {
            filesForOutput[i] = file;
            i++;
        }
        var manifestFileContent = filesForOutput.join("\n");
        fs.writeFile(manifestPath, manifestFileContent, 'utf8', callback);
    }
    Manifest.prototype.isPathInManifest = function (path, rootPath) {
        Ensure.argNotNull(path, "path");
        Ensure.argNotNull(rootPath, "rootPath");
        var relativePath = pathUtil.relative(rootPath, path);
        return this._files[relativePath] != null;
    };
    Manifest.prototype.addFileToManifest = function (path, rootPath) {
        Ensure.argNotNull(path, "path");
        Ensure.argNotNull(rootPath, "rootPath");
        var relativePath = pathUtil.relative(rootPath, path);
        this._files[relativePath] = relativePath;
    };
    Manifest.prototype.isEmpty = function () {
        return this._isEmpty;
    };
    return Manifest;
})();
function kuduSync(fromPath, toPath, nextManifestPath, previousManifestPath, whatIf, callback) {
    Ensure.argNotNull(fromPath, "fromPath");
    Ensure.argNotNull(toPath, "toPath");
    Ensure.argNotNull(nextManifestPath, "nextManifestPath");
    Ensure.argNotNull(callback, "callback");
    var from = new DirectoryInfo(fromPath);
    var to = new DirectoryInfo(toPath);
    var nextManifest = new Manifest();
    log("Kudu sync from: " + from.path() + " to: " + to.path());
    Manifest.load(previousManifestPath, function (err, manifest) {
        if(err) {
            callback(err);
            return;
        }
        kuduSyncDirectory(from, to, from.path(), to.path(), manifest, nextManifest, whatIf, function (innerErr) {
            if(innerErr) {
                callback(innerErr);
                return;
            }
            if(!whatIf) {
                Manifest.save(nextManifest, nextManifestPath, callback);
                return;
            }
            callback(null);
        });
    });
}
exports.kuduSync = kuduSync;
function copyFile(fromFile, toFilePath, whatIf, callback) {
    Ensure.argNotNull(fromFile, "fromFile");
    Ensure.argNotNull(toFilePath, "toFilePath");
    Ensure.argNotNull(callback, "callback");
    log("Copy file from: " + fromFile.path() + " to: " + toFilePath);
    attempt(function (attemptCallback) {
        try  {
            if(!whatIf) {
                fs.createReadStream(fromFile.path()).pipe(fs.createWriteStream(toFilePath));
            }
            attemptCallback(null);
        } catch (err) {
            attemptCallback(err);
        }
    }, callback);
}
function deleteFile(file, whatIf, callback) {
    Ensure.argNotNull(file, "file");
    Ensure.argNotNull(callback, "callback");
    var path = file.path();
    log("Deleting file: " + path);
    if(!whatIf) {
        attempt(function (attemptCallback) {
            return fs.unlink(path, attemptCallback);
        }, callback);
        return;
    }
    callback(null);
}
function deleteDirectoryRecursive(directory, whatIf, callback) {
    Ensure.argNotNull(directory, "directory");
    Ensure.argNotNull(callback, "callback");
    var path = directory.path();
    log("Deleting directory: " + path);
    var files = directory.files();
    var subDirectories = directory.subDirectories();
    async.forEach(files, function (file, fileCallback) {
        deleteFile(file, whatIf, fileCallback);
    }, function (forEachErr) {
        if(forEachErr) {
            callback(forEachErr);
            return;
        }
        async.forEach(subDirectories, function (subDirectory, subDirectoryCallback) {
            var __delDirRecursive = deleteDirectoryRecursive;
            __delDirRecursive(subDirectory, whatIf, subDirectoryCallback);
        }, function (innerForEachErr) {
            if(innerForEachErr) {
                callback(innerForEachErr);
                return;
            }
            if(!whatIf) {
                attempt(function (attemptCallback) {
                    return fs.rmdir(path, attemptCallback);
                }, callback);
                return;
            }
            callback(null);
        });
    });
}
function kuduSyncDirectory(from, to, fromRootPath, toRootPath, manifest, outManifest, whatIf, callback) {
    try  {
        Ensure.argNotNull(from, "from");
        Ensure.argNotNull(to, "to");
        Ensure.argNotNull(fromRootPath, "fromRootPath");
        Ensure.argNotNull(toRootPath, "toRootPath");
        Ensure.argNotNull(manifest, "manifest");
        Ensure.argNotNull(outManifest, "outManifest");
        Ensure.argNotNull(callback, "callback");
        if(from.isSourceControl()) {
            callback(null);
            return;
        }
        var fromFiles = from.files();
        var toFiles = getFilesConsiderWhatIf(to, whatIf);
        var fromSubDirectories = from.subDirectories();
        var toSubDirectories = getSubDirectoriesConsiderWhatIf(to, whatIf);
        async.series([
            function (seriesCallback) {
                if(!whatIf) {
                    to.ensureCreated(seriesCallback);
                    return;
                }
                seriesCallback(null);
            }, 
            function (seriesCallback) {
                async.forEach(toFiles, function (toFile, fileCallback) {
                    if(!fromFiles[toFile.name()]) {
                        if(manifest.isEmpty() || manifest.isPathInManifest(toFile.path(), toRootPath)) {
                            deleteFile(toFile, whatIf, fileCallback);
                            return;
                        }
                    }
                    fileCallback();
                }, seriesCallback);
            }, 
            function (seriesCallback) {
                async.forEach(fromFiles, function (fromFile, fileCallback) {
                    outManifest.addFileToManifest(fromFile.path(), fromRootPath);
                    var toFile = toFiles[fromFile.name()];
                    if(toFile == null || fromFile.modifiedTime() > toFile.modifiedTime()) {
                        copyFile(fromFile, pathUtil.join(to.path(), fromFile.name()), whatIf, fileCallback);
                        return;
                    }
                    fileCallback();
                }, seriesCallback);
            }, 
            function (seriesCallback) {
                async.forEach(toSubDirectories, function (toSubDirectory, directoryCallback) {
                    if(!fromSubDirectories[toSubDirectory.name()]) {
                        if(manifest.isEmpty() || manifest.isPathInManifest(toSubDirectory.path(), toRootPath)) {
                            deleteDirectoryRecursive(toSubDirectory, whatIf, directoryCallback);
                            return;
                        }
                    }
                    directoryCallback();
                }, seriesCallback);
            }, 
            function (seriesCallback) {
                async.forEach(fromSubDirectories, function (fromSubDirectory, directoryCallback) {
                    outManifest.addFileToManifest(fromSubDirectory.path(), fromRootPath);
                    var toSubDirectory = new DirectoryInfo(pathUtil.join(to.path(), fromSubDirectory.name()));
                    kuduSyncDirectory(fromSubDirectory, toSubDirectory, fromRootPath, toRootPath, manifest, outManifest, whatIf, directoryCallback);
                }, seriesCallback);
            }        ], callback);
    } catch (err) {
        callback(err);
    }
}
function getFilesConsiderWhatIf(dir, whatIf) {
    try  {
        return dir.files();
    } catch (e) {
        if(whatIf) {
            return [];
        }
        throw e;
    }
}
function getSubDirectoriesConsiderWhatIf(dir, whatIf) {
    try  {
        return dir.subDirectories();
    } catch (e) {
        if(whatIf) {
            return [];
        }
        throw e;
    }
}
function main() {
    var commander = require("commander");
    commander.version("0.0.1").option("-f, --fromDir <dir path>", "Source directory to sync").option("-t, --toDir <dir path>", "Destination directory to sync").option("-n, --nextManifest <manifest file path>", "Next manifest file path").option("-p, --previousManifest [manifest file path]", "Previous manifest file path").option("-q, --quiet", "No logging").option("-w, --whatIf", "Only log without actual copy/remove of files").parse(process.argv);
    var commanderValues = commander;
    var fromDir = commanderValues.fromDir;
    var toDir = commanderValues.toDir;
    var previousManifest = commanderValues.previousManifest;
    var nextManifest = commanderValues.nextManifest;
    var quiet = commanderValues.quiet;
    var whatIf = commanderValues.whatIf;
    if(quiet) {
        log = function () {
        };
    }
    if(!fromDir || !toDir || !nextManifest) {
        console.log("Error: Missing required argument");
        commander.help();
        process.exit(1);
        return;
    }
    kuduSync(fromDir, toDir, nextManifest, previousManifest, whatIf, function (err) {
        if(err) {
            console.log("" + err);
            process.exit(1);
        }
    });
}
exports.main = main;
