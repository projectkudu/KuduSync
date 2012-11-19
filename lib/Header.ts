///<reference path='..\typings\node.d.ts'/>
///<reference path='..\typings\q.d.ts'/>
///<reference path='..\typings\minimatch.d.ts'/>

var fs = require('fs');
var pathUtil = require('path');
var Q = require('q');
var minimatch = require('minimatch');

var log = console.log;

// Workaround to support both APIs whether in node 0.6.* or 0.8.0 and higher.
if (!fs.existsSync) fs.existsSync = pathUtil.existsSync;
