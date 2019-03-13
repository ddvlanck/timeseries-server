var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var MultidimensionalInterface = require('../../lib/MultidimensionalInterface');
var Utils = require('../../lib/Utils');
var md5 = require('md5');
var RawData = /** @class */ (function (_super) {
    __extends(RawData, _super);
    function RawData(config, commMan) {
        var _this = _super.call(this, commMan) || this;
        _this._serverUrl = _this.commMan.config.serverUrl;
        _this._name = config.name;
        _this._websocket = config.websocket;
        _this._fragmentsPath = config.fragmentsPath;
        _this._fragmentMaxSize = config.maxFileSize;
        _this._staticTriples = config.staticTriples;
        _this._byteCounter = 0;
        _this._lastFragment = null;
        _this._lastGat = null;
        // Load HTTP interfaces for this interfaces
        _this.setupPollInterfaces();
        // Load Websocket interface
        if (_this._websocket) {
            _super.prototype.setupPubSubInterface.call(_this, _this._name, config.wsPort);
        }
        // Init storage folder
        Utils.createFolder(_this._fragmentsPath);
        return _this;
    }
    RawData.prototype.onData = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, st, staticTriples;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this.latestData = data;
                        _a = this;
                        return [4 /*yield*/, Utils.getGeneratedAtTimeValue(this.latestData)];
                    case 1:
                        _a._lastGat = _b.sent();
                        if (!this._websocket) return [3 /*break*/, 4];
                        return [4 /*yield*/, Utils.getTriplesFromFile(this._staticTriples)];
                    case 2:
                        st = _b.sent();
                        return [4 /*yield*/, Utils.formatTriples('application/trig', st[1], st[0])];
                    case 3:
                        staticTriples = _b.sent();
                        this.commMan.pushData(this.name, staticTriples.concat(data.toString()));
                        _b.label = 4;
                    case 4:
                        // Store data in files according to config to keep historic data
                        this.storeData();
                        return [2 /*return*/];
                }
            });
        });
    };
    RawData.prototype.setupPollInterfaces = function () {
        var _this = this;
        var self = this;
        // HTTP interface to get the latset data update
        this.commMan.router.get('/' + this.name + '/latest', function (ctx, next) { return __awaiter(_this, void 0, void 0, function () {
            var etag, ifNoneMatchHeader, last_modified, st, staticTriples;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ctx.response.set({ 'Access-Control-Allow-Origin': '*' });
                        if (!(self.latestData == null)) return [3 /*break*/, 1];
                        ctx.response.status = 404;
                        ctx.response.body = "No data found.";
                        return [3 /*break*/, 5];
                    case 1:
                        etag = 'W/"' + md5(this._lastGat) + '"';
                        ifNoneMatchHeader = ctx.request.header['if-none-match'];
                        last_modified = this._lastGat.toUTCString();
                        if (!(ifNoneMatchHeader && ifNoneMatchHeader === etag)) return [3 /*break*/, 2];
                        ctx.response.status = 304;
                        return [3 /*break*/, 5];
                    case 2:
                        ctx.response.set({
                            //'Cache-Control': 'public, s-maxage=' + (maxage - 1) + ', max-age=' + maxage + ', must-revalidate',
                            //'Expires': expires,
                            'ETag': etag,
                            'Last-Modified': last_modified,
                            'Content-Type': 'application/trig'
                        });
                        return [4 /*yield*/, Utils.getTriplesFromFile(this._staticTriples)];
                    case 3:
                        st = _a.sent();
                        return [4 /*yield*/, Utils.formatTriples('application/trig', st[1], st[0])];
                    case 4:
                        staticTriples = _a.sent();
                        ctx.response.body = staticTriples.concat(self.latestData.toString());
                        _a.label = 5;
                    case 5: return [2 /*return*/];
                }
            });
        }); });
        // HTTP interface to gat a specific fragment of data (historic data)
        this.commMan.router.get('/' + this._name + '/fragments', function (ctx, next) { return __awaiter(_this, void 0, void 0, function () {
            var queryTime, fragments, _a, fragment, index, modFragment, fc, st, staticTriples, ft, fragmentTriples, metaData;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        queryTime = new Date(ctx.query.time);
                        if (queryTime.toString() === 'Invalid Date') {
                            // Redirect to now time
                            ctx.status = 302;
                            ctx.redirect('/' + this.name + '/fragments?time=' + new Date().toISOString());
                            return [2 /*return*/];
                        }
                        fragments = Utils.getAllFragments(this.fragmentsPath).map(function (f) {
                            f = f.replace(/_/g, ':');
                            return new Date(f.substring(0, f.indexOf('.trig'))).getTime();
                        });
                        _a = Utils.dateBinarySearch(queryTime.getTime(), fragments), fragment = _a[0], index = _a[1];
                        if (queryTime.getTime() !== fragment.getTime()) {
                            // Redirect to correct fragment URL
                            ctx.status = 302;
                            modFragment = fragment.toISOString().replace(/:/g, '_');
                            ctx.redirect('/' + this.name + '/fragments?time=' + modFragment);
                            return [2 /*return*/];
                        }
                        fc = Utils.getFragmentsCount(this._fragmentsPath);
                        return [4 /*yield*/, Utils.getTriplesFromFile(this._staticTriples)];
                    case 1:
                        st = _b.sent();
                        return [4 /*yield*/, Utils.formatTriples('application/trig', st[1], st[0])];
                    case 2:
                        staticTriples = _b.sent();
                        return [4 /*yield*/, Utils.getTriplesFromFile(this._fragmentsPath + '/' + fragment.toISOString())];
                    case 3:
                        ft = _b.sent();
                        return [4 /*yield*/, Utils.formatTriples('application/trig', ft[1], ft[0])];
                    case 4:
                        fragmentTriples = _b.sent();
                        return [4 /*yield*/, this.createMetadata(fragment, index)];
                    case 5:
                        metaData = _b.sent();
                        ctx.response.body = staticTriples.concat('\n' + fragmentTriples, '\n' + metaData);
                        ctx.response.set({
                            'Access-Control-Allow-Origin': '*',
                            'Content-Type': 'application/trig'
                        });
                        if (index < (fc - 1)) {
                            // Cache older fragment that won't change over time
                            ctx.response.set({ 'Cache-Control': 'public, max-age=31536000, inmutable' });
                        }
                        else {
                            // Do not cache current fragment as it will get more data
                            ctx.response.set({ 'Cache-Control': 'no-cache, no-store, must-revalidate' });
                        }
                        return [2 /*return*/];
                }
            });
        }); });
    };
    RawData.prototype.storeData = function () {
        return __awaiter(this, void 0, void 0, function () {
            var newLastGat, bytes;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.byteCounter === 0 || this.byteCounter > this.fragmentMaxSize) {
                            newLastGat = this.lastGat.toISOString().replace(/:/g, '_');
                            // Create new fragment
                            this.lastFragment = this.fragmentsPath + '/' + newLastGat + '.trig';
                            this.byteCounter = 0;
                        }
                        return [4 /*yield*/, Utils.appendToFile(this.lastFragment, this.latestData.toString())];
                    case 1:
                        _a.sent();
                        bytes = Buffer.from(this.latestData.toString()).byteLength;
                        this.byteCounter += bytes;
                        return [2 /*return*/];
                }
            });
        });
    };
    RawData.prototype.createMetadata = function (fragment, index) {
        return __awaiter(this, void 0, void 0, function () {
            var baseUri, subject, quads, fragments, previous;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        baseUri = this.serverUrl + this.name + '/fragments';
                        subject = baseUri + '?time=' + fragment.toISOString();
                        quads = [];
                        quads.push({
                            subject: subject,
                            predicate: 'http://www.w3.org/2000/01/rdf-schema#label',
                            object: '"Historic and real-time parking data in Ghent"',
                            graph: '#Metadata'
                        });
                        quads.push({
                            subject: subject,
                            predicate: 'http://www.w3.org/2000/01/rdf-schema#comment',
                            object: '"This document is a proof of concept mapping using Linked Datex2 by Pieter Colpaert and Julian Rojas"',
                            graph: '#Metadata'
                        });
                        quads.push({
                            subject: subject,
                            predicate: 'http://xmlns.com/foaf/0.1/homepage',
                            object: 'https://github.com/smartflanders/ghent-datex2-to-linkeddata',
                            graph: '#Metadata'
                        });
                        quads.push({
                            subject: subject,
                            predicate: 'http://creativecommons.org/ns#license',
                            object: 'https://data.stad.gent/algemene-licentie',
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
                        if (index > 0) {
                            fragments = Utils.getAllFragments(this.fragmentsPath);
                            previous = fragments[index - 1].substring(0, fragments[index - 1].indexOf('.trig'));
                            quads.push({
                                subject: subject,
                                predicate: 'http://www.w3.org/ns/hydra/core#previous',
                                object: baseUri + '?time=' + previous,
                                graph: '#Metadata'
                            });
                        }
                        return [4 /*yield*/, Utils.formatTriples('application/trig', quads)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Object.defineProperty(RawData.prototype, "serverUrl", {
        get: function () {
            return this._serverUrl;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RawData.prototype, "name", {
        get: function () {
            return this._name;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RawData.prototype, "websocket", {
        get: function () {
            return this._websocket;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RawData.prototype, "fragmentsPath", {
        get: function () {
            return this._fragmentsPath;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RawData.prototype, "fragmentMaxSize", {
        get: function () {
            return this._fragmentMaxSize;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RawData.prototype, "staticTriples", {
        get: function () {
            return this._staticTriples;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RawData.prototype, "byteCounter", {
        get: function () {
            return this._byteCounter;
        },
        set: function (value) {
            this._byteCounter = value;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RawData.prototype, "lastFragment", {
        get: function () {
            return this._lastFragment;
        },
        set: function (frg) {
            this._lastFragment = frg;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(RawData.prototype, "lastGat", {
        get: function () {
            return this._lastGat;
        },
        set: function (gat) {
            this._lastGat = gat;
        },
        enumerable: true,
        configurable: true
    });
    return RawData;
}(MultidimensionalInterface));
module.exports = RawData;
