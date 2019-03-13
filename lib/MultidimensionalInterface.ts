export {};
const DataEventManager = require('./DataEventManager');
class MultidimensionalInterface {

    private _commMan: CommunicationManager;
    private _latestData;

    constructor(communicationManager: CommunicationManager){
        // Communication Manager Object
        this._commMan = communicationManager;

        // Latest piece of data received
        this._latestData = null;

        //Subscribe to 'data' events
        DataEventManager.subscribe('data', (...data) => this.onData(data));
    }

    // Abstract method to be overriden by interface implementation
    onData(data: object): void {}

    setupPollInterfaces(): void {}

    // Websocket interface creator
    setupPubSubInterface(name: string, port: number){
        this.commMan.setupWebSocket(name, port);
    }

    get commMan(){
        return this._commMan;
    }

    get latestData(){
        return this._latestData;
    }

    set latestData(data){
        this._latestData = data;
    }
}

module.exports = MultidimensionalInterface;

