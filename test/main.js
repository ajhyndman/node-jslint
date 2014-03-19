var assert = require('assert'),
    main;

function mockConsole() {
    var c ={
        warnings: [],
        warn: function(str) {
            c.warnings.push(str);
        },
        loggings: [],
        log: function(str) {
            c.loggings.push(str);
        }
    };

    return c;
}

function mockProcess() {
    var p = {
        argv: ['jslint'],
        exit: function (c) {
            this.exitCode = c;
            this.events.exit.forEach(function (f) {
                f();
            });
        },
        doDrain: function() {
            this.events.drain.forEach(function (f) {
                f();
            });
        },
        events: { exit: [],
                  drain: [] },
        on: function (event,f) {
            this.events[event].push(f);
        },
        stdout: {
            isTTY: true,

            /* mock: call callback right away */
            on: function (event, fn) {
                fn();
                p.doDrain()
            },
            callbacks: {
                drain: []
            }
        }
    };
    return p;
}

function mockParsed() {
    return {
        argv: {
            remain: []
        }
    };
}

suite('jslint main', function () {
    var pro, con;

    setup(function () {
        main = require('../lib/main');

        con = mockConsole();
        pro = mockProcess();

        main.setConsole(con);
        main.setProcess(pro);
    });

    test('main - no args', function () {
        var parsed = mockParsed();

        main.runMain(parsed);

        assert.ok(main);
        assert.strictEqual(1, pro.exitCode);
        assert.strictEqual(2, con.warnings.length);
    });

    test('main - three files', function (done) {
        var parsed = mockParsed();

        parsed.argv.remain.push('lib/main.js');
        parsed.argv.remain.push('lib/main.js');
        parsed.argv.remain.push('lib/main.js');

        pro.on('exit', done);

        parsed.terse = true;

        main.runMain(parsed);

        assert.ok(main);
    });

    test('main - glob files', function (done) {
        // bail if glob not installed
        if (!main.glob) {
            assert.ok(true);
            done();
            return;
        }

        var parsed = mockParsed();

        parsed.argv.remain.push('lib/mai*.js');

        pro.on('exit', done);

        parsed.terse = true;

        main.runMain(parsed);

        assert.ok(main);
    });

    test('main - glob ignore node_modules', function (done) {
        var parsed = mockParsed();

        parsed.argv.remain.push('./lib/main.js');
        parsed.argv.remain.push('./node_modules/glob/*');

        pro.on('exit', done);

        parsed.terse = true;

        main.runMain(parsed);

        assert.ok(main);
    });

    test('main - one file, not tty, json output', function (done) {
        var parsed = mockParsed();

        parsed.argv.remain.push('lib/reporter.js');

        parsed.json = true;

        pro.stdout.isTTY = false;

        pro.on('drain', function () {
            assert.strictEqual(0, pro.exitCode);
            done();
        });

        main.runMain(parsed);

        assert.ok(main);

        // expect process.exit(0) to be as yet uncalled
        assert.strictEqual(undefined, pro.exitCode);
    });

    test('todo in command-line options', function () {
        var o = main.commandOptions();

        assert.strictEqual(Boolean, o.todo);
    });

    function isBasicType(type, value) {
        return type(value).valueOf() === value;
    }

    test('isBasicType works', function () {

        assert.ok(isBasicType(Boolean, true));
        assert.ok(isBasicType(Boolean, false));
        assert.ok(isBasicType(Number, 1));

        assert.ok(!isBasicType(Boolean, 0));
        assert.ok(!isBasicType(Boolean, 1));
        assert.ok(!isBasicType(Number, false));
        assert.ok(!isBasicType(String, 1));
        assert.ok(!isBasicType(Number, '1'));
    });

    test('example jslintrc contains only valid options', function (done) {

        var options = main.commandOptions(),
            fs = require('fs');

        fs.readFile("jslintrc.example", function (err, file) {
            if (err) {
                throw err;
            }

            var example = JSON.parse(file),
                keys = Object.keys(example);

            keys.forEach(function(opt) {
                assert.ok(options.hasOwnProperty(opt));

                var type = options[opt],
                    value = example[opt];

                assert.ok(isBasicType(type, value));
            });

            done();
        });
    });

    test('edition is a string (not Boolean) option', function () {
        var options = main.commandOptions();

        assert.equal(String, options.edition);
    });

    test('returns a version', function (done) {

        main.reportVersion(function (version) {

            assert.ok(/^node-jslint version:/.test(version));
            assert.ok(/  JSLint edition/.test(version));
            done();
        }, {} );
    });

    test('argument parsing: edition is a string', function () {
        var options = main.parseArgs(['node', 'jslint', '--edition=latest']);

        assert.equal('latest', options.edition);
    });

    test('main -- report version', function (done) {
        main.runMain({version: true});

        done();
    });
});
