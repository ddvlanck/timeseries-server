const MultidimensionalInterface = require('../../lib/MultidimensionalInterface');
const Utils = require('../../lib/Utils');
const moment = require('moment');


class StatisticalAverage extends MultidimensionalInterface {

    constructor(config, commMan) {
        super(commMan);
        this._serverUrl = super.commMan.config.serverUrl;
        this._name = config.name;
        this._websocket = config.websocket;
        this._fragmentsPath = config.fragmentsPath;
        this._staticTriples = config.staticTriples;

        this._latestGat = null;
        this._latestValues = new Map();

        this._currentFragment = null;

        // Init storage folder
        Utils.createFolder(this.fragmentsPath);

        // Load HTTP interfaces for this interface
        this.setupPollInterfaces();

        // Load Websocket interface
        /*if (this.websocket) {
            super.setupPubsupInterface(this.name, config.wsPort);
        }*/

        setInterval(() => {
            this.storeData(this.latestGat);
        }, 5000);
    }

    setupPollInterfaces() {
        let self = this;

        super.commMan.router.get('/' + this.name + '/fragment/:year', async (ctx, next) => {
            ctx.response.set({'Access-Control-Allow-Origin': '*'});
            let filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '.trig';
            await this.handleRequest(ctx, filePath, "year");
        });

        super.commMan.router.get('/' + this.name + '/fragment/:year/:month', async (ctx, next) => {
            ctx.response.set({'Access-Control-Allow-Origin': '*'});
            let filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '-' + ctx.params.month.split('_')[0] + '.trig';
            await this.handleRequest(ctx, filePath, "month");
        });

        super.commMan.router.get('/' + this.name + '/fragment/:year/:month/:day', async (ctx, next) => {
            ctx.response.set({'Access-Control-Allow-Origin': '*'});
            let filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '-' + ctx.params.month.split('_')[0] + '-'
                + ctx.params.day.split('_')[0] + '.trig';

            await this.handleRequest(ctx, filePath, "day");
        });

        super.commMan.router.get('/' + this.name + '/fragment/:year/:month/:day/:hour', async (ctx, next) => {
            ctx.response.set({'Access-Control-Allow-Origin': '*'});
            let filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '-' + ctx.params.month.split('_')[0] + '-'
                + ctx.params.day.split('_')[0] + 'T' + ctx.params.hour.split('_')[0] + '.trig';

            await this.handleRequest(ctx, filePath, "hour");
        });
    }

    async handleRequest(ctx, filePath, type) {
        if (!Utils.exists(filePath)) {
            ctx.response.status = 404;
            ctx.response.body = "[StatisticalAverage]: no data found.";
        } else {
            let pr = await Utils.getTriplesFromFile(this.staticTriples);
            let ft = await Utils.getTriplesFromFile(filePath);
            let st = await this.createStaticTriples(ft[1]);
            let expired = this.expiredDate(ctx, type);

            let fragmentId = Utils.getTriplesBySPOG(ft[1], null, 'http://www.w3.org/ns/prov#generatedAtTime')[0].subject;
            this.addMetadata(fragmentId, ft[1]);

            // Fragment will not be updated anymore, so add cache headers
            if (expired) {
                ctx.response.set({'Cache-Control': 'public, max-age=31536000, inmutable'});
            } else {
                // Do not cache current fragment as it will get more data
                ctx.response.set({ 'Cache-Control': 'no-cache, no-store, must-revalidate' });
            }

            ctx.response.set({'Content-Type': 'text/plain'});
            ctx.response.body = await Utils.formatTriples('application/trig', st.concat(ft[1]), pr[0]);
        }
    }

    async onData(data) {
        //this.latestGat = moment(await Utils.getGeneratedAtTimeValue(data[0]));
        this.latestGat = moment(await Utils.getResultTimeValue(data[0]));

        let newTriples = (await Utils.getTriplesFromString(data[0].toString()))[1];
        let values = await this.getPropertiesAndValues(newTriples);

        // Add new values to buffer
        for (let source of values.keys()) {
            this._latestValues.set(source, values.get(source));
        }

        /*
        // If applicable push data to subscribed clients through Websocket
        if (this.websocket) {
            let st = await Utils.getTriplesFromFile(this.staticTriples);
            st[1] = st[1].concat(hlevel[0]);
            let rdf = await Utils.formatTriples('application/trig', st[1], st[0]);
            super.commMan.pushData(this.name, rdf);
        }*/
    }

    async storeData(latestGat) {
        if (latestGat && this._latestValues.size > 0) {
            let gat = latestGat;
            gat.utc();

            let hlevel = await this.handleHourLevel(this._latestValues, gat);

            // Only problem is here
            // Sometimes map is cleared and unwritten properties are deleted also
            this._latestValues.clear();
            let dlevel = await this.handleDayLevel(hlevel, gat);
            let mlevel = await this.handleMonthLevel(dlevel, gat);
            await this.handleYearLevel(mlevel, gat);
        }
    }

    async handleHourLevel(latestValues, gat) {
        let hourPath = this.fragmentsPath + '/' + gat.format('YYYY-MM-DDTHH') + '.trig';
        let data = null;
        let values = null;

        if (Utils.exists(hourPath)) {
            let storedTriples = (await Utils.getTriplesFromFile(hourPath))[1];
            [data, values] = await this.updateHourFragment(latestValues, storedTriples, gat);
            await Utils.overwriteFile(hourPath, await Utils.formatTriples('application/trig', data));
        } else {
            let triples = await this.createTriples(latestValues);   // Does not contain a graph
            [data, values] = await this.createHourFragment(gat, triples);
            await Utils.appendToFile(hourPath, await Utils.formatTriples('application/trig', data));
        }

        return [data, values];
    }

    async handleDayLevel(hlevel, gat) {
        let dayPath = this.fragmentsPath + '/' + gat.format('YYYY-MM-DD') + '.trig';
        let data = null;
        let values = null;

        if (Utils.exists(dayPath)) {
            let storedTriples = (await Utils.getTriplesFromFile(dayPath))[1];
            [data, values] = await this.updateFragment(hlevel[1], storedTriples, gat);
            await Utils.overwriteFile(dayPath, await Utils.formatTriples('application/trig', data));
        } else {
            data = this.createDayFragment(hlevel[0], gat);
            values = hlevel[1];
            await Utils.appendToFile(dayPath, await Utils.formatTriples('application/trig', data));
        }

        return [data, values];
    }

    async handleMonthLevel(dlevel, gat) {
        let monthPath = this.fragmentsPath + '/' + gat.format('YYYY-MM') + '.trig';
        let data = null;
        let values = null;

        if (Utils.exists(monthPath)) {
            let storedTriples = (await Utils.getTriplesFromFile(monthPath))[1];
            [data, values] = await this.updateFragment(dlevel[1], storedTriples, gat);
            await Utils.overwriteFile(monthPath, await Utils.formatTriples('application/trig', data));
        } else {
            data = this.createMonthFragment(dlevel[0], gat);
            values = dlevel[1];
            await Utils.appendToFile(monthPath, await Utils.formatTriples('application/trig', data));
        }

        return [data, values];
    }

    async handleYearLevel(mlevel, gat) {
        let yearPath = this.fragmentsPath + '/' + gat.format('YYYY') + '.trig';
        let data = null;
        let values = null;

        if (Utils.exists(yearPath)) {
            let storedTriples = (await Utils.getTriplesFromFile(yearPath))[1];
            [data, values] = await this.updateFragment(mlevel[1], storedTriples, gat);
            await Utils.overwriteFile(yearPath, await Utils.formatTriples('application/trig', data));
        } else {
            data = this.createYearFragment(mlevel[0], gat);
            values = mlevel[1];
            await Utils.appendToFile(yearPath, await Utils.formatTriples('application/trig', data));
        }

        return [data, values];
    }

    async createHourFragment(gat, triples) {
        let graphGat = gat;

        let tempDate = moment(gat);
        let nextMonth = tempDate.add(1, 'M').format('MM');
        tempDate = moment(gat);
        let nextDay = tempDate.add(1, 'd').format('DD');
        tempDate = moment(gat);
        let nextHour = tempDate.add(1, 'h').format('HH');

        let rangeGate = this.serverUrl + this.name + '/fragment/' + gat.year() + '_' + (gat.year() + 1) + '/'
            + gat.format('MM') + '_' + nextMonth + '/' + gat.format('DD') + '_' + nextDay + '/';
        let fragmentId = rangeGate + gat.format('HH') + '_' + nextHour;
        this.currentFragment = fragmentId;

        let values = new Map();

        tempDate = moment(gat);
        tempDate.minutes(0).seconds(0).milliseconds(0);

        for (let i = 0; i < triples.length; i++) {
            if (triples[i].predicate === 'ts:mean') {
                values.set(triples[i].subject, Utils.getLiteralValue(triples[i].object));
            }
            triples[i].graph = fragmentId;
        }

        triples.unshift({
            subject: fragmentId,
            predicate: 'http://www.w3.org/ns/prov#generatedAtTime',
            object: '"' + graphGat.toISOString() + '"'
        });

        triples.push({
            subject: fragmentId,
            predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
            object: 'http://w3id.org/multidimensional-interface/ontology#RangeFragment'
        });
        triples.push({
            subject: fragmentId,
            predicate: 'http://w3id.org/multidimensional-interface/ontology#initial',
            object: '"' + tempDate.toISOString() + '"'
        });
        triples.push({
            subject: fragmentId,
            predicate: 'http://w3id.org/multidimensional-interface/ontology#final',
            object: '"' + tempDate.add(1, 'h').toISOString() + '"'
        });
        triples.push({
            subject: fragmentId,
            predicate: 'http://w3id.org/multidimensional-interface/ontology#hasRangeGate',
            object: rangeGate
        });

        return [triples, values];
    }

    updateHourFragment(newValues, oldTriples, gat) {
        let values = new Map();
        let sampleValues = Utils.getSampleValuesFromTriples(oldTriples);
        let graph = null;

        for (let source of newValues.keys()) {
            let insert = true;
            for (let i in oldTriples) {
                if (oldTriples[i].predicate === 'http://www.w3.org/ns/prov#generatedAtTime') {
                    graph = oldTriples[i].subject;
                    oldTriples[i].object = '"' + gat.toISOString() + '"';
                }


                if (source === oldTriples[i].subject) {
                    insert = false;

                    if (oldTriples[i].predicate === 'ts:mean') {
                        oldTriples[i].object = '"' + this.calculateMean(parseFloat(Utils.getLiteralValue(newValues.get(source))),
                            parseFloat(Utils.getLiteralValue(oldTriples[i].object)), parseInt(Utils.getLiteralValue(sampleValues.get(source)))) + '"';
                        values.set(oldTriples[i].subject, oldTriples[i].object);
                    }

                    if (oldTriples[i].predicate === 'ts:sampleSize') {
                        let newSampleSize = (parseInt(Utils.getLiteralValue(sampleValues.get(source))) + 1);
                        oldTriples[i].object = '"' + newSampleSize + '"';
                    }
                }
            }

            if (insert) {
                // We have to use the splice method because otherwise the metadata is in the middle of the array
                // And when writing to the file, this causes the triples being divided into 2 graphs with the same name
                oldTriples.splice(oldTriples.length - 4, 0, {
                    subject: source,
                    predicate: 'ts:mean',
                    object: newValues.get(source),
                    graph: graph
                });

                oldTriples.splice(oldTriples.length - 4, 0, {
                    subject: source,
                    predicate: 'ts:sampleSize',
                    object: '"1"',
                    graph: graph
                });
            }


        }

        return [oldTriples, values];
    }

    createDayFragment(hlevel, gat) {
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
        }

        //this.addMetadata(fragmentId, hlevel);

        return hlevel;
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
        }

        //this.addMetadata(fragmentId, dlevel);

        return dlevel;
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
        }

        mlevel = mlevel.filter(m => m.predicate !== 'http://w3id.org/multidimensional-interface/ontology#hasRangeGate');

        //this.addMetadata(fragmentId, mlevel);

        return mlevel;
    }

    updateFragment(newValues, oldTriples, gat) {
        let sampleValues = Utils.getSampleValuesFromTriples(oldTriples);
        let values = new Map();
        let graph = null;

        for (let source of newValues.keys()) {
            let insert = true;

            for (let i in oldTriples) {

                if (oldTriples[i].predicate === 'http://www.w3.org/ns/prov#generatedAtTime') {
                    oldTriples[i].object = '"' + gat.toISOString() + '"';
                    graph = oldTriples[i].subject;
                }

                if (source === oldTriples[i].subject) {
                    insert = false;

                    if (oldTriples[i].predicate === 'ts:mean') {
                        oldTriples[i].object = '"' + this.calculateMean(parseFloat(Utils.getLiteralValue(newValues.get(source))),
                            parseFloat(Utils.getLiteralValue(oldTriples[i].object)), parseInt(Utils.getLiteralValue(sampleValues.get(source)))) + '"';
                        values.set(oldTriples[i].subject, oldTriples[i].object);
                    }

                    if (oldTriples[i].predicate === 'ts:sampleSize') {
                        let newSampleSize = (parseInt(Utils.getLiteralValue(sampleValues.get(source))) + 1);
                        oldTriples[i].object = '"' + newSampleSize + '"';
                    }
                }
            }

            if (insert) {
                oldTriples.splice(oldTriples.length - 4, 0, {
                    subject: source,
                    predicate: 'ts:mean',
                    object: newValues.get(source),
                    graph: graph
                });
                oldTriples.splice(oldTriples.length - 4, 0, {
                    subject: source,
                    predicate: 'ts:sampleSize',
                    object: '"1"',
                    graph: graph
                });

            }
        }

        return [oldTriples, values];
    }

    createTriples(values) {
        let triples = [];
        for (let sourceID of values.keys()) {
            triples.push({
                subject: sourceID,
                predicate: 'ts:mean',
                object: values.get(sourceID)
            });
            triples.push({
                subject: sourceID,
                predicate: 'ts:sampleSize',
                object: '"1"'
            });
        }
        return triples;
    }

    getPropertiesAndValues(updateTriples) {
        let subjects = new Map();
        for (let i = 0; i < updateTriples.length; i++) {
            if (updateTriples[i].predicate === 'sosa:hasSimpleResult') {

                if (!subjects[updateTriples[i].subject]) {
                    subjects[updateTriples[i].subject] = {};
                }

                subjects[updateTriples[i].subject].value = updateTriples[i].object;
            }

            if (updateTriples[i].predicate === 'sosa:observedProperty') {

                if (!subjects[updateTriples[i].subject]) {
                    subjects[updateTriples[i].subject] = {};
                }

                subjects[updateTriples[i].subject].source = updateTriples[i].object;
            }
        }

        let values = new Map();
        Object.keys(subjects).forEach((object) => {
            let obj = subjects[object];
            values.set(obj.source, obj.value);
        });

        return values;
    }

    createStaticTriples(triples) {
        let st = new Map();
        let AQParts = [];
        for (let i = 0; i < triples.length; i++) {
            if (triples[i].predicate === 'ts:mean') {
                let property = triples[i].subject;
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

    calculateMean(n, aggregate, sample) {
        return (((aggregate * sample) + n) / (sample + 1));
    }

    // Controleer metadata
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

    expiredDate(ctx, type) {
        let date;
        const currentDate = new Date();
        currentDate.setHours(currentDate.getHours() + currentDate.getTimezoneOffset() / -60);
        let expired;

        switch (type) {
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

        if (type === 'year') {
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

    get latestGat() {
        return this._latestGat;
    }

    set latestGat(gat) {
        this._latestGat = gat;
    }

    get currentFragment() {
        return this._currentFragment;
    }

    set currentFragment(id) {
        this._currentFragment = id;
    }
}

module.exports = StatisticalAverage;