const Stream = require('stream');

const quad = require('rdf-quad');
const Utils = require('../lib/Utils');
const moment = require('moment');
const tz = require('moment-timezone');


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

        this._sensors = {
            'lora.343233386A378918': 'Sensor/343233386A378918',
            'lora.3432333877378117': 'Sensor/3432333877378117',
            'lora.3432333865377618': 'Sensor/3432333865377618',
            'lora.343233385F377C18': 'Sensor/343233385F377C18',
            'lora.70B3D58FF0032ED2': 'Sensor/70B3D58FF0032ED2',
            'lora.70B3D58FF0032E37': 'Sensor/70B3D58FF0032E37',
            'lora.3432333857376518': 'Sensor/3432333857376518',
            'lora.3432333855376418': 'Sensor/3432333855376418',
            'lora.343233384A376E18': 'Sensor/343233384A376E18',
            'lora.343233386A377C18': 'Sensor/343233386A377C18',
            'lora.3432333857376218': 'Sensor/3432333857376218',
            'lora.3432333849378418': 'Sensor/3432333849378418',
            'lora.70B3D58FF0032E95': 'Sensor/70B3D58FF0032E95',
            'lora.3432333855378818': 'Sensor/3432333855378818',
            'lora.3432333855378E18': 'Sensor/3432333855378E18',
            'lora.3432333853376B18': 'Sensor/3432333853376B18',
            'lora.3432333851378918': 'Sensor/3432333851378918',
            'lora.343233384F378D18': 'Sensor/343233384F378D18',
        };
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