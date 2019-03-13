var listeners = new Map();
var DataEventManager = /** @class */ (function () {
    function DataEventManager() {
    }
    DataEventManager.subscribe = function (label, callback) {
        listeners.has(label) || listeners.set(label, []);
        listeners.get(label).push(callback);
    };
    DataEventManager.push = function (label) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var ls = listeners.get(label);
        if (ls && ls.length) {
            ls.forEach(function (callback) {
                callback.apply(void 0, args);
            });
            return true;
        }
        return false;
    };
    return DataEventManager;
}());
module.exports = DataEventManager;
