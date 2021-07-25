if (!((typeof(globalThis.require) == "function") && 
    (globalThis.require.length === 2) &&
    (globalThis.require.name == "require_everywhere"))) {
    
    throw new TypeError("Cannot patch unknown instance of require()");
}

let oldRequire = globalThis.require;
globalThis.require = async function require_everywhere_electron(file, groupId) {
    
}
