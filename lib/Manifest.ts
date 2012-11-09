///<reference path='fileInfoBase.ts'/>

class Manifest {

    private _files: string[];
    private _isEmpty: bool;

    constructor () {
        this._files = new string[];
        this._isEmpty = true;
    }

    static load(manifestPath: string, callback: (err, manifest) => void) {
        var manifest = new Manifest();

        if (manifestPath == null) {
            callback(null, manifest);
            return;
        }

        fs.readFile(manifestPath, 'utf8', (err, content) => {
            if (err) {
                // If failed on file not found (34), return an empty manifest
                if (err.errno == 34) {
                    callback(null, manifest)
                }
                else {
                    callback(err, null);
                }

                return;
            }

            var filePaths = content.split("\n");
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

            callback(null, manifest);
        });
    }

    static save(manifest: Manifest, manifestPath: string, callback: (err) => void) {
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

        fs.writeFile(manifestPath, manifestFileContent, 'utf8', callback);
    }

    isPathInManifest(path: string, rootPath: string) {
        Ensure.argNotNull(path, "path");
        Ensure.argNotNull(rootPath, "rootPath");

        var relativePath = pathUtil.relative(rootPath, path);
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
