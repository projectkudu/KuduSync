///<reference path='FileInfoBase.ts'/>

class FileInfo extends FileInfoBase {
    private _size;
    private _modifiedTime: Date;

    constructor (path: string, rootPath: string, size: any, modifiedTime: any) {
        super(path, rootPath);
        Ensure.argNotNull(size, "size");
        Ensure.argNotNull(modifiedTime, "modifiedTime");

        this._size = size;
        this._modifiedTime = new Date(modifiedTime);
    }

    modifiedTime() {
        return this._modifiedTime;
    }

    size() {
        return this._size;
    }

    equals(otherFile: FileInfo): bool {
        if (this.modifiedTime() == null || otherFile.modifiedTime() == null) {
            return false;
        }

        return this.modifiedTime().getTime() === otherFile.modifiedTime().getTime() &&
            this.size() === otherFile.size();
    }
}
