const MultidimensionalInterface = require('../../lib/MultidimensionalInterface');
const Utils = require('../../lib/Utils');

class Geographical extends MultidimensionalInterface {

    constructor(config, commMan) {
        super(commMan);
        this._serverUrl = super.commMan.config.serverUrl;
        this._name = config.name;
        this._websocket = config.websocket;
        this._fragmentsPath = config.fragmentsPath;
        this._staticTriples = config.staticTriples;
        this._maxFileSize = config.maxFileSize;

        this._upperLeftTile = {upperLeft: ["51.23017", "4.38886"], bottomRight: ["51.2035", "4.41011"]};
        this._bottomLeftTile = {upperLeft: ["51.2035", "4.38886"], bottomRight: ["51.1766", "4.41011"]};
        this._upperRightTile = {upperLeft: ["51.23017", "4.41011"], bottomRight: ["51.2035", "4.43367"]};
        this._bottomRightTile = {upperLeft: ["51.2035", "4.41011"], bottomRight: ["51.1766", "4.43367"]};

        this._averageBuffer = new Map();

        this.setupPollInterfaces();

        // Init storage folder
        Utils.createFolder(this.fragmentsPath);

        // Create fragments for every tile
        this._upperLeftFragmentCounter = 0;
        this._upperRightFragmentCounter = 0;
        this._bottomLeftFragmentCounter = 0;
        this._bottomRightFragmentCounter = 0;
        this._upperLeftPath = this.fragmentsPath + '/14_8391_5468_fragment_';
        this._upperRightPath = this.fragmentsPath + '/14_8392_5468_fragment_';
        this._bottomLeftPath = this.fragmentsPath + '/14_8391_5470_fragment_';
        this._bottomRightPath = this.fragmentsPath + '/14_8392_5470_fragment_';
        this._upperLeftByteCounter = 0;
        this._upperRightByteCounter = 0;
        this._bottomLeftByteCounter = 0;
        this._bottomRightByteCounter = 0;

        setInterval(() => {
            this.updateAverageFile();
        }, 5000);
    }

    async onData(data) {
        let triples = (await Utils.getTriplesFromString(data.toString()))[1];
        let filteredTriples = await this.filterTriples(triples);
        if (filteredTriples.length > 0) {
            this.storeData(filteredTriples);
        }

    }

    setupPollInterfaces() {
        let self = this;

        /*this.commMan.router.get('/' + this.name + '/fragment/14/:x/:y', async (ctx, next) => {
            ctx.response.set({'Access-Control-Allow-Origin': '*'});
            let filePath = this.fragmentsPath + '/14_' + ctx.params.x + '_' + ctx.params.y + '.trig';
            await this.handleRequest(ctx, filePath);
        });*/

        this.commMan.router.get('/' + this.name + '/fragment/:coordinates', async (ctx, next) => {
            ctx.response.set({'Access-Control-Allow-Origin': '*'});
            let coords = ctx.params.coordinates.split('_');
            let filePath = this.fragmentsPath + '/' + coords[0] + '_' + coords[1] + '_' + coords[2] + '.trig';
            await this.handleRequest(ctx, filePath, false);

        });

        // Route to get specific fragment
        this.commMan.router.get('/' + this.name + '/fragment/:coordinates/:numb', async (ctx, next) => {
            ctx.response.set({'Access-Control-Allow-Origin': '*'});
            let coords = ctx.params.coordinates.split('_');
            let filePath = this.fragmentsPath + '/' + coords[0] + '_' + coords[1] + '_' + coords[2] + '_fragment_' + numb + '.trig';
            await this.handleRequest(ctx, filePath, true);
        });
    }

    async handleRequest(ctx, filePath, fragment) {
        let file;

        if (!fragment) {
            file = filePath.substring(0, filePath.lastIndexOf('.trig')) + '_fragment_1.trig';
        } else {
            file = filePath;
        }

        if (!Utils.exists(file)) {
            ctx.response.status = 404;
            ctx.response.body = "[Geographical]: No data found";
        } else {
            let fragments = [];
            if (fragment) {
                fragments = Utils.getFragmentsForTile(filePath, ctx.params.numb);
            } else {
                fragments = Utils.getFragmentsForTile(filePath, null);
                // Instead of first fragment, give most recent fragment
                file = file.substring(0, file.indexOf('.trig') - 1) + (fragments.length - 1) + '.trig';
            }
            let index = fragments[1];

            let ft = await Utils.getTriplesFromFile(file);
            let st = await this.createStaticTriples(ft[1]);
            let pr = await Utils.getTriplesFromFile(this.staticTriples);

            // Add metadata
            let metadata = await this.addMetadata(ctx.params.coordinates, index);
            let data = await Utils.formatTriples('application/trig', st.concat(ft[1]), pr[0]);

            // Cache headers
            if (index < (fragments.length - 1)) {
                // Cache older fragment that won't change over time
                ctx.response.set({ 'Cache-Control': 'public, max-age=31536000, inmutable' });
            } else {
                // Do not cache current fragment as it will get more data
                ctx.response.set({ 'Cache-Control': 'no-cache, no-store, must-revalidate' });
            }

            ctx.response.set({'Content-Type': 'text/plain'});
            ctx.response.body = data.concat('\n' + metadata);
        }
    }

    async storeData(triples) {
        let latitude = null;
        let longitude = null;
        for (let i = 0; i < triples.length; i++) {

            if (triples[i].predicate === 'schema:latitude') {
                latitude = Utils.getLiteralValue(triples[i].object);
            }

            if (triples[i].predicate === 'schema:longitude') {
                longitude = Utils.getLiteralValue(triples[i].object);
            }
        }

        await this.selectTile(latitude, longitude, triples);
    }

    async selectTile(latitude, longitude, triples) {
        let path = null;
        let byteCounter = null;
        let fragmentCounter = null;

        if (longitude > this.upperLeftTile.upperLeft[1] && longitude < this.upperRightTile.bottomRight[1]) {

            if (latitude < this.upperLeftTile.upperLeft[0] && latitude > this.bottomRightTile.bottomRight[0]) {

                if (longitude < this.upperRightTile.upperLeft[1]) {   // Left half

                    if (latitude > this.upperLeftTile.bottomRight[0]) {
                        path = this.upperLeftPath;
                    } else {
                        path = this.bottomLeftPath;
                    }

                } else {    // Right half

                    if (latitude > this.upperLeftTile.bottomRight[0]) {
                        path = this.upperRightPath;
                    } else {
                        path = this.bottomRightPath;
                    }
                }
            }

        }

        let sensorValues = await this.getSensorValuesByTile(triples);

        if (path) {
            let data = await Utils.formatTriples('application/trig', triples, {});
            let bytes = Buffer.from(data).byteLength;

            let file = null;
            if (path === this.upperLeftPath) {

                if (this.upperLeftByteCounter === 0 || this.upperLeftByteCounter + bytes > this.maxFileSize) {
                    this.upperLeftFragmentCounter++;
                    this.upperLeftByteCounter = 0;
                }
                file = path + this.upperLeftFragmentCounter + '.trig';
                this.upperLeftByteCounter += bytes;
            } else if (path === this.upperRightPath) {

                if (this.upperRightByteCounter === 0 || this.upperRightByteCounter + bytes > this.maxFileSize) {
                    this.upperRightFragmentCounter++;
                    this.upperRightByteCounter = 0;
                }
                file = path + this.upperRightFragmentCounter + '.trig';
                this.upperRightByteCounter += bytes;
            } else if (path === this.bottomLeftPath) {

                if (this.bottomLeftByteCounter === 0 || this.bottomLeftByteCounter + bytes > this.maxFileSize) {
                    this.bottomLeftFragmentCounter++;
                    this.bottomLeftByteCounter = 0;
                }
                file = path + this.bottomLeftFragmentCounter + '.trig';
                this.bottomLeftByteCounter += bytes;
            } else {

                if (this.bottomRightByteCounter === 0 || this.bottomRightByteCounter + bytes > this.maxFileSize) {
                    this.bottomRightFragmentCounter++;
                    this.bottomRightByteCounter = 0;
                }
                file = path + this.bottomRightFragmentCounter + '.trig';
                this.bottomRightByteCounter += bytes;
            }

            await Utils.appendToFile(file, data);
            await this.updateAverageBuffer(sensorValues, path);
        }

    }

    filterTriples(triples) {
        let filteredTriples = [];
        let geoNode = null;
        for (let i = 0; i < triples.length; i++) {

            if (triples[i].subject.indexOf('PM10') >= 0) {
                filteredTriples.push(triples[i]);

                if (triples[i].predicate === 'schema:geo') {
                    geoNode = triples[i].object;
                }
            }

            if (geoNode && triples[i].subject === geoNode) {
                filteredTriples.push(triples[i]);
            }
        }
        return filteredTriples;
    }

    async addMetadata(coordinates, index) {
        let baseURI = this.serverUrl + this.name + '/fragment';
        let coords = coordinates.split('_');
        let subject = baseURI + '/14_' + coords[1] + '_' + coords[2];
        let quads = [];

        quads.push({
            subject: baseURI,
            predicate: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
            object: "http://www.w3.org/ns/hydra/core#Collection",
            graph: "#Metadata"
        });

        /*
        <dataset>  hydra:member <tileX> .
        <tileX> tree:latitudeTile "y"^xsd:float .
        <tileX> tree:longitudeTile "x"^^xsd:float .
        <tileX> tree:zoomTile "z" ...
        * */

        // Dataset containing 4 tiles
        quads.push({
            subject: "Dataset",
            predicate: "hydra:member",
            object: baseURI + '/14/8391/5468',
            graph: "#Metadata"
        });

        quads.push({
            subject: "Dataset",
            predicate: "hydra:member",
            object: baseURI + "/14/8391/5470",
            graph: "#Metadata"
        });

        quads.push({
            subject: "Dataset",
            predicate: "hydra:member",
            object: baseURI + '/14/8392/5468',
            graph: "#Metadata"
        });

        quads.push({
            subject: "Dataset",
            predicate: "hydra:member",
            object: baseURI + '/14/8392/5470',
            graph: "#Metadata"
        });

        // Tile 1
        quads.push({
            subject: baseURI + '/14/8391/5468',
            predicate: 'tree:latitudeTile',
            object: '8391',
            graph: "#Metadata"
        });

        quads.push({
            subject: baseURI + '/14/8391/5468',
            predicate: 'tree:longitudeTile',
            object: '5468',
            graph: "#Metadata"
        });

        quads.push({
            subject: baseURI + '/14/8391/5468',
            predicate: 'tree:zoomTile',
            object: '14',
            graph: "#Metadata"
        });

        // Tile 2
        quads.push({
            subject: baseURI + '/14/8391/5470',
            predicate: 'tree:latitudeTile',
            object: '8391',
            graph: "#Metadata"
        });

        quads.push({
            subject: baseURI + '/14/8391/5470',
            predicate: 'tree:longitudeTile',
            object: '5470',
            graph: "#Metadata"
        });

        quads.push({
            subject: baseURI + '/14/8391/5470',
            predicate: 'tree:zoomTile',
            object: '14',
            graph: "#Metadata"
        });

        // Tile 3
        quads.push({
            subject: baseURI + '/14/8392/5468',
            predicate: 'tree:latitudeTile',
            object: '8392',
            graph: "#Metadata"
        });

        quads.push({
            subject: baseURI + '/14/8392/5468',
            predicate: 'tree:longitudeTile',
            object: '5468',
            graph: "#Metadata"
        });

        quads.push({
            subject: baseURI + '/14/8392/5468',
            predicate: 'tree:zoomTile',
            object: '14',
            graph: "#Metadata"
        });

        // Tile 4
        quads.push({
            subject: baseURI + '/14/8392/5470',
            predicate: 'tree:latitudeTile',
            object: '8392',
            graph: "#Metadata"
        });

        quads.push({
            subject: baseURI + '/14/8392/5470',
            predicate: 'tree:longitudeTile',
            object: '5470',
            graph: "#Metadata"
        });

        quads.push({
            subject: baseURI + '/14/8392/5470',
            predicate: 'tree:zoomTile',
            object: '14',
            graph: "#Metadata"
        });


        // Hydra:previous
        if(index > 0){
            quads.push({
                subject: subject,
                predicate: 'http://www.w3.org/ns/hydra/core#previous',
                object: subject + '/' + index ,
                graph: '#Metadata'
            });
        }

        return await Utils.formatTriples('application/trig', quads);
    }

    async getSensorValuesByTile(triples) {
        let results = [];
        for (let i = 0; i < triples.length; i++) {
            if (triples[i].predicate === 'sosa:hasSimpleResult') {
                results.push(parseFloat(Utils.getLiteralValue(triples[i].object)));
            }
        }
        return results;
    }

    async updateAverageBuffer(value, tilePath) {
        let tile = null;

        if (tilePath === this.upperLeftPath) {
            tile = "Tile/14/8391/5468";
        } else if (tilePath === this.upperRightPath) {
            tile = "Tile/14/8392/5468";
        } else if (tilePath === this.bottomLeftPath) {
            tile = "Tile/14/8391/5470";
        } else if (tilePath === this.bottomRightPath) {
            tile = "Tile/14/8392/5470";
        }

        if (tile) {
            if (this.averageBuffer.has(tile)) {
                let oldValue = this.averageBuffer.get(tile);       // Contains the value and sampleSize
                let updated = this.calculateMean(parseFloat(value), parseFloat(oldValue.value), parseInt(oldValue.sampleSize));
                let sampleSize = oldValue.sampleSize + 1;
                this.averageBuffer.set(tile, {value: updated, sampleSize: sampleSize});


            } else {
                this.averageBuffer.set(tile, {value: value, sampleSize: 1});
            }

        }
    }

    async updateAverageFile() {
        if (!Utils.exists(this.fragmentsPath + '/tileAverage.trig')) {
            let newTriples = await this.createTriples();
            let data = await Utils.formatTriples('application/trig', newTriples, {});
            console.log(this.averageBuffer);
            this.averageBuffer.clear();
            await Utils.appendToFile(this.fragmentsPath + '/tileAverage.trig', data);
        } else {
            let oldTriples = (await Utils.getTriplesFromFile(this.fragmentsPath + '/tileAverage.trig'))[1];
            for (let tile of this.averageBuffer.keys()) {
                let tileObject = this.averageBuffer.get(tile);
                let oldMean = null;
                let sampleSize = null;
                for (let i = 0; i < oldTriples.length; i++) {
                    if (tile === oldTriples[i].subject) {
                        if (oldTriples[i].predicate === 'ts:mean') {
                            oldMean = parseFloat(oldTriples[i].object);
                            oldTriples.splice(i, 1);
                            i > 0 ? i-- : i = 0;
                        }

                        if (oldTriples[i].predicate === 'ts:sampleSize') {
                            sampleSize = parseInt(oldTriples[i].object);
                            oldTriples.splice(i, 1);
                            i > 0 ? i-- : i = 0;
                        }

                    }
                }

                if (oldMean && sampleSize) {
                    let updated = this.calculateMean(tileObject.value, oldMean, sampleSize + tileObject.sampleSize);
                    let updatedSize = sampleSize + tileObject.sampleSize;
                    oldTriples.push({
                        subject: tile,
                        predicate: 'ts:mean',
                        object: '"' + updated + '"'
                    });
                    oldTriples.push({
                        subject: tile,
                        predicate: 'ts:sampleSize',
                        object: '"' + updatedSize + '"'
                    });
                } else {
                    oldTriples.push({
                        subject: tile,
                        predicate: 'ts:mean',
                        object: '"' + tileObject.value + '"'
                    });
                    oldTriples.push({
                        subject: tile,
                        predicate: 'ts:sampleSize',
                        object: '"' + tileObject.sampleSize + '"'
                    });
                }
                oldMean = null;
                sampleSize = null;

                let data = await Utils.formatTriples('application/trig', oldTriples, {});
                await Utils.overwriteFile(this.fragmentsPath + '/tileAverage.trig', data);
            }

        }
    }

    createStaticTriples(triples) {
        let result = [];
        result.push({
            subject: 'PM10',
            predicate: 'rdf:type',
            object: 'sosa:FeatureOfInterest'
        });

        let sensors = [];
        for (let i = 0; i < triples.length; i++) {
            if (triples[i].predicate === 'sosa:observedProperty') {
                let property = triples[i].object;
                let sensor = property.substring(0, property.lastIndexOf('/'));

                if (!sensors.includes(sensor)) {
                    sensors.push(sensor);
                    result.push({
                        subject: sensor,
                        predicate: 'sosa:observes',
                        object: property
                    })
                }
            }
        }
        return result;
    }

    createTriples() {
        let triples = [];
        for (let tile of this.averageBuffer.keys()) {
            let object = this.averageBuffer.get(tile);
            triples.push({
                subject: tile,
                predicate: 'ts:mean',
                object: '"' + object.value + '"'
            });
            triples.push({
                subject: tile,
                predicate: 'ts:sampleSize',
                object: '"' + object.sampleSize + '"'
            });
        }
        return triples;
    }

    calculateMean(n, aggregate, sample) {
        return (((aggregate * sample) + n) / (sample + 1));
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

    get maxFileSize() {
        return this._maxFileSize;
    }

    get upperLeftTile() {
        return this._upperLeftTile;
    }

    get upperRightTile() {
        return this._upperRightTile;
    }

    get bottomLeftTile() {
        return this._bottomLeftTile;
    }

    get bottomRightTile() {
        return this._bottomRightTile;
    }

    get upperLeftFragmentCounter() {
        return this._upperLeftFragmentCounter;
    };

    set upperLeftFragmentCounter(numb) {
        this._upperLeftFragmentCounter = numb;
    };

    get upperRightFragmentCounter() {
        return this._upperRightFragmentCounter;
    };

    set upperRightFragmentCounter(numb) {
        this._upperRightFragmentCounter = numb;
    };

    get bottomLeftFragmentCounter() {
        return this._bottomLeftFragmentCounter;
    };

    set bottomLeftFragmentCounter(numb) {
        this._bottomLeftFragmentCounter = numb;
    };

    get bottomRightFragmentCounter() {
        return this._bottomRightFragmentCounter;
    };

    set bottomRightFragmentCounter(numb) {
        this._bottomRightFragmentCounter = numb;
    };

    get upperLeftPath() {
        return this._upperLeftPath;
    };

    get upperRightPath() {
        return this._upperRightPath;
    };

    get bottomLeftPath() {
        return this._bottomLeftPath;
    };

    get bottomRightPath() {
        return this._bottomRightPath;
    };

    get upperLeftByteCounter() {
        return this._upperLeftByteCounter;
    }

    set upperLeftByteCounter(bytes) {
        this._upperLeftByteCounter = bytes;
    }

    get upperRightByteCounter() {
        return this._upperRightByteCounter;
    }

    set upperRightByteCounter(bytes) {
        this._upperRightByteCounter = bytes;
    }

    get bottomLeftByteCounter() {
        return this._bottomLeftByteCounter;
    }

    set bottomLeftByteCounter(bytes) {
        this._bottomLeftByteCounter = bytes;
    }

    get bottomRightByteCounter() {
        return this._bottomRightByteCounter;
    }

    set bottomRightByteCounter(bytes) {
        this._bottomRightByteCounter = bytes;
    }

    get averageBuffer() {
        return this._averageBuffer;
    }

    resetBuffer() {
        this._averageBuffer.clear();
    }
}

module.exports = Geographical;