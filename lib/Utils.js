const fs = require('fs');
const n3 = require('n3');
const util = require('util');

const readfile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const appendFile = util.promisify(fs.appendFile);

module.exports = new class Utils {

    exists(path) {
        return fs.existsSync(path);
    }

    createFolder(path) {
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path);
        }
    }

    async getFileContent(path) {
        return await readfile(path);
    }

    async overwriteFile(path, data) {
        return await writeFile(path, data);
    }

    async appendToFile(path, data) {
        return await appendFile(path, data);
    }

    getGeneratedAtTimeValue(rdf) {
        return new Promise((resolve, reject) => {
            n3.Parser().parse(rdf.toString(), (error, triple, prefixes) => {
                if (error) {
                    reject(error);
                }

                if (triple && triple.predicate === "http://www.w3.org/ns/prov#generatedAtTime") {
                    let n3Util = n3.Util;
                    resolve(new Date(n3Util.getLiteralValue(triple.object)));
                }
            });
        });
    }

    getResultTimeValue(rdf) {
        return new Promise((resolve, reject) => {
            n3.Parser().parse(rdf.toString(), (error, triple, prefixes) => {
                if (error) {
                    reject(error);
                }

                if (triple && triple.predicate === "sosa:resultTime") {
                    let n3Util = n3.Util;
                    resolve(new Date(n3Util.getLiteralValue(triple.object)));
                }
            });
        });
    }


    getAllFragments(path) {
        return fs.readdirSync(path);
    }

    dateBinarySearch(target, fragments) {
        let min = 0;
        let max = fragments.length - 1;
        let index = null;

        // Checking that target date is contained in the list of fragments.
        if (target <= fragments[min]) {
            index = min;
        } else if (target >= fragments[max]) {
            index = max;
        } else {
            // Perform binary search to find the fragment that contains the target date.
            while (index === null) {
                // Divide the array in half
                let mid = Math.floor((min + max) / 2);
                // Target date is in the right half
                if (target > fragments[mid]) {
                    if (target < fragments[mid + 1]) {
                        index = mid;
                    } else if (target === fragments[mid + 1]) {
                        index = mid + 1;
                    } else {
                        // Not found yet proceed to divide further this half in 2.
                        min = mid;
                    }
                    // Target date is exactly equals to the middle fragment
                } else if (target === fragments[mid]) {
                    index = mid;
                    // Target date is on the left half
                } else {
                    if (target >= fragments[mid - 1]) {
                        index = mid - 1;
                    } else {
                        max = mid;
                    }
                }
            }
        }

        return [new Date(fragments[index]), index];
    }

    getTriplesFromFile(path) {
        return new Promise(async (resolve, reject) => {
            let parser = n3.Parser();
            let triples = [];

            parser.parse((await readfile(path)).toString(), (err, triple, prefixes) => {
                if (triple) {
                    triples.push(triple);
                } else {
                    resolve([prefixes, triples]);
                }
            });
        });
    }

    getTriplesFromString(text) {
        return new Promise(async (resolve, reject) => {
            let parser = n3.Parser();
            let triples = [];

            parser.parse(text, (err, triple, prefixes) => {
                if (triple) {
                    triples.push(triple);
                } else {
                    resolve([prefixes, triples]);
                }
            });
        });
    }

    formatTriples(format, triples, prefixes) {
        return new Promise((resolve, reject) => {
            let writer = n3.Writer({
                prefixes: prefixes,
                format: format
            });

            writer.addTriples(triples);

            writer.end((err, res) => {
                if (err) reject(err);
                resolve(res);
            });
        });
    }

    getFragmentsCount(path) {
        return fs.readdirSync(path).length;
    }

    getLiteralValue(literal) {
        return n3.Util.getLiteralValue(literal);
    }

    getTriplesBySPOG(array, s, p, o, g) {
        let temp = array;

        if (s) {
            temp = temp.filter(t => t.subject === s);
        }

        if (p) {
            temp = temp.filter(t => t.predicate === p);
        }

        if (o) {
            temp = temp.filter(t => t.object === o);
        }

        if (g) {
            temp = temp.filter(t => t.graph === g);
        }

        return temp;
    }

    // DUplicate function
    getFragmentsForTimeRange(path, fragmentNumber){
        let timeRange = path.substring(path.lastIndexOf('/') + 1, path.indexOf('.trig'));
        const files = this.getAllFragments('./example/data/TimeRangeData');
        let index = -1;
        let result = [];

        for(let i = 0 ; i < files.length ; i++){
            if(files[i].indexOf(timeRange + '_fragment') >= 0){
                if(fragmentNumber){
                    let number = files[i].substring(files[i].indexOf('_fragment') + 9, files[i].indexOf('.trig'));
                    index = number == fragmentNumber ? i : -1;
                }

                result.push(files[i]);
            }
        }

        return [result, index];
    }
    // Duplicate function
    getFragmentsForTile(filePath, fragmentNumber){
        const files = this.getAllFragments('./example/data/Geographical');
        let tile = filePath.substr(filePath.lastIndexOf('/') + 1, filePath.indexOf('_fragment'));
        let index = -1;
        let result = [];

        for(let i = 0 ; i < files.length ; i++){
            if(files[i].indexOf(tile) >= 0){
                result.push(files[i]);

                if(fragmentNumber){
                    let number = files[i].substring(files[i].indexOf('_fragment') + 9, files[i].indexOf('.trig'));
                    index = number == fragmentNumber ? i : -1;
                }
            }
        }

        return [result, index];
    }

    getFragmentsToGenerateData(ctx, time) {
        const files = this.getAllFragments('./example/data/RawData');
        let result = [];
        let date;

        if (time === "year") {
            date = ctx.params.year.split('_')[0] + '-';
        } else if (time === "month") {
            date = ctx.params.year.split('_')[0] + '-' + ctx.params.month.split('_')[0] + '-';
        } else if (time === "day") {
            date = ctx.params.year.split('_')[0] + '-' + ctx.params.month.split('_')[0] + '-' + ctx.params.day.split('_')[0] + 'T';
        } else {
            date = ctx.params.year.split('_')[0] + '-' + ctx.params.month.split('_')[0] + '-' + ctx.params.day.split('_')[0] + 'T' + ctx.params.hour.split('_')[0]
        }

        for (let index = 0; index < files.length; index++) {
            if (files[index].indexOf(date) >= 0) {
                result.push(files[index]);
            }
        }
        return result;
    }

    getSampleValuesFromTriples(triples) {
        let values = new Map();

        for (let i in triples) {
            if (triples[i].predicate === 'ts:sampleSize') {
                values.set(triples[i].subject, triples[i].object);
            }
        }
        return values;
    }
}