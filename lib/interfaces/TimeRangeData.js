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
        this._staticTriples = config.staticTriples;
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

    async onData(data) {
    }

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
                + ctx.params.day.split('_')[0] + 'T' + ctx.params.hour + '.trig';
            await this.handleRequest(ctx, filePath, false, "hour");
        });
    }

    async handleRequest(ctx, filePath, metadata, time) {

        let file;
        if(filePath.indexOf('_fragment') < 0){
            file = filePath.substring(0, filePath.lastIndexOf('.trig')) + '_fragment1.trig';
        } else {
            file = filePath
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
                    if (!triplesArray[1][i].graph) {
                        triplesArray[1].splice(i, 1);
                        i--;
                    } else {
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

            let ft = await Utils.getTriplesFromFile(file);
            let st = await this.createStaticTriples(ft[1]);

            // TODO : add graph


            if (metadata) {

                // TODO : function addMetadata does not exist (metadata is not the same as static triples)
                // What kind of metadata should be added?
                // this function needs to have links to other files
                // for example, a file containing triples for a year needs to have links to the files containing the values of the months of that year
                //let fragmentId = Utils.getTriplesBySPOG(ft[1], null, 'http://www.w3.org/ns/prov#generatedAtTime')[0].subject;

                //this.addMetadata(fragmentId, ft[1]);
            }

            ctx.response.set({'Content-Type': 'text/plain'});
            ctx.response.body = await Utils.formatTriples('application/trig', st.concat(ft[1]), {});
        }
    }

    async storeData(filePath, triples) {
        let observationID = null;
        let observationTriples = [];
        let byteCounter = 0;
        let fragmentCounter = 1;

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
                        fragmentCounter++;
                        byteCounter = 0;
                    }
                    await Utils.appendToFile(filePath.substring(0, filePath.indexOf('.trig')) + '_fragment' + fragmentCounter + '.trig', data);
                    byteCounter += bytes;
                    observationTriples = [];
                    observationID = triples[i].subject;


                } else if(triples[i].predicate === 'rdf:type' && triples[i].object === 'schema:GeoCoordinates'){
                    observationTriples.push(triples[i]);
                }
            }
        }
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

    get staticTriples() {
        return this._staticTriples;
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