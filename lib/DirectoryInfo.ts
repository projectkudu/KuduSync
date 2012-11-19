///<reference path='fileInfo.ts'/>

class DirectoryInfo extends FileInfoBase {
    private _filesMapping: FileInfo[];
    private _subDirectoriesMapping: DirectoryInfo[];
    private _filesList: FileInfo[];
    private _subDirectoriesList: DirectoryInfo[];

    constructor (path: string) {
        super(path);

        this._filesMapping = [];
        this._subDirectoriesMapping = [];
        this._filesList = [];
        this._subDirectoriesList = [];
    }

    ensureCreated() : Promise {
        if (!this.exists()) {
            return this.parent().ensureCreated().then(() => {
                return Utils.attempt(() => Q.ncall(fs.mkdir, fs, this.path()));
            });
        }
        return Q.resolve();
    }

    parent(): DirectoryInfo {
        return new DirectoryInfo(pathUtil.dirname(this.path()));
    }

    initializeFilesAndSubDirectoriesLists() {
        var self = this;

        var filesMapping = new FileInfo[];
        var filesList = new FileInfo[];
        var subDirectoriesMapping = new DirectoryInfo[];
        var subDirectoriesList = new DirectoryInfo[];

        // TODO: Add retry here.
        if (this.exists()) {
            var files = fs.readdirSync(this.path());
            files.forEach(
                function (fileName: string) {
                    var path = pathUtil.join(self.path(), fileName);
                    var stat = fs.statSync(path);

                    if (stat.isDirectory()) {
                        // Store both as mapping as an array
                        subDirectoriesMapping[fileName] = new DirectoryInfo(path);
                        subDirectoriesList.push(subDirectoriesMapping[fileName]);
                    }
                    else {
                        // Store both as mapping as an array
                        filesMapping[fileName] = new FileInfo(path, stat.mtime);
                        filesList.push(filesMapping[fileName]);
                    }
                }
            );
        }

        this._filesMapping = filesMapping;
        this._subDirectoriesMapping = subDirectoriesMapping;
        this._filesList = filesList;
        this._subDirectoriesList = subDirectoriesList;
    }

    filesMapping() {
        return this._filesMapping;
    }

    subDirectoriesMapping() {
        return this._subDirectoriesMapping;
    }

    filesList() {
        return this._filesList;
    }

    subDirectoriesList() {
        return this._subDirectoriesList;
    }
}
