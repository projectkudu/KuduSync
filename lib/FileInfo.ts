///<reference path='fileInfoBase.ts'/>

class FileInfo extends FileInfoBase {
    private _fileStat: FileStat;

    constructor (path: string, fileStat: FileStat) {
        super(path);

        Ensure.argNotNull(fileStat, "fileStat");

        this._fileStat = fileStat;
    }

    modifiedTime() {
        return this._fileStat.mtime;
    }

    size() {
        return this._fileStat.size;
    }

    equals(otherFile: FileInfo): bool {
        if (this._fileStat == null || otherFile._fileStat == null || this.modifiedTime() == null || otherFile.modifiedTime() == null) {
            return false;
        }

        return this.modifiedTime().getTime() === otherFile.modifiedTime().getTime() &&
            this.size() === otherFile.size();
    }
}
