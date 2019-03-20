"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var CommunicationManager = require('../lib/CommunicationManager');
var Configuration = require('../lib/Configuration');
var DataEventManager = require('../lib/DataEventManager');
var DataFetcher = require('../lib/DataFetcher');
var TimeRange = require('../lib/interfaces/TimeRange');
try {
    // Read the configuration file
    var config = Configuration.getConfig(process.argv);
    // Init Communication Manager module
    var commManager = new CommunicationManager(config);
    // Load multidimensional interfaces
    loadInterfaceModules(config.interfaces, commManager);
    //////////////////////////////////////////////
    /*
    * Getting Air quality data
    * */
    var fetcher = new DataFetcher([]);
    //fetcher.fetchData('');
    //////////////////////////////////////////////
    // Listen for data on standard input -- this will be replaced
    var stdin = process.openStdin();
    stdin.on('data', function (chunk) {
        // Launch data event towards interfaces through Data Event Manager module
        DataEventManager.push('data', chunk);
    });
    // Launch Web server for polling interfaces
    var app = commManager.app;
    var router = commManager.router;
    app.use(router.routes()).use(router.allowedMethods());
    app.listen(config.httpPort);
}
catch (e) {
    console.error(e);
    process.exit(1);
}
function loadInterfaceModules(interfaces, commManager) {
    for (var index in interfaces) {
        var Interface = require(interfaces[index].path);
        new Interface(interfaces[index], commManager);
    }
}
