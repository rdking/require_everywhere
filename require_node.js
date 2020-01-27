const Module = require('module');
const {require: oldRequire} = Module.prototype;
const map = new Map();

Module.prototype.require = function require_everywhere(file, groupId) {
    let retval;
    
    if (groupId && (typeof(groupId) !== "symbol")) {
        throw new TypeError(`"groupId" must be a Symbol if present`);
    }
    
    if (!["symbol", "string"].includes(typeof(file))) {
        throw new TypeError(`"file" must be either a string or a Symbol`)
    }

    if (!map.has(groupId)) {
        map.set(groupId, []);
    }

    if (!groupId && (typeof(file) === "symbol")) {
        retval = map.get(file);
        map.delete(file);
    }
    else {
        retval = oldRequire.apply(this, file);
  
        if (groupId) {
            map.get(groupId).push(retval);
        }
    }
  
  return retval;
}
