var dbmap = {};

var nextTick = window.setImmediate || function(fun) {
    window.setTimeout(fun, 0);
};

/* **
function handle(p, win, fail) {
    if (p)
        p.done(
            function (res) {
                if (res[1])
                    fail(res[1]);
                else
                    win(res[0]?JSON.parse(res[0]):[]);
            },
            function (err) {
                fail(err);
            }
        );
}
// */

module.exports = {
	echoStringValue: function(win, fail, args) {
	    var options = args[0];
		win(options.value);
	},
	open: function(win, fail, args) {
	    var options = args[0];
	    var res;

		function openImmediate(dbname) {
			if (!!dbmap[dbname]) {
				// NO LONGER EXPECTED due to BUG 666 workaround solution:
				fail("INTERNAL ERROR: database already open for dbname: " + dbname);
			}

			// from @EionRobb / phonegap-win8-sqlite:
			var opendbname = Windows.Storage.ApplicationData.current.localFolder.path + "\\" + dbname;
			console.log("open db name: " + dbname + " at full path: " + opendbname);

			var db = new SQLite3JS.Database(opendbname);
			dbmap[dbname] = db;
			nextTick(function() {
				win();
			});
		    //res = SQLitePluginRT.SQLitePlugin.openAsync(options.name);
		}

		try {
		    //res = SQLitePluginRT.SQLitePlugin.openAsync(options.name);
			var dbname = options.name;

			openImmediate(dbname);
		} catch(ex) {
			//fail(ex);
			nextTick(function() {
				fail(ex);
			});
		}
		//handle(res, win, fail);
	},
	close: function(win, fail, args) {
	    var options = args[0];
	    var res;
		try {
			var dbname = options.path;

			nextTick(function() {
				var rc = 0;
				var db = dbmap[dbname];

				if (!db) {
					fail("CLOSE ERROR: cannot find db object for dbname: " + dbname);
				} else if ((rc = db.close()) !== 0) {
					fail("CLOSE ERROR CODE: " + rc);
				} else {
					delete dbmap[dbname];
					win();
				}
			});
		} catch (ex) {
			fail(ex);
		}
	},
	backgroundExecuteSqlBatch: function(win, fail, args) {
	    var options = args[0];
	    var dbname = options.dbargs.dbname;
		var executes = options.executes;
		var db = dbmap[dbname];
		var results = [];
		var i, count=executes.length;

		//console.log("executes: " + JSON.stringify(executes));
		//console.log("execute sql count: " + count);
		for (i=0; i<count; ++i) {
			var e = executes[i];
			//console.log("execute sql: " + e.sql + " params: " + JSON.stringify(e.params));
			try {
				var oldTotalChanges = db.totalChanges();
				var rows = db.all(e.sql, e.params);
				//console.log("got rows: " + JSON.stringify(rows));
				var rowsAffected = db.totalChanges() - oldTotalChanges;
				var result = { rows: rows, rowsAffected: rowsAffected };
				if (rowsAffected > 0) {
					var lastInsertRowid = db.lastInsertRowid();
					if (lastInsertRowid !== 0) result.insertId = lastInsertRowid;
				}
				results.push({
					type: "success",
					result: result
				});
			} catch(ex) {
				console.log("sql exception error: " + ex.message);
				results.push({
					type: "error",
					result: { message: ex.message, code: 0 }
				});
			}
		}
		//console.log("return results: " + JSON.stringify(results));
		nextTick(function() {
			//console.log("return results: " + JSON.stringify(results));
			win(results);
		});
	},
	attach: function(win, fail, args) {
	    var options = args[0];
	    var res;

	    var dbname = options.dbname1;
	    var dbname2 = options.dbname2;
	    var as = options.as;

		if (!dbmap[dbname]) {
				fail("INTERNAL PLUGIN ERROR: no connection found: " + dbname);
		}

		// get full attach db path in a similar fashion to the open method above
		// from @EionRobb / phonegap-win8-sqlite:
		var attachdbname = Windows.Storage.ApplicationData.current.localFolder.path + "\\" + dbname2;
		console.log("attach db name: " + dbname2 + " with full path: " + attachdbname);

		var db = dbmap[dbname];

		// FUTURE TBD: add more graceful error checking & handling here
		db.all("ATTACH ? AS " + as, [attachdbname]);

		// FUTURE TBD separate params with "?" placeholder
		var sql = "SELECT * FROM " + as + ".sqlite_master";
		var rows = db.all(sql, []);
		if (rows.length < 1) return fail("ATTACH ERROR: no rows in attached db .sqlite_master table")

		nextTick(function() {
			win();
		});
	},
	"delete": function(win, fail, args) {
	    var options = args[0];
	    var res;
		try {
		    //res = SQLitePluginRT.SQLitePlugin.deleteAsync(JSON.stringify(options));
			var dbname = options.path;

			WinJS.Application.local.exists(dbname).then(function(isExisting) {
				if (!isExisting) {
					// XXX FUTURE TBD consistent for all platforms:
					fail("file does not exist");
					return;
				}

				if (!!dbmap[dbname]) {
					dbmap[dbname].close_v2();

					delete dbmap[dbname];
				}

				//console.log('test db name: ' + dbname);
				Windows.Storage.ApplicationData.current.localFolder.getFileAsync(dbname)
					.then(function (dbfile) {
						//console.log('get db file to delete ok');
						return dbfile.deleteAsync(Windows.Storage.StorageDeleteOption.permanentDelete);
					}, function (e) {
						console.log('get file failure: ' + JSON.stringify(e));
						// XXX FUTURE TBD consistent for all platforms:
						fail(e);
					}).then(function () {
						//console.log('delete ok');
						win();
					}, function (e) {
						console.log('delete failure: ' + JSON.stringify(e));
						// XXX FUTURE TBD consistent for all platforms:
						fail(e);
					});

			});

		} catch(ex) {
			fail(ex);
		}
		//handle(res, win, fail);
	}
};
require("cordova/exec/proxy").add("SQLitePlugin", module.exports);
