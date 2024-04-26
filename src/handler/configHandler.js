// imports
const os = require('os');
const fs = require('fs');
const path = require('path');

// classes
const Config = require('../objects/config');
const version = require("../util/version");
const Logger = require('../util/logger').Logger;

// constants
const logger = new Logger('ConfigurationHandler', 'green');
const sysRoot = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME);
const mcDataDir = path.join(sysRoot, process.env.APPDATA ? '.minecraft' : 'minecraft');
const commonDir = path.join(require('user-home'), '.crystaldev');
const launcherDataDir = process.env.CONFIG_DIRECT_PATH || require('@electron/remote').app.getPath('userData');
const launcherConfigFile = path.join(launcherDataDir, 'launcher_config.json');

// initialize the logger
require('../util/logger').setLogFile(path.join(commonDir, 'launcher.log'));

// initialize the configuration
logger.info('Initializing configuration handler...');

/** @type {Config} */
const defaultConfig = new Config(mcDataDir);

/** @type {Config} */
let config;

// reads the configuration
if (fs.existsSync(launcherConfigFile)) {
    try {
        const json = JSON.parse(fs.readFileSync(launcherConfigFile).toString());
        config = validateKeySet(defaultConfig, Object.assign(new Config(mcDataDir), json));
        saveConfig();
    }
    catch (ex) {
        logger.error('Failed to read configuration file. Resetting to default.');
        config = new Config(mcDataDir);
        saveConfig();
    }
}
else {
    config = new Config(mcDataDir);
    saveConfig();
}

logger.info('Configuration handler initialized.');

//
// functions
//

/**
 * Saves the configuration to the launcher's configuration file.
 */
function saveConfig() {
    fs.writeFileSync(launcherConfigFile, JSON.stringify(config, null, 4));
}

/**
 *
 * @param srcObj The object to check against.
 * @param destObj The object to check.
 * @return {Object} The {destObj} with the differences.
 */
function validateKeySet(srcObj, destObj) {
    if (srcObj === null)
        srcObj = {};

    const keys = Object.keys(srcObj);
    for (let i = 0; i < keys.length; i++) {
        if (typeof destObj[keys[i]] === 'undefined')
            destObj[keys[i]] = srcObj[keys[i]];
        else
            if (typeof srcObj[keys[i]] === 'object' && srcObj[keys[i]] != null && !(srcObj[keys[i]] instanceof Array))
                destObj[keys[i]] = validateKeySet(srcObj[keys[i]], destObj[keys[i]]);
    }

    return destObj;
}

// exports
module.exports = {
    saveConfig,
    /** @return {import("../objects/config")} */
    getConfig: () => config,
    /** @return {import("../objects/config")} */
    getDefaultConfig: () => defaultConfig,
    getMinMemory: () => 2048, // min memory of 2 GB
    getMaxMemory: () => Math.min(8192, os.totalmem() / 1000000), // max 8 GB, or the total memory of the system,
    getMcDataDir: () => mcDataDir,
    getCommonDir: () => commonDir,
    getCurrentVersion: (getMcVersion = false) => {
        const self = module.exports;
        let ver = self.getConfig().game.version;
        let found = false;

        // iterate through client versions, then iterate over valid versions.
        // if the version is found, set found to true and break.
        for (const v of Object.keys(version)) {
            let versions = Object.values(version[v]);
            if (versions.includes(ver)) {
                if (getMcVersion)
                    ver = Object.keys(version[v])[versions.indexOf(ver)];
                found = true;
                break;
            }
        }

        // version is not a valid version, resort to using 1.8 Crystal Client.
        if (!found) {
            self.getConfig().game.version = version.CRYSTAL_CLIENT.v1_8;
            self.saveConfig();
            if (getMcVersion)
                ver = version.CRYSTAL_CLIENT.v1_8;
        }

        return getMcVersion ? ver.slice(1).replace('_', '.') : ver;
    }
};