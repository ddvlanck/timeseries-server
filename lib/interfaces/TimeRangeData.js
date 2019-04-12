const MultidimensionalInterface = require('../MultidimensionalInterface');
const CommunicationManager = require('../CommunicationManager');
const Utils = require('../Utils');
const moment = require('moment');       // Library for parsing, validating, manipulating, and formatting dates.

class TimeRangeData extends MultidimensionalInterface {

    constructor(config, commMan){
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

    async onData(data){}

    setupPollInterfaces(){
        let self = this;

        this.commMan.router.get('/' + this.name + '/fragment/:year', async (ctx, next) => {
            ctx.response.set({ 'Access-Control-Allow-Origin': '*' });
            let filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '.trig';
            await this.handleRequest(ctx, filePath, true, "year");
        });

        this.commMan.router.get('/' + this.name + '/fragment/:year/:month', async (ctx, next) => {
            ctx.response.set({ 'Access-Control-Allow-Origin': '*' });
            let filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '-' + ctx.params.month.split('_')[0] + '.trig';
            await this.handleRequest(ctx, filePath, true, "month");
        });

        this.commMan.router.get('/' + this.name + '/fragment/:year/:month/:day', async (ctx, next) => {
            ctx.response.set({ 'Access-Control-Allow-Origin': '*' });
            let filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '-' + ctx.params.month.split('_')[0] + '-'
                + ctx.params.day.split('_')[0] + '.trig';

            await this.handleRequest(ctx, filePath, true, "day");
        });

        this.commMan.router.get('/' + this.name + '/fragment/:year/:month/:day/:hour', async (ctx, next) => {
            ctx.response.set({ 'Access-Control-Allow-Origin': '*' });
            let filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '-' + ctx.params.month.split('_')[0] + '-'
                + ctx.params.day.split('_')[0] + 'T' + ctx.params.hour.split('_')[0] + '.trig';
            await this.handleRequest(ctx, filePath, false, "hour");
        });
    }

    async handleRequest(ctx, filePath, metadata, time) {
        if(!Utils.exists(filePath)) {
            const expiredInterval = this.expiredTimeInterval(ctx, time);
            const files = Utils.getFragmentsToGenerateData(ctx, time);

            if(files.length === 0){
                ctx.response.status = 404;
                ctx.response.body = "[TimeRange]: No data found";
            } else {
                let triplesArray = [[], []];
                for(let index in files){
                    let ft = await Utils.getTriplesFromFile('./example/data/RawData/' + files[index]);
                    Array.prototype.push.apply(triplesArray[1], ft[1]);
                }

                const fileTriples = await Utils.formatTriples('application/trig', triplesArray[1], triplesArray[0]);

                if(expiredInterval){
                    this.storeData(filePath, fileTriples);
                }

                const st = await Utils.getTriplesFromFile(this.staticTriples);

                if(metadata){
                    let fragmentId = Utils.getTriplesBySPOG(triplesArray[1], null, 'http://www.w3.org/ns/prov#generatedAtTime')[0].subject;
                    //this.addMetadata(fragmentId, fileTriples[1]);
                }

                ctx.response.set({'Content-Type': 'text/plain'});
                ctx.response.body = await Utils.formatTriples('application/trig', st[1].concat(triplesArray[1]), st[0]);

            }
        } else {
            let st = await Utils.getTriplesFromFile(this.staticTriples);
            let ft = await Utils.getTriplesFromFile(filePath);

            if(metadata) {

                // TODO : function addMetadata does not exist (metadata is not the same as static triples)
                // What kind of metadata should be added?
                // this function needs to have links to other files
                // for example, a file containing triples for a year needs to have links to the files containing the values of the months of that year
                let fragmentId = Utils.getTriplesBySPOG(ft[1], null, 'http://www.w3.org/ns/prov#generatedAtTime')[0].subject;
                //this.addMetadata(fragmentId, ft[1]);
            }

            ctx.response.set({'Content-Type': 'text/plain'});
            ctx.response.body = await Utils.formatTriples('application/trig', st[1].concat(ft[1]), st[0]);
        }
    }

    // TODO : if max size is exceeded, make more files
    // Maybe do the check in Utils
    async storeData(filePath, data){
        const bytes = Buffer.from(data).byteLength;
        await Utils.appendToFile(filePath, data);
    }

    expiredTimeInterval(ctx, time) {
        let date;
        const currentDate = new Date();
        let expired;

        switch (time) {
            case "hour": {
                date = new Date(ctx.params.year.split('_')[0] + '-' + ctx.params.month.split('_')[0] + '-' + ctx.params.day.split('_')[0] + 'T' + ctx.params.hour.split('_')[0] + ':00:00');
                date.setHours(date.getHours() + date.getTimezoneOffset()/-60);   // Central European Time
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

        if(time === 'year'){
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

    get fragmentsMaxSize(){
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