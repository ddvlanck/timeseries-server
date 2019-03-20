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
/*
*   This class will fetch data from te given URLs
*   For now, we only work with data from the Obelisk API (City of Things)
*   To fetch this data we have to authorize ourselves etc..
*   normally it should be possible to just provide the URL to retrieve the data
* */
var request = require('request');
var Configuration = require('../lib/Configuration');
var DataFetcher = /** @class */ (function () {
    function DataFetcher(urls) {
        this.URLs = urls;
        this.authorize();
    }
    DataFetcher.prototype.authorize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var tokens;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getRPTtoken()];
                    case 1:
                        tokens = _a.sent();
                        this.access_token = tokens.access_token;
                        this.refresh_token = tokens.refresh_token;
                        this.getAirQualityThings();
                        return [2 /*return*/];
                }
            });
        });
    };
    DataFetcher.prototype.refresh = function () {
        return __awaiter(this, void 0, void 0, function () {
            var tokens;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.refreshRPTtoken()];
                    case 1:
                        tokens = _a.sent();
                        this.access_token = tokens.access_token;
                        this.refresh_token = tokens.refresh_token;
                        return [2 /*return*/];
                }
            });
        });
    };
    DataFetcher.prototype.getAirQualityThings = function () {
        return __awaiter(this, void 0, void 0, function () {
            var things, index, thing;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, new Promise(function (resolve) {
                            request.get('https://idlab-iot.tengu.io/api/v1/scopes/cot.dencity/things', {
                                headers: {
                                    'Accept': 'application/json',
                                    'Authorization': 'Bearer ' + _this.access_token
                                }
                            }, function (err, httpResponse, body) {
                                if (err) {
                                    console.log(err);
                                }
                                if (httpResponse.statusCode === 200) {
                                    resolve(JSON.parse(body));
                                }
                                if (httpResponse.statusCode === 401) { // TODO : is this allowed?
                                    _this.refresh(); // TODO : make sure it's finished before next call
                                    _this.getAirQualityThings();
                                }
                            });
                        })];
                    case 1:
                        things = _a.sent();
                        // 2. Filter out those Things that not measure air quality
                        for (index = 0; index < things.length; index++) {
                            thing = things[index].id;
                            request.get('https://idlab-iot.tengu.io/api/v1/scopes/cot.dencity/things/' + thing + '/metrics', {
                                headers: {
                                    'Accept': 'application/json',
                                    'Authorization': 'Bearer ' + this.access_token
                                }
                            }, function (err, httpResponse, body) {
                                if (err)
                                    console.log(err);
                                if (httpResponse.statusCode === 200) {
                                    var metrics = JSON.parse(body);
                                    // TODO : iterate through metrics
                                    /*for(let metric in metrics){
                
                                    }*/
                                }
                                if (httpResponse.statusCode === 401) {
                                    _this.refresh();
                                    _this.getAirQualityThings();
                                }
                            });
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    DataFetcher.prototype.fetchData = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                /*
                *   1. Fetch all the 'things'
                *   2. Delete things that do not measure airquality
                *   3. For the remaining things, get the airquality data
                * */
                this.authorize();
                this.refresh();
                return [2 /*return*/];
            });
        });
    };
    /*
    *   In order to execute API calls we need to authorize ourselves
    *   We receive an access token and a refresh token
    *   When the access token has expired we need to use the refresh token to request a new access token
    * */
    DataFetcher.prototype.getRPTtoken = function () {
        var authString = new Buffer('linked-data-fragments-client:c9022447-3f57-425d-b1e9-a09c31d80f74').toString('base64');
        var tokens = new Promise(function (resolve) {
            request.post('https://idlab-iot.tengu.io/auth/realms/idlab-iot/protocol/openid-connect/token', {
                form: {
                    'grant_type': 'urn:ietf:params:oauth:grant-type:uma-ticket',
                    'audience': 'policy-enforcer'
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + authString
                }
            }, function (err, httpResponse, body) {
                if (err)
                    console.log(err);
                if (httpResponse.statusCode === 200) {
                    var jsonBody = JSON.parse(body);
                    resolve({ 'access_token': jsonBody.access_token, 'refresh_token': jsonBody.refresh_token });
                }
            });
        });
        return tokens;
    };
    DataFetcher.prototype.refreshRPTtoken = function () {
        var _this = this;
        var authString = new Buffer('linked-data-fragments-client:c9022447-3f57-425d-b1e9-a09c31d80f74').toString('base64');
        var tokens = new Promise(function (resolve) {
            request.post('https://idlab-iot.tengu.io/auth/realms/idlab-iot/protocol/openid-connect/token', {
                form: {
                    'grant_type': 'refresh_token',
                    'refresh_token': _this.refresh_token,
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + authString
                }
            }, function (err, httpResponse, body) {
                if (err)
                    console.log(err);
                if (httpResponse.statusCode === 200) {
                    var jsonBody = JSON.parse(body);
                    resolve({ 'access_token': jsonBody.access_token, 'refresh_token': jsonBody.refresh_token });
                }
                if (httpResponse.statusCode === 400) {
                    return _this.authorize();
                }
            });
        });
        return tokens;
    };
    return DataFetcher;
}());
module.exports = DataFetcher;
