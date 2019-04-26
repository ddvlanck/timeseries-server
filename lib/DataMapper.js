const Stream = require('stream');
const Utils = require('../lib/Utils');
const geo = require('latlon-geohash');
const rdf = require('rdf');

class DataMapper {

    // This callback will contain a stream
    constructor(dataCallback) {

        // Callback returning the data stream
        this._dataCallback = dataCallback;
        this._dataStream = new Stream.Readable({objectMode: true});
        this._dataStream._read = () => {
        };
        this._dataCallback({dataStream: this._dataStream});

        this._lastSource = null;
        this._graph = null;
        this._buffer = [];
    }

    async mapData(data) {
            if(!this.lastSource){
                this.lastSource = data.sourceId;

                let date = new Date(data.timestamp);
                await date.setHours(date.getHours() + date.getTimezoneOffset()/-60);

                this.graph = 'http://example.org/Results/' + date.toISOString();
                this.addToBuffer({
                    subject: this.graph,
                    predicate: 'http://www.w3.org/ns/prov#generatedAtTime',
                    object: '"' + date.toISOString() + '"'
                });
            }

            if(this.lastSource !== data.sourceId){
                let result = await Utils.formatTriples('application/trig', this.buffer, {});
                this.dataStream.push(result);

                let date = new Date(data.timestamp);
                await date.setHours(date.getHours() + date.getTimezoneOffset()/-60);

                this.resetBuffer();

                this.graph = 'http://example.org/Results/' + date.toISOString();
                this.addToBuffer({
                    subject: this.graph,
                    predicate: 'http://www.w3.org/ns/prov#generatedAtTime',
                    object: '"' + date.toISOString() + '"'
                });

                this.lastSource = data.sourceId;
            }

            let date = new Date(data.timestamp);
            date.setHours(date.getHours() + date.getTimezoneOffset()/-60);
            date = date.toISOString();

            let measuredPart = data.metricId.split('.')[1];

            //  Observation/sourceID/timestamp/measuredPart
            let observationID = 'Observation/' + data.sourceId.split('.')[1] + '/' + data.timestamp + '/' + measuredPart.toUpperCase();

            let latlng = geo.decode(data.geohash);
            let blankNode = rdf.environment.createBlankNode().toNT();

            this.addToBuffer({
                subject: observationID,
                predicate: 'rdf:type',
                object: "sosa:Observation",
                graph: this.graph
            });

            this.addToBuffer({
                subject: observationID,
                predicate: 'sosa:hasFeatureOfInterest',
                object: measuredPart.toUpperCase(),
                graph: this.graph
            });

            this.addToBuffer({
                subject: observationID,
                predicate: 'sosa:hasSimpleResult',
                object: '"' + data.value + '"',
                graph: this.graph
            });

            this.addToBuffer({
                subject: observationID,
                predicate: 'sosa:madeBySensor',
                object: data.sourceId.replace('lora.', 'Sensor/'),
                graph: this.graph
            });

            this.addToBuffer({
                subject: observationID,
                predicate: 'sosa:observedProperty',
                object: data.sourceId.replace('lora.', 'Sensor/') + "/" + measuredPart.toUpperCase(),
                graph: this.graph
            });

            this.addToBuffer({
                subject: observationID,
                predicate: 'sosa:resultTime',
                object: '"' + date + '"',
                graph: this.graph
            });

            // GEO
            this.addToBuffer({
                subject: observationID,
                predicate: "schema:geo",
                object: blankNode,
                graph: this.graph
            });

            this.addToBuffer({
                subject: blankNode,
                predicate: "rdf:type",
                object: "schema:GeoCoordinates",
                graph: this.graph
            });

            this.addToBuffer({
                subject: blankNode,
                predicate: "schema:latitude",
                object: '"' + latlng.lat + '"',
                graph: this.graph
            });

            this.addToBuffer({
                subject: blankNode,
                predicate: "schema:longitude",
                object: '"' + latlng.lon + '"',
                graph: this.graph
            });
    }

    get dataStream() {
        return this._dataStream;
    }

    get sensors() {
        return this._sensors;
    }

    get parts() {
        return this._parts;
    }

    get graph(){
        return this._graph;
    }

    set graph(name){
        this._graph = name;
    }

    get lastSource() {
        return this._lastSource;
    }

    set lastSource(source) {
        this._lastSource = source;
    }

    get buffer() {
        return this._buffer;
    }

    resetBuffer() {
        this._buffer = [];
    }

    addToBuffer(quad) {
        this._buffer.push(quad);
    }
}

module.exports = DataMapper;