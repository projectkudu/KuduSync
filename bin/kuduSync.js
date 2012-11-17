var fs = require('fs');
var pathUtil = require('path');
var Q = require('q');
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
var Utils;
(function (Utils) {
    Utils.DefaultRetries = 3;
    Utils.DefaultDelayBeforeRetry = 250;
    function attempt(action, retries, delayBeforeRetry) {
        if (typeof retries === "undefined") { retries = Utils.DefaultRetries; }
        if (typeof delayBeforeRetry === "undefined") { delayBeforeRetry = Utils.DefaultDelayBeforeRetry; }
        Ensure.argNotNull(action, "action");
        var currentTry = 1;
        var retryAction = function () {
            return action().then(Q.resolve, function (err) {
                if(retries >= currentTry++) {
                    return Q.delay(Q.fcall(retryAction), delayBeforeRetry);
                } else {
                    return Q.reject(err);
                }
            });
        };
        return retryAction();
    }
    Utils.attempt = attempt;
    function map(source, action) {
        var results = [];
        for(var i = 0; i < source.length; i++) {
            results.push(action(source[i], i));
        }
        return results;
    }
    Utils.map = map;
    function serialize() {
        var source = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            source[_i] = arguments[_i + 0];
        }
        var result = Q.resolve();
        for(var i = 0; i < source.length; i++) {
            result = result.then(source[i]);
        }
        return result;
    }
    Utils.serialize = serialize;
})(Utils || (Utils = {}));
exports.Utils = Utils;
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
};
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
    DirectoryInfo.prototype.ensureCreated = function () {
        var _this = this;
        if(!this.exists()) {
            return this.parent().ensureCreated().then(function () {
                return Utils.attempt(function () {
                    return Q.ncall(fs.mkdir, fs, _this.path());
                });
            });
        }
        return Q.resolve();
    };
    DirectoryInfo.prototype.parent = function () {
        return new DirectoryInfo(pathUtil.dirname(this.path()));
    };
    DirectoryInfo.prototype.ensureFilesDirectories = function () {
        var self = this;
        if(this._files === null || this._directories === null) {
            var fileInfos = new Array();
            var directoryInfos = new Array();
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
    Manifest.load = function load(manifestPath) {
        var manifest = new Manifest();
        if(manifestPath == null) {
            return Q.resolve(manifest);
        }
        return Q.ncall(fs.readFile, fs, manifestPath, 'utf8').then(function (content) {
            var filePaths = content.split("\n");
            var files = new Array();
            filePaths.forEach(function (filePath) {
                var file = filePath.trim();
                if(file != "") {
                    files[file] = file;
                    manifest._isEmpty = false;
                }
            });
            return Q.resolve(manifest);
        }, function (err) {
            if(err.errno == 34) {
                return Q.resolve(manifest);
            } else {
                return Q.reject(err);
            }
        });
    }
    Manifest.save = function save(manifest, manifestPath) {
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
        return Q.ncall(fs.writeFile, fs, manifestPath, manifestFileContent, 'utf8');
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
function kuduSync(fromPath, toPath, nextManifestPath, previousManifestPath, whatIf) {
    Ensure.argNotNull(fromPath, "fromPath");
    Ensure.argNotNull(toPath, "toPath");
    Ensure.argNotNull(nextManifestPath, "nextManifestPath");
    var from = new DirectoryInfo(fromPath);
    var to = new DirectoryInfo(toPath);
    var nextManifest = new Manifest();
    log("Kudu sync from: " + from.path() + " to: " + to.path());
    return Manifest.load(previousManifestPath).then(function (manifest) {
        return kuduSyncDirectory(from, to, from.path(), to.path(), manifest, nextManifest, whatIf);
    }).then(function () {
        if(!whatIf) {
            return Manifest.save(nextManifest, nextManifestPath);
        }
    });
}
exports.kuduSync = kuduSync;
function copyFile(fromFile, toFilePath, whatIf) {
    Ensure.argNotNull(fromFile, "fromFile");
    Ensure.argNotNull(toFilePath, "toFilePath");
    log("Copy file from: " + fromFile.path() + " to: " + toFilePath);
    return Utils.attempt(function () {
        try  {
            if(!whatIf) {
                fs.createReadStream(fromFile.path()).pipe(fs.createWriteStream(toFilePath));
            }
            return Q.resolve();
        } catch (err) {
            return Q.reject(err);
        }
    });
}
function deleteFile(file, whatIf) {
    Ensure.argNotNull(file, "file");
    var path = file.path();
    log("Deleting file: " + path);
    if(!whatIf) {
        return Utils.attempt(function () {
            return Q.ncall(fs.unlink, fs, path);
        });
    }
    return Q.resolve();
}
function deleteDirectoryRecursive(directory, whatIf) {
    Ensure.argNotNull(directory, "directory");
    var path = directory.path();
    log("Deleting directory: " + path);
    var files = directory.files();
    var subDirectories = directory.subDirectories();
    return Q.all(Utils.map(files, function (file) {
        return deleteFile(file, whatIf);
    })).then(function () {
        return Q.all(Utils.map(subDirectories, function (subDir) {
            return deleteDirectoryRecursive(subDir, whatIf);
        }));
    }).then(function () {
        if(!whatIf) {
            return Utils.attempt(function () {
                return Q.ncall(fs.rmdir, fs, path);
            });
        }
        return Q.resolve();
    });
}
function kuduSyncDirectory(from, to, fromRootPath, toRootPath, manifest, outManifest, whatIf) {
    Ensure.argNotNull(from, "from");
    Ensure.argNotNull(to, "to");
    Ensure.argNotNull(fromRootPath, "fromRootPath");
    Ensure.argNotNull(toRootPath, "toRootPath");
    Ensure.argNotNull(manifest, "manifest");
    Ensure.argNotNull(outManifest, "outManifest");
    if(from.isSourceControl()) {
        return Q.resolve();
    }
    var fromFiles;
    var toFiles;
    var fromSubDirectories;
    var toSubDirectories;
    return Utils.serialize(function () {
        if(!whatIf) {
            return to.ensureCreated();
        }
        return Q.resolve();
    }, function () {
        fromFiles = from.files();
        toFiles = getFilesConsiderWhatIf(to, whatIf);
        fromSubDirectories = from.subDirectories();
        toSubDirectories = getSubDirectoriesConsiderWhatIf(to, whatIf);
        return Q.resolve();
    }, function () {
        return Q.all(Utils.map(toFiles, function (toFile) {
            if(!fromFiles[toFile.name()]) {
                if(manifest.isEmpty() || manifest.isPathInManifest(toFile.path(), toRootPath)) {
                    return deleteFile(toFile, whatIf);
                }
            }
            return Q.resolve();
        }));
    }, function () {
        return Q.all(Utils.map(fromFiles, function (fromFile) {
            outManifest.addFileToManifest(fromFile.path(), fromRootPath);
            var toFile = toFiles[fromFile.name()];
            if(toFile == null || fromFile.modifiedTime() > toFile.modifiedTime()) {
                return copyFile(fromFile, pathUtil.join(to.path(), fromFile.name()), whatIf);
            }
            return Q.resolve();
        }));
    }, function () {
        return Q.all(Utils.map(toSubDirectories, function (toSubDirectory) {
            if(!fromSubDirectories[toSubDirectory.name()]) {
                if(manifest.isEmpty() || manifest.isPathInManifest(toSubDirectory.path(), toRootPath)) {
                    return deleteDirectoryRecursive(toSubDirectory, whatIf);
                }
            }
            return Q.resolve();
        }));
    }, function () {
        return Q.all(Utils.map(fromSubDirectories, function (fromSubDirectory) {
            outManifest.addFileToManifest(fromSubDirectory.path(), fromRootPath);
            var toSubDirectory = new DirectoryInfo(pathUtil.join(to.path(), fromSubDirectory.name()));
            return kuduSyncDirectory(fromSubDirectory, toSubDirectory, fromRootPath, toRootPath, manifest, outManifest, whatIf);
        }));
    });
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
    kuduSync(fromDir, toDir, nextManifest, previousManifest, whatIf).then(function () {
        process.exit(0);
    }, function (err) {
        if(err) {
            console.log("" + err);
        }
        process.exit(1);
    });
}
exports.main = main;
