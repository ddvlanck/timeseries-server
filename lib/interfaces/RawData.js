const MultidimensionalInterface = require('../../lib/MultidimensionalInterface');
const Utils = require('../../lib/Utils');
const md5 = require('md5');
const rdf = require('rdf');

class RawData extends MultidimensionalInterface {

    constructor(config, commMan) {
        super(commMan);
        this._serverUrl = super.commMan.config.serverUrl;
        this._name = config.name;
        this._websocket = config.websocket;
        this._fragmentsPath = config.fragmentsPath;
        this._fragmentMaxSize = config.maxFileSize;
        this._staticTriples = config.staticTriples;
        this._byteCounter = 0;
        this._lastFragment = null;
        this._lastGat = null;

        // Load HTTP interfaces for this interface
        this.setupPollInterfaces();

        // Init storage folder
        Utils.createFolder(this.fragmentsPath);
    }

    async onData(data) {
        this.latestData = data[0];
        this.lastGat = await Utils.getResultTimeValue(this.latestData); // Get the result time

        // If applicable push data to subscribed clients through Websocket
        /*if (this.websocket) {
            let st = await Utils.getTriplesFromFile(this.staticTriples);
            let staticTriples = await Utils.formatTriples('application/trig', st[1], st[0]);
            super.commMan.pushData(this.name, staticTriples.concat(data.toString()));
        }*/

        // Store data in files according to config to keep historic data
        this.storeData();
    }

    setupPollInterfaces() {
        let self = this;

        // HTTP interface to get the latest data update
        super.commMan.router.get('/' + this.name + '/latest', async (ctx, next) => {
            ctx.response.set({'Access-Control-Allow-Origin': '*'});
            if (self.latestData == null) {
                ctx.response.status = 404;
                ctx.response.body = "No data found";
            } else {
                let etag = 'W/"' + md5(this.lastGat) + '"';
                let ifNoneMatchHeader = ctx.request.header['if-none-match'];
                let last_modified = this.lastGat.toUTCString();

                if (ifNoneMatchHeader && ifNoneMatchHeader === etag) {
                    ctx.response.status = 304;
                } else {
                    ctx.response.set({
                        //'Cache-Control': 'public, s-maxage=' + (maxage - 1) + ', max-age=' + maxage + ', must-revalidate',
                        //'Expires': expires,
                        'ETag': etag,
                        'Last-Modified': last_modified,
                        'Content-Type': 'application/trig'
                    });

                    let st = await Utils.getTriplesFromFile(this.staticTriples);
                    let staticTriples = await Utils.formatTriples('application/trig', st[1], st[0]);
                    ctx.response.body = staticTriples.concat(self.latestData.toString());
                }
            }
        });

        // HTTP interface to get a specific fragment of data (historic data)
        super.commMan.router.get('/' + this.name + '/fragments', async (ctx, next) => {
            let queryTime = new Date(ctx.query.time);

            if (queryTime.toString() === 'Invalid Date') {
                // Redirect to now time
                ctx.status = 302
                ctx.redirect('/' + this.name + '/fragments?time=' + new Date().toISOString());
                return;
            }

            // The character ':' can't be used because it's a forbidden character in Windows
            // Instead, we replace the character with '_'
            let fragments = Utils.getAllFragments(this.fragmentsPath).map(f => {
                f = f.replace(/_/g, ':');
                return new Date(f.substring(0, f.indexOf('.trig'))).getTime();
            });

            let [fragment, index] = Utils.dateBinarySearch(queryTime.getTime(), fragments);

            if (queryTime.getTime() !== fragment.getTime()) {
                // Redirect to correct fragment URL
                ctx.status = 302
                ctx.redirect('/' + this.name + '/fragments?time=' + fragment.toISOString());
                return;
            }

            let fc = Utils.getFragmentsCount(this.fragmentsPath);

            // Modified fragment: replace the forbidden character ':' with '_'
            let modifiedFragment = fragment.toISOString().replace(/:/g, '_');
            let ft = await Utils.getTriplesFromFile(this.fragmentsPath + '/' + modifiedFragment + '.trig');

            // Add graph
            let graph = this.serverUrl.substr(0, this.serverUrl.length - 1) + ctx.request.url;
            let time = new Date();
            time.setHours(time.getHours() + time.getTimezoneOffset() / -60);
            for(let i = 0 ; i < ft[1].length ; i++){
                ft[1][i].graph = graph;
            }

            // Prefixes
            let pr = await Utils.getTriplesFromFile(this.staticTriples);

            // Static triples - create sensor triples
            let st = await this.createStaticTriples(ft[1]);
            let data = await Utils.formatTriples('application/trig', st.concat(ft[1]), pr[0]);
            let metaData = await this.createMetadata(fragment, index);
            ctx.response.body = data.concat('\n' + metaData);
            ctx.response.set({
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/trig'
            });

            // Caching
            if (index < (fc - 1)) {
                // Cache older fragment that won't change over time
                ctx.response.set({'Cache-Control': 'public, max-age=31536000, inmutable'});
            } else {
                // Do not cache current fragment as it will get more data
                ctx.response.set({'Cache-Control': 'no-cache, no-store, must-revalidate'});
            }
        });
    }

    async storeData() {
        if (this.byteCounter === 0 || this.byteCounter > this.fragmentMaxSize) {

            // Replace ':' by '_' in filename otherwise this would give an error on Windows OS
            let modifiedLastGat = this.lastGat.toISOString().replace(/:/g, '_');

            // Create new fragment
            this.lastFragment = this.fragmentsPath + '/' + modifiedLastGat + '.trig';
            this.byteCounter = 0;
        }
        await Utils.appendToFile(this.lastFragment, this.latestData.toString());
        let bytes = Buffer.from(this.latestData.toString()).byteLength;
        this.byteCounter += bytes;
    }

    async createMetadata(fragment, index) {
        let baseUri = this.serverUrl + this.name + '/fragments';
        let subject = baseUri + '?time=' + fragment.toISOString();
        let quads = [];

        quads.push({
            subject: subject,
            predicate: 'http://www.w3.org/2000/01/rdf-schema#label',
            object: '"Values for the monitored air quality components by various sensors"',
            graph: '#Metadata'
        });
        quads.push({
            subject: subject,
            predicate: 'http://www.w3.org/ns/hydra/core#search',
            object: subject + '#search',
            graph: '#Metadata'
        });
        quads.push({
            subject: subject + '#search',
            predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
            object: 'http://www.w3.org/ns/hydra/core#IriTemplate',
            graph: '#Metadata'
        });
        quads.push({
            subject: subject + '#search',
            predicate: 'http://www.w3.org/ns/hydra/core#template',
            object: '"' + baseUri + '{?time}"',
            graph: '#Metadata'
        });
        quads.push({
            subject: subject + '#search',
            predicate: 'http://www.w3.org/ns/hydra/core#variableRepresentation',
            object: 'http://www.w3.org/ns/hydra/core#BasicRepresentation',
            graph: '#Metadata'
        });
        quads.push({
            subject: subject + '#search',
            predicate: 'http://www.w3.org/ns/hydra/core#mapping',
            object: subject + '#mapping',
            graph: '#Metadata'
        });
        quads.push({
            subject: subject + '#mapping',
            predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
            object: 'http://www.w3.org/ns/hydra/core#IriTemplateMapping',
            graph: '#Metadata'
        });
        quads.push({
            subject: subject + '#mapping',
            predicate: 'http://www.w3.org/ns/hydra/core#variable',
            object: '"time"',
            graph: '#Metadata'
        });
        quads.push({
            subject: subject + '#mapping',
            predicate: 'http://www.w3.org/ns/hydra/core#required',
            object: '"true"^^http://www.w3.org/2001/XMLSchema#boolean',
            graph: '#Metadata'
        });

        // Add hydra:previous with link to previous fragment if possible
        if (index > 0) {
            let fragments = Utils.getAllFragments(this.fragmentsPath);
            let previous = fragments[index - 1].substring(0, fragments[index - 1].indexOf('.trig'));
            previous = previous.replace(/_/g, ':');

            quads.push({
                subject: subject,
                predicate: 'http://www.w3.org/ns/hydra/core#previous',
                object: baseUri + '?time=' + previous,
                graph: '#Metadata'
            });
        }

        return await Utils.formatTriples('application/trig', quads);
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

    get fragmentMaxSize() {
        return this._fragmentMaxSize;
    }

    get staticTriples() {
        return this._staticTriples;
    }

    get byteCounter() {
        return this._byteCounter;
    }

    set byteCounter(value) {
        this._byteCounter = value;
    }

    get lastFragment() {
        return this._lastFragment;
    }

    set lastFragment(frg) {
        this._lastFragment = frg;
    }

    get lastGat() {
        return this._lastGat;
    }

    set lastGat(gat) {
        this._lastGat = gat;
    }


}

module.exports = RawData;