var fs = require('fs');
function getConfig(argv) {
    // Get the configuration
    if (argv[3]) {
        try {
            var raw = fs.readFileSync(argv[3]);
            return JSON.parse(raw);
        }
        catch (e) {
            throw e;
        }
    }
    else {
        throw new Error('Please provide a configuration file using the -c option');
    }
}
module.exports = {
    getConfig: getConfig
};
