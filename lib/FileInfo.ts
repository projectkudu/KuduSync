///<reference path='fileInfoBase.ts'/>

class FileInfo extends FileInfoBase {
    private _modifiedTime: Date;

    constructor (path: string, modifiedTime: Date) {
        super(path);

        Ensure.argNotNull(modifiedTime, "modifiedTime");

        this._modifiedTime = modifiedTime;
    }

    getModifiedTime() {
        return this._modifiedTime;
    }
}
