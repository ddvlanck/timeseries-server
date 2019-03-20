"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
var MultidimensionalInterface = require('../MultidimensionalInterface');
var Utils = require('../Utils');
var moment = require('moment'); // Library for parsing, validating, manipulating, and formatting dates.
var TimeRange = /** @class */ (function (_super) {
    __extends(TimeRange, _super);
    function TimeRange(config, commMan) {
        var _this = _super.call(this, commMan) || this;
        _this._serverURL = _this.commMan.config.serverUrl;
        _this._name = config.name;
        _this._websocket = config.websocket;
        _this._fragmentsPath = config.fragmentsPath;
        _this._staticTriples = config.staticTriples;
        _this._latestGat = null;
        // Init storage folder
        Utils.createFolder(_this._fragmentsPath);
        // Load HTTP interfaces for this interface
        _this.setupPollInterfaces();
        // Load Websocket interface
        if (_this.websocket) {
            _this.setupPubSubInterface(_this.name, config.wsPort);
        }
        return _this;
    }
    TimeRange.prototype.setupPollInterfaces = function () {
        var _this = this;
        var self = this;
        // YEAR
        this.commMan.router.get('/' + this.name + '/fragment/:year', function (ctx, next) { return __awaiter(_this, void 0, void 0, function () {
            var filePath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ctx.response.set({ 'Access-Control-Allow-Origin': '*' });
                        filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '.trig';
                        return [4 /*yield*/, this.handleRequest(ctx, filePath, true, true)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        // MONTH
        this.commMan.router.get('/' + this.name + '/fragment/:year/:month', function (ctx, next) { return __awaiter(_this, void 0, void 0, function () {
            var filePath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ctx.response.set({ 'Access-Control-Allow-Origin': '*' });
                        filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '-' + ctx.params.month.split('_')[0] + '.trig';
                        return [4 /*yield*/, this.handleRequest(ctx, filePath, true, true)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        // DAY
        this.commMan.router.get('/' + this.name + '/fragment/:year/:month/:day', function (ctx, next) { return __awaiter(_this, void 0, void 0, function () {
            var filePath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ctx.response.set({ 'Access-Control-Allow-Origin': '*' });
                        filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '-'
                            + ctx.params.month.split('_')[0] + '-' + ctx.params.day.split('_')[0] + '.trig';
                        return [4 /*yield*/, this.handleRequest(ctx, filePath, true, true)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        // HOUR
        this.commMan.router.get('/' + this.name + '/fragment/:year/:month/:day/:hour', function (ctx, next) { return __awaiter(_this, void 0, void 0, function () {
            var filePath;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ctx.response.set({ 'Access-Control-Allow-Origin': '*' });
                        filePath = this.fragmentsPath + '/' + ctx.params.year.split('_')[0] + '-'
                            + ctx.params.month.split('_')[0] + '-' + ctx.params.day.split('_')[0] + 'T'
                            + ctx.params.hour.split('_')[0] + '.trig';
                        return [4 /*yield*/, this.handleRequest(ctx, filePath, true, false)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    };
    TimeRange.prototype.handleRequest = function (ctx, filePath, metadata, calculateData) {
        return __awaiter(this, void 0, void 0, function () {
            var files, st, ft, fragmentID, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!!Utils.exists(filePath)) return [3 /*break*/, 1];
                        // If it doesn't exist, we search for triples and create the file.
                        // If not triples were found, then we return an error.
                        if (calculateData) {
                            files = Utils.getFilesFromInterfaceByParams(filePath.substring(0, filePath.lastIndexOf('/')), ctx);
                            Utils.getAllDataToGenerateFile(filePath, files);
                        }
                        else {
                            ctx.response.status = 404;
                            ctx.response.body = "[TimeRange]: No data found.";
                        }
                        return [3 /*break*/, 5];
                    case 1: return [4 /*yield*/, Utils.getTriplesFromFile(this.staticTriples)];
                    case 2:
                        st = _b.sent();
                        return [4 /*yield*/, Utils.getTriplesFromFile(filePath)];
                    case 3:
                        ft = _b.sent();
                        if (metadata) {
                            fragmentID = (Utils.getTriplesBySPOG(ft[1], null, 'http://www.w3.org/ns/prov#generatedAtTime', null, null)[0]).subject;
                            this.addMetadata(fragmentID, ft[1]);
                        }
                        ctx.response.set({ 'Content-Type': 'text/plain' });
                        _a = ctx.response;
                        return [4 /*yield*/, Utils.formatTriples('application/trig', st[1].concat(ft[1]), st[0])];
                    case 4:
                        _a.body = _b.sent();
                        _b.label = 5;
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    // Looks like we will not need this anymore
    TimeRange.prototype.onData = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, gat, hlevel;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        this.latestData = data;
                        _a = this;
                        _b = moment;
                        return [4 /*yield*/, Utils.getGeneratedAtTimeValue(this.latestData)];
                    case 1:
                        _a.latestGat = _b.apply(void 0, [_c.sent()]);
                        gat = this.latestGat;
                        gat.utc();
                        return [4 /*yield*/, this.handleHourLevel(this.latestData, gat)];
                    case 2:
                        hlevel = _c.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    TimeRange.prototype.getTriplesForDate = function (date) {
        // TODO:
    };
    //////////////////////////////////////////////////////
    ////////////////////// HOURS /////////////////////////
    //////////////////////////////////////////////////////
    TimeRange.prototype.handleHourLevel = function (rawdata, gat) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, hourPath, data, values, newTriples, storedTriples, _c, _d, _e, _f, _g, _h;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        hourPath = this.fragmentsPath + '/' + gat.format('YYYY-MM-DDTHH') + '.trig';
                        data = null;
                        values = null;
                        console.log("Path: " + hourPath);
                        if (!Utils.exists(hourPath)) return [3 /*break*/, 6];
                        return [4 /*yield*/, Utils.getTriplesFromString(rawdata.toString())];
                    case 1:
                        newTriples = (_j.sent())[1];
                        return [4 /*yield*/, Utils.getTriplesFromFile(hourPath)];
                    case 2:
                        storedTriples = (_j.sent())[1];
                        return [4 /*yield*/, this.updateHourFragment(newTriples, storedTriples, gat)];
                    case 3:
                        _a = _j.sent(), data = _a[0], values = _a[1];
                        _d = (_c = Utils).appendToFile;
                        _e = [hourPath];
                        return [4 /*yield*/, Utils.formatTriples('application/trig', data)];
                    case 4: 
                    //await Utils.overwriteFile(hourPath, await Utils.formatTriples('application/trig', data));
                    return [4 /*yield*/, _d.apply(_c, _e.concat([_j.sent()]))];
                    case 5:
                        //await Utils.overwriteFile(hourPath, await Utils.formatTriples('application/trig', data));
                        _j.sent();
                        return [3 /*break*/, 10];
                    case 6: return [4 /*yield*/, this.createHourFragment(gat)];
                    case 7:
                        _b = _j.sent(), data = _b[0], values = _b[1];
                        _g = (_f = Utils).appendToFile;
                        _h = [hourPath];
                        return [4 /*yield*/, Utils.formatTriples('application/trig', data)];
                    case 8: return [4 /*yield*/, _g.apply(_f, _h.concat([_j.sent()]))];
                    case 9:
                        _j.sent();
                        _j.label = 10;
                    case 10: return [2 /*return*/, [data, values]];
                }
            });
        });
    };
    TimeRange.prototype.createHourFragment = function (gat) {
        return __awaiter(this, void 0, void 0, function () {
            var tempDate, nextMonth, nextDay, nextHour, rangeGate, fragmentID, quads, values, i;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        tempDate = moment(gat);
                        nextMonth = tempDate.add('1', 'M').format('MM');
                        tempDate = moment(gat);
                        nextDay = tempDate.add('1', 'd').format('DD');
                        tempDate = moment(gat);
                        nextHour = tempDate.add('1', 'h').format('HH');
                        rangeGate = this.serverUrl + this.name + '/fragment/' + gat.year() + '_' + (gat.year() + 1) + '/'
                            + gat.format('MM') + '_' + nextMonth + '/' + gat.format('DD') + '_' + nextDay;
                        fragmentID = rangeGate + gat.format('HH') + '_' + nextHour;
                        return [4 /*yield*/, Utils.getTriplesFromString(this.latestData.toString())];
                    case 1:
                        quads = (_a.sent())[1];
                        values = new Map();
                        tempDate = moment(gat);
                        tempDate.minutes(0).seconds(0).milliseconds(0);
                        for (i = 0; i < quads.length; i++) {
                            if (quads[i].predicate === 'http://vocab.datex.org/terms#parkingNumberOfVacantSpaces') {
                                quads[i].graph = fragmentID;
                                quads[i].predicate = 'http://datapiloten.be/vocab/timeseries#mean';
                                values.set(quads[i].subject, Utils.getLiteralValue(quads[i].object));
                            }
                            if (quads[i].predicate === 'http://www.w3.org/ns/prov#generatedAtTime') {
                                quads[i].subject = fragmentID;
                            }
                        }
                        quads.push({
                            subject: fragmentID,
                            predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
                            object: 'http://w3id.org/multidimensional-interface/ontology#RangeFragment'
                        });
                        quads.push({
                            subject: fragmentID,
                            predicate: 'http://w3id.org/multidimensional-interface/ontology#initial',
                            object: '"' + tempDate.toISOString() + '"'
                        });
                        quads.push({
                            subject: fragmentID,
                            predicate: 'http://w3id.org/multidimensional-interface/ontology#final',
                            object: '"' + tempDate.add(1, 'h').toISOString() + '"'
                        });
                        quads.push({
                            subject: fragmentID,
                            predicate: 'http://w3id.org/multidimensional-interface/ontology#hasRangeGate',
                            object: rangeGate
                        });
                        quads.push({
                            subject: fragmentID,
                            predicate: 'http://datapiloten.be/vocab/timeseries#sampleSize',
                            object: '"1"'
                        });
                        return [2 /*return*/, [quads, values]];
                }
            });
        });
    };
    TimeRange.prototype.updateHourFragment = function (newer, old, gat) {
        var newValues = this.getPVFromRawData(newer);
        var sampleTriple = Utils.getTriplesBySPOG(old, null, 'http://datapiloten.be/vocab/timeseries#sampleSize')[0];
        var sampleValue = parseInt(Utils.getLiteralValue(sampleTriple.object));
        var values = new Map();
        for (var i in old) {
            if (old[i].predicate === 'http://datapiloten.be/vocab/timeseries#mean') {
                old[i].object = '"' + this.calculateMean(parseInt(newValues.get(old[i].subject)), parseInt(Utils.getLiteralValue(old[i].object)), sampleValue) + '"';
                values.set(old[i].subject, Utils.getLiteralValue(old[i].object));
            }
            if (old[i].predicate === 'http://www.w3.org/ns/prov#generatedAtTime') {
                old[i].object = '"' + gat.toISOString() + '"';
            }
            if (old[i].predicate === 'http://datapiloten.be/vocab/timeseries#sampleSize') {
                old[i].object = '"' + (sampleValue + 1) + '"';
            }
        }
        return [old, values];
    };
    //////////////////////////////////////////////////////
    ////////////////////// DAYS //////////////////////////
    //////////////////////////////////////////////////////
    TimeRange.prototype.handleDayLevel = function (hlevel, gat) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, dayPath, data, values, storedTriples, _b, _c, _d, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        dayPath = this.fragmentsPath + '/' + gat.format('YYYY-MM-DD') + '.trig';
                        data = null;
                        values = null;
                        if (!Utils.exists(dayPath)) return [3 /*break*/, 5];
                        return [4 /*yield*/, Utils.getTriplesFromFile(dayPath)];
                    case 1:
                        storedTriples = (_h.sent())[1];
                        return [4 /*yield*/, this.updateFragment(hlevel[1], storedTriples, gat)];
                    case 2:
                        _a = _h.sent(), data = _a[0], values = _a[1];
                        _c = (_b = Utils).overwriteFile;
                        _d = [dayPath];
                        return [4 /*yield*/, Utils.formatTriples('application/trig', data)];
                    case 3: return [4 /*yield*/, _c.apply(_b, _d.concat([_h.sent()]))];
                    case 4:
                        _h.sent();
                        return [3 /*break*/, 8];
                    case 5:
                        data = this.createDayFragment(hlevel[0], gat);
                        values = hlevel[1];
                        _f = (_e = Utils).appendToFile;
                        _g = [dayPath];
                        return [4 /*yield*/, Utils.formatTriples('application/trig', data)];
                    case 6: return [4 /*yield*/, _f.apply(_e, _g.concat([_h.sent()]))];
                    case 7:
                        _h.sent();
                        _h.label = 8;
                    case 8: return [2 /*return*/, [data, values]];
                }
            });
        });
    };
    TimeRange.prototype.createDayFragment = function (hlevel, gat) {
        var tempDate = moment(gat);
        var nextMonth = tempDate.add(1, 'M').format('MM');
        tempDate = moment(gat);
        var nextDay = tempDate.add(1, 'd').format('DD');
        var rangeGate = this.serverUrl + this.name + '/fragment/' + gat.year() + '_' + (gat.year() + 1) + '/'
            + gat.format('MM') + '_' + nextMonth + '/';
        var fragmentId = rangeGate + gat.format('DD') + '_' + nextDay;
        tempDate = moment(gat);
        tempDate.hours(0).minutes(0).seconds(0).milliseconds(0);
        for (var i = 0; i < hlevel.length; i++) {
            if (hlevel[i].graph) {
                hlevel[i].graph = fragmentId;
            }
            else {
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
            if (hlevel[i].predicate === 'http://datapiloten.be/vocab/timeseries#sampleSize') {
                hlevel[i].object = '"1"';
            }
        }
        return hlevel;
    };
    //////////////////////////////////////////////////////
    ////////////////////// MONTH /////////////////////////
    //////////////////////////////////////////////////////
    TimeRange.prototype.handleMonthLevel = function (dlevel, gat) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, monthPath, data, values, storedTriples, _b, _c, _d, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        monthPath = this.fragmentsPath + '/' + gat.format('YYYY-MM') + '.trig';
                        data = null;
                        values = null;
                        if (!Utils.exists(monthPath)) return [3 /*break*/, 5];
                        return [4 /*yield*/, Utils.getTriplesFromFile(monthPath)];
                    case 1:
                        storedTriples = (_h.sent())[1];
                        return [4 /*yield*/, this.updateFragment(dlevel[1], storedTriples, gat)];
                    case 2:
                        _a = _h.sent(), data = _a[0], values = _a[1];
                        _c = (_b = Utils).overwriteFile;
                        _d = [monthPath];
                        return [4 /*yield*/, Utils.formatTriples('application/trig', data)];
                    case 3: return [4 /*yield*/, _c.apply(_b, _d.concat([_h.sent()]))];
                    case 4:
                        _h.sent();
                        return [3 /*break*/, 8];
                    case 5:
                        data = this.createMonthFragment(dlevel[0], gat);
                        values = dlevel[1];
                        _f = (_e = Utils).appendToFile;
                        _g = [monthPath];
                        return [4 /*yield*/, Utils.formatTriples('application/trig', data)];
                    case 6: return [4 /*yield*/, _f.apply(_e, _g.concat([_h.sent()]))];
                    case 7:
                        _h.sent();
                        _h.label = 8;
                    case 8: return [2 /*return*/, [data, values]];
                }
            });
        });
    };
    TimeRange.prototype.createMonthFragment = function (dlevel, gat) {
        var tempDate = moment(gat);
        var nextMonth = tempDate.add(1, 'M').format('MM');
        var rangeGate = this.serverUrl + this.name + '/fragment/' + gat.year() + '_' + (gat.year() + 1) + '/';
        var fragmentId = rangeGate + gat.format('MM') + '_' + nextMonth;
        tempDate = moment(gat);
        tempDate.date(1).hours(0).minutes(0).seconds(0).milliseconds(0);
        for (var i = 0; i < dlevel.length; i++) {
            if (dlevel[i].graph) {
                dlevel[i].graph = fragmentId;
            }
            else {
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
            if (dlevel[i].predicate === 'http://datapiloten.be/vocab/timeseries#sampleSize') {
                dlevel[i].object = '"1"';
            }
        }
        return dlevel;
    };
    //////////////////////////////////////////////////////
    ////////////////////// YEARS /////////////////////////
    //////////////////////////////////////////////////////
    TimeRange.prototype.handleYearLevel = function (mlevel, gat) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, yearPath, data, values, storedTriples, _b, _c, _d, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        yearPath = this.fragmentsPath + '/' + gat.format('YYYY') + '.trig';
                        data = null;
                        values = null;
                        if (!Utils.exists(yearPath)) return [3 /*break*/, 5];
                        return [4 /*yield*/, Utils.getTriplesFromFile(yearPath)];
                    case 1:
                        storedTriples = (_h.sent())[1];
                        return [4 /*yield*/, this.updateFragment(mlevel[1], storedTriples, gat)];
                    case 2:
                        _a = _h.sent(), data = _a[0], values = _a[1];
                        _c = (_b = Utils).overwriteFile;
                        _d = [yearPath];
                        return [4 /*yield*/, Utils.formatTriples('application/trig', data)];
                    case 3: return [4 /*yield*/, _c.apply(_b, _d.concat([_h.sent()]))];
                    case 4:
                        _h.sent();
                        return [3 /*break*/, 8];
                    case 5:
                        data = this.createYearFragment(mlevel[0], gat);
                        values = mlevel[1];
                        _f = (_e = Utils).appendToFile;
                        _g = [yearPath];
                        return [4 /*yield*/, Utils.formatTriples('application/trig', data)];
                    case 6: return [4 /*yield*/, _f.apply(_e, _g.concat([_h.sent()]))];
                    case 7:
                        _h.sent();
                        _h.label = 8;
                    case 8: return [2 /*return*/, [data, values]];
                }
            });
        });
    };
    TimeRange.prototype.createYearFragment = function (mlevel, gat) {
        var tempDate = moment(gat);
        var fragmentId = this.serverUrl + this.name + '/fragment/' + gat.year() + '_' + (gat.year() + 1);
        tempDate.month(0).date(1).hours(0).minutes(0).seconds(0).milliseconds(0);
        for (var i = 0; i < mlevel.length; i++) {
            if (mlevel[i].graph) {
                mlevel[i].graph = fragmentId;
            }
            else {
                mlevel[i].subject = fragmentId;
            }
            if (mlevel[i].predicate === 'http://w3id.org/multidimensional-interface/ontology#initial') {
                mlevel[i].object = '"' + tempDate.toISOString() + '"';
            }
            if (mlevel[i].predicate === 'http://w3id.org/multidimensional-interface/ontology#final') {
                mlevel[i].object = '"' + tempDate.add(1, 'y').toISOString() + '"';
            }
            if (mlevel[i].predicate === 'http://datapiloten.be/vocab/timeseries#sampleSize') {
                mlevel[i].object = '"1"';
            }
        }
        mlevel = mlevel.filter(function (m) { return m.predicate !== 'http://w3id.org/multidimensional-interface/ontology#hasRangeGate'; });
        return mlevel;
    };
    //////////////////////////////////////////////////////
    TimeRange.prototype.updateFragment = function (newValues, old, gat) {
        var sampleTriple = Utils.getTriplesBySPOG(old, null, 'http://datapiloten.be/vocab/timeseries#sampleSize')[0];
        var sampleValue = parseInt(Utils.getLiteralValue(sampleTriple.object));
        for (var i in old) {
            if (old[i].predicate === 'http://datapiloten.be/vocab/timeseries#mean') {
                old[i].object = '"' + this.calculateMean(parseInt(newValues.get(old[i].subject)), parseInt(Utils.getLiteralValue(old[i].object)), sampleValue) + '"';
                newValues.set(old[i].subject, Utils.getLiteralValue(old[i].object));
            }
            if (old[i].predicate === 'http://www.w3.org/ns/prov#generatedAtTime') {
                old[i].object = '"' + gat.toISOString() + '"';
            }
            if (old[i].predicate === 'http://datapiloten.be/vocab/timeseries#sampleSize') {
                old[i].object = '"' + (sampleValue + 1) + '"';
            }
        }
        return [old, newValues];
    };
    TimeRange.prototype.addMetadata = function (fragmentId, level) {
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
    };
    TimeRange.prototype.getPVFromRawData = function (triples) {
        var res = new Map();
        for (var i in triples) {
            if (triples[i].predicate === 'http://vocab.datex.org/terms#parkingNumberOfVacantSpaces') {
                res.set(triples[i].subject, Utils.getLiteralValue(triples[i].object));
            }
        }
        return res;
    };
    TimeRange.prototype.calculateMean = function (n, aggregate, sample) {
        return Math.floor(((aggregate * sample) + n) / (sample + 1));
    };
    Object.defineProperty(TimeRange.prototype, "serverUrl", {
        get: function () {
            return this._serverUrl;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(TimeRange.prototype, "name", {
        get: function () {
            return this._name;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(TimeRange.prototype, "websocket", {
        get: function () {
            return this._websocket;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(TimeRange.prototype, "fragmentsPath", {
        get: function () {
            return this._fragmentsPath;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(TimeRange.prototype, "staticTriples", {
        get: function () {
            return this._staticTriples;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(TimeRange.prototype, "latestGat", {
        get: function () {
            return this._latestGat;
        },
        set: function (date) {
            this._latestGat = date;
        },
        enumerable: true,
        configurable: true
    });
    return TimeRange;
}(MultidimensionalInterface));
module.exports = TimeRange;
