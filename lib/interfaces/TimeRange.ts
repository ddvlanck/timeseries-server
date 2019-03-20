export {}
const MultidimensionalInterface = require('../MultidimensionalInterface');
const Utils = require('../Utils');
const moment = require('moment');       // Library for parsing, validating, manipulating, and formatting dates.

class TimeRange extends MultidimensionalInterface {

    private _serverUrl: string;
    private _name: string;
    private _websocket: boolean;
    private _fragmentsPath: string;
    private _staticTriples: string;
    private _latestGat;
    private _latestData;

    constructor(config, commMan: CommunicationManager){
        super(commMan);
        this._serverURL = this.commMan.config.serverUrl;
        this._name = config.name;
        this._websocket = config.websocket;
        this._fragmentsPath = config.fragmentsPath;
        this._staticTriples = config.staticTriples;
        this._latestGat = null;

        // Init storage folder
        Utils.createFolder(this._fragmentsPath);

        // Load HTTP interfaces for this interface
        this.setupPollInterfaces();

        // Load Websocket interface
        if(this.websocket){
            this.setupPubSubInterface(this.name, config.wsPort);
        }
    }

    setupPollInterfaces(){
        const self = this;

        // YEAR
        this.commMan.router.get('/' + this.name + '/fragment/:year', async (ctx, next) => {
            ctx.response.set({'Access-Control-Allow-Origin' : '*'});

            // In order te get all the values from the year 2018
            // you enter 2018_2019 in the URL
            const filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '.trig';
            await this.handleRequest(ctx, filePath, true, true);
        });

        // MONTH
        this.commMan.router.get('/' + this.name + '/fragment/:year/:month', async (ctx, next) => {
            ctx.response.set({'Access-Control-Allow-Origin' : '*'});

            // In order to get all the values from the month march (3th month)
            // you enter 03_04 in the URL
            const filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '-' + ctx.params.month.split('_')[0] + '.trig';
            await this.handleRequest(ctx, filePath, true, true);
        });

        // DAY
        this.commMan.router.get('/' + this.name + '/fragment/:year/:month/:day', async (ctx ,next) => {
            ctx.response.set({'Access-Control-Allow-Origin' : '*'});

            // In order to get all the values from a specific day (eg. 15)
            // you enter 15_16 in the URL
            const filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '-'
                + ctx.params.month.split('_')[0] + '-' + ctx.params.day.split('_')[0] + '.trig';

            await this.handleRequest(ctx, filePath, true, true);
        });

        // HOUR
        this.commMan.router.get('/' + this.name + '/fragment/:year/:month/:day/:hour', async (ctx ,next) => {
            ctx.response.set({'Access-Control-Allow-Origin' : '*'});

            // In order to get all the values from 15h till 16h
            // you enter 15_16 in the URL
            const filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '-'
                + ctx.params.month.split('_')[0] + '-' + ctx.params.day.split('_')[0] + 'T'
                + ctx.params.hour.split('_')[0] + '.trig';

            await this.handleRequest(ctx, filePath, true, false);
        });
    }

    async handleRequest(ctx, filePath: string, metadata: boolean, calculateData: boolean){

        if(!Utils.exists(filePath)){

            // If it doesn't exist, we search for triples and create the file.
            // If not triples were found, then we return an error.
            if(calculateData){
                let files = Utils.getFilesFromInterfaceByParams(filePath.substring(0, filePath.lastIndexOf('/')), ctx);
                Utils.getAllDataToGenerateFile(filePath, files);

            } else {
                ctx.response.status = 404;
                ctx.response.body = "[TimeRange]: No data found.";
            }


        } else {
            let st = await Utils.getTriplesFromFile(this.staticTriples);    // Static triples -- those triples that do not change in an update (eg. location of sensor, type of sensor, name of sensor)
            let ft = await Utils.getTriplesFromFile(filePath);              // New triples received through an update and stored in a file on the disk

            if(metadata){
                let fragmentID = (Utils.getTriplesBySPOG(ft[1], null, 'http://www.w3.org/ns/prov#generatedAtTime', null, null)[0]).subject;
                this.addMetadata(fragmentID, ft[1]);
            }

            ctx.response.set({'Content-Type' : 'text/plain'});
            ctx.response.body = await Utils.formatTriples('application/trig', st[1].concat(ft[1]), st[0]);
        }
    }

    // Looks like we will not need this anymore
    async onData(data){
        this.latestData = data;
        this.latestGat = moment(await Utils.getGeneratedAtTimeValue(this.latestData));
        let gat = this.latestGat;   // gat = Generated At Time
        gat.utc();

        let hlevel = await this.handleHourLevel(this.latestData, gat);

        /*let dlevel = await this.handleDayLevel(hlevel, gat);
        let mlevel = await this.handleMonthLevel(dlevel, gat);
        await this.handleYearLevel(mlevel, gat);*/

        // If possible, push data to subscribed client via Websocket
        /*if(this.websocket){
            let st = await Utils.getTriplesFromFile(this.staticTriples);
            st[1] = st[1].concact(hlevel[0]);
            let rdf = await Utils.formatTriples('application/trig', st[1], st[0]);
            super.commMan.pushData(this.name, rdf);
        }*/
    }

    getTriplesForDate(date){
        // TODO:
    }

    //////////////////////////////////////////////////////
    ////////////////////// HOURS /////////////////////////
    //////////////////////////////////////////////////////

    async handleHourLevel(rawdata, gat){
        const hourPath = this.fragmentsPath + '/' + gat.format('YYYY-MM-DDTHH') + '.trig';
        let data = null;
        let values = null;
        console.log("Path: " + hourPath);

        if(Utils.exists(hourPath)){
            const newTriples = (await Utils.getTriplesFromString(rawdata.toString()))[1];
            const storedTriples = (await Utils.getTriplesFromFile(hourPath))[1];
            [data, values] = await this.updateHourFragment(newTriples, storedTriples, gat);
            //await Utils.overwriteFile(hourPath, await Utils.formatTriples('application/trig', data));
            await Utils.appendToFile(hourPath, await Utils.formatTriples('application/trig', data));
        } else {
            [data, values] = await this.createHourFragment(gat);
            await Utils.appendToFile(hourPath, await Utils.formatTriples('application/trig', data));
        }
        return [data, values];
    }

    async createHourFragment(gat){
        let tempDate = moment(gat);
        const nextMonth = tempDate.add('1', 'M').format('MM');
        tempDate = moment(gat);
        const nextDay = tempDate.add('1', 'd').format('DD');
        tempDate = moment(gat);
        const nextHour = tempDate.add('1', 'h').format('HH');

        const rangeGate = this.serverUrl + this.name + '/fragment/' + gat.year() + '_' + (gat.year() + 1) + '/'
            + gat.format('MM') + '_' + nextMonth + '/' + gat.format('DD') + '_' + nextDay;

        const fragmentID = rangeGate + gat.format('HH') + '_' + nextHour;
        const quads = (await Utils.getTriplesFromString(this.latestData.toString()))[1];
        let values = new Map();

        tempDate = moment(gat);
        tempDate.minutes(0).seconds(0).milliseconds(0);

        for(let i = 0 ; i < quads.length ; i++){
            if (quads[i].predicate === 'http://vocab.datex.org/terms#parkingNumberOfVacantSpaces') {
                quads[i].graph = fragmentID;
                quads[i].predicate = 'http://datapiloten.be/vocab/timeseries#mean';
                values.set(quads[i].subject, Utils.getLiteralValue(quads[i].object));
            }

            if (quads[i].predicate === 'http://www.w3.org/ns/prov#generatedAtTime') {
                quads[i].subject = fragmentID;
            }
        }

        quads.push({
            subject: fragmentID,
            predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
            object: 'http://w3id.org/multidimensional-interface/ontology#RangeFragment'
        });
        quads.push({
            subject: fragmentID,
            predicate: 'http://w3id.org/multidimensional-interface/ontology#initial',
            object: '"' + tempDate.toISOString() + '"'
        });
        quads.push({
            subject: fragmentID,
            predicate: 'http://w3id.org/multidimensional-interface/ontology#final',
            object: '"' + tempDate.add(1, 'h').toISOString() + '"'
        });
        quads.push({
            subject: fragmentID,
            predicate: 'http://w3id.org/multidimensional-interface/ontology#hasRangeGate',
            object: rangeGate
        });
        quads.push({
            subject: fragmentID,
            predicate: 'http://datapiloten.be/vocab/timeseries#sampleSize',
            object: '"1"'
        });

        return [quads, values];
    }

    updateHourFragment(newer, old, gat) {
        let newValues = this.getPVFromRawData(newer);
        let sampleTriple = Utils.getTriplesBySPOG(old, null, 'http://datapiloten.be/vocab/timeseries#sampleSize')[0];
        let sampleValue = parseInt(Utils.getLiteralValue(sampleTriple.object));
        let values = new Map();

        for (let i in old) {
            if (old[i].predicate === 'http://datapiloten.be/vocab/timeseries#mean') {
                old[i].object = '"' + this.calculateMean(parseInt(newValues.get(old[i].subject)),
                    parseInt(Utils.getLiteralValue(old[i].object)), sampleValue) + '"';
                values.set(old[i].subject, Utils.getLiteralValue(old[i].object));
            }

            if (old[i].predicate === 'http://www.w3.org/ns/prov#generatedAtTime') {
                old[i].object = '"' + gat.toISOString() + '"';
            }

            if (old[i].predicate === 'http://datapiloten.be/vocab/timeseries#sampleSize') {
                old[i].object = '"' + (sampleValue + 1) + '"';
            }
        }

        return [old, values];
    }

    //////////////////////////////////////////////////////
    ////////////////////// DAYS //////////////////////////
    //////////////////////////////////////////////////////

    async handleDayLevel(hlevel, gat) {
        const dayPath = this.fragmentsPath + '/' + gat.format('YYYY-MM-DD') + '.trig';
        let data = null;
        let values = null;

        if (Utils.exists(dayPath)) {
            const storedTriples = (await Utils.getTriplesFromFile(dayPath))[1];
            [data, values] = await this.updateFragment(hlevel[1], storedTriples, gat);
            await Utils.overwriteFile(dayPath, await Utils.formatTriples('application/trig', data));
        } else {
            data = this.createDayFragment(hlevel[0], gat);
            values = hlevel[1];
            await Utils.appendToFile(dayPath, await Utils.formatTriples('application/trig', data));
        }

        return [data, values];
    }

    createDayFragment(hlevel, gat){
        let tempDate = moment(gat);
        let nextMonth = tempDate.add(1, 'M').format('MM');
        tempDate = moment(gat);
        let nextDay = tempDate.add(1, 'd').format('DD');

        let rangeGate = this.serverUrl + this.name + '/fragment/' + gat.year() + '_' + (gat.year() + 1) + '/'
            + gat.format('MM') + '_' + nextMonth + '/';
        let fragmentId = rangeGate + gat.format('DD') + '_' + nextDay;

        tempDate = moment(gat);
        tempDate.hours(0).minutes(0).seconds(0).milliseconds(0);

        for (let i = 0; i < hlevel.length; i++) {
            if (hlevel[i].graph) {
                hlevel[i].graph = fragmentId;
            } else {
                hlevel[i].subject = fragmentId;
            }

            if (hlevel[i].predicate === 'http://w3id.org/multidimensional-interface/ontology#initial') {
                hlevel[i].object = '"' + tempDate.toISOString() + '"';
            }

            if (hlevel[i].predicate === 'http://w3id.org/multidimensional-interface/ontology#final') {
                hlevel[i].object = '"' + tempDate.add(1, 'd').toISOString() + '"';
            }

            if (hlevel[i].predicate === 'http://w3id.org/multidimensional-interface/ontology#hasRangeGate') {
                hlevel[i].object = rangeGate;
            }

            if (hlevel[i].predicate === 'http://datapiloten.be/vocab/timeseries#sampleSize') {
                hlevel[i].object = '"1"';
            }
        }
        return hlevel;
    }

    //////////////////////////////////////////////////////
    ////////////////////// MONTH /////////////////////////
    //////////////////////////////////////////////////////

    async handleMonthLevel(dlevel, gat) {
        const monthPath = this.fragmentsPath + '/' + gat.format('YYYY-MM') + '.trig';
        let data = null;
        let values = null;

        if (Utils.exists(monthPath)) {
            const storedTriples = (await Utils.getTriplesFromFile(monthPath))[1];
            [data, values] = await this.updateFragment(dlevel[1], storedTriples, gat);
            await Utils.overwriteFile(monthPath, await Utils.formatTriples('application/trig', data));
        } else {
            data = this.createMonthFragment(dlevel[0], gat);
            values = dlevel[1];
            await Utils.appendToFile(monthPath, await Utils.formatTriples('application/trig', data));
        }

        return [data, values];
    }

    createMonthFragment(dlevel, gat) {
        let tempDate = moment(gat);
        let nextMonth = tempDate.add(1, 'M').format('MM');

        let rangeGate = this.serverUrl + this.name + '/fragment/' + gat.year() + '_' + (gat.year() + 1) + '/';
        let fragmentId = rangeGate + gat.format('MM') + '_' + nextMonth;

        tempDate = moment(gat);
        tempDate.date(1).hours(0).minutes(0).seconds(0).milliseconds(0);

        for (let i = 0; i < dlevel.length; i++) {
            if (dlevel[i].graph) {
                dlevel[i].graph = fragmentId;
            } else {
                dlevel[i].subject = fragmentId;
            }

            if (dlevel[i].predicate === 'http://w3id.org/multidimensional-interface/ontology#initial') {
                dlevel[i].object = '"' + tempDate.toISOString() + '"';
            }

            if (dlevel[i].predicate === 'http://w3id.org/multidimensional-interface/ontology#final') {
                dlevel[i].object = '"' + tempDate.add(1, 'M').toISOString() + '"';
            }

            if (dlevel[i].predicate === 'http://w3id.org/multidimensional-interface/ontology#hasRangeGate') {
                dlevel[i].object = rangeGate;
            }

            if (dlevel[i].predicate === 'http://datapiloten.be/vocab/timeseries#sampleSize') {
                dlevel[i].object = '"1"';
            }
        }

        return dlevel;
    }

    //////////////////////////////////////////////////////
    ////////////////////// YEARS /////////////////////////
    //////////////////////////////////////////////////////
    async handleYearLevel(mlevel, gat) {
        const yearPath = this.fragmentsPath + '/' + gat.format('YYYY') + '.trig';
        let data = null;
        let values = null;

        if (Utils.exists(yearPath)) {
            const storedTriples = (await Utils.getTriplesFromFile(yearPath))[1];
            [data, values] = await this.updateFragment(mlevel[1], storedTriples, gat);
            await Utils.overwriteFile(yearPath, await Utils.formatTriples('application/trig', data));
        } else {
            data = this.createYearFragment(mlevel[0], gat);
            values = mlevel[1];
            await Utils.appendToFile(yearPath, await Utils.formatTriples('application/trig', data));
        }

        return [data, values];
    }

    createYearFragment(mlevel, gat) {
        let tempDate = moment(gat);
        let fragmentId = this.serverUrl + this.name + '/fragment/' + gat.year() + '_' + (gat.year() + 1);

        tempDate.month(0).date(1).hours(0).minutes(0).seconds(0).milliseconds(0);

        for (let i = 0; i < mlevel.length; i++) {
            if (mlevel[i].graph) {
                mlevel[i].graph = fragmentId;
            } else {
                mlevel[i].subject = fragmentId;
            }

            if (mlevel[i].predicate === 'http://w3id.org/multidimensional-interface/ontology#initial') {
                mlevel[i].object = '"' + tempDate.toISOString() + '"';
            }

            if (mlevel[i].predicate === 'http://w3id.org/multidimensional-interface/ontology#final') {
                mlevel[i].object = '"' + tempDate.add(1, 'y').toISOString() + '"';
            }

            if (mlevel[i].predicate === 'http://datapiloten.be/vocab/timeseries#sampleSize') {
                mlevel[i].object = '"1"';
            }
        }

        mlevel = mlevel.filter(m => m.predicate !== 'http://w3id.org/multidimensional-interface/ontology#hasRangeGate');

        return mlevel;
    }

    //////////////////////////////////////////////////////

    updateFragment(newValues, old, gat) {
        let sampleTriple = Utils.getTriplesBySPOG(old, null, 'http://datapiloten.be/vocab/timeseries#sampleSize')[0];
        let sampleValue = parseInt(Utils.getLiteralValue(sampleTriple.object));

        for (let i in old) {
            if (old[i].predicate === 'http://datapiloten.be/vocab/timeseries#mean') {
                old[i].object = '"' + this.calculateMean(parseInt(newValues.get(old[i].subject)),
                    parseInt(Utils.getLiteralValue(old[i].object)), sampleValue) + '"';
                newValues.set(old[i].subject, Utils.getLiteralValue(old[i].object));
            }

            if (old[i].predicate === 'http://www.w3.org/ns/prov#generatedAtTime') {
                old[i].object = '"' + gat.toISOString() + '"';
            }

            if (old[i].predicate === 'http://datapiloten.be/vocab/timeseries#sampleSize') {
                old[i].object = '"' + (sampleValue + 1) + '"';
            }
        }

        return [old, newValues];
    }

    addMetadata(fragmentId, level) {
        level.push({
            subject: fragmentId,
            predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
            object: 'http://w3id.org/multidimensional-interface/ontology#RangeGate'
        });
        level.push({
            subject: fragmentId,
            predicate: 'http://www.w3.org/ns/hydra/core#search',
            object: fragmentId + '#search'
        });
        level.push({
            subject: fragmentId + '#search',
            predicate: 'http://www.w3.org/ns/hydra/core#template',
            object: '"' + fragmentId + '/{+initial_final}' + '"'
        });
        level.push({
            subject: fragmentId + '#search',
            predicate: 'http://www.w3.org/ns/hydra/core#mapping',
            object: '"' + fragmentId + '#mapping' + '"'
        });
        level.push({
            subject: fragmentId + '#mapping',
            predicate: 'http://www.w3.org/ns/hydra/core#variable',
            object: '"initial"'
        });
        level.push({
            subject: fragmentId + '#mapping',
            predicate: 'http://www.w3.org/ns/hydra/core#variable',
            object: '"final"'
        });
        level.push({
            subject: fragmentId + '#mapping',
            predicate: 'http://www.w3.org/ns/hydra/core#property',
            object: 'http://w3id.org/multidimensional-interface/ontology#initial'
        });
        level.push({
            subject: fragmentId + '#mapping',
            predicate: 'http://www.w3.org/ns/hydra/core#property',
            object: 'http://w3id.org/multidimensional-interface/ontology#final'
        });
    }

    getPVFromRawData(triples) {
        let res = new Map();
        for (let i in triples) {
            if (triples[i].predicate === 'http://vocab.datex.org/terms#parkingNumberOfVacantSpaces') {
                res.set(triples[i].subject, Utils.getLiteralValue(triples[i].object));
            }
        }
        return res;
    }

    calculateMean(n, aggregate, sample) {
        return Math.floor(((aggregate * sample) + n) / (sample + 1));
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

    get latestGat() {
        return this._latestGat;
    }

    set latestGat(date) {
        this._latestGat = date;
    }
}

module.exports = TimeRange;