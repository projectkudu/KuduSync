///<reference path='fileInfo.ts'/>

class DirectoryInfo extends FileInfoBase {
    private _filesMapping: FileInfo[];
    private _subDirectoriesMapping: DirectoryInfo[];
    private _filesList: FileInfo[];
    private _subDirectoriesList: DirectoryInfo[];
    private _initialized: bool;

    constructor (path: string) {
        super(path);

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
        return new DirectoryInfo(pathUtil.dirname(this.path()));
    }

    initializeFilesAndSubDirectoriesLists() : Promise {
        var filesMapping = new FileInfo[];
        var filesList = new FileInfo[];
        var subDirectoriesMapping = new DirectoryInfo[];
        var subDirectoriesList = new DirectoryInfo[];

        if (!this._initialized && this.exists()) {
            return Utils.attempt(() => {
                try {
                    var files = fs.readdirSync(this.path());
                    files.forEach((fileName: string) => {
                            var path = pathUtil.join(this.path(), fileName);
                            var stat = fs.statSync(path);

                            if (stat.isDirectory()) {
                                // Store both as mapping as an array
                                var directoryInfo = new DirectoryInfo(path);
                                subDirectoriesMapping[fileName.toUpperCase()] = directoryInfo;
                                subDirectoriesList.push(directoryInfo);
                            }
                            else {
                                // Store both as mapping as an array
                                var fileInfo = new FileInfo(path, stat);
                                filesMapping[fileName.toUpperCase()] = fileInfo;
                                filesList.push(fileInfo);
                            }
                        }
                    );

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
