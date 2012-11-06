var fs = require('fs');
var pathUtil = require('path');
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
    DirectoryInfo.prototype.ensureCreated = function () {
        if(!this.exists()) {
            fs.mkdirSync(this.path());
        }
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
                } else {
                    fileInfos[fileName] = new FileInfo(path, stat.mtime);
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
            return manifest;
        }
        try  {
            var filePaths = fs.readFileSync(manifestPath, 'utf8').split("\n");
            var files = new Array();
            filePaths.forEach(function (filePath) {
                var file = filePath.trim();
                if(file != "") {
                    files[file] = file;
                    manifest._isEmpty = false;
                }
            });
            manifest._files = files;
        } catch (e) {
        }
        return manifest;
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
        fs.writeFileSync(manifestPath, manifestFileContent, 'utf8');
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
    kuduSyncDirectory(from, to, from.path(), to.path(), Manifest.load(previousManifestPath), nextManifest, whatIf);
    if(!whatIf) {
        Manifest.save(nextManifest, nextManifestPath);
    }
}
exports.kuduSync = kuduSync;
function copyFile(fromFile, toFilePath, whatIf) {
    Ensure.argNotNull(fromFile, "fromFile");
    Ensure.argNotNull(toFilePath, "toFilePath");
    log("Copy file from: " + fromFile.path() + " to: " + toFilePath);
    if(!whatIf) {
        fs.createReadStream(fromFile.path()).pipe(fs.createWriteStream(toFilePath));
    }
}
function deleteFile(file, whatIf) {
    Ensure.argNotNull(file, "file");
    var path = file.path();
    log("Deleting file: " + path);
    if(!whatIf) {
        fs.unlinkSync(path);
    }
}
function deleteDirectoryRecursive(directory, whatIf) {
    Ensure.argNotNull(directory, "directory");
    var path = directory.path();
    log("Deleting directory: " + path);
    var files = directory.files();
    for(var fileKey in files) {
        var file = files[fileKey];
        deleteFile(file, whatIf);
    }
    var subDirectories = directory.subDirectories();
    for(var subDirectoryKey in subDirectories) {
        var subDirectory = subDirectories[subDirectoryKey];
        deleteDirectoryRecursive(subDirectory, whatIf);
    }
    if(!whatIf) {
        fs.rmdirSync(path);
    }
}
function kuduSyncDirectory(from, to, fromRootPath, toRootPath, manifest, outManifest, whatIf) {
    Ensure.argNotNull(from, "from");
    Ensure.argNotNull(to, "to");
    Ensure.argNotNull(fromRootPath, "fromRootPath");
    Ensure.argNotNull(toRootPath, "toRootPath");
    Ensure.argNotNull(manifest, "manifest");
    Ensure.argNotNull(outManifest, "outManifest");
    if(from.isSourceControl()) {
        return;
    }
    if(!whatIf) {
        to.ensureCreated();
    }
    var fromFiles = from.files();
    var toFiles = getFilesConsiderWhatIf(to, whatIf);
    for(var toFileKey in toFiles) {
        var toFile = toFiles[toFileKey];
        if(!fromFiles[toFile.name()]) {
            if(manifest.isEmpty() || manifest.isPathInManifest(toFile.path(), toRootPath)) {
                deleteFile(toFile, whatIf);
            }
        }
    }
    for(var fromFileKey in fromFiles) {
        var fromFile = fromFiles[fromFileKey];
        outManifest.addFileToManifest(fromFile.path(), fromRootPath);
        var toFile = toFiles[fromFile.name()];
        if(toFile == null || fromFile.modifiedTime() > toFile.modifiedTime()) {
            copyFile(fromFile, pathUtil.join(to.path(), fromFile.name()), whatIf);
        }
    }
    var fromSubDirectories = from.subDirectories();
    var toSubDirectories = getSubDirectoriesConsiderWhatIf(to, whatIf);
    for(var toSubDirectoryKey in toSubDirectories) {
        var toSubDirectory = toSubDirectories[toSubDirectoryKey];
        if(!fromSubDirectories[toSubDirectory.name()]) {
            if(manifest.isEmpty() || manifest.isPathInManifest(toSubDirectory.path(), toRootPath)) {
                deleteDirectoryRecursive(toSubDirectory, whatIf);
            }
        }
    }
    for(var fromSubDirectoryKey in fromSubDirectories) {
        var fromSubDirectory = fromSubDirectories[fromSubDirectoryKey];
        outManifest.addFileToManifest(fromSubDirectory.path(), fromRootPath);
        var toSubDirectory = new DirectoryInfo(pathUtil.join(to.path(), fromSubDirectory.name()));
        kuduSyncDirectory(fromSubDirectory, toSubDirectory, fromRootPath, toRootPath, manifest, outManifest, whatIf);
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
var commander = require("commander");
commander.version("0.0.1").option("-f, --fromDir [dir path]", "Source directory to sync (* required)").option("-t, --toDir [dir path]", "Destination directory to sync (* required)").option("-p, --previousManifest [manifest file path]", "Previous manifest file path (* required)").option("-n, --nextManifest [manifest file path]", "Next manifest file path (optional)").option("-q, --quiet", "No logging").option("-w, --whatIf", "Only log without actual copy/remove of files").parse(process.argv);
try  {
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
    kuduSync(fromDir, toDir, nextManifest, previousManifest, whatIf);
} catch (e) {
    console.log("" + e);
    process.exit(1);
}
