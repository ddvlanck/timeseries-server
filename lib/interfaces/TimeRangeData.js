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

    }

    // We generate the fragments on the fly, so we don't need this function
    async onData(data) {
    }

    setupPollInterfaces() {
        let self = this;

        this.commMan.router.get('/' + this.name + '/fragment/:year', async (ctx, next) => {
            ctx.response.set({'Access-Control-Allow-Origin': '*'});
            let filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '.trig';
            await this.handleRequest(ctx, filePath, "year");
        });

        this.commMan.router.get('/' + this.name + '/fragment/:year/:month', async (ctx, next) => {
            ctx.response.set({'Access-Control-Allow-Origin': '*'});
            let filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '-' + ctx.params.month.split('_')[0] + '.trig';
            await this.handleRequest(ctx, filePath, "month");
        });

        this.commMan.router.get('/' + this.name + '/fragment/:year/:month/:day', async (ctx, next) => {
            ctx.response.set({'Access-Control-Allow-Origin': '*'});
            let filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '-' + ctx.params.month.split('_')[0] + '-'
                + ctx.params.day.split('_')[0] + '.trig';

            await this.handleRequest(ctx, filePath, "day");
        });

        this.commMan.router.get('/' + this.name + '/fragment/:year/:month/:day/:hour', async (ctx, next) => {
            ctx.response.set({'Access-Control-Allow-Origin': '*'});
            let filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '-' + ctx.params.month.split('_')[0] + '-'
                + ctx.params.day.split('_')[0] + 'T' + ctx.params.hour.split('_')[0] + '.trig';
            await this.handleRequest(ctx, filePath, "hour");
        });

    }

    async handleRequest(ctx, filePath, time) {
        let file = filePath.substr(0, filePath.lastIndexOf('.trig')) + '_fragment1.trig';

        // Check if the time range is already expired
        const expiredInterval = this.expiredTimeInterval(ctx, time);
        if (!Utils.exists(file)) { // No fragments exist for time range

            const files = Utils.getFragmentsToGenerateData(ctx, time);

            if (files.length === 0) {
                ctx.response.status = 404;
                ctx.response.body = "[TimeRange]: No data found";
                return;

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

                for (let i = 0; i < triples.length; i++) {
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

                if (expiredInterval) {
                    await this.storeData(filePath, triples);
                } else {
                    // We sturen alle data terug, want er worden geen fragments aangemaakt.
                    let fragmentId = Utils.getTriplesBySPOG(triples, null, 'http://www.w3.org/ns/prov#generatedAtTime')[0].subject;
                    this.createMetadata(fragmentId, triples);

                    const data = await Utils.formatTriples('application/trig', st.concat(triples), prefixes);

                    ctx.response.set({'Content-Type': 'text/plain'});
                    ctx.response.body = data;
                    return;
                }
            }
        }
        let triples;
        let previousnumber = -1;

        // We need to check whether the client asks for a specific fragment (then '_fragment is present)
        // Or whether the client just ask for a time range and the fragments were already generated
        if (ctx.request.url.indexOf('_fragment') >= 0) {
            // Clients asks for a specific fragment
            let fragmentNumber = parseInt(ctx.request.url.substring(ctx.request.url.indexOf('_fragment') + 9, ctx.request.url.indexOf('.trig')));
            let file = filePath.substring(0, filePath.lastIndexOf('.trig')) + '_fragment' + fragmentNumber + '.trig';

            triples = (await Utils.getTriplesFromFile(file))[1];
            if (fragmentNumber > 1) {
                previousnumber = fragmentNumber - 1;
            }

        } else {
            let [fragments, index] = await Utils.getFragmentsForTimeRange(filePath, null);
            triples = (await Utils.getTriplesFromFile(this.fragmentsPath + '/' + fragments[fragments.length - 1]))[1];

            if (fragments.length > 1) {
                previousnumber = fragments.length - 1;
            }
        }
        const prefixes = (await Utils.getTriplesFromFile(this.prefixes))[0];
        const st = await this.createStaticTriples(triples);

        // Add graph to triples
        let graph = this.serverUrl.substr(0, this.serverUrl.length - 1) + ctx.request.url;
        let gat = new Date();
        gat.setHours(gat.getHours() + gat.getTimezoneOffset() / -60);

        for (let i = 0; i < triples.length; i++) {
            triples[i].graph = graph;
        }

        triples.unshift({
            subject: graph,
            predicate: 'http://www.w3.org/ns/prov#generatedAtTime',
            object: '"' + gat.toISOString() + '"'
        });

        let fragmentId = Utils.getTriplesBySPOG(triples, null, 'http://www.w3.org/ns/prov#generatedAtTime')[0].subject;
        this.createMetadata(fragmentId, triples);

        // Hydra:previous
        if (previousnumber > 0) {
            let previousFile = this.serverUrl + "TimeRangeData/fragment" + filePath.substring(filePath.lastIndexOf('/'), filePath.lastIndexOf('.trig')) + '_fragment' + previousnumber + '.trig';
            triples.push({
                subject: fragmentId,
                predicate: 'hydra:previous',
                object: previousFile
            })
        }

        // Caching
        if (expiredInterval) {
            // Cache older fragment that won't change over time
            ctx.response.set({'Cache-Control': 'public, max-age=31536000, inmutable'});
        } else {
            // Do not cache current fragment as it will get more data
            ctx.response.set({'Cache-Control': 'no-cache, no-store, must-revalidate'});
        }


        const data = await Utils.formatTriples('application/trig', st.concat(triples), prefixes);

        ctx.response.set({'Content-Type': 'text/plain'});
        ctx.response.body = data;

    }

    // Temporary fix
    async storeData(filePath, triples) {
        // Each observation contains the same amount of triples
        let tripleCounter = 0;
        let observationTriples = [];
        let byteCounter = 0;
        let fragmentCounter = 1;

        // We start at 1 because we don't need the prov:generatedAtTime
        for (let i = 1; i < triples.length; i++) {
            triples[i].graph = "";

            if (tripleCounter === 10) {
                let data = await Utils.formatTriples('application/trig', observationTriples, {});
                tripleCounter = 0;
                observationTriples = []

                let bytes = Buffer.from(data).byteLength;
                if (byteCounter + bytes > this.fragmentsMaxSize) {
                    fragmentCounter++;
                    byteCounter = 0;
                }

                await Utils.appendToFile(filePath.substring(0, filePath.indexOf('.trig')) + '_fragment' + fragmentCounter + '.trig', data);
                byteCounter += bytes;

            }

            observationTriples.push(triples[i]);
            tripleCounter++;
        }
    }

    // Something is wrong with this function
    /*async storeData(filePath, triples) {
        let observationID = null;
        let observationTriples = [];
        let byteCounter = 0;
        let fragmentCounter = 1;
        let buffer = [];
        console.log(triples);

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
                        let result = await Utils.formatTriples('application/trig', buffer, {});
                        result = result.substring(result.indexOf('<Observation'), result.lastIndexOf('}'));   // Skip prefixes
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
        let data = await Utils.formatTriples('application/trig', observationTriples, {});
        data = data.substring(data.indexOf('<Observation'), data.lastIndexOf('}'));   // Skip prefixes

        let bytes = Buffer.from(data).byteLength;
        if(byteCounter + bytes > this.fragmentsMaxSize){
            fragmentCounter++;
        }
        await Utils.appendToFile(filePath.substring(0, filePath.indexOf('.trig')) + '_fragment' + fragmentCounter + '.trig', data);

    }*/

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

    createStaticTriples(triples) {
        let st = new Map();
        let AQParts = [];
        for (let i = 0; i < triples.length; i++) {
            if (triples[i].predicate === 'sosa:observedProperty') {
                let property = triples[i].object;
                let AQPart = property.substring(property.lastIndexOf('/') + 1, property.length);

                if (!AQParts.includes(AQPart)) {
                    AQParts.push(AQPart);
                }

                let sensor = property.substring(0, property.lastIndexOf('/'));
                if (!st.has(sensor)) {
                    st.set(sensor, [property]);
                } else {
                    let properties = st.get(sensor);
                    if (!properties.includes(property)) {
                        properties.push(property);
                        st.set(sensor, properties);
                    }
                }
            }
        }

        let staticTriples = [];
        for (let i = 0; i < AQParts.length; i++) {
            staticTriples.push({
                subject: AQParts[i],
                predicate: 'rdf:type',
                object: 'sosa:FeatureOfInterest'
            })
        }

        for (let sensor of st.keys()) {
            let properties = st.get(sensor);
            staticTriples.push({
                subject: sensor,
                predicate: 'rdf:type',
                object: 'sosa:Sensor'
            });

            for (let i = 0; i < properties.length; i++) {
                staticTriples.push({
                    subject: sensor,
                    predicate: 'sosa:observes',
                    object: properties[i]
                })
            }
        }
        return staticTriples;
    }

    // TODO: verify metadata
    createMetadata(fragmentID, triples) {
        triples.push({
            subject: fragmentID,
            predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
            object: 'http://w3id.org/multidimensional-interface/ontology#RangeGate'
        });
        triples.push({
            subject: fragmentID,
            predicate: 'http://www.w3.org/ns/hydra/core#search',
            object: fragmentID + '#search'
        });
        triples.push({
            subject: fragmentID + '#search',
            predicate: 'http://www.w3.org/ns/hydra/core#template',
            object: '"' + fragmentID + '/{+initial_final}' + '"'
        });
        triples.push({
            subject: fragmentID + '#search',
            predicate: 'http://www.w3.org/ns/hydra/core#mapping',
            object: '"' + fragmentID + '#mapping' + '"'
        });
        triples.push({
            subject: fragmentID + '#mapping',
            predicate: 'http://www.w3.org/ns/hydra/core#variable',
            object: '"initial"'
        });
        triples.push({
            subject: fragmentID + '#mapping',
            predicate: 'http://www.w3.org/ns/hydra/core#variable',
            object: '"final"'
        });
        triples.push({
            subject: fragmentID + '#mapping',
            predicate: 'http://www.w3.org/ns/hydra/core#property',
            object: 'http://w3id.org/multidimensional-interface/ontology#initial'
        });
        triples.push({
            subject: fragmentID + '#mapping',
            predicate: 'http://www.w3.org/ns/hydra/core#property',
            object: 'http://w3id.org/multidimensional-interface/ontology#final'
        });
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