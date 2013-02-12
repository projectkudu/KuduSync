var pathUtil = require("path");

var cmd = "node " + pathUtil.join(__dirname, "..", "bin", "kudusync");
var ignoredTestsMap = {};

exports.cmd = cmd;
exports.ignoredTestsMap = ignoredTestsMap;
