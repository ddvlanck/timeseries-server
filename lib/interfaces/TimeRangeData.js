const MultidimensionalInterface = require('../MultidimensionalInterface');
const CommunicationManager = require('../CommunicationManager');
const Utils = require('../Utils');
const moment = require('moment');       // Library for parsing, validating, manipulating, and formatting dates.

class TimeRangeData extends MultidimensionalInterface {

    constructor(config, commMan) {
        super(commMan);
        this._serverUrl = this.commMan.config.serverUrl;
        this._name = config.name;
        this._websocket = config.websocket;
        this._fragmentsPath = config.fragmentsPath;
        this._fragmentMaxSize = config.maxFileSize;
        this._prefixes = config.prefixes;
        this._lastFragment = null;
        this._latestGat = null;

        // Init storage folder
        Utils.createFolder(this.fragmentsPath);

        // Load HTTP interfaces for this interface
        this.setupPollInterfaces();

        // Load Websocket interface
        /*if (this.websocket) {
            super.setupPubsupInterface(this.name, config.wsPort);
        }*/
    }

    // We generate the fragments on the fly, so we don't need this function
    async onData(data) {}

    setupPollInterfaces() {
        let self = this;

        this.commMan.router.get('/' + this.name + '/fragment/:year', async (ctx, next) => {
            ctx.response.set({'Access-Control-Allow-Origin': '*'});
            let filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '.trig';
            await this.handleRequest(ctx, filePath, true, "year");
        });

        this.commMan.router.get('/' + this.name + '/fragment/:year/:month', async (ctx, next) => {
            ctx.response.set({'Access-Control-Allow-Origin': '*'});
            let filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '-' + ctx.params.month.split('_')[0] + '.trig';
            await this.handleRequest(ctx, filePath, true, "month");
        });

        this.commMan.router.get('/' + this.name + '/fragment/:year/:month/:day', async (ctx, next) => {
            ctx.response.set({'Access-Control-Allow-Origin': '*'});
            let filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '-' + ctx.params.month.split('_')[0] + '-'
                + ctx.params.day.split('_')[0] + '.trig';

            await this.handleRequest(ctx, filePath, true, "day");
        });

        this.commMan.router.get('/' + this.name + '/fragment/:year/:month/:day/:hour', async (ctx, next) => {
            ctx.response.set({'Access-Control-Allow-Origin': '*'});
            let filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '-' + ctx.params.month.split('_')[0] + '-'
                + ctx.params.day.split('_')[0] + 'T' + ctx.params.hour.split('_')[0] + '.trig';
            await this.handleRequest(ctx, filePath, false, "hour");
        });

        // TODO : route for fragments
    }

    async handleRequest(ctx, filePath, metadata, time){
        let file = filePath.substr(0, filePath.lastIndexOf('.trig')) + '_fragment1.trig'

        if(!Utils.exists(file)){ // No fragments exist for time range

            // Check if the time range is already expired
            const expiredInterval = this.expiredTimeInterval(ctx, time);
            const files = Utils.getFragmentsToGenerateData(ctx, time);

            if(files.length === 0){
                ctx.response.status = 404;
                ctx.response.body = "[TimeRange]: No data found";

            } else {
                let triples = [];
                for (let index in files) {
                    let ft = await Utils.getTriplesFromFile('./example/data/RawData/' + files[index]);
                    triples = triples.concat(ft[1]);
                }

                // Add graph to triples
                let graph = this.serverUrl.substr(0, this.serverUrl.length - 1) + ctx.request.url;
                let time = new Date();
                time.setHours(time.getHours() + time.getTimezoneOffset() / -60);

                for(let i = 0 ; i < triples.length ; i++){
                    triples[i].graph = graph;
                }

                triples.unshift({
                    subject: graph,
                    predicate: 'http://www.w3.org/ns/prov#generatedAtTime',
                    object: '"' + time.toISOString() + '"'
                });

                // Get prefixes and format triples
                const prefixes = (await Utils.getTriplesFromFile(this.prefixes))[0];
                const st = await this.createStaticTriples(triples);
                const data = await Utils.formatTriples('application/trig', st.concat(triples), prefixes);

                if(expiredInterval){
                    this.storeData(filePath, triples, prefixes);
                }

                // TODO: Add metadata

                ctx.response.set({'Content-Type': 'text/plain'});
                ctx.response.body = data;
            }
        } else {
            let triples;
            let metadata;

            // We need to check whether the client asks for a specific fragment (then '_fragment is present)
            // Or whether the client just ask for a time range and the fragments were already generated
            if(ctx.request.url.indexOf('_fragment') >= 0){
                // Clients asks for a specific fragment
                let fragmentNumber = parseInt(ctx.request.url.substring(ctx.request.url.indexOf('_fragment') + 9, ctx.request.url.indexOf('.trig')));
                let file = filePath.substring(0, filePath.lastIndexOf('.trig')) + '_fragment' + fragmentNumber + '.trig';

                triples = (await Utils.getTriplesFromFile(file))[1];

                // TODO: add metadata

                if(fragmentNumber > 1){
                    // Hydra:previous
                }

            } else {
                let [fragments, index] = await Utils.getFragmentsForTimeRange(filePath, null);
                triples = (await Utils.getTriplesFromFile(this.fragmentsPath + '/' + fragments[fragments.length - 1]))[1];

                // TODO: add metadata

                if(fragments.length > 1){
                    // Add hydra:previous
                }
            }

            const prefixes = (await Utils.getTriplesFromFile(this.prefixes))[0];
            const st = await this.createStaticTriples(triples);
            const data = await Utils.formatTriples('application/trig', st.concat(triples), prefixes);

            ctx.response.set({'Content-Type': 'text/plain'});
            ctx.response.body = data;
        }
    }

    /*async handleRequest(ctx, filePath, metadata, time) {
        let file;
        let fragmentNumber;
        if(filePath.indexOf('_fragment') < 0){
            file = filePath.substring(0, filePath.lastIndexOf('.trig')) + '_fragment1.trig';
        } else {
            fragmentNumber = ctx.params.x;
            file = filePath;
        }

        if (!Utils.exists(file)) {
            const expiredInterval = this.expiredTimeInterval(ctx, time);
            const files = Utils.getFragmentsToGenerateData(ctx, time);

            if (files.length === 0) {
                ctx.response.status = 404;
                ctx.response.body = "[TimeRange]: No data found";
            } else {
                let triplesArray = [[], []];
                for (let index in files) {
                    let ft = await Utils.getTriplesFromFile('./example/data/RawData/' + files[index]);
                    triplesArray[1] = triplesArray[1].concat(ft[1]);
                }

                // Add graph en delete all others
                let graphID = this.serverUrl + ctx.request.url;
                let time = new Date();
                time.setHours(time.getHours() + time.getTimezoneOffset() / -60);

                for (let i = 0; i < triplesArray[1].length; i++) {
                    if(!triplesArray[1][i].graph){
                        triplesArray[1][i].graph = graphID;
                    }
                }

                triplesArray[1].unshift({
                    subject: graphID,
                    predicate: 'http://www.w3.org/ns/prov#generatedAtTime',
                    object: '"' + time.toISOString() + '"'
                });


                const fileTriples = await Utils.formatTriples('application/trig', triplesArray[1], triplesArray[0]);
                const st = await Utils.getTriplesFromFile(this.staticTriples);

                if (expiredInterval) {
                    this.storeData(filePath, triplesArray[1]);
                }

                if (metadata) {
                    let fragmentId = Utils.getTriplesBySPOG(triplesArray[1], null, 'http://www.w3.org/ns/prov#generatedAtTime')[0].subject;
                    //this.addMetadata(fragmentId, fileTriples[1]);
                }

                ctx.response.set({'Content-Type': 'text/plain'});
                ctx.response.body = await Utils.formatTriples('application/trig', st[1].concat(triplesArray[1]), st[0]);

            }
        } else {
            // If fragmentNumber is undefined, it means the use doesn't know how many fragments there are
            // We collect all the fragments (so index  = -1) and return the most recent fragment to the user
            // TODO: test this for fragment route
            let [fragments, index] = await Utils.getFragmentsForTimeRange(filePath, fragmentNumber);
            let ft;
            if(index >= 0){
                ft = await Utils.getTriplesFromFile(this.fragmentsPath + '/' + fragments[index]);
            } else {
                ft = await Utils.getTriplesFromFile(this.fragmentsPath + '/' + fragments[fragments.length - 1]);
            }

            //let ft = await Utils.getTriplesFromFile(file);
            let st = await this.createStaticTriples(ft[1]);

            // TODO : add graph


            if (metadata) {

                // TODO : function addMetadata does not exist (metadata is not the same as static triples)
                // What kind of metadata should be added?
                // this function needs to have links to other files
                // for example, a file containing triples for a year needs to have links to the files containing the values of the months of that year
                //let fragmentId = Utils.getTriplesBySPOG(ft[1], null, 'http://www.w3.org/ns/prov#generatedAtTime')[0].subject;

                // If there's an index > 0 ==> add hydra:previous

                //this.addMetadata(fragmentId, ft[1]);
            }

            ctx.response.set({'Content-Type': 'text/plain'});
            ctx.response.body = await Utils.formatTriples('application/trig', st.concat(ft[1]), {});
        }
    }*/

    async storeData(filePath, triples, prefixes) {
        let observationID = null;
        let observationTriples = [];
        let byteCounter = 0;
        let fragmentCounter = 1;
        let buffer = [];

        for(let i = 0 ; i < triples.length ; i++){
            if(!observationID && triples[i].predicate === 'rdf:type'){
                observationID = triples[i].subject;
            }

            if(triples[i].subject === observationID){
                observationTriples.push(triples[i]);
            } else {
                if(triples[i].predicate === 'schema:geo' || triples[i].predicate === 'schema:latitude' || triples[i].predicate === 'schema:longitude'){
                    observationTriples.push(triples[i]);
                }

                if(triples[i].predicate === 'rdf:type' && triples[i].object === 'sosa:Observation'){
                    let data = await Utils.formatTriples('application/trig', observationTriples, {});
                    let bytes = Buffer.from(data).byteLength;

                    if(byteCounter + bytes > this.fragmentsMaxSize){
                        let result = await Utils.formatTriples('application/trig', buffer, prefixes);
                        result = result.substring(result.indexOf('<Observation'), result.length);   // Skip prefixes
                        await Utils.appendToFile(filePath.substring(0, filePath.indexOf('.trig')) + '_fragment' + fragmentCounter + '.trig', result);

                        buffer = [];
                        fragmentCounter++;
                        byteCounter = 0;
                    }
                    buffer.concat(observationTriples);
                    byteCounter += bytes;
                    observationTriples = [];
                    observationID = triples[i].subject;


                } else if(triples[i].predicate === 'rdf:type' && triples[i].object === 'schema:GeoCoordinates'){
                    observationTriples.push(triples[i]);
                }
            }
        }

        // Empty buffer
        let data = await Utils.formatTriples('application/trig', observationTriples, prefixes);
        data = data.substring(data.indexOf('<Observation'), data.length);   // Skip prefixes

        let bytes = Buffer.from(data).byteLength;
        if(byteCounter + bytes > this.fragmentsMaxSize){
            fragmentCounter++;
        }
        await Utils.appendToFile(filePath.substring(0, filePath.indexOf('.trig')) + '_fragment' + fragmentCounter + '.trig', data);

    }

    expiredTimeInterval(ctx, time) {
        let date;
        const currentDate = new Date();
        currentDate.setHours(currentDate.getHours() + currentDate.getTimezoneOffset() / -60);
        let expired;

        switch (time) {
            case "hour": {
                date = new Date(ctx.params.year.split('_')[0] + '-' + ctx.params.month.split('_')[0] + '-' + ctx.params.day.split('_')[0] + 'T' + ctx.params.hour.split('_')[0] + ':00:00');
                date.setHours(date.getHours() + date.getTimezoneOffset() / -60);   // Central European Time
                break;
            }

            case "day" : {
                date = new Date(ctx.params.year.split('_')[0] + '-' + ctx.params.month.split('_')[0] + '-' + ctx.params.day.split('_')[0]);
                break;
            }

            case "month" : {
                date = new Date(ctx.params.year.split('_')[0], ctx.params.month.split('_')[0]);
                break;
            }
        }

        if (time === 'year') {
            if (currentDate.getFullYear() <= ctx.params.year.split('_')[0]) {
                expired = false;
            } else {
                expired = true;
            }
        } else {
            expired = currentDate.getTime() > date.getTime();
        }

        return expired;
    }

    createStaticTriples(triples){
        let st = new Map();
        let AQParts = [];
        for(let i = 0 ; i < triples.length ; i++){
            if(triples[i].predicate === 'sosa:observedProperty'){
                let property = triples[i].object;
                let AQPart = property.substring(property.lastIndexOf('/') + 1, property.length);

                if(!AQParts.includes(AQPart)){
                    AQParts.push(AQPart);
                }

                let sensor = property.substring(0, property.lastIndexOf('/'));
                if(!st.has(sensor)){
                    st.set(sensor, [property]);
                } else {
                    let properties = st.get(sensor);
                    if(!properties.includes(property)){
                        properties.push(property);
                        st.set(sensor, properties);
                    }
                }
            }
        }

        let staticTriples = [];
        for(let i = 0 ; i < AQParts.length ; i++){
            staticTriples.push({
                subject: AQParts[i],
                predicate: 'rdf:type',
                object: 'sosa:FeatureOfInterest'
            })
        }

        for(let sensor of st.keys()){
            let properties = st.get(sensor);
            staticTriples.push({
                subject: sensor,
                predicate: 'rdf:type',
                object: 'sosa:Sensor'
            });

            for(let i = 0 ; i < properties.length ; i++){
                staticTriples.push({
                    subject: sensor,
                    predicate: 'sosa:observes',
                    object: properties[i]
                })
            }
        }
        return staticTriples;
    }


    get serverUrl() {
        return this._serverUrl;
    }

    get name() {
        return this._name;
    }

    get websocket() {
        return this._websocket;
    }

    get fragmentsPath() {
        return this._fragmentsPath;
    }

    get prefixes() {
        return this._prefixes;
    }

    get fragmentsMaxSize() {
        return this._fragmentMaxSize;
    }

    get latestGat() {
        return this._latestGat;
    }

    set latestGat(date) {
        this._latestGat = date;
    }
}

module.exports = TimeRangeData;