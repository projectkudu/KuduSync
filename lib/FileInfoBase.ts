///<reference path='ensure.ts'/>

class FileInfoBase {
    private _name: string;
    private _path: string;

    constructor (path: string) {
        Ensure.argNotNull(path, "path");

        this._path = path;
        this._name = pathUtil.relative(pathUtil.dirname(path), path);
    }

    getName(): string {
        return this._name;
    }

    getPath(): string {
        return this._path;
    }

    exists(): string {
        return fs.existsSync(this.getPath());
    }
}
