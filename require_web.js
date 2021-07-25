const PromiseChain = (function () {
    const ID = Symbol("PromiseChain::ID");
    let handlers = new Map();

    function defer(fn) {
        setTimeout(fn, 0);
    }

    class PromiseChain extends Promise {
        constructor(groupId) {
            if (typeof(groupId) === "symbol") {
                let id = groupId;
                super((resolve, reject) => { 
                    handlers.set(id, { 
                        resolve: resolve,
                        reject: reject, 
                        next: []
                    });
                });
                let data = handlers.get(id);
                data.resolve = data.resolve.bind(this);
                data.reject = data.reject.bind(this);
                Object.defineProperty(this, ID, {value: id});
            }
            else {
                super(groupId);
            }
        }

        attach(p, fn) {
            if (!(p instanceof Promise)) {
                throw TypeError("First parameter must be a promise.");
            }
            if (typeof(fn) !== "function") {
                throw TypeError("Second parameter must be a functions.");
            }
            handlers.get(this[ID]).next.push({p, fn});
        }

        async process() {
            let retvals = [];
            if (handlers.has(this[ID])) {
                let pvt = handlers.get(this[ID]);
                let n = pvt.next.shift();

                while (n) {
                    n = await new Promise(resolve => {
                        n.p.then(async response => {
                            let rval = (response.ready) ? response.exports : await n.fn(response);
                            retvals.push(rval);
                            resolve(pvt.next.shift());
                        });
                    });
                }

                pvt.resolve(retvals);
            }
        }
    }

    return PromiseChain;
})();

const FileName = (function() {
    const pvt = new WeakMap;

    return class FileName {
        constructor(filename) {
            let parts = filename.match(/(?:(\/?\w+)?(\/.*)?\/)?(.*)/);
            pvt.set(this, {
                original: filename,
                package: parts[1] || parts[3],
                path: parts[2] ? `${parts[2]}/` : "",
                file: parts[3]
            });
        }

        get requestedName() { return pvt.get(this).original; }
        get correctedName() { return fixName(this.requestedName); }
        get packageName() { return pvt.get(this).package; }
        get packagePrefix() {
            let p = pvt.get(this);
            return `/node_modules/${p.package || p.file}`;
        }
        get path() { return pvt.get(this).path; }
        get name() { return pvt.get(this).file; }
    }
})();

function fixName(name) {
    let index = name.lastIndexOf(".");
    if (index === -1) {
        let suffix = name.substr(index);
        if (![".json", ".js"].includes(suffix)) {
            name += '.js';
        }
    }

    return name;
}

/**
 * @function
 * Asynchronous require
 * @description This "require" variant performs asynchronous loading, returning
 * a Promise for the exported information. It can load both '.json' & '.js'
 * files, returning the parsed result as the promised response. NPM modules
 * also work as long as all requirements are script-only and present in the
 * source tree of the running website or package.
 * @param {string} file - the url of the file to be loaded. Can also be the
 * name of a script-only NPM module.
 * @returns a Promise of the compiled script module or JSON object.
 */
require = (function() {
    const modules = [];
    const groups = new Map();
    const handlers = new WeakMap();

    function getFile(url) {
        return fetch(url).then((response) => {
            let retval = null;
            if (response.ok) {
                retval = response.text();
            }
            return retval;
        });
    }

    function loadFile(module, script) {
        return getFile(script).then((response) => {
            let retval = module;
            if (!module.loaded) {
                if (response) {
                    console.debug(`Loaded "${script}". Attempting to parse...`);
                    try {
                        module.exports = JSON.parse(response);
                        module.loaded = true;
                    } catch(e) {
                        module.fn = eval(`(async function(exports, require, module, __filename, __dirname) {\n${response}\n//# sourceURL=${window.location.origin}${(script[0]=="/") ? "" : "/"}${script}\n});`);
                        module.loaded = true;
                    }
                    module.mapping = script;
                }
                else {
                    console.error(`Failed to load "${script}".`);
                }
            }
            else {
                console.debug(`Skipping loading "${script}". Already loaded.`);
            }
            return retval;
        }).then(mod => {
            if (mod !== module) {
                module.loaded = true;
            };
            return module;
        });
    }

    function found(module, script) {
        return new Promise((resolve, reject) => {
            if (module.ready) {
                resolve(module.exports);
            }
            else {
                let sDir = script.substring(0, script.lastIndexOf("/"));
                let mod = module.fn(module.exports, require, module, script, sDir);
                mod.then(() => {
                    module.ready = true;
                    resolve(module.exports);
                }).catch(err => {
                    module.errors.push(err);
                    reject(err);
                });
            }
        });
    }

    async function findFile(module, groupId) {
        let file = new FileName(module.file);
        let hasGroup = groups.has(groupId);
        
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                //First, assume we're given a full path...
                let script = file.correctedName;
                
                loadFile(module, script).then(() => {
                    if (!module.loaded) {
                        throw new Error(`File ${script} not found...`);
                    }
                    resolve(module);
                }).catch((e) => {
                    module.error = e;
                    script = `${file.packagePrefix}/package.json`;
                    loadFile({exports: {}, loaded: false}, script).then((mod) => {
                        if (!mod.loaded) {
                            throw new Error(`File ${script} not found...`, module.error);
                        }
                        let main = new FileName(mod.exports.main);
                        console.debug(`package main file: ${main.requestedName}`);
                        console.debug(`package path = ${main.path || "N/A"}`);
                        let mPath = (!main.path && main.packageName && (main.name != main.packageName))
                            ? main.packageName + "/"
                            : main.path;
                        let path = `${file.packagePrefix}/${mPath}${file.path}`;
                        script = fixName(`${path}${((file.name === file.packageName) ? main : file).name}`);
                        loadFile(module, script).then(() => {
                            if (!module.loaded) {
                                throw new Error(`File ${script} not found...`, module.error);
                            }
                            resolve(module);
                        });
                    }).catch((e) => {
                        module.error = e;
                        script = fixName(`${file.packagePrefix}/${file.path}${file.name}`);
                        loadFile(module, script).then(() => {
                            if (!module.loaded) {
                                reject(new Error(`File ${script} not found...`, module.error));
                            }
                            resolve(module);
                        });
                    });
                });
            }, 0);
        });
    }

    function resolveInOrder(pLoad, groupId, resolve) {
        if (!groups.has(groupId)) {
            groups.set(groupId, new PromiseChain(groupId));
        }

        let pc = groups.get(groupId);
        pc.attach(pLoad, async module => {
            let retval = await found(module, module.mapping)
            resolve(retval);
            return retval;
        });
    }

    async function retry(file, resolve) {
        let gid = Symbol(~~(Math.random() * 100000));
        require(file, gid);
        resolve((await require(gid))[0]);
    }

    const require = async function require_everywhere(file, groupId) {
        if (groupId && (typeof(groupId) !== "symbol")) {
            throw new TypeError(`"groupId" must be a Symbol if present`);
        }
        if (!["symbol", "string"].includes(typeof(file))) {
            throw new TypeError(`"file" must be either a string or a Symbol`)
        }

        let pRetval = new Promise((resolve, reject) => {
            //Unfortunately, I need access to the Promise instance to run the
            //executor, so we have to defer the executor...
            setTimeout(() => {
                //Do we already have a module for this file?
                let module = modules.find(mod => fixName(mod.file || "") == fixName(file.toString()));
                    
                //If we know about it already...
                if (module) {
                    if (module.ready) {     //Good, we've already parsed it.
                        if (groupId) {
                            resolveInOrder(module.pending, groupId, resolve);
                        }
                        else {
                            resolve(module.exports);
                        }
                    }
                    else if (module.loaded) {   //Well, it's at least in memory...
                        if (groupId) {      //Let's make sure we process it in the right order
                            resolveInOrder(module.pending, groupId, resolve);
                        }
                        else {              //Give it a groupId and go wait for it.
                            retry(file, resolve);
                        }
                    }
                }
                //If this is a groupless request...
                else if (!groupId) {
                    if (typeof(file) === "symbol") {    //This is a request to process a group.
                        if (groups.has(file)) {
                            let pvt = groups.get(file);
                            pvt.process().then(() => {
                                pvt.then(results => {
                                    resolve(results);
                                });
                            });
                        }
                    }
                    else {                  //Just treat it like a single file group request.
                        retry(file, resolve);
                    }
                }
                else {
                    let hasGroup = (typeof(groupId) === "symbol");
                    //Let's try to load it the way node would.
                    module = {
                        file,
                        fn: undefined,
                        mapping: undefined,
                        exports: {},
                        loaded: false,
                        ready: false,
                        pending: null,
                        errors: []
                    };
        
                    modules.push(module);
                    module.pending = findFile(module, groupId);
                    resolveInOrder(module.pending, groupId, resolve);
                }
            }, 1);
        });
        
        return pRetval;
    }

    return require;
})();
