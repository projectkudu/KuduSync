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
    function mapSerialized(source, action) {
        var result = Q.resolve();
        for(var i = 0; i < source.length; i++) {
            var func = {
                source: source[i],
                index: i,
                action: function () {
                    var self = this;
                    return function () {
                        return action(self.source, self.index);
                    }
                }
            };
            result = result.then(func.action());
        }
        return result;
    }
    Utils.mapSerialized = mapSerialized;
    function mapParallelized(maxParallel, source, action) {
        var parallelOperations = [];
        var result = Q.resolve();
        for(var i = 0; i < source.length; i++) {
            var singleOperation = {
                source: source[i],
                index: i,
                action: function () {
                    return action(this.source, this.index);
                }
            };
            parallelOperations.push(singleOperation);
            if((i % maxParallel) == (maxParallel - 1) || i == (source.length - 1)) {
                var complexOperation = {
                    parallelOperations: parallelOperations,
                    action: function () {
                        var self = this;
                        return function () {
                            var promises = [];
                            for(var j = 0; j < self.parallelOperations.length; j++) {
                                promises.push(self.parallelOperations[j].action());
                            }
                            return Q.all(promises);
                        }
                    }
                };
                result = result.then(complexOperation.action());
                parallelOperations = [];
            }
        }
        return result;
    }
    Utils.mapParallelized = mapParallelized;
})(Utils || (Utils = {}));

exports.Utils = Utils;
var FileInfoBase = (function () {
    function FileInfoBase(path, rootPath) {
        Ensure.argNotNull(path, "path");
        this._path = path;
        this._rootPath = rootPath;
        this._name = pathUtil.relative(pathUtil.dirname(path), path);
    }
    FileInfoBase.prototype.name = function () {
        return this._name;
    };
    FileInfoBase.prototype.path = function () {
        return this._path;
    };
    FileInfoBase.prototype.rootPath = function () {
        return this._rootPath;
    };
    FileInfoBase.prototype.relativePath = function () {
        return pathUtil.relative(this._rootPath, this._path);
    };
    FileInfoBase.prototype.exists = function () {
        if(!this._exists) {
            this._exists = fs.existsSync(this.path());
        }
        return this._exists;
    };
    FileInfoBase.prototype.setExists = function (val) {
        this._exists = val;
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
    function FileInfo(path, rootPath, size, modifiedTime) {
        _super.call(this, path, rootPath);
        Ensure.argNotNull(size, "size");
        Ensure.argNotNull(modifiedTime, "modifiedTime");
        this._size = size;
        this._modifiedTime = new Date(modifiedTime);
    }
    FileInfo.prototype.modifiedTime = function () {
        return this._modifiedTime;
    };
    FileInfo.prototype.size = function () {
        return this._size;
    };
    FileInfo.prototype.equals = function (otherFile) {
        if(this.modifiedTime() == null || otherFile.modifiedTime() == null) {
            return false;
        }
        return this.modifiedTime().getTime() === otherFile.modifiedTime().getTime() && this.size() === otherFile.size();
    };
    return FileInfo;
})(FileInfoBase);
var listDir = null;
try  {
    listDir = require("../ext/fsx_win32").listDir;
    console.log("Using fsx_win32");
} catch (e) {
}
if(listDir == null) {
    listDir = function (path) {
        var files = fs.readdirSync(path);
        return Utils.map(files, function (fileName) {
            var filePath = pathUtil.join(path, fileName);
            var stat = fs.statSync(filePath);
            if(stat.isDirectory()) {
                var result = {
                    fileName: fileName,
                    isDirectory: true
                };
                return result;
            } else {
                var result = {
                    fileName: fileName,
                    size: stat.size,
                    modifiedTime: stat.mtime
                };
                return result;
            }
        });
    };
}
var DirectoryInfo = (function (_super) {
    __extends(DirectoryInfo, _super);
    function DirectoryInfo(path, rootPath) {
        _super.call(this, path, rootPath);
        this._filesMapping = [];
        this._subDirectoriesMapping = [];
        this._filesList = [];
        this._subDirectoriesList = [];
        this._initialized = false;
    }
    DirectoryInfo.prototype.ensureCreated = function () {
        var _this = this;
        if(!this.exists()) {
            var promise = this.parent().ensureCreated();
            promise = promise.then(function () {
                return Utils.attempt(function () {
                    return Q.nfcall(fs.mkdir, _this.path());
                });
            });
            promise = promise.then(function () {
                _this.setExists(true);
                _this._initialized = true;
            });
            return promise;
        }
        return Q.resolve();
    };
    DirectoryInfo.prototype.parent = function () {
        return new DirectoryInfo(pathUtil.dirname(this.path()), this.rootPath());
    };
    DirectoryInfo.prototype.initializeFilesAndSubDirectoriesLists = function () {
        if(!this._initialized && this.exists()) {
            return this.updateFilesAndSubDirectoriesLists();
        }
        return Q.resolve();
    };
    DirectoryInfo.prototype.updateFilesAndSubDirectoriesLists = function () {
        var _this = this;
        var filesMapping = new Array();
        var filesList = new Array();
        var subDirectoriesMapping = new Array();
        var subDirectoriesList = new Array();
        if(this.exists()) {
            return Utils.attempt(function () {
                try  {
                    var files = listDir(_this.path());
                    files.forEach(function (file) {
                        var path = pathUtil.join(_this.path(), file.fileName);
                        if(file.fileName !== "." && file.fileName !== "..") {
                            if(file.isDirectory) {
                                var directoryInfo = new DirectoryInfo(path, _this.rootPath());
                                directoryInfo.setExists(true);
                                subDirectoriesMapping[file.fileName.toUpperCase()] = directoryInfo;
                                subDirectoriesList.push(directoryInfo);
                            } else {
                                var fileInfo = new FileInfo(path, _this.rootPath(), file.size, file.modifiedTime);
                                filesMapping[file.fileName.toUpperCase()] = fileInfo;
                                filesList.push(fileInfo);
                            }
                        }
                    });
                    _this._filesMapping = filesMapping;
                    _this._subDirectoriesMapping = subDirectoriesMapping;
                    _this._filesList = filesList;
                    _this._subDirectoriesList = subDirectoriesList;
                    _this._initialized = true;
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
    DirectoryInfo.prototype.isSubdirectoryOf = function (potentialParentDirectory) {
        if(potentialParentDirectory == null || this.path() == null || potentialParentDirectory.path() == null) {
            return false;
        }
        var thisPath = pathUtil.resolve(this.path());
        var potentialParentDirectoryPath = pathUtil.resolve(potentialParentDirectory.path());
        if(thisPath.toUpperCase().indexOf(potentialParentDirectoryPath.toUpperCase()) == 0) {
            var pathPart = thisPath.substr(potentialParentDirectoryPath.length);
            return pathPart.indexOf('/') >= 0 || pathPart.indexOf('\\') >= 0;
        }
        return false;
    };
    return DirectoryInfo;
})(FileInfoBase);
var nodePath = require("path");
var Manifest = (function () {
    function Manifest() {
        this._files = new Array();
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
            manifest._files = files;
            return Q.resolve(manifest);
        }, function (err) {
            if(err.errno == 34 || err.errno == -4058) {
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
    Manifest.prototype.isPathInManifest = function (path, rootPath, targetSubFolder) {
        Ensure.argNotNull(path, "path");
        Ensure.argNotNull(rootPath, "rootPath");
        var relativePath = pathUtil.relative(rootPath, path);
        relativePath = (targetSubFolder ? nodePath.join(targetSubFolder, relativePath) : relativePath);
        return this._files[relativePath] != null;
    };
    Manifest.prototype.addFileToManifest = function (path, rootPath, targetSubFolder) {
        Ensure.argNotNull(path, "path");
        Ensure.argNotNull(rootPath, "rootPath");
        var relativePath = pathUtil.relative(rootPath, path);
        relativePath = (targetSubFolder ? nodePath.join(targetSubFolder, relativePath) : relativePath);
        this._files[relativePath] = relativePath;
    };
    return Manifest;
})();
function kuduSync(fromPath, toPath, targetSubFolder, nextManifestPath, previousManifestPath, ignoreManifest, ignore, whatIf) {
    Ensure.argNotNull(fromPath, "fromPath");
    Ensure.argNotNull(toPath, "toPath");
    Ensure.argNotNull(nextManifestPath, "nextManifestPath");
    if(ignoreManifest) {
        previousManifestPath = null;
    }
    var from = new DirectoryInfo(fromPath, fromPath);
    var to = new DirectoryInfo(toPath, toPath);
    if(!from.exists()) {
        return Q.reject(new Error("From directory doesn't exist"));
    }
    if(from.isSubdirectoryOf(to) || to.isSubdirectoryOf(from)) {
        return Q.reject(new Error("Source and destination directories cannot be sub-directories of each other"));
    }
    var nextManifest = new Manifest();
    var ignoreList = parseIgnoreList(ignore);
    log("Kudu sync from: '" + from.path() + "' to: '" + to.path() + "'");
    return Manifest.load(previousManifestPath).then(function (manifest) {
        return kuduSyncDirectory(from, to, from.path(), to.path(), targetSubFolder, manifest, nextManifest, ignoreManifest, ignoreList, whatIf);
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
            log("Ignoring: " + relativePath);
            return true;
        }
    }
    return false;
}
function copyFile(fromFile, toFilePath, whatIf) {
    Ensure.argNotNull(fromFile, "fromFile");
    Ensure.argNotNull(toFilePath, "toFilePath");
    log("Copying file: '" + fromFile.relativePath() + "'");
    if(!whatIf) {
        return Utils.attempt(function () {
            var promise = copyFileInternal(fromFile, toFilePath);
            promise = promise.then(function () {
                return Q.nfcall(fs.utimes, toFilePath, new Date(), fromFile.modifiedTime());
            }, null);
            return promise;
        });
    }
    return Q.resolve();
}
function copyFileInternal(fromFile, toFilePath) {
    var deffered = Q.defer();
    try  {
        var readStream = fs.createReadStream(fromFile.path());
        var writeStream = fs.createWriteStream(toFilePath);
        readStream.pipe(writeStream);
        readStream.on("error", deffered.reject);
        writeStream.on("error", deffered.reject);
        writeStream.on("close", deffered.resolve);
    } catch (err) {
        deffered.reject(err);
    }
    return deffered.promise;
}
function deleteFile(file, manifest, rootPath, targetSubFolder, ignoreManifest, whatIf) {
    Ensure.argNotNull(file, "file");
    var path = file.path();
    if(ignoreManifest || manifest.isPathInManifest(file.path(), rootPath, targetSubFolder)) {
        log("Deleting file: '" + file.relativePath() + "'");
        if(!whatIf) {
            return Utils.attempt(function () {
                return Q.nfcall(fs.unlink, path);
            });
        }
    }
    return Q.resolve();
}
function deleteDirectoryRecursive(directory, manifest, rootPath, targetSubFolder, ignoreManifest, whatIf) {
    Ensure.argNotNull(directory, "directory");
    var path = directory.path();
    var relativePath = directory.relativePath();
    if(!ignoreManifest && !manifest.isPathInManifest(path, rootPath, targetSubFolder)) {
        return Q.resolve();
    }
    return Utils.serialize(function () {
        return directory.initializeFilesAndSubDirectoriesLists();
    }, function () {
        return Utils.mapSerialized(directory.filesList(), function (file) {
            return deleteFile(file, manifest, rootPath, targetSubFolder, ignoreManifest, whatIf);
        });
    }, function () {
        return Utils.mapSerialized(directory.subDirectoriesList(), function (subDir) {
            return deleteDirectoryRecursive(subDir, manifest, rootPath, targetSubFolder, ignoreManifest, whatIf);
        });
    }, function () {
        return directory.updateFilesAndSubDirectoriesLists();
    }, function () {
        var filesCount = directory.filesList().length + directory.subDirectoriesList().length;
        if(filesCount > 0) {
            return Q.resolve();
        }
        log("Deleting directory: '" + relativePath + "'");
        if(!whatIf) {
            return Utils.attempt(function () {
                return Q.nfcall(fs.rmdir, path);
            });
        }
        return Q.resolve();
    });
}
function kuduSyncDirectory(from, to, fromRootPath, toRootPath, targetSubFolder, manifest, outManifest, ignoreManifest, ignoreList, whatIf) {
    Ensure.argNotNull(from, "from");
    Ensure.argNotNull(to, "to");
    Ensure.argNotNull(fromRootPath, "fromRootPath");
    Ensure.argNotNull(toRootPath, "toRootPath");
    Ensure.argNotNull(manifest, "manifest");
    Ensure.argNotNull(outManifest, "outManifest");
    try  {
        if(shouldIgnore(from.path(), fromRootPath, ignoreList)) {
            return Q.resolve();
        }
        if(!pathUtil.relative(from.path(), toRootPath)) {
            return Q.resolve();
        }
        if(from.path() != fromRootPath) {
            outManifest.addFileToManifest(from.path(), fromRootPath, targetSubFolder);
        }
        return Utils.serialize(function () {
            if(!whatIf) {
                return to.ensureCreated();
            }
            return Q.resolve();
        }, function () {
            return to.initializeFilesAndSubDirectoriesLists();
        }, function () {
            return from.initializeFilesAndSubDirectoriesLists();
        }, function () {
            return Utils.mapParallelized(5, from.filesList(), function (fromFile) {
                if(shouldIgnore(fromFile.path(), fromRootPath, ignoreList)) {
                    return Q.resolve();
                }
                outManifest.addFileToManifest(fromFile.path(), fromRootPath, targetSubFolder);
                var toFile = to.getFile(fromFile.name());
                if(toFile == null || !fromFile.equals(toFile)) {
                    return copyFile(fromFile, pathUtil.join(to.path(), fromFile.name()), whatIf);
                }
                return Q.resolve();
            });
        }, function () {
            return Utils.mapSerialized(to.filesList(), function (toFile) {
                if(shouldIgnore(toFile.path(), toRootPath, ignoreList)) {
                    return Q.resolve();
                }
                if(!from.getFile(toFile.name())) {
                    return deleteFile(toFile, manifest, toRootPath, targetSubFolder, ignoreManifest, whatIf);
                }
                return Q.resolve();
            });
        }, function () {
            return Utils.mapSerialized(to.subDirectoriesList(), function (toSubDirectory) {
                if(!from.getSubDirectory(toSubDirectory.name())) {
                    return deleteDirectoryRecursive(toSubDirectory, manifest, toRootPath, targetSubFolder, ignoreManifest, whatIf);
                }
                return Q.resolve();
            });
        }, function () {
            return Utils.mapSerialized(from.subDirectoriesList(), function (fromSubDirectory) {
                var toSubDirectory = new DirectoryInfo(pathUtil.join(to.path(), fromSubDirectory.name()), toRootPath);
                return kuduSyncDirectory(fromSubDirectory, toSubDirectory, fromRootPath, toRootPath, targetSubFolder, manifest, outManifest, ignoreManifest, ignoreList, whatIf);
            });
        });
    } catch (err) {
        return Q.reject(err);
    }
}
function main() {
    var commander = require("commander");
    var package = require("../package.json");
    var path = require("path");
    commander.version(package.version).usage("[options]").option("-f, --fromDir <dir path>", "Source directory to sync").option("-t, --toDir <dir path>", "Destination directory to sync").option("-s, --targetSubFolder <dir path>", "A relative sub folder in the destination to create and copy files to").option("-n, --nextManifest <manifest file path>", "Next manifest file path").option("-p, --previousManifest [manifest file path]", "Previous manifest file path").option("-x, --ignoreManifest", "Disables the processing of the manifest file").option("-i, --ignore [patterns]", "List of files/directories to ignore and not sync, delimited by ;").option("-q, --quiet", "No logging").option("-v, --verbose [maxLines]", "Verbose logging with maximum number of output lines").option("-w, --whatIf", "Only log without actual copy/remove of files").option("--perf", "Print out the time it took to complete KuduSync operation").parse(process.argv);
    var commanderValues = commander;
    var fromDir = commanderValues.fromDir;
    var toDir = commanderValues.toDir;
    var targetSubFolder = commanderValues.targetSubFolder;
    var previousManifest = commanderValues.previousManifest;
    var nextManifest = commanderValues.nextManifest;
    var ignoreManifest = commanderValues.ignoreManifest;
    var ignore = commanderValues.ignore;
    var quiet = commanderValues.quiet;
    var verbose = commanderValues.verbose;
    var whatIf = commanderValues.whatIf;
    var perf = commanderValues.perf;
    if(quiet && verbose) {
        console.log("Error: Cannot use --quiet and --verbose arguments together");
        process.exit(1);
        return;
    }
    if(!fromDir || !toDir || !nextManifest) {
        console.log("Error: Missing required argument");
        commander.help();
        process.exit(1);
        return;
    }
    if(quiet) {
        log = function () {
        };
    }
    if(targetSubFolder) {
        toDir = path.join(toDir, targetSubFolder);
    }
    var counter = 0;
    var nextLogTime = null;
    if(verbose && verbose > 0) {
        log = function (msg) {
            var updateLogTime = false;
            if(counter < verbose) {
                console.log(msg);
            } else {
                if(counter == verbose) {
                    console.log("Omitting next output lines...");
                    updateLogTime = true;
                } else {
                    if(new Date().getTime() >= nextLogTime.getTime()) {
                        console.log("Processed " + (counter - 1) + " files...");
                        updateLogTime = true;
                    }
                }
            }
            if(updateLogTime) {
                var currentDate = new Date();
                nextLogTime = new Date(currentDate.getTime() + 20000);
            }
            counter++;
        };
    }
    var start = new Date();
    kuduSync(fromDir, toDir, targetSubFolder, nextManifest, previousManifest, ignoreManifest, ignore, whatIf).then(function () {
        if(perf) {
            var stop = new Date();
            console.log("Operation took " + ((stop.getTime() - start.getTime()) / 1000) + " seconds");
        }
        process.exit(0);
    }, function (err) {
        if(err) {
            console.log("" + err);
        }
        process.exit(1);
    });
}
exports.main = main;
