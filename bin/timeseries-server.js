const CommunicationManager = require('../lib/CommunicationManager');
const Configuration = require('../lib/Configuration');
const DataEventManager = require('../lib/DataEventManager');
const DataMapper = require('../lib/DataMapper');

const kafka = require('kafka-node');
const Consumer = kafka.Consumer;

const Utils= require('../lib/Utils');

try {

    // Read the configuration file
    let config = Configuration.getConfig(process.argv);

    // Init Communication Manager module
    let commManager = new CommunicationManager(config);

    // Load multidimensional interfaces
    loadInterfaceModules(config.interfaces, commManager);

    // Initialize data mapper
    let mapper = new DataMapper(
        (stream) => {
            stream.dataStream.on('data', (data) => {
                setTimeout( () => {
                    DataEventManager.push('data', Buffer.from(data));
                }, 100);

            });
        }
    );

    let sources = new Map();

    // Initiate kafka client
    let client = new kafka.KafkaClient();    // maybe do something if there's an idle connection
    let consumer = new Consumer(client, [{topic: 'airquality'}], {fetchMaxBytes: 1024});
    consumer.on('message', (message) => {
        const data = JSON.parse(message.value);

        // Check wat die VOC is - blijkt niet meer aanwezig
        if(data.metricId.indexOf('airquality') >= 0 && data.metricId.indexOf('voc') < 0){
           mapper.mapData(data);
        }

    });

    consumer.on('error', (err) => {
        console.log(err);
    })


    // Listen for data on standard input
    /*let stdin = process.openStdin();
     stdin.on('data', chunk => {
         // Launch data event towards interfaces through Data Event Manager module
         console.log(chunk.toString());
        // DataEventManager.push('data', chunk);
     });*/

    // Launch Web server for polling interfaces
    let app = commManager.app;
    let router = commManager.router;
    app.use(router.routes()).use(router.allowedMethods());
    app.listen(config.httpPort);

} catch (e) {
    console.error(e);
    process.exit(1);
}

function loadInterfaceModules(interfaces, commManager) {
    for (let index in interfaces) {
        let Interface = require(interfaces[index].path);
        new Interface(interfaces[index], commManager);
    }
}