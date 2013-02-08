///<reference path='fileInfo.ts'/>

var listDir: (path: string) => any[] = null;

try {
    listDir = require("../ext/fsx_win32").listDir;
    console.log("Using fsx_win32");
}
catch (e) {
}

if (listDir == null) {
    listDir = function (path: string) {
        var files = fs.readdirSync(path);
        return Utils.map(files, (fileName) => {
            var filePath = pathUtil.join(path, fileName);
            var stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                var result: any = {
                    fileName: fileName,
                    isDirectory: true
                };
                return result;
            }
            else {
                var result: any = {
                    fileName: fileName,
                    size: stat.size,
                    modifiedTime: stat.mtime
                };
                return result;
            }
        });
    }
}

class DirectoryInfo extends FileInfoBase {
    private _filesMapping: FileInfo[];
    private _subDirectoriesMapping: DirectoryInfo[];
    private _filesList: FileInfo[];
    private _subDirectoriesList: DirectoryInfo[];
    private _initialized: bool;

    constructor (path: string, rootPath: string) {
        super(path, rootPath);

        this._filesMapping = [];
        this._subDirectoriesMapping = [];
        this._filesList = [];
        this._subDirectoriesList = [];
        this._initialized = false;
    }

    ensureCreated() : Promise {
        if (!this.exists()) {
            var promise = this.parent().ensureCreated();

            promise = promise.then(() => {
                return Utils.attempt(() => Q.nfcall(fs.mkdir, this.path()));
            });

            promise = promise.then(() => {
                this.setExists(true);
                this._initialized = true;
            });

            return promise;
        }

        return Q.resolve();
    }

    parent(): DirectoryInfo {
        return new DirectoryInfo(pathUtil.dirname(this.path()), this.rootPath());
    }

    initializeFilesAndSubDirectoriesLists(): Promise {
        var filesMapping = new FileInfo[];
        var filesList = new FileInfo[];
        var subDirectoriesMapping = new DirectoryInfo[];
        var subDirectoriesList = new DirectoryInfo[];

        if (!this._initialized && this.exists()) {
            return Utils.attempt(() => {
                try {
                    var files = listDir(this.path());
                    files.forEach((file: any) => {
                        var path = pathUtil.join(this.path(), file.fileName);

                        if (file.fileName !== "." && file.fileName !== "..") {
                            if (file.isDirectory) {
                                // Store both as mapping as an array
                                var directoryInfo = new DirectoryInfo(path, this.rootPath());
                                directoryInfo.setExists(true);
                                subDirectoriesMapping[file.fileName.toUpperCase()] = directoryInfo;
                                subDirectoriesList.push(directoryInfo);
                            } else {
                                // Store both as mapping as an array
                                var fileInfo = new FileInfo(path, this.rootPath(), file.size, file.modifiedTime);
                                filesMapping[file.fileName.toUpperCase()] = fileInfo;
                                filesList.push(fileInfo);
                            }
                        }
                    });

                    this._filesMapping = filesMapping;
                    this._subDirectoriesMapping = subDirectoriesMapping;
                    this._filesList = filesList;
                    this._subDirectoriesList = subDirectoriesList;

                    this._initialized = true;

                    return Q.resolve();
                }
                catch (err) {
                    return Q.reject(err);
                }
            });
        }

        return Q.resolve();
    }

    getFile(fileName: string): FileInfo {
        Ensure.argNotNull(fileName, "fileName");

        return this._filesMapping[fileName.toUpperCase()];
    }

    getSubDirectory(subDirectoryName: string): DirectoryInfo {
        Ensure.argNotNull(subDirectoryName, "subDirectoryName");

        return this._subDirectoriesMapping[subDirectoryName.toUpperCase()];
    }

    filesList() {
        return this._filesList;
    }

    subDirectoriesList() {
        return this._subDirectoriesList;
    }
}
