///<reference path='Utils.ts'/>

class FileInfoBase {
    private _name: string;
    private _path: string;
    private _rootPath: string;
    private _exists: bool;

    constructor (path: string, rootPath: string) {
        Ensure.argNotNull(path, "path");

        this._path = path;
        this._rootPath = rootPath;
        this._name = pathUtil.relative(pathUtil.dirname(path), path);
    }

    name(): string {
        return this._name;
    }

    path(): string {
        return this._path;
    }

    rootPath(): string {
        return this._rootPath;
    }

    relativePath(): string {
        return pathUtil.relative(this._rootPath, this._path);
    }

    exists(): bool {
        if (!this._exists) {
            this._exists = fs.existsSync(this.path());
        }
        return this._exists;
    }

    setExists(val: bool) {
        this._exists = val;
    }
}
