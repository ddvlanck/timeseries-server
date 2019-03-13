let listeners = new Map();

class DataEventManager {

    static subscribe(label: string, callback){
        listeners.has(label) || listeners.set(label, []);
        listeners.get(label).push(callback)
    }

    static push(label: string, ...args){
        let ls = listeners.get(label);
        if(ls && ls.length){
            ls.forEach( (callback) => {
                callback(...args);
            });
            return true;
        }
        return false;
    }
}

module.exports = DataEventManager;