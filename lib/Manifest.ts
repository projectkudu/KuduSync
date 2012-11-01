///<reference path='fileInfoBase.ts'/>

class Manifest {

    private _files: string[];
    private _isEmpty: bool;

    constructor () {
        this._files = new string[];
        this._isEmpty = true;
    }

    static load(manifestPath: string) {
        Ensure.argNotNull(manifestPath, "manifestPath");

        var manifest = new Manifest();

        try {
            var filePaths = fs.readFileSync(manifestPath, 'utf8').split("\n");
            var files = new string[];
            filePaths.forEach(
                function (filePath) {
                    var file = filePath.trim();
                    if (file != "") {
                        files[file] = file;
                        manifest._isEmpty = false;
                    }
                }
            );

            manifest._files = files;
        }
        catch (e) {
            // TODO: handle failures
        }

        return manifest;
    }

    static save(manifest: Manifest, manifestPath: string) {
        Ensure.argNotNull(manifest, "manifest");
        Ensure.argNotNull(manifestPath, "manifestPath");

        var manifestFileContent = "";
        var filesForOutput = new string[];

        var i = 0;
        for (var file in manifest._files) {
            filesForOutput[i] = file;
            i++
        }

        var manifestFileContent = filesForOutput.join("\n");

        fs.writeFileSync(manifestPath, manifestFileContent, 'utf8');
    }

    isPathInManifest(path: string, rootPath: string) {
        Ensure.argNotNull(path, "path");
        Ensure.argNotNull(rootPath, "rootPath");

        var relativePath = pathUtil.relative(rootPath, path);
        // console.log("isPathInManifest: " + this._files[relativePath] + " " + this._files[relativePath] != null);
        return this._files[relativePath] != null;
    }

    addFileToManifest(path: string, rootPath: string) {
        Ensure.argNotNull(path, "path");
        Ensure.argNotNull(rootPath, "rootPath");

        var relativePath = pathUtil.relative(rootPath, path);
        this._files[relativePath] = relativePath;
    }

    isEmpty() {
        return this._isEmpty;
    }
}
