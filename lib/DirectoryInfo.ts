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

    ensureCreated(callback: (err) => void) {
        if (!this.exists()) {
            this.parent().ensureCreated((err) => {
                if (err) {
                    callback(err);
                    return;
                }

                attempt(
                    (attemptCallback) => fs.mkdir(this.path(), attemptCallback),
                    callback);
            });
            return;
        }

        callback(null);
    }

    parent(): DirectoryInfo {
        return new DirectoryInfo(pathUtil.dirname(this.path()));
    }

    private ensureFilesDirectories() {
        var self = this;

        if (this._files === null || this._directories === null) {
            var fileInfos = new FileInfo[];
            var directoryInfos = new DirectoryInfo[];

            // TODO: Add retry here.
            var files = fs.readdirSync(this.path());
            files.forEach(
                function (fileName: string) {
                    var path = pathUtil.join(self.path(), fileName);
                    var stat = fs.statSync(path);

                    if (stat.isDirectory()) {
                        directoryInfos[fileName] = new DirectoryInfo(path);
                    }
                    else {
                        fileInfos[fileName] = new FileInfo(path, stat.mtime);
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
