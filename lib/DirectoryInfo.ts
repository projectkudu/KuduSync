///<reference path='fileInfo.ts'/>

class DirectoryInfo extends FileInfoBase {
    private _files: FileInfo[];
    private _directories: DirectoryInfo[];

    constructor (path: string) {
        super(path);

        this._files = null;
        this._directories = null;
    }

    isSourceControl() {
        return this.name().indexOf(".git") == 0;
    }

    ensureCreated() {
        if (!this.exists()) {
            fs.mkdirSync(this.path());
        }
    }

    private ensureFilesDirectories() {
        var self = this;

        if (this._files === null || this._directories === null) {
            var fileInfos = new FileInfo[];
            var directoryInfos = new DirectoryInfo[];

            var files = fs.readdirSync(this.path());
            files.forEach(
                function (fileName) {
                    var path = pathUtil.join(self.path(), fileName);
                    var stat = fs.statSync(path);

                    if (stat.isDirectory()) {
                        directoryInfos[fileName] = new DirectoryInfo(path);
                    }
                    else {
                        fileInfos[fileName] = new FileInfo(path, stat);
                    }
                }
            );

            this._files = fileInfos;
            this._directories = directoryInfos;
        }
    }

    files() {
        this.ensureFilesDirectories();
        return this._files;
    }

    subDirectories() {
        this.ensureFilesDirectories();
        return this._directories;
    }
}
