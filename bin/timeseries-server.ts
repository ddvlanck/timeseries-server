export {};
const CommunicationManager = require('../lib/CommunicationManager');
const Configuration = require('../lib/Configuration');
const DataEventManager = require('../lib/DataEventManager');
const DataFetcher = require('../lib/DataFetcher');
const TimeRange = require('../lib/interfaces/TimeRange');

try {
    // Read the configuration file
    const config = Configuration.getConfig(process.argv);

    // Init Communication Manager module
    const commManager = new CommunicationManager(config);

    // Load multidimensional interfaces
    loadInterfaceModules(config.interfaces, commManager);

    //////////////////////////////////////////////
    /*
    * Getting Air quality data
    * */
    const fetcher = new DataFetcher([]);
    //fetcher.fetchData('');

    //////////////////////////////////////////////

    // Listen for data on standard input -- this will be replaced
    let stdin = process.openStdin();
    stdin.on('data', chunk => {
        // Launch data event towards interfaces through Data Event Manager module
        DataEventManager.push('data', chunk);
    });

    // Launch Web server for polling interfaces
    let app = commManager.app;
    let router = commManager.router;
    app.use(router.routes()).use(router.allowedMethods());
    app.listen(config.httpPort);

} catch (e) {
    console.error(e);
    process.exit(1);
}

function loadInterfaceModules(interfaces: Array<any>, commManager: CommunicationManager) {
    for(let index in interfaces){
        let Interface = require(interfaces[index].path);
        new Interface(interfaces[index], commManager);
    }
}