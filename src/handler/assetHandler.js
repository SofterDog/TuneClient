const got = require('got');
const path = require('path');
const fs = require('fs');
const fsExtra = require('fs-extra');
const { LIBRARIES_ROOT_URL } = require('../constants');

const { validateRules, mojangFriendlyOS, mojangFriendlyArch } = require('../util/mojangUtils');

const Logger = require('../util/logger').Logger;
const Asset = require('../objects/asset');

class AssetHandler {
    constructor(downloadHandler) {
        /** @type {import("downloadHandler")} */
        this._downloadHandler = downloadHandler;

        this.logger = new Logger('AssetHandler', 'magenta');

        /** @type {string} */
        this._version = require('../util/version').CRYSTAL_CLIENT.v1_8;
        /** @type {Object} */
        this._distribution = null;
        /** @type {import("../objects/javaBuild")} */
        this._javaBuild = null;

        /** @type {Map<String, Object>} */
        this._clientJsonData = new Map();
    }

    /**
     * Setup core version data for the given version.
     * @param version The version to set up.
     */
    async setVersionDistribution(version) {
        this._version = version;
        this._distribution = await this._getJson(`${LIBRARIES_ROOT_URL}/${version}.json`);
        console.log(this._distribution)
        this._javaBuild = await require('../util/java')(this._distribution.version["jre_version"]);

        // get the required client.json files for the inheritance path
        let clientVersionJson = await this._getJson(this._distribution["version_attributes"]);
        this._clientJsonData.set(this._version, clientVersionJson);
        await this._handleDistributionInheritance(clientVersionJson);

        // reverse _clientJsonData
        let map = new Map();
        let arr = [];
        for (let [key, value] of this._clientJsonData)
            arr.push([key, value]);
        for (let [key, value] of arr.reverse())
            map.set(key, value);
        this._clientJsonData = map;
    }

    /**
     * Ensure assets are up-to-date.
     */
    async validateAssetIntegrity() {
        setLaunchButtonText('Validating Assets...');

        return new Promise(async res => {
            const mcVersion = this.getDistribution()["version"]["mc_version"];
            const mcVersionMajor = this.getDistribution()["version"]["mc_version_major"];
            const clientVersionJson = this._clientJsonData.get(mcVersion);
            console.log(clientVersionJson)
            const assetIndexObj = clientVersionJson["assetIndex"];

            const commonDir = configHandler.getCommonDir();
            const assetsDir = path.join(commonDir, 'assets');
            const assetsIndexDir = path.join(assetsDir, 'indexes', `${mcVersionMajor}.json`);
            let assetIndex;

            const assetIndexAsset = new Asset({
                url: assetIndexObj["url"],
                destination: assetsIndexDir,
                size: assetIndexObj["size"],
                sha1: assetIndexObj["sha1"]
            });

            // ensure indexes dir exists
            fsExtra.ensureDirSync(path.join(assetsDir, 'indexes'));

            // download asset index
            if (!assetIndexAsset.verify()) {
                assetIndex = await this._getJson(assetIndexAsset.getUrl());
                fs.writeFileSync(assetIndexAsset.getDestination(), JSON.stringify(assetIndex));
            }
            else {
                try {
                    assetIndex = JSON.parse(assetIndexAsset.getDestination());
                }
                catch (err) {
                    assetIndex = await this._getJson(assetIndexAsset.getUrl());
                    fs.writeFileSync(assetIndexAsset.getDestination(), JSON.stringify(assetIndex));
                }
            }

            // download assets
            const resourceURL = 'https://resources.download.minecraft.net/'
            for (const sec of Object.keys(assetIndex)) {
                const objDir = path.join(assetsDir, sec);
                fsExtra.ensureDirSync(objDir);

                const objects = [];
                for (const objKey of Object.keys(assetIndex[sec])) {
                    const obj = assetIndex[sec][objKey];

                    const hash = obj["hash"];
                    const urlName = `${hash.substring(0, 2)}/${hash}`;

                    const objAsset = new Asset({
                        url: resourceURL + urlName,
                        destination: path.join(assetsDir, sec, hash.substring(0, 2), hash),
                        size: obj["size"],
                        sha1: hash
                    });

                    if (!objAsset.verify())
                        objects.push(objAsset);
                }

                if (objects.length > 0) {
                    this.logger.info(`Downloading ${objects.length} assets for ${sec}...`);
                    await this._downloadHandler.addToDownloadQueue(objects);
                }
            }

            res();
        });
    }

    /**
     * Ensure the client.jar and client-agent.jar for the given version is up-to-date.
     */
    async validateVersionIntegrity() {
        return new Promise(async res => {
            setLaunchButtonText('Validating Minecraft...');

            const mcVersion = this.getDistribution()["version"]["mc_version"];
            const clientVersionJson = this._clientJsonData.get(mcVersion);

            const versionsDir = path.join(configHandler.getCommonDir(), 'versions');
            const clientJarDir = path.join(versionsDir, mcVersion + '.jar');
            const agentJarDir = path.join(versionsDir, mcVersion + '-agent.jar');

            // ensure the version folder exists
            fsExtra.ensureDirSync(versionsDir);

            // download the client.jar
            if (clientVersionJson["downloads"] && clientVersionJson["downloads"]["client"]) {
                const obj = clientVersionJson["downloads"]["client"];
                const clientJarAsset = new Asset({
                    url: obj["url"],
                    destination: clientJarDir,
                    size: obj["size"],
                    sha1: obj["sha1"]
                });

                if (!clientJarAsset.verify())
                    await this._downloadHandler.addToDownloadQueue([clientJarAsset]);
            }

            // download the client-agent.jar
            if (clientVersionJson["downloads"] && clientVersionJson["downloads"]["agent"]) {
                const obj = clientVersionJson["downloads"]["agent"];
                const agentJarAsset = new Asset({
                    url: obj["url"],
                    destination: agentJarDir,
                    size: obj["size"],
                    sha1: obj["sha1"]
                });

                if (!agentJarAsset.verify())
                    await this._downloadHandler.addToDownloadQueue([agentJarAsset]);
            }

            res();
        });
    }

    /**
     * Ensure client libraries are up-to-date.
     */
    async validateLibraryIntegrity() {
        return new Promise(async res => {
            setLaunchButtonText('Validating Libraries...');

            const queue = [];

            for (const key of this._clientJsonData.keys()) {
                const json = this._clientJsonData.get(key);
                if (json["libraries"]) {
                    const libs = json["libraries"];
                    for (const lib of libs) {
                        queue.push(lib);
                    }
                }
            }

            // libraries distributed in the client distro, these should override libs above.
            if (this.getDistribution()["version_data"]["libraries"]) {
                const libs = this.getDistribution()["version_data"]["libraries"];
                for (const l of libs)
                    queue.push(l);
            }

            const librariesDir = path.join(configHandler.getCommonDir(), 'libraries');

            const libraries = [];
            for (const lib of queue) {
                if (validateRules(lib["rules"], lib["natives"])) {
                    if (!lib["downloads"])
                        continue;

                    let nativesKey = null;
                    if (lib["natives"]) {
                        nativesKey = lib["natives"][mojangFriendlyOS()];
                        if (typeof nativesKey === 'object')
                            nativesKey = nativesKey[mojangFriendlyArch()] || nativesKey["default"];

                        if (!nativesKey)
                            continue;

                        nativesKey = nativesKey.replace('${arch}', mojangFriendlyArch().replace('x', ''));
                    }

                    const artifact = !nativesKey ? lib["downloads"]["artifact"] : lib["downloads"]["classifiers"][nativesKey];
                    if (!artifact)
                        continue;

                    const libAsset = new Asset({
                        url: artifact["url"],
                        destination: path.join(librariesDir, artifact["path"]),
                        size: artifact["size"],
                        sha1: artifact["sha1"]
                    });

                    if (!libAsset.verify())
                        libraries.push(libAsset);
                }
            }

            if (libraries.length > 0) {
                this.logger.info(`Downloading ${libraries.length} libraries...`);
                await this._downloadHandler.addToDownloadQueue(libraries);
            }

            res();
        });
    }

    /**
     * Validate misc assets required for the game to launch.
     */
    async validateMisc() {
        return new Promise(async res => {
            const mcVersion = this.getDistribution()["version"]["mc_version"];
            const clientVersionJson = this._clientJsonData.get(mcVersion);

            const confDir = path.join(configHandler.getCommonDir(), 'config');

            // validate log4j props
            if (clientVersionJson["logging"] && clientVersionJson["logging"]["client"]) {
                const obj = clientVersionJson["logging"]["client"]["file"];
                const loggingConfig = new Asset({
                    url: obj["url"],
                    destination: path.join(confDir, obj["id"]),
                    size: obj["size"],
                    sha1: obj["sha1"]
                });

                if (!loggingConfig.verify())
                    await this._downloadHandler.addToDownloadQueue([loggingConfig]);
            }

            res();
        });
    }

    /**
     * Get the current client distribution used.
     */
    getDistribution() {
        return this._distribution;
    }

    /**
     * @return {Object[]} List of inherited versions from the current distribution. (i.e. OptiFine, 1.8.9)
     */
    getInheritedVersions() {
        return [...this._clientJsonData.values()];
    }

    /**
     * Get a specific version which was inherited from the current distribution.
     *
     * @param version {string} Version to get.
     * @return {Object} Inherited version.
     */
    getInheritedVersion(version) {
        return this._clientJsonData.get(version);
    }

    /**
     * Get the JRE distribution for the current version.
     */
    getJavaBuild() {
        return this._javaBuild;
    }

    /**
     * Recursively search for inheritsFrom key inside client.json files, until the first JSON file is found.
     * @private
     *
     * @param clientJson {object} Client JSON file in (i.e. 1.8.9.json found inside .minecraft/versions/1.8.9)
     */
    async _handleDistributionInheritance(clientJson) {
        if (clientJson["inheritsFrom"]) {
            let json = await this._getJson(`${LIBRARIES_ROOT_URL}/versions/${clientJson["inheritsFrom"]}.json`);
            this._clientJsonData.set(clientJson["inheritsFrom"], json);
            await this._handleDistributionInheritance(json);
        }
    }

    /**
     * Get a JSON file from the given URL, and replace placeholders inside given JSON file.
     * @private
     *
     * @param url {string} URL to the JSON file.
     * @return {Promise<Object>} the JSON data.
     */
    async _getJson(url) {
        return new Promise(async res => {
            let resp = await got(url, { method: 'GET' });
            res(JSON.parse(resp.body.replace(new RegExp('{LIBRARIES_ROOT_URL}', 'g'), LIBRARIES_ROOT_URL)));
        });
    }
}

module.exports = AssetHandler;