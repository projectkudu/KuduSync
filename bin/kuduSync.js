var fs = require('fs');
var pathUtil = require('path');
var Q = require('q');
var minimatch = require('minimatch');
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
        this._filesMapping = [];
        this._subDirectoriesMapping = [];
        this._filesList = [];
        this._subDirectoriesList = [];
    }
    DirectoryInfo.prototype.ensureCreated = function () {
        var _this = this;
        if(!this.exists()) {
            return this.parent().ensureCreated().then(function () {
                return Utils.attempt(function () {
                    return Q.nfcall(fs.mkdir, _this.path());
                });
            });
        }
        return Q.resolve();
    };
    DirectoryInfo.prototype.parent = function () {
        return new DirectoryInfo(pathUtil.dirname(this.path()));
    };
    DirectoryInfo.prototype.initializeFilesAndSubDirectoriesLists = function () {
        var _this = this;
        var self = this;
        var filesMapping = new Array();
        var filesList = new Array();
        var subDirectoriesMapping = new Array();
        var subDirectoriesList = new Array();
        if(this.exists()) {
            return Utils.attempt(function () {
                try  {
                    var files = fs.readdirSync(_this.path());
                    files.forEach(function (fileName) {
                        var path = pathUtil.join(self.path(), fileName);
                        var stat = fs.statSync(path);
                        if(stat.isDirectory()) {
                            var directoryInfo = new DirectoryInfo(path);
                            subDirectoriesMapping[fileName.toUpperCase()] = directoryInfo;
                            subDirectoriesList.push(directoryInfo);
                        } else {
                            var fileInfo = new FileInfo(path, stat.mtime);
                            filesMapping[fileName.toUpperCase()] = fileInfo;
                            filesList.push(fileInfo);
                        }
                    });
                    _this._filesMapping = filesMapping;
                    _this._subDirectoriesMapping = subDirectoriesMapping;
                    _this._filesList = filesList;
                    _this._subDirectoriesList = subDirectoriesList;
                    return Q.resolve();
                } catch (err) {
                    return Q.reject(err);
                }
            });
        }
        return Q.resolve();
    };
    DirectoryInfo.prototype.getFile = function (fileName) {
        Ensure.argNotNull(fileName, "fileName");
        return this._filesMapping[fileName.toUpperCase()];
    };
    DirectoryInfo.prototype.getSubDirectory = function (subDirectoryName) {
        Ensure.argNotNull(subDirectoryName, "subDirectoryName");
        return this._subDirectoriesMapping[subDirectoryName.toUpperCase()];
    };
    DirectoryInfo.prototype.filesList = function () {
        return this._filesList;
    };
    DirectoryInfo.prototype.subDirectoriesList = function () {
        return this._subDirectoriesList;
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
        return Q.nfcall(fs.readFile, manifestPath, 'utf8').then(function (content) {
            var filePaths = content.split("\n");
            var files = new Array();
            filePaths.forEach(function (filePath) {
                var file = filePath.trim();
                if(file != "") {
                    files[file] = file;
                }
            });
            manifest._isEmpty = false;
            manifest._files = files;
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
        return Q.nfcall(fs.writeFile, manifestPath, manifestFileContent, 'utf8');
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
function kuduSync(fromPath, toPath, nextManifestPath, previousManifestPath, ignore, whatIf) {
    Ensure.argNotNull(fromPath, "fromPath");
    Ensure.argNotNull(toPath, "toPath");
    Ensure.argNotNull(nextManifestPath, "nextManifestPath");
    var from = new DirectoryInfo(fromPath);
    var to = new DirectoryInfo(toPath);
    var nextManifest = new Manifest();
    var ignoreList = parseIgnoreList(ignore);
    log("Kudu sync from: " + from.path() + " to: " + to.path());
    return Manifest.load(previousManifestPath).then(function (manifest) {
        return kuduSyncDirectory(from, to, from.path(), to.path(), manifest, nextManifest, ignoreList, whatIf);
    }).then(function () {
        if(!whatIf) {
            return Manifest.save(nextManifest, nextManifestPath);
        }
    });
}
exports.kuduSync = kuduSync;
function parseIgnoreList(ignore) {
    if(!ignore) {
        return null;
    }
    return ignore.split(";");
}
function shouldIgnore(path, rootPath, ignoreList) {
    if(!ignoreList) {
        return false;
    }
    var relativePath = pathUtil.relative(rootPath, path);
    for(var i = 0; i < ignoreList.length; i++) {
        var ignore = ignoreList[i];
        if(minimatch(relativePath, ignore, {
            matchBase: true,
            nocase: true
        })) {
            log("Ignoring: " + path);
            return true;
        }
    }
    return false;
}
function copyFile(fromFile, toFilePath, whatIf) {
    Ensure.argNotNull(fromFile, "fromFile");
    Ensure.argNotNull(toFilePath, "toFilePath");
    log("Copying file from: " + fromFile.path() + " to: " + toFilePath);
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
            return Q.nfcall(fs.unlink, path);
        });
    }
    return Q.resolve();
}
function deleteDirectoryRecursive(directory, whatIf) {
    Ensure.argNotNull(directory, "directory");
    var path = directory.path();
    log("Deleting directory: " + path);
    return directory.initializeFilesAndSubDirectoriesLists().then(function () {
        var files = directory.filesList();
        var subDirectories = directory.subDirectoriesList();
        return Q.all(Utils.map(files, function (file) {
            return deleteFile(file, whatIf);
        })).then(function () {
            return Q.all(Utils.map(subDirectories, function (subDir) {
                return deleteDirectoryRecursive(subDir, whatIf);
            }));
        }).then(function () {
            if(!whatIf) {
                return Utils.attempt(function () {
                    return Q.nfcall(fs.rmdir, path);
                });
            }
            return Q.resolve();
        });
    });
}
function kuduSyncDirectory(from, to, fromRootPath, toRootPath, manifest, outManifest, ignoreList, whatIf) {
    Ensure.argNotNull(from, "from");
    Ensure.argNotNull(to, "to");
    Ensure.argNotNull(fromRootPath, "fromRootPath");
    Ensure.argNotNull(toRootPath, "toRootPath");
    Ensure.argNotNull(manifest, "manifest");
    Ensure.argNotNull(outManifest, "outManifest");
    try  {
        if(!from.exists()) {
            return Q.reject(new Error("From directory doesn't exist"));
        }
        if(shouldIgnore(from.path(), fromRootPath, ignoreList)) {
            return Q.resolve();
        }
        if(!pathUtil.relative(from.path(), toRootPath)) {
            return Q.resolve();
        }
        if(from.path() != fromRootPath) {
            outManifest.addFileToManifest(from.path(), fromRootPath);
        }
        return Utils.serialize(function () {
            if(!whatIf) {
                return to.ensureCreated();
            }
            return Q.resolve();
        }, function () {
            to.initializeFilesAndSubDirectoriesLists();
        }, function () {
            from.initializeFilesAndSubDirectoriesLists();
        }, function () {
            return Q.all(Utils.map(to.filesList(), function (toFile) {
                if(shouldIgnore(toFile.path(), toRootPath, ignoreList)) {
                    return Q.resolve();
                }
                if(!from.getFile(toFile.name())) {
                    if(manifest.isEmpty() || manifest.isPathInManifest(toFile.path(), toRootPath)) {
                        return deleteFile(toFile, whatIf);
                    }
                }
                return Q.resolve();
            }));
        }, function () {
            return Q.all(Utils.map(from.filesList(), function (fromFile) {
                if(shouldIgnore(fromFile.path(), fromRootPath, ignoreList)) {
                    return Q.resolve();
                }
                outManifest.addFileToManifest(fromFile.path(), fromRootPath);
                var toFile = to.getFile(fromFile.name());
                if(toFile == null || fromFile.modifiedTime() > toFile.modifiedTime()) {
                    return copyFile(fromFile, pathUtil.join(to.path(), fromFile.name()), whatIf);
                }
                return Q.resolve();
            }));
        }, function () {
            return Q.all(Utils.map(to.subDirectoriesList(), function (toSubDirectory) {
                if(!from.getSubDirectory(toSubDirectory.name())) {
                    if(manifest.isEmpty() || manifest.isPathInManifest(toSubDirectory.path(), toRootPath)) {
                        return deleteDirectoryRecursive(toSubDirectory, whatIf);
                    }
                }
                return Q.resolve();
            }));
        }, function () {
            return Q.all(Utils.map(from.subDirectoriesList(), function (fromSubDirectory) {
                var toSubDirectory = new DirectoryInfo(pathUtil.join(to.path(), fromSubDirectory.name()));
                return kuduSyncDirectory(fromSubDirectory, toSubDirectory, fromRootPath, toRootPath, manifest, outManifest, ignoreList, whatIf);
            }));
        });
    } catch (err) {
        return Q.reject(err);
    }
}
function main() {
    var commander = require("commander");
    commander.version("0.0.1").usage("[options]").option("-f, --fromDir <dir path>", "Source directory to sync").option("-t, --toDir <dir path>", "Destination directory to sync").option("-n, --nextManifest <manifest file path>", "Next manifest file path").option("-p, --previousManifest [manifest file path]", "Previous manifest file path").option("-i, --ignore [patterns]", "List of files/directories to ignore and not sync, delimited by ;").option("-q, --quiet", "No logging").option("-w, --whatIf", "Only log without actual copy/remove of files").parse(process.argv);
    var commanderValues = commander;
    var fromDir = commanderValues.fromDir;
    var toDir = commanderValues.toDir;
    var previousManifest = commanderValues.previousManifest;
    var nextManifest = commanderValues.nextManifest;
    var ignore = commanderValues.ignore;
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
    kuduSync(fromDir, toDir, nextManifest, previousManifest, ignore, whatIf).then(function () {
        process.exit(0);
    }, function (err) {
        if(err) {
            console.log("" + err);
        }
        process.exit(1);
    });
}
exports.main = main;
