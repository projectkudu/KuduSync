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
}

function fileEquals(file1: FileInfo, file2: FileInfo) {
    if (file1 == null) {
        return file2 == null;
    }

    if (file1.modifiedTime() == null) {
        return file2.modifiedTime() == null;
    }

    return
        file2 != null &&
        file2.modifiedTime() != null &&
        file1.modifiedTime().getTime() === file2.modifiedTime().getTime() &&
        file1.size === file2.size;
}
