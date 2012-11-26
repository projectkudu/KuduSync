///<reference path='fileInfoBase.ts'/>

class Manifest {

    private _files: string[];
    private _isEmpty: bool;

    constructor () {
        this._files = new string[];
        this._isEmpty = true;
    }

    static load(manifestPath: string) {
        var manifest = new Manifest();

        if (manifestPath == null) {
            return Q.resolve(manifest);
        }
        
        return Q.nfcall(fs.readFile, manifestPath, 'utf8').then(
            function(content?) {
                var filePaths = content.split("\n");
                var files = new string[];
                filePaths.forEach(
                    function (filePath) {
                        var file = filePath.trim();
                        if (file != "") {
                            files[file] = file;
                        }
                    }
                );
                manifest._isEmpty = false;
                manifest._files = files;
                return Q.resolve(manifest);
            },
            function(err?) {
                // If failed on file not found (34), return an empty manifest
                if (err.errno == 34) {
                    return Q.resolve(manifest);
                }
                else {
                    return Q.reject(err);
                }
            });
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
        return Q.nfcall(fs.writeFile, manifestPath, manifestFileContent, 'utf8');
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
