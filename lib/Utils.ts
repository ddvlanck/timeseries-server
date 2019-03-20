import {PathLike} from "fs";

const fs = require('fs');
const n3 = require('n3');
const util = require('util');

const readfile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const appendFile = util.promisify(fs.appendFile);

module.exports = new class Utils {

    exists(path: PathLike){
        return fs.existsSync(path);
    }

    createFolder(path: PathLike){
        if(!fs.existsSync(path)){
            fs.mkdirSync(path);
        }
    }

    async getFileContent(path: PathLike){
        return await readfile(path);
    }

    async overwriteFile(path: PathLike, data: any){
        return await fs.writeFile(path, data, (err => {
            if(err) throw err;
        }));
    }

    async appendToFile(path: PathLike, data: any){
        return await fs.appendFile(path, data, (err) => {
            if(err) throw err;
        });
    }

    getGeneratedAtTimeValue(rdf: object){
        return new Promise( (resolve, reject) => {
            n3.Parser().parse(rdf.toString(), (error, triple, prefixes) => {
                if(error){
                    reject(error);
                }

                if(triple && triple.predicate === 'http://www.w3.org/ns/prov#generatedAtTime'){
                    let n3Util = n3.Util;
                    resolve(new Date(n3Util.getLiteralValue(triple.object)));
                }
            });
        });
    }

    getAllFragments(path: PathLike){
        return fs.readdirSync(path);
    }

    dateBinarySearch(target, fragments){
        let min = 0;
        let max = fragments.length - 1;
        let index = null;

        // Checking that target date is contained in the list of fragments
        if(target <= fragments[min]){
            index = min;
        } else if(target >= fragments[max]){
            index = max;
        } else {

            // Perform binary search to find the fragment that contains the target date
            while(index === null){

                // Divide array in half
                let mid = Math.floor((min + max)/2);

                // Target date is in the right half
                if(target > fragments[mid]){
                    if(target < fragments[mid + 1]){
                        index = mid;
                    } else if(target === fragments[mid + 1]){
                        index = mid + 1;
                    } else {

                        // Not found yet, proceed to divide further this half in 2
                        min = mid;
                    }
                }
                // Target date is exactly equals to the middle fragment
                else if(target === fragments[mid]){
                    index = mid;
                }
                // Target date is on the left half
                else {
                    if(target >= fragments[mid - 1]){
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
                if(triple) {
                    triples.push(triple);
                } else {
                    resolve([prefixes, triples]);
                }
            });
        });
    }

    getTriplesFromString(text: string){
        return new Promise(async (resolve, reject) => {
            let parser = n3.Parser();
            let triples = [];

            parser.parse(text, (err, triple, prefixes) => {
                if(triple){
                    triples.push(triple);
                } else {
                    resolve([prefixes, triples]);
                }
            });
        });
    }

    formatTriples(format, triples, prefixes){
        return new Promise((resolve, reject) => {
           let writer = n3.Writer({
               prefixes: prefixes,
               format: format
           });

           writer.addTriples(triples);

           writer.end((err, res) => {
               if(err){
                   reject(err);
               }

               resolve(res);
           })
        });
    }

    getFragmentsCount(path: PathLike) {
        return fs.readdirSync(path).length;
    }

    getLiteralValue(literal) {
        return n3.Util.getLiteralValue(literal);
    }

    getTriplesBySPOG(array, s, p, o, g){
        let temp = array;
        if(s){
            temp = temp.filter(t => t.subject === s);
        }

        if(p){
            temp = temp.filter(t => t.predicate === p);
        }

        if(o){
            temp = temp.filter(t => t.object === o);
        }

        if(g){
            temp = temp.filter(t => t.graph === g);
        }

        return temp;
    }

    /*
    *   Hier bepalen we alle bestanden die nodig zijn om het gevraagde bestand te genereren
    *   Eventueel een object teruggeven waarin een onderscheid gemaakt wordt tussen de verschillende bestanden
    * */

    getFilesFromInterfaceByParams(path: string): Array<string>{
        let files: Array<string> = [];
        fs.readdirSync(path).forEach( file => {
            files.push(file);
        });
        return files;

    }

    getAllDataToGenerateFile(path: string, files: Array<string>){
        let level: string = null;
        const date = path.substring(path.lastIndexOf('/') + 1, path.length -5);
        const timePieces = date.split('-');

        if(timePieces.length === 1){
            level = 'year';
        } else if(timePieces.length === 2){
            level = 'month';
        } else {
            level = 'day';
        }

        // f = f.replace(/_/g, ':');
        const monthRegex: RegExp = new RegExp('^' + date + '-[0-1][0-9].trig$');
        const dayRegex: RegExp = new RegExp('^' + date + '-[0-3][0-9].trig$');
        const hourRegex: RegExp = new RegExp('^' + date + 'T[0-2][0-9].trig');

        let counter = 0;
        let dataFiles: Array<string> = [];

        for(let file in files){
            if(level === 'year' && monthRegex.test(file)){
                // We have to search for the 'month'-files
                dataFiles.push(file);
            } else {

            }
        }
    }

    getFilesForDay(regex: RegExp){

    }
}