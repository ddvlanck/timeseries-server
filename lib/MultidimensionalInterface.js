"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var DataEventManager = require('./DataEventManager');
var MultidimensionalInterface = /** @class */ (function () {
    function MultidimensionalInterface(communicationManager) {
        var _this = this;
        // Communication Manager Object
        this._commMan = communicationManager;
        // Latest piece of data received
        this._latestData = null;
        //Subscribe to 'data' events
        DataEventManager.subscribe('data', function () {
            var data = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                data[_i] = arguments[_i];
            }
            return _this.onData(data);
        });
    }
    // Abstract method to be overriden by interface implementation
    MultidimensionalInterface.prototype.onData = function (data) { };
    MultidimensionalInterface.prototype.setupPollInterfaces = function () { };
    // Websocket interface creator
    MultidimensionalInterface.prototype.setupPubSubInterface = function (name, port) {
        this.commMan.setupWebSocket(name, port);
    };
    Object.defineProperty(MultidimensionalInterface.prototype, "commMan", {
        get: function () {
            return this._commMan;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(MultidimensionalInterface.prototype, "latestData", {
        get: function () {
            return this._latestData;
        },
        set: function (data) {
            this._latestData = data;
        },
        enumerable: true,
        configurable: true
    });
    return MultidimensionalInterface;
}());
module.exports = MultidimensionalInterface;
