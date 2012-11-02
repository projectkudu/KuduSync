var fs = require('fs');
var pathUtil = require('path');
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
                    fileInfos[fileName] = new FileInfo(path, stat);
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
        Ensure.argNotNull(manifestPath, "manifestPath");
        var manifest = new Manifest();
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
function smartCopy(fromPath, toPath, previousManifestPath, currentManifestPath) {
    Ensure.argNotNull(fromPath, "fromPath");
    Ensure.argNotNull(toPath, "toPath");
    Ensure.argNotNull(previousManifestPath, "manifestPath");
    var from = new DirectoryInfo(fromPath);
    var to = new DirectoryInfo(toPath);
    var currentManifest = new Manifest();
    smartCopyDirectory(from, to, from.path(), to.path(), Manifest.load(previousManifestPath), currentManifest);
    Manifest.save(currentManifest, currentManifestPath);
}
function simpleCopy(fromFile, toFilePath) {
    Ensure.argNotNull(fromFile, "fromFile");
    Ensure.argNotNull(toFilePath, "toFilePath");
    fs.createReadStream(fromFile.path()).pipe(fs.createWriteStream(toFilePath));
}
function deleteFile(file) {
    Ensure.argNotNull(file, "file");
    fs.unlinkSync(file.path());
}
function deleteDirectoryRecursive(directory) {
    Ensure.argNotNull(directory, "directory");
    var files = directory.files();
    for(var fileKey in files) {
        var file = files[fileKey];
        deleteFile(file);
    }
    var subDirectories = directory.subDirectories();
    for(var subDirectoryKey in subDirectories) {
        var subDirectory = subDirectories[subDirectoryKey];
        deleteDirectoryRecursive(subDirectory);
    }
    fs.rmdirSync(directory.path());
}
function smartCopyDirectory(from, to, fromRootPath, toRootPath, manifest, outManifest) {
    Ensure.argNotNull(from, "from");
    Ensure.argNotNull(to, "to");
    Ensure.argNotNull(fromRootPath, "fromRootPath");
    Ensure.argNotNull(toRootPath, "toRootPath");
    Ensure.argNotNull(manifest, "manifest");
    Ensure.argNotNull(outManifest, "outManifest");
    if(from.isSourceControl()) {
        return;
    }
    to.ensureCreated();
    var fromFiles = from.files();
    var toFiles = to.files();
    for(var toFileKey in toFiles) {
        var toFile = toFiles[toFileKey];
        var toFilePath = toFile.getPath();
        if(!fromFiles[toFilePath]) {
            if(manifest.isEmpty() || manifest.isPathInManifest(toFilePath, toRootPath)) {
                deleteFile(toFile);
            }
        }
    }
    for(var fromFileKey in fromFiles) {
        var fromFile = fromFiles[fromFileKey];
        outManifest.addFileToManifest(fromFile.getPath(), fromRootPath);
        var toFile = toFiles[fromFile.getName()];
        if(toFile == null || fromFile.getModifiedTime() > toFile.getModifiedTime()) {
            simpleCopy(fromFile, pathUtil.join(to.path(), fromFile.getName()));
        }
    }
    var fromSubDirectories = from.subDirectories();
    var toSubDirectories = to.subDirectories();
    for(var toSubDirectoryKey in toSubDirectories) {
        var toSubDirectory = toSubDirectories[toSubDirectoryKey];
        var toSubDirectoryPath = toSubDirectory.getPath();
        if(!fromSubDirectories[toSubDirectoryPath]) {
            if(manifest.isEmpty() || manifest.isPathInManifest(toSubDirectoryPath, toRootPath)) {
                deleteDirectoryRecursive(toSubDirectory);
            }
        }
    }
    for(var fromSubDirectoryKey in fromSubDirectories) {
        var fromSubDirectory = fromSubDirectories[fromSubDirectoryKey];
        outManifest.addFileToManifest(fromSubDirectory.getPath(), fromRootPath);
        var toSubDirectory = new DirectoryInfo(pathUtil.join(to.path(), fromSubDirectory.getName()));
        smartCopyDirectory(fromSubDirectory, toSubDirectory, fromRootPath, toRootPath, manifest, outManifest);
    }
}
if(process.argv.length != 6) {
    console.log("Usage: smartCopy [from directory path] [to directory path] [previous manifest file path] [current manifest file path]");
} else {
    var from = process.argv[2];
    var to = process.argv[3];
    var previousManifestPath = process.argv[4];
    var currentManifestPath = process.argv[5];
    smartCopy(from, to, previousManifestPath, currentManifestPath);
}
