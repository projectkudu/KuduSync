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
        runKuduSyncTestScenario(testedFiles, testedFiles, done); // Files to create, Files to expect
    });

    test('Several files should be sync\'d', function (done) {
        var testedFiles = ["file1", "file2", "file3"];
        runKuduSyncTestScenario(testedFiles, testedFiles, done);
    });

    test('Several files and sub-directories should be sync\'d', function (done) {
        var testedFiles = ["file1", "file2", "dir1/file3", "dir1/dir2/dir3/file4", "dir1/dir2/dir3/file5", "dir2/file6.txt"];
        runKuduSyncTestScenario(testedFiles, testedFiles, done);
    });

    test('Single file updated should be sync\'d', function (done) {
        runKuduSyncTestScenario(["file1.bin"], ["file1.bin"], function () {

            // Waiting 1 second for updated file to have a newer modified time
            setTimeout(function () {
                runKuduSyncTestScenario(["file1.bin"], ["file1.bin"], done);
            }, 1000);
        });
    });

    test('Several files updated should be sync\'d', function (done) {
        runKuduSyncTestScenario(["file1.bin", "file2", "dir1/file3", "dir1/dir2/dir3/file4"], ["file1.bin", "file2", "dir1/file3", "dir1/dir2/dir3/file4"], function () {

            // Waiting 1 second for updated file to have a newer modified time
            setTimeout(function () {
                runKuduSyncTestScenario(["file2", "dir1/file3", "dir1/dir2/dir3/file5", "dir2/file6.txt"], ["file1.bin", "file2", "dir1/file3", "dir1/dir2/dir3/file4", "dir1/dir2/dir3/file5", "dir2/file6.txt"], done);
            }, 1000);
        });
    });

    test('Single file created then removed should be sync\'d', function (done) {
        runKuduSyncTestScenario(["file1"], ["file1"], function () {
            runKuduSyncTestScenario(["-file1"], ["-file1"], done);
        });
    });

    test('Several files some created some removed should be sync\'d', function (done) {
        runKuduSyncTestScenario(["file1.bin", "file2", "dir1/file3", "dir1/dir2/dir3/file4"], ["file1.bin", "file2", "dir1/file3", "dir1/dir2/dir3/file4"], function () {

            // Waiting 1 second for updated file to have a newer modified time
            setTimeout(function () {
                runKuduSyncTestScenario(["file2", "-dir1/file3", "-dir1/dir2/dir3/file4"], ["file1.bin", "file2", "-dir1/file3", "-dir1/dir2/dir3/file4"], done);
            }, 1000);
        });
    });

    test('Single file created then file created only in destination, new file should remain', function (done) {
        runKuduSyncTestScenario(["file1"], ["file1"], function () {

            // Generating a file only in the destination directory, this shouldn't be removed
            generateToFile("tofile");

            runKuduSyncTestScenario([], ["file1", "tofile"], done);
        });
    });

    test('Several files created then file created only in destination, new file should remain', function (done) {
        runKuduSyncTestScenario(["file1", "dir1/file2"], ["file1", "dir1/file2"], function () {

            // Generating files only in the destination directory, those files shouldn't be removed
            generateToFile("dir1/dir2/tofile1");
            generateToFile("dir1/dir2/tofile2");

            runKuduSyncTestScenario(["-file1"], ["-file1", "dir1/file2", "dir1/dir2/tofile1", "dir1/dir2/tofile2"], done);
        });
    });

    test('Several files should not be sync\'d with whatIf flag set to true', function (done) {
        runKuduSyncTestScenario(["file1", "file2", "file3"], [], done, /*whatIf*/true);
    });

    test('From directory doesn\'t exists should fail', function (done) {
        var from = pathUtil.join(baseTestTempDir, testDir, fromDir + "aaa");
        var to = pathUtil.join(baseTestTempDir, testDir, toDir);
        var prevManifestPath = pathUtil.join(baseTestTempDir, testDir, "manifest1");
        var nextManifestPath = prevManifestPath;

        ks.kuduSync(from, to, nextManifestPath, prevManifestPath, true, function (err) {
            err.should.exist;
            done();
        });
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
function runKuduSyncTestScenario(updatedFiles, expectedFiles, callback, whatIf) {
    generateFromFiles(updatedFiles);

    runKuduSync("manifest1", "manifest1", whatIf, function (err) {
        if (err) {
            callback(err);
            return;
        }

        // Small timeout to make sure files were persisted in file system.
        setTimeout(function () {
            testFilesShouldBeEqual(expectedFiles);
            callback();
        }, 100);
    });
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
            fs.existsSync(file).should.not.be.ok;
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

function runKuduSync(prevManifestFile, nextManifestFile, whatIf, callback) {
    var from = pathUtil.join(baseTestTempDir, testDir, fromDir);
    var to = pathUtil.join(baseTestTempDir, testDir, toDir);
    var prevManifestPath = pathUtil.join(baseTestTempDir, testDir, prevManifestFile);
    var nextManifestPath = pathUtil.join(baseTestTempDir, testDir, nextManifestFile);

    ks.kuduSync(from, to, nextManifestPath, prevManifestPath, whatIf, callback);
}

function generateFromFiles(files) {
    for (var index in files) {
        var file = files[index];
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
        expectedContent = fs.readFileSync(fromPath, 'utf8');
    }
    else {
        fileShouldExist(toPath, expectedContent);
    }
}

function fileShouldExist(path, expectedContent) {
    should.exist(fs.existsSync(path));

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
