// Functional tests using mocha and should.

// The tested module
var ks = require("../bin/kudusync.js");

var should = require("should");
var Q = require("q");

var attempts = 0;

// Tests Suite
suite('Attempt Function Tests', function () {
    test('Attempt without failing action should be called once', function (done) {
        ks.Utils.attempt(function () {
            attempts.should.equal(0);
            attempts++;
            return Q.resolve();
        }, 3, 10).then(function () {
            attempts.should.equal(1);
            done();
        });
    });

    test('Attempt with failing action should be called once', function (done) {
        ks.Utils.attempt(function () {
            // Do nothing, success
            attempts++;

            if (attempts == 1) {
                return Q.reject(new Error("error"));
            }

            return Q.resolve();
        }, 3, 10).then(function () {
            attempts.should.equal(2);
            done();
        });
    });

    test('Attempt should retry for failing actions', function (done) {
        ks.Utils.attempt(function () {
            // Do nothing, success
            attempts++;

            if (attempts <= 2) {
                return Q.reject(new Error("error"));
            }

            return Q.resolve();
        }, 3, 10).then(function () {
            attempts.should.equal(3);
            done();
        });
    });

    test('Attempt should retry for failing actions', function (done) {
        ks.Utils.attempt(function () {
            // Do nothing, success
            attempts++;

            if (attempts <= 3) {
                return Q.reject(new Error("error"));
            }

            return Q.resolve();
        }, 3, 10).then(function () {
            attempts.should.equal(4);
            done();
        });
    });

    test('Attempt with failing fails after retries', function (done) {
        ks.Utils.attempt(function () {
            // Do nothing, success
            attempts++;

            if (attempts <= 4) {
                return Q.reject(new Error("error"));
            }

            return Q.resolve();
        }, 3, 10).fail(function (err) {
            err.should.be.ok;
            err.message.should.equal("error");
            attempts.should.equal(4);
            done();
        });
    });

    setup(function () {
        attempts = 0;
    });
});
