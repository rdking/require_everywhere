const Module = require('module');
const {require: oldRequire} = Module.prototype;
const map = new Map();

Module.prototype.require = function require_everywhere(file, groupId) {
    return new Promise((resolve, reject) => {
        let retval;
        
        if (groupId && (typeof(groupId) !== "symbol")) {
            reject(new TypeError(`2nd parameter must be a Symbol if present`));
        }
        
        if (!["symbol", "string"].includes(typeof(file))) {
            reject(new TypeError(`1st parameter must be either a string or a Symbol`));
        }

        if ((typeof(file) == "symbol") && groupId) {
            reject(new TypeError(`Cannot use 2nd parameter if 1st is a Symbol`));
        }

        if (groupId && !map.has(groupId)) {
            map.set(groupId, []);
        }

        if (typeof(file) === "symbol") {
            retval = map.get(file);
            map.delete(file);
        }
        else {
            let response = oldRequire.apply(this, file);
    
            if (groupId) {
                map.get(groupId).push(response);
            }
            else {
                retval = response;
            }
        }
    
        resolve(retval);
    });
}

module.exports = Module.prototype.require;
