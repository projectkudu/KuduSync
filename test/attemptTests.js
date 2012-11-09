// Functional tests using mocha and should.

// The tested module
var ks = require("../bin/kuduSync.js");

var should = require("should");

var attempts = 0;

// Tests Suite
suite('Attempt Function Tests', function () {
    test('Attempt without failing action should be called once', function (done) {
        ks.attempt(function (callback) {
            // Do nothing, success
            attempts++;
            callback();
        }, function (err) {
            // Make sure action was called only once
            should.not.exist(err);
            attempts.should.equal(1);
            done();
        }, 3, 10);
    });

    test('Attempt without failing action should be called once', function (done) {
        ks.attempt(function (callback) {
            // Do nothing, success
            attempts++;

            if (attempts == 1) {
                callback(new Error("error"));
                return;
            }

            callback();
        }, function (err) {
            should.not.exist(err);
            attempts.should.equal(2);
            done();
        }, 3, 10);
    });

    test('Attempt without failing action should be called once', function (done) {
        ks.attempt(function (callback) {
            // Do nothing, success
            attempts++;

            if (attempts <= 2) {
                callback(new Error("error"));
                return;
            }

            callback();
        }, function (err) {
            should.not.exist(err);
            attempts.should.equal(3);
            done();
        }, 3, 10);
    });

    test('Attempt without failing action should be called once', function (done) {
        ks.attempt(function (callback) {
            // Do nothing, success
            attempts++;

            if (attempts <= 3) {
                callback(new Error("error"));
                return;
            }

            callback();
        }, function (err) {
            should.not.exist(err);
            attempts.should.equal(4);
            done();
        }, 3, 10);
    });

    test('Attempt without failing action should be called once', function (done) {
        ks.attempt(function (callback) {
            // Do nothing, success
            attempts++;

            if (attempts <= 4) {
                callback(new Error("error"));
                return;
            }

            callback();
        }, function (err) {
            err.should.be.ok;
            err.message.should.equal("error");
            attempts.should.equal(4);
            done();
        }, 3, 10);
    });

    setup(function () {
        attempts = 0;
    });
});
