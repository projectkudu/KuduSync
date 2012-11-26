// Functional tests using mocha and should.

// The tested module
var ks = require("../bin/kuduSync.js");

var should = require("should");
var fs = require("fs");
var pathUtil = require("path");

// Globals
var baseTestTempDir = "temp";
var fromDir = "from";
var toDir = "to";
var testDirBase = "test";
var testDirIndex = 0;
var testDir = "";

// Tests Suite
suite('Kudu Sync Functional Tests', function () {
    test('Single file should be sync\'d', function (done) {
        var testedFiles = ["file1"];
        runKuduSyncTestScenario(testedFiles, testedFiles, null, done); // Files to create, Files to expect
    });

    test('Single file with digit for file name should be sync\'d', function (done) {
        var testedFiles = ["5"];
        runKuduSyncTestScenario(testedFiles, testedFiles, null, done); // Files to create, Files to expect
    });

    test('Several files should be sync\'d', function (done) {
        var testedFiles = ["file1", "file2", "file3"];
        runKuduSyncTestScenario(testedFiles, testedFiles, null, done);
    });

    test('Several files and sub-directories should be sync\'d', function (done) {
        var testedFiles = ["file1", "file2", "dir1/file3", "dir1/dir2/dir3/file4", "dir1/dir2/dir3/file5", "dir2/file6.txt"];
        runKuduSyncTestScenario(testedFiles, testedFiles, null, done);
    });

    test('Single file updated should be sync\'d', function (done) {
        runKuduSyncTestScenario(["file1.bin"], ["file1.bin"], null, function () {

            // Waiting 1 second for updated file to have a newer modified time
            setTimeout(function () {
                runKuduSyncTestScenario(["file1.bin"], ["file1.bin"], null, done);
            }, 1000);
        });
    });

    test('Several files updated should be sync\'d', function (done) {
        runKuduSyncTestScenario(["file1.bin", "file2", "dir1/file3", "dir1/dir2/dir3/file4"], ["file1.bin", "file2", "dir1/file3", "dir1/dir2/dir3/file4"], null, function () {

            // Waiting 1 second for updated file to have a newer modified time
            setTimeout(function () {
                runKuduSyncTestScenario(["file2", "dir1/file3", "dir1/dir2/dir3/file5", "dir2/file6.txt"], ["file1.bin", "file2", "dir1/file3", "dir1/dir2/dir3/file4", "dir1/dir2/dir3/file5", "dir2/file6.txt"], null, done);
            }, 1000);
        });
    });

    test('Single file created then removed should be sync\'d', function (done) {
        runKuduSyncTestScenario(["file1"], ["file1"], null, function () {
            runKuduSyncTestScenario(["-file1"], ["-file1"], null, done);
        });
    });

    test('Several files some created some removed should be sync\'d', function (done) {
        runKuduSyncTestScenario(["file1.bin", "file2", "dir1/file3", "dir1/dir2/dir3/file4"], ["file1.bin", "file2", "dir1/file3", "dir1/dir2/dir3/file4"], null, function () {

            // Waiting 1 second for updated file to have a newer modified time
            setTimeout(function () {
                runKuduSyncTestScenario(["file2", "-dir1/file3", "-dir1/dir2/dir3/file4"], ["file1.bin", "file2", "-dir1/file3", "-dir1/dir2/dir3/file4"], null, done);
            }, 1000);
        });
    });

    test('Single file created then file created only in destination, new file should remain', function (done) {
        runKuduSyncTestScenario(["file1"], ["file1"], null, function () {

            // Generating a file only in the destination directory, this shouldn't be removed
            generateToFile("tofile");

            runKuduSyncTestScenario([], ["file1", "tofile"], null, done);
        });
    });

    test('Several files created then file created only in destination, new file should remain', function (done) {
        runKuduSyncTestScenario(["file1", "dir1/file2"], ["file1", "dir1/file2"], null, function () {

            // Generating files only in the destination directory, those files shouldn't be removed
            generateToFile("dir1/dir2/tofile1");
            generateToFile("dir1/dir2/tofile2");

            runKuduSyncTestScenario(["-file1"], ["-file1", "dir1/file2", "dir1/dir2/tofile1", "dir1/dir2/tofile2"], null, done);
        });
    });

    test('File created then removed (resulting in empty manifest) then added while target has an extra file which should stay', function (done) {
        runKuduSyncTestScenario(["file1"], ["file1"], null, function () {
            // Generating files only in the destination directory, those files shouldn't be removed
            generateToFile("tofile2");

            runKuduSyncTestScenario(["-file1"], ["-file1", "tofile2"], null, function () {

                runKuduSyncTestScenario(["file1"], ["file1", "tofile2"], null, done);
            });
        });
    });

    test('No previous manifest will clean target directory', function (done) {
        runKuduSyncTestScenario(["file1"], ["file1"], null, function () {
            // Generating files only in the destination directory, those files shouldn't be removed
            generateToFile("tofile2");

            runKuduSyncTestScenario(["-file1"], ["-file1", "tofile2"], null, function () {
                removeManifestFile();
                runKuduSyncTestScenario(["file1"], ["file1", "-tofile2"], null, done);
            });
        });
    });

    test('Several files should not be sync\'d with whatIf flag set to true', function (done) {
        runKuduSyncTestScenario(["file1", "file2", "file3"], [], null, done, /*whatIf*/true);
    });

    test('Several files and direcotires should not be sync\'d with whatIf flag set to true', function (done) {
        runKuduSyncTestScenario(["file1", "file2", "dir1/dir2/file3"], [], null, done, /*whatIf*/true);
    });

    test('From directory doesn\'t exists should fail', function (done) {
        var from = pathUtil.join(baseTestTempDir, testDir, fromDir + "aaa");
        var to = pathUtil.join(baseTestTempDir, testDir, toDir);
        var prevManifestPath = pathUtil.join(baseTestTempDir, testDir, "manifest1");
        var nextManifestPath = prevManifestPath;

        ks.kuduSync(from, to, nextManifestPath, prevManifestPath, null, true)
            .fail(function (err) {
                try {
                    should.exist(err);
                    done();
                }
                catch (e) {
                    done(e);
                }
            });
    });

    test('Ignore files (file2) should not copy them', function (done) {
        var testedFiles = ["file1", "file2", "file3"];
        var ignore = "file2";
        var expectedFiles = ["file1", "-file2", "file3"];
        runKuduSyncTestScenario(testedFiles, expectedFiles, ignore, done);
    });

    test('Ignore files (file*) should not copy them', function (done) {
        var testedFiles = ["file1", "file2", "file3", "bin/more/file4", "bin/more/gile5"];
        var ignore = "file*";
        var expectedFiles = ["-file1", "-file2", "-file3", "-bin/more/file4", "bin/more/gile5"];
        runKuduSyncTestScenario(testedFiles, expectedFiles, ignore, done);
    });

    test('Ignore files (bin/file*) should not copy them', function (done) {
        var testedFiles = ["file1", "bin/file2", "bin/gile3", "bin/more/file4"];
        var ignore = "bin/file*";
        var expectedFiles = ["file1", "-bin/file2", "bin/gile3", "bin/more/file4"];
        runKuduSyncTestScenario(testedFiles, expectedFiles, ignore, done);
    });

    test('Ignore files (bin/**) should not copy them', function (done) {
        var testedFiles = ["file1", "bin/file2", "bin/gile3", "bin/more/file4"];
        var ignore = "bin/**";
        var expectedFiles = ["file1", "-bin/file2", "-bin/gile3", "-bin/more/file4", "bin"];
        runKuduSyncTestScenario(testedFiles, expectedFiles, ignore, done);
    });

    test('Ignore files (bin) should not copy them', function (done) {
        var testedFiles = ["file1", "bin/file2", "bin/gile3", "bin/more/file4"];
        var ignore = "bin";
        var expectedFiles = ["file1", "-bin/file2", "-bin/gile3", "-bin/more/file4"];
        runKuduSyncTestScenario(testedFiles, expectedFiles, ignore, done);
    });

    test('Ignore files (file1) should not copy them', function (done) {
        var testedFiles = ["file1", "bin/file2", "bin/gile3", "bin/more/file4"];
        var ignore = "file1";
        var expectedFiles = ["-file1", "bin/file2", "bin/gile3", "bin/more/file4"];
        runKuduSyncTestScenario(testedFiles, expectedFiles, ignore, done);
    });

    test('Ignore files (file1;file2) should not copy them', function (done) {
        var testedFiles = ["file1", "bin/file2", "bin/file3", "bin/more/file4"];
        var ignore = "file1;file2";
        var expectedFiles = ["-file1", "-bin/file2", "bin/file3", "bin/more/file4"];
        runKuduSyncTestScenario(testedFiles, expectedFiles, ignore, done);
    });

    test('Ignore files (file1;bin/file3) should not copy them', function (done) {
        var testedFiles = ["file1", "bin/file2", "bin/file3", "bin/more/file4", "file5"];
        var ignore = "file1;bin/file3";
        var expectedFiles = ["-file1", "bin/file2", "-bin/file3", "bin/more/file4", "file5"];
        runKuduSyncTestScenario(testedFiles, expectedFiles, ignore, done);
    });

    test('Ignore files (file1;bin/*) should not copy them', function (done) {
        var testedFiles = ["file1", "bin/file2", "bin/file3", "bin/more/file4", "file5"];
        var ignore = "file1;bin/*";
        var expectedFiles = ["-file1", "-bin/file2", "-bin/file3", "-bin/more/file4", "file5"];
        runKuduSyncTestScenario(testedFiles, expectedFiles, ignore, done);
    });

    test('Ignore files added after first sync', function (done) {
        runKuduSyncTestScenario(["file1", "dir1/file2"], ["file1", "dir1/file2"], null, function () {
            var testedFiles = ["-file1", "file3", "file4"];
            var ignore = "file3";
            var expectedFiles = ["-file1", "dir1/file2", "-file3", "file4"];
            runKuduSyncTestScenario(testedFiles, expectedFiles, ignore, done);
        });
    });

    test('Ignore files removed after first sync', function (done) {
        runKuduSyncTestScenario(["file1", "dir1/file2"], ["file1", "dir1/file2"], null, function () {
            var testedFiles = ["-file1", "file3", "file4"];
            var ignore = "file1";
            var expectedFiles = ["file1", "dir1/file2", "file3", "file4"];
            runKuduSyncTestScenario(testedFiles, expectedFiles, ignore, done);
        });
    });

    test('Ignore directories added after first sync', function (done) {
        runKuduSyncTestScenario(["file1", "dir1/file2"], ["file1", "dir1/file2"], null, function () {
            var testedFiles = ["-file1", "dir1/file3", "file4"];
            var ignore = "dir1";
            var expectedFiles = ["-file1", "dir1/file2", "-dir1/file3", "file4"];
            runKuduSyncTestScenario(testedFiles, expectedFiles, ignore, done);
        });
    });

    test('Ignore directories removed after first sync', function (done) {
        runKuduSyncTestScenario(["file1", "dir1/file2"], ["file1", "dir1/file2"], null, function () {
            var testedFiles = ["-file1", "-dir1/file2", "dir1/file3", "file4"];
            var ignore = "dir1";
            var expectedFiles = ["-file1", "dir1/file2", "-dir1/file3", "file4"];
            runKuduSyncTestScenario(testedFiles, expectedFiles, ignore, done);
        });
    });

    test('Clean before sync when it\'s the first sync (manifest is empty)', function (done) {
        generateToFile("dir1/dir2/tofile3");
        var testedFiles = ["file4", "file5", "file6"];
        var expectedFiles = ["file4", "file5", "file6", "-dir1/dir2/tofile3"];
        runKuduSyncTestScenario(testedFiles, expectedFiles, null, done);
    });

    setup(function () {
        // Setting a different test directory per test.
        incrementTestDir();
    });

    teardown(function () {
        // Cleaning up after each test
        removePath(baseTestTempDir);
    });
});

// The scenario:
// 1. Create/update or remove files from updatedFiles on the source path
// 2. Run the kudu sync function
// 3. Verify expectedFiles exist (or not exist) in the destination path
function runKuduSyncTestScenario(updatedFiles, expectedFiles, ignore, callback, whatIf) {
    generateFromFiles(updatedFiles);

    runKuduSync("manifest1", "manifest1", ignore, whatIf, function (err) {
        if (err) {
            callback(err);
            return;
        }

        // Small timeout to make sure files were persisted in file system.
        setTimeout(function () {
            try {
                testFilesShouldBeEqual(expectedFiles);
                callback();
            }
            catch (err) {
                callback(err);
            }
        }, 100);
    });
}

function removeManifestFile() {
    var manifestPath = pathUtil.join(baseTestTempDir, testDir, "manifest1");
    tryRemoveFile(manifestPath);
}

function incrementTestDir() {
    testDirIndex++;
    testDir = testDirBase + testDirIndex;
}

function testFilesShouldBeEqual(files) {
    for (var index in files) {
        var file = files[index];

        // Find whether to verify file is there or not
        if (file.indexOf("-") == 0) {
            file = file.substring(1);
            var fileFullPath = pathUtil.join(baseTestTempDir, testDir, toDir, file);
            fs.existsSync(fileFullPath).should.equal(false, "File exists: " + fileFullPath);
        }
        else {
            testFileShouldBeEqual(file);
        }
    }
}

function testFileShouldBeEqual(file) {
    var from = pathUtil.join(baseTestTempDir, testDir, fromDir);
    var to = pathUtil.join(baseTestTempDir, testDir, toDir);

    filesShouldBeEqual(from, to, file);
}

function runKuduSync(prevManifestFile, nextManifestFile, ignore, whatIf, callback) {
    var from = pathUtil.join(baseTestTempDir, testDir, fromDir);
    var to = pathUtil.join(baseTestTempDir, testDir, toDir);
    var prevManifestPath = pathUtil.join(baseTestTempDir, testDir, prevManifestFile);
    var nextManifestPath = pathUtil.join(baseTestTempDir, testDir, nextManifestFile);

    ks.kuduSync(from, to, nextManifestPath, prevManifestPath, ignore, whatIf)
      .then(callback, callback);
}

function generateFromFiles(files) {
    for (var index in files) {
        var file = files[index];
        file = file.toUpperCase(); // to find casing bugs
        generateFromFile(file);
    }
}

function generateFromFile(fileName) {
    var isRemove = false;
    // Find whether to create/update or remove file
    if (fileName.indexOf("-") == 0) {
        fileName = fileName.substring(1);
        isRemove = true;
    }

    var filePath = pathUtil.join(baseTestTempDir, testDir, fromDir, fileName);

    if (isRemove) {
        removePath(filePath);
        return "";
    }
    else {
        return generateFile(filePath);
    }
}

function generateToFile(fileName) {
    var filePath = pathUtil.join(baseTestTempDir, testDir, toDir, fileName);
    return generateFile(filePath);
}

function filesShouldBeEqual(fromPath, toPath, fileName) {
    fromPath = pathUtil.join(fromPath, fileName);
    toPath = pathUtil.join(toPath, fileName);

    // Only validate content if the from file exists
    var expectedContent = null;
    if (fs.existsSync(fromPath)) {
        var stat = tryGetFileStat(fromPath);
        if (!stat.isDirectory) {
            expectedContent = fs.readFileSync(fromPath, 'utf8');
        }
    }

    fileShouldExist(toPath, expectedContent);
}

function fileShouldExist(path, expectedContent) {
    fs.existsSync(path).should.equal(true, "File doesn't exist: " + path);

    // Validate content if received it
    if (expectedContent != null) {
        var content = fs.readFileSync(path, 'utf8');
        expectedContent.should.equal(content);
    }
}

function generateFile(path, content) {
    if (content == null) {
        content = randomString();
    }
    ensurePathExists(pathUtil.dirname(path));
    fs.writeFileSync(path, content, 'utf8');
    return content;
}

function removePath(path) {
    var stat = tryGetFileStat(path);
    if (stat) {
        if (!stat.isDirectory()) {
            tryRemoveFile(path);
        }
        else {
            var files = fs.readdirSync(path);
            for (var index in files) {
                var file = files[index];
                var filePath = pathUtil.join(path, file);
                removePath(filePath);
            }

            tryRemoveDir(path);
        }
    }
}

function tryGetFileStat(path) {
    try {
        return fs.statSync(path);
    }
    catch (e) {
        if (e.errno == 34) {
            // Return null if path doesn't exist
            return null;
        }

        throw e;
    }
}

function tryRemoveFile(path) {
    try {
        fs.unlinkSync(path);
    }
    catch (e) {
        console.log(e);
    }
}

function tryRemoveDir(path) {
    try {
        fs.rmdirSync(path);
    }
    catch (e) {
    }
}

function ensurePathExists(path) {
    if (!fs.existsSync(path)) {
        ensurePathExists(pathUtil.dirname(path));
        fs.mkdirSync(path);
    }
}

// Create a random string, more chance for /n and space.
function randomString()
{
    var length = Math.floor(Math.random() * 1024) + 100;

    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ \n abcdefghijklmnopqrstuvwxyz \n 0123456789 \n \t";

    for( var i=0; i < length; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}
