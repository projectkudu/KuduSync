///<reference path='utils.ts'/>

class FileInfoBase {
    private _name: string;
    private _path: string;

    constructor (path: string) {
        Ensure.argNotNull(path, "path");

        this._path = path;
        this._name = pathUtil.relative(pathUtil.dirname(path), path);
    }

    name(): string {
        return this._name;
    }

    path(): string {
        return this._path;
    }

    exists(): string {
        return fs.existsSync(this.path());
    }
}
