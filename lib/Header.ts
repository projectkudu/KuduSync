///<reference path='..\typings\node.d.ts'/>
///<reference path='..\typings\jquery-deferred.d.ts'/>

var fs = require('fs');
var pathUtil = require('path');
var jQuery = require('jquery-deferred');

var log = console.log;

// Workaround to support both APIs whether in node 0.6.* or 0.8.0 and higher.
if (!fs.existsSync) fs.existsSync = pathUtil.existsSync;
