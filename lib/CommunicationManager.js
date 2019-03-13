var Koa = require('koa');
var Router = require('koa-router');
var WS = require('ws');
var CommunicationManager = /** @class */ (function () {
    function CommunicationManager(config) {
        this._config = config;
        this._app = new Koa();
        this._router = new Router();
        this._webSockets = new Map();
    }
    CommunicationManager.prototype.setupWebSocket = function (name, port) {
        var websocket = new WS.Server({ port: port });
        this.webSockets.set(name, websocket);
    };
    CommunicationManager.prototype.pushData = function (name, data) {
        if (this.webSockets.has(name)) {
            this.webSockets.get(name).clients.forEach(function (client) {
                // Check is the connection is open
                if (client.readyState === WS.OPEN) {
                    client.send(data);
                }
            });
        }
        else {
            throw new Error('There is no WebSocket interface defined for ' + name);
        }
    };
    Object.defineProperty(CommunicationManager.prototype, "config", {
        get: function () {
            return this._config;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CommunicationManager.prototype, "app", {
        get: function () {
            return this._app;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CommunicationManager.prototype, "router", {
        get: function () {
            return this._router;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CommunicationManager.prototype, "webSockets", {
        get: function () {
            return this._webSockets;
        },
        enumerable: true,
        configurable: true
    });
    return CommunicationManager;
}());
module.exports = CommunicationManager;
