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
        this._prefixes = config.prefixes;
        this._latestGat = null;

        this._fragmentCounterHour = 1;
        this._fragmentCounterDay = 1;
        this._fragmentCounterMonth = 1;
        this._fragmentCounterYear = 1;

        this._byteCounterHour = 0;
        this._byteCounterDay = 0;
        this._byteCounterMonth = 0;
        this._byteCounterYear = 0;

        // Init storage folder
        Utils.createFolder(this.fragmentsPath);

        // Load HTTP interfaces for this interface
        this.setupPollInterfaces();

    }

    async onData(data) {
        this.latestData = data;
        this.latestGat = moment(await Utils.getResultTimeValue(this.latestData));
        let gat = this.latestGat;
        gat.utc();

        let hlevel = await this.handleHourLevel(this.latestData, gat);
        let dlevel = await this.handleDayLevel(hlevel, gat);
        let mlevel = await this.handleMonthLevel(dlevel, gat);
        await this.handleYearLevel(mlevel, gat);
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
        let file;
        let asksFragment;
        let fragmentNumber;

        if (ctx.request.url.indexOf('_fragment') >= 0) {
            asksFragment = true;
            let params = ctx.request.url.split('_');
            fragmentNumber = params[params.length - 1].split('.')[0];
            file = filePath.substring(0, filePath.lastIndexOf('.trig')) + '_fragment_' + fragmentNumber + '.trig'
        } else {
            asksFragment = false;
            // If there exists a time range, this fragment will always exist.
            file = filePath.substring(0, filePath.lastIndexOf('.trig')) + '_fragment_1.trig';
        }

        if (!Utils.exists(file)) {
            ctx.response.status = 404;
            ctx.response.body = "[TimeRange]: No data was found or you requested the wrong fragment.";
        } else {

            // Get all fragments for the time range -- to add hydra:previous if clients asks for specific fragment
            // Or to return most recent fragment if clients ask for the tile (also with hydra:previous)
            let fragments = [];
            if (asksFragment) {
                let fragmentNumber = parseInt(ctx.request.url.split('_')[2].split('.')[0]);
                fragments = Utils.getFragmentsForTimeRange(filePath, fragmentNumber);
            } else {
                fragments = Utils.getFragmentsForTimeRange(filePath, null);
                // Return most recent fragment instead of first fragment
                file = this.fragmentsPath + '/' + fragments[0][fragments[0].length - 1];
            }
            let index = fragments[1];  // Bevat locatie van het gevraagde fragment in de array

            let ft = await Utils.getTriplesFromFile(file);                  // File triples
            let st = await this.createStaticTriples(ft[1]);                 // Static triples (sensors)
            let pr = await Utils.getTriplesFromFile(this.staticTriples);    // Prefixes

            let [metadata, subject] = await this.addMetadata(filePath, time);

            // Hydra:previous
            if(index > 0){
                console.log("YES");
                metadata.push({
                    subject: subject,
                    predicate: 'http://www.w3.org/ns/hydra/core#previous',
                    object: subject + '_fragment_' + (index) + '.trig',
                    graph: '#Metadata'
                });
            }

            let data = await Utils.formatTriples('application/trig', st.concat(ft[1],metadata), pr[0]);


            // Cache headers
            if (index < (fragments[0].length - 1)) {
                // Cache older fragment that won't change over time
                ctx.response.set({'Cache-Control': 'public, max-age=31536000, inmutable'});
            } else {
                // Do not cache current fragment as it will get more data
                ctx.response.set({'Cache-Control': 'no-cache, no-store, must-revalidate'});
            }

            ctx.response.set({'Content-Type': 'text/plain'});
            ctx.response.body = data;
        }
    }

    async handleHourLevel(rawdata, gat) {
        let hourPath = this.fragmentsPath + '/' + gat.format('YYYY-MM-DDTHH') + '_fragment_1.trig'; // Just to check if there's data for this time range
        let data = rawdata.toString();
        let bytes = Buffer.from(data).byteLength;

        if (Utils.exists(hourPath)) {
            if (this.byteCounterHour + bytes > this.fragmentsMaxSize) {
                this.fragmentCounterHour++;
                this.byteCounterHour = 0;
            }
            let file = this.fragmentsPath + '/' + gat.format('YYYY-MM-DDTHH') + '_fragment_' + this.fragmentCounterHour + '.trig'; // Just to check if there's data for this time range
            await Utils.appendToFile(file, data);
            this.byteCounterHour += bytes;

        } else {
            this.fragmentCounterHour = 1;
            this.byteCounterHour = 0;
            await Utils.appendToFile(hourPath, data);
            this.byteCounterHour += bytes;
        }

        return data;
    }

    async handleDayLevel(hlevel, gat) {
        let dayPath = this.fragmentsPath + '/' + gat.format('YYYY-MM-DD') + '_fragment_1.trig';
        let bytes = Buffer.from(hlevel).byteLength;

        if (Utils.exists(dayPath)) {
            if (this.byteCounterDay + bytes > this.fragmentsMaxSize) {
                this.fragmentCounterDay++;
                this.byteCounterDay = 0;
            }
            let file = this.fragmentsPath + '/' + gat.format('YYYY-MM-DD') + '_fragment_' + this.fragmentCounterDay + '.trig'; // Just to check if there's data for this time range
            await Utils.appendToFile(file, hlevel);
            this.byteCounterDay += bytes;

        } else {
            this.fragmentCounterDay = 1;
            this.byteCounterDay = 0;
            await Utils.appendToFile(dayPath, hlevel);
            this.byteCounterDay += bytes;
        }

        return hlevel;


    }

    async handleMonthLevel(dlevel, gat) {
        let monthPath = this.fragmentsPath + '/' + gat.format('YYYY-MM') + '_fragment_1.trig';
        let bytes = Buffer.from(dlevel).byteLength;

        if (Utils.exists(monthPath)) {
            if (this.byteCounterMonth + bytes > this.fragmentsMaxSize) {
                this.fragmentCounterMonth++;
                this.byteCounterMonth = 0;
            }
            let file = this.fragmentsPath + '/' + gat.format('YYYY-MM') + '_fragment_' + this.fragmentCounterMonth + '.trig'; // Just to check if there's data for this time range
            await Utils.appendToFile(file, dlevel);
            this.byteCounterMonth += bytes;

        } else {
            this.fragmentCounterMonth = 1;
            this.byteCounterMonth = 0;
            await Utils.appendToFile(monthPath, dlevel);
            this.byteCounterMonth += bytes;
        }

        return dlevel;
    }

    async handleYearLevel(mlevel, gat) {
        let yearPath = this.fragmentsPath + '/' + gat.format('YYYY') + '_fragment_1.trig';
        let bytes = Buffer.from(mlevel).byteLength;

        if (Utils.exists(yearPath)) {
            if (this.byteCounterYear + bytes > this.fragmentsMaxSize) {
                this.fragmentCounterYear++;
                this.byteCounterYear = 0;
            }
            let file = this.fragmentsPath + '/' + gat.format('YYYY') + '_fragment_' + this.fragmentCounterYear + '.trig'; // Just to check if there's data for this time range
            await Utils.appendToFile(file, mlevel);
            this.byteCounterYear += bytes;

        } else {
            this.fragmentCounterYear = 1;
            this.byteCounterYear = 0;
            await Utils.appendToFile(yearPath, mlevel);
            this.byteCounterYear += bytes;
        }

        return mlevel;
    }

    addMetadata(filePath, time) {
        let initialTime = filePath.substring(filePath.lastIndexOf('/') + 1, filePath.lastIndexOf('.trig'));
        let date = moment(initialTime);
        let tempDate = moment(initialTime);
        let rangeGate;
        let fragmentId;
        let triples = [];

        if (time === "hour") {
            let nextMonth = tempDate.add(1, 'M').format('MM');
            tempDate = moment(initialTime);
            let nextDay = tempDate.add(1, 'd').format('DD');
            tempDate = moment(initialTime);
            let nextHour = tempDate.add(1, 'h').format('HH');
            rangeGate = this.serverUrl + this.name + '/fragment/' + date.year() + '_' + (date.year() + 1) + '/'
                + date.format('MM') + '_' + nextMonth + '/' + date.format('DD') + '_' + nextDay + '/';
            fragmentId = rangeGate + date.format('HH') + '_' + nextHour;


            tempDate = moment(initialTime);
            tempDate.minutes(0).seconds(0).milliseconds(0);

            triples.push({
                subject: fragmentId,
                predicate: 'http://w3id.org/multidimensional-interface/ontology#initial',
                object: '"' + tempDate.add(2, 'h').toISOString() + '"',
                graph: "#Metadata"
            });

            triples.push({
                subject: fragmentId,
                predicate: 'http://w3id.org/multidimensional-interface/ontology#final',
                object: '"' + tempDate.add(1, 'h').toISOString() + '"',
                graph: "#Metadata"
            });

        } else if (time === "day") {
            let nextMonth = tempDate.add(1, 'M').format('MM');
            tempDate = moment(initialTime);
            let nextDay = tempDate.add(1, 'd').format('DD');

            rangeGate = this.serverUrl + this.name + '/fragment/' + date.year() + '_' + (date.year() + 1) + '/'
                + date.format('MM') + '_' + nextMonth + '/';
            fragmentId = rangeGate + date.format('DD') + '_' + nextDay;

            triples.push({
                subject: fragmentId,
                predicate: 'http://w3id.org/multidimensional-interface/ontology#initial',
                object: '"' + tempDate.toISOString() + '"',
                graph: "#Metadata"
            });
            triples.push({
                subject: fragmentId,
                predicate: 'http://w3id.org/multidimensional-interface/ontology#final',
                object: '"' + tempDate.add(1, 'd').toISOString() + '"',
                graph: "#Metadata"
            });

        } else if (time === "month") {
            let nextMonth = tempDate.add(1, 'M').format('MM');

            rangeGate = this.serverUrl + this.name + '/fragment/' + date.year() + '_' + (date.year() + 1) + '/';
            fragmentId = rangeGate + date.format('MM') + '_' + nextMonth;

            triples.push({
                subject: fragmentId,
                predicate: 'http://w3id.org/multidimensional-interface/ontology#initial',
                object: '"' + tempDate.toISOString() + '"',
                graph: "#Metadata"
            });
            triples.push({
                subject: fragmentId,
                predicate: 'http://w3id.org/multidimensional-interface/ontology#final',
                object: '"' + tempDate.add(1, 'M').toISOString() + '"',
                graph: "#Metadata"
            });
        } else {
            fragmentId = this.serverUrl + this.name + '/fragment/' + date.year() + '_' + (date.year() + 1);

            triples.push({
                subject: fragmentId,
                predicate: 'http://w3id.org/multidimensional-interface/ontology#initial',
                object: '"' + tempDate.toISOString() + '"',
                graph: "#Metadata"
            });
            triples.push({
                subject: fragmentId,
                predicate: 'http://w3id.org/multidimensional-interface/ontology#final',
                object: '"' + tempDate.add(1, 'y').toISOString() + '"',
                graph: "#Metadata"
            });
        }

        triples.unshift({
            subject: fragmentId,
            predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
            object: 'http://w3id.org/multidimensional-interface/ontology#RangeFragment',
            graph: "#Metadata"
        });

        if (time === 'hour' || time === 'day' || time === 'month') {
            triples.push({
                subject: fragmentId,
                predicate: 'http://w3id.org/multidimensional-interface/ontology#hasRangeGate',
                object: rangeGate,
                graph: "#Metadata"
            });
        }


        return [triples, fragmentId];
    }


    createStaticTriples(triples) {
        let st = new Map();
        let AQParts = [];
        for (let i = 0; i < triples.length; i++) {
            if (triples[i].predicate === 'sosa:observedProperty') {
                let property = triples[i].object;
                let AQPart = property.substring(property.lastIndexOf('/') + 1, property.length);

                // Collect all air quality parts in the fragment
                if (!AQParts.includes(AQPart)) {
                    AQParts.push(AQPart);
                }

                // Collect all sensors in the fragment
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

        // For every air quality part we create a triple
        for (let i = 0; i < AQParts.length; i++) {
            staticTriples.push({
                subject: AQParts[i],
                predicate: 'rdf:type',
                object: 'sosa:FeatureOfInterest'
            })
        }

        // For every sensor check which air quality parts he measured and create the corresponding triples if so.
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

    get staticTriples() {
        return this._staticTriples;
    }

    get latestGat() {
        return this._latestGat;
    }

    set latestGat(date) {
        this._latestGat = date;
    }

    get fragmentCounterHour() {
        return this._fragmentCounterHour;
    }

    set fragmentCounterHour(number) {
        this._fragmentCounterHour = number;
    }

    get fragmentCounterDay() {
        return this._fragmentCounterDay;
    }

    set fragmentCounterDay(number) {
        this._fragmentCounterDay = number;
    }

    get fragmentCounterMonth() {
        return this._fragmentCounterMonth;
    }

    set fragmentCounterMonth(number) {
        this._fragmentCounterMonth = number;
    }

    get fragmentCounterYear() {
        return this._fragmentCounterYear;
    }

    set fragmentCounterYear(number) {
        this._fragmentCounterYear = number;
    }

    get byteCounterHour() {
        return this._byteCounterHour;
    }

    set byteCounterHour(bytes) {
        this._byteCounterHour = bytes;
    }

    get byteCounterDay() {
        return this._byteCounterDay;
    }

    set byteCounterDay(bytes) {
        this._byteCounterDay = bytes;
    }

    get byteCounterMonth() {
        return this._byteCounterMonth;
    }

    set byteCounterMonth(bytes) {
        this._byteCounterMonth = bytes;
    }

    get byteCounterYear() {
        return this._byteCounterYear;
    }

    set byteCounterYear(bytes) {
        this._byteCounterYear = bytes;
    }
}

module.exports = TimeRangeData;