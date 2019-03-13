"use strict";
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
var fs = require('fs');
var n3 = require('n3');
var util = require('util');
var readfile = util.promisify(fs.readFile);
var writeFile = util.promisify(fs.writeFile);
var appendFile = util.promisify(fs.appendFile);
module.exports = new /** @class */ (function () {
    function Utils() {
    }
    Utils.prototype.exists = function (path) {
        return fs.existsSync(path);
    };
    Utils.prototype.createFolder = function (path) {
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path);
        }
    };
    Utils.prototype.getFileContent = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, readfile(path)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Utils.prototype.overwriteFile = function (path, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fs.writeFile(path, data)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Utils.prototype.appendToFile = function (path, data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fs.appendFile(path, data, function (err) {
                            if (err)
                                throw err;
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    Utils.prototype.getGeneratedAtTimeValue = function (rdf) {
        return new Promise(function (resolve, reject) {
            n3.Parser().parse(rdf.toString(), function (error, triple, prefixes) {
                if (error) {
                    reject(error);
                }
                if (triple && triple.predicate === 'http://www.w3.org/ns/prov#generatedAtTime') {
                    var n3Util = n3.Util;
                    resolve(new Date(n3Util.getLiteralValue(triple.object)));
                }
            });
        });
    };
    Utils.prototype.getAllFragments = function (path) {
        return fs.readdirSync(path);
    };
    Utils.prototype.dateBinarySearch = function (target, fragments) {
        var min = 0;
        var max = fragments.length - 1;
        var index = null;
        // Checking that target date is contained in the list of fragments
        if (target <= fragments[min]) {
            index = min;
        }
        else if (target >= fragments[max]) {
            index = max;
        }
        else {
            // Perform binary search to find the fragment that contains the target date
            while (index === null) {
                // Divide array in half
                var mid = Math.floor((min + max) / 2);
                // Target date is in the right half
                if (target > fragments[mid]) {
                    if (target < fragments[mid + 1]) {
                        index = mid;
                    }
                    else if (target === fragments[mid + 1]) {
                        index = mid + 1;
                    }
                    else {
                        // Not found yet, proceed to divide further this half in 2
                        min = mid;
                    }
                }
                // Target date is exactly equals to the middle fragment
                else if (target === fragments[mid]) {
                    index = mid;
                }
                // Target date is on the left half
                else {
                    if (target >= fragments[mid - 1]) {
                        index = mid - 1;
                    }
                    else {
                        max = mid;
                    }
                }
            }
        }
        return [new Date(fragments[index]), index];
    };
    Utils.prototype.getTriplesFromFile = function (path) {
        var _this = this;
        return new Promise(function (resolve, reject) { return __awaiter(_this, void 0, void 0, function () {
            var parser, triples, _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        parser = n3.Parser();
                        triples = [];
                        _b = (_a = parser).parse;
                        return [4 /*yield*/, readfile(path)];
                    case 1:
                        _b.apply(_a, [(_c.sent()).toString(), function (err, triple, prefixes) {
                                if (triple) {
                                    triples.push(triple);
                                }
                                else {
                                    resolve([prefixes, triples]);
                                }
                            }]);
                        return [2 /*return*/];
                }
            });
        }); });
    };
    Utils.prototype.getTriplesFromString = function (text) {
        var _this = this;
        return new Promise(function (resolve, reject) { return __awaiter(_this, void 0, void 0, function () {
            var parser, triples;
            return __generator(this, function (_a) {
                parser = n3.Parser();
                triples = [];
                parser.parse(text, function (err, triple, prefixes) {
                    if (triple) {
                        triples.push(triple);
                    }
                    else {
                        resolve([prefixes, triples]);
                    }
                });
                return [2 /*return*/];
            });
        }); });
    };
    Utils.prototype.formatTriples = function (format, triples, prefixes) {
        return new Promise(function (resolve, reject) {
            var writer = n3.Writer({
                prefixes: prefixes,
                format: format
            });
            writer.addTriples(triples);
            writer.end(function (err, res) {
                if (err) {
                    reject(err);
                }
                resolve(res);
            });
        });
    };
    Utils.prototype.getFragmentsCount = function (path) {
        return fs.readdirSync(path).length;
    };
    Utils.prototype.getLiteralValue = function (literal) {
        return n3.Util.getLiteralValue(literal);
    };
    Utils.prototype.getTriplesBySPOG = function (array, s, p, o, g) {
        var temp = array;
        if (s) {
            temp = temp.filter(function (t) { return t.subject === s; });
        }
        if (p) {
            temp = temp.filter(function (t) { return t.predicate === p; });
        }
        if (o) {
            temp = temp.filter(function (t) { return t.object === o; });
        }
        if (g) {
            temp = temp.filter(function (t) { return t.graph === g; });
        }
        return temp;
    };
    return Utils;
}());
