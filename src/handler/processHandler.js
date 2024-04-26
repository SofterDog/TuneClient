const fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');
const childProcess = require('child_process');
const got = require('got');
const glob = require('glob');

const { mojangFriendlyOS, mojangFriendlyArch, validateRules } = require('../util/mojangUtils');
const decompress = require('decompress');

const Asset = require('../objects/asset');
const AssetHandler = require('./assetHandler');
const DownloadHandler = require('./downloadHandler');
const ProtocolHandler = require('./protocolHandler');
const { Logger } = require('../util/logger');

class ProcessHandler {
    /**
     * Game process handler, handles all functions related to launching the game.
     * @param {import("../handler/configHandler")} configHandler Config handler.
     */
    constructor(configHandler) {
        this.logger = new Logger('ProcessHandler', 'green');
        this.downloadHandler = new DownloadHandler();
        this.assetHandler = new AssetHandler(this.downloadHandler);
        this.protocolHandler = new ProtocolHandler();

        this.commonDirectory = configHandler.getCommonDir();
        this.currentDownloadText = "-";

        /** @type {ChildProcessWithoutNullStreams} */
        this.activeProcess = null;

        this.downloadHandler.on('progress', progress => {
            setLaunchButtonText(`Downloading ${this.currentDownloadText} (${Math.min(100, Math.round(100 * progress))}%)`);
        });
    }

    /**
     * Launches the game.
     */
    async launch() {
        setLaunchButtonText('Validating...');
        saveConfigElements(); // save config state from settings window

        const ver = configHandler.getCurrentVersion(false);
        this.logger.info(`Starting launch process... (version: ${ver}, game directory: ${configHandler.getConfig().launcher.mcDataDir}, libraries directory: ${this.commonDirectory})`);

        // set up the asset handler.
        this.assetHandler = new AssetHandler(this.downloadHandler);
        await this.assetHandler.setVersionDistribution(ver);

        // ensure the user has the correct version of Java
        this.currentDownloadText = 'Java';
        const javaw = await this._ensureJava(this.assetHandler.getJavaBuild());

        this.currentDownloadText = 'Assets';
        await this.assetHandler.validateAssetIntegrity();

        this.currentDownloadText = 'Libraries';
        await this.assetHandler.validateLibraryIntegrity();

        this.currentDownloadText = 'Minecraft';
        await this.assetHandler.validateVersionIntegrity();
        await this.assetHandler.validateMisc();

        setLaunchButtonText('Launching...');

        const nativesPath = path.join(this.commonDirectory, 'natives', ver);
        const args = await this._constructJvmArgs(nativesPath, path.join(javaw, '..', '..'));
        const mcLogger = new Logger('Minecraft', 'green');

        // ensure the game directory exists
        fsExtra.ensureDirSync(configHandler.getConfig().launcher.mcDataDir);

        mcLogger.info(`Launching Minecraft process (java: ${javaw}, natives: ${nativesPath}, process args: ${args.length})`);
        const child = this.activeProcess = childProcess.spawn('java', args, {
            cwd: configHandler.getConfig().launcher.mcDataDir,
            detached: configHandler.getConfig().game.detached,
            env: {
                PATH: path.join(javaw, '..')
            }
        });

        if (configHandler.getConfig().game.detached)
            child.unref();

        if (configHandler.getConfig().game.hideLauncher)
            require('@electron/remote').getCurrentWindow().hide();

        setLaunchButtonText('Game Running');

        child.stderr.setEncoding('utf8');
        child.stderr.on('data', data => {
            if (!this.protocolHandler.handleProtocol(child, data.toString()))
                mcLogger.error(data);
        });

        child.stdout.on('data', data => {
            data = data.toString().trim();
            if (!this.protocolHandler.handleProtocol(child, data)) {
                mcLogger.info(data);
                this._handleCrash(data);
            }
        });

        child.on('close', code => {
            mcLogger.info(`Minecraft process exited with code ${code}.`);
            resetLaunchButtonText();
            enableLaunchButton();

            this.activeProcess = null;
            require('@electron/remote').getCurrentWindow().show();
        });
    }

    /**
     * Handles uploading crash report on the event of a crash.
     * @private
     *
     * @param data {string} The data from stdout.
     */
    async _handleCrash(data) {
        if (/#@!@# Game crashed! Crash report saved to: #@!@#/g.test(data)) {
            const fileLoc = data.split('#@!@# Game crashed! Crash report saved to: #@!@#')[1].trim();
            const fileData = require('fs').readFileSync(fileLoc).toString();

            const { body } = await got.post('https://www.toptal.com/developers/hastebin/documents', { body: fileData });

            const crashLog = `https://www.toptal.com/developers/hastebin/${JSON.parse(body).key}`;
            const stackTraceRegexp = /(.+)(\r\n\tat.+)+/;

            if (stackTraceRegexp.test(fileData)) {
                showLaunchFailure(
                    'Game Crash Detected',
                    `<pre style="max-width: 900px; padding: 8px; text-align: justify; background: rgba(43,43,43,0.4);"><code style="overflow: hidden; text-overflow: ellipsis; display: block">${fileData.match(stackTraceRegexp)[0]}</code></pre><a href="${crashLog}">View Crash Report</a>`,
                );
            }
            else {
                showLaunchFailure(
                    'Game Crash Detected',
                    `${stackTraceRegexp.test(fileData) ? fileData.match(stackTraceRegexp)[0] : 'A crash has been detected during runtime'}<h1><a href="${crashLog}">Crash Log</a></h1>`,
                );
            }
        }
    }

    /**
     * Generates the JVM argument list passed to the JVM process.
     * @private
     *
     * @param nativesPath The path to store the native libraries.
     * @param jrePath Path to the JRE.
     * @returns {Promise<string[]>} The JVM argument list.
     */
    async _constructJvmArgs(nativesPath, jrePath) {
        return new Promise(async res => {
            // get the current client distribution
            const distro = this.assetHandler.getDistribution();
            const mcVersion = distro["version"]["mc_version"];

            const args = [];

            // launcher args
            const { NAME, VERSION } = require('../constants');
            args.push(`-Dlauncher.name=${NAME}`)
            args.push(`-Dlauncher.version=${VERSION}`)

            // agent args
            const agentPath = path.join(configHandler.getCommonDir(), 'versions', `${mcVersion}-agent.jar`);
            args.push(`-javaagent:${agentPath}`)

            // classpath args (for libraries)
            let cpArgs = (await this._generateClasspathArgument(nativesPath, jrePath)).join(process.platform === 'win32' ? ';' : ':');
            if(process.platform === 'win32') {
                cpArgs = cpArgs.replaceAll('/', '\\');
            }
            args.push(...['-cp', cpArgs]);

            // java args

            // macosx
            if (process.platform === 'darwin') {
                const minecraftIcon = path.join(configHandler.getCommonDir(), 'assets', 'minecraft.icns');
                if (!fs.existsSync(minecraftIcon)) {
                    fs.copyFileSync(path.join(__dirname, '..', 'ui', 'images', 'minecraft.icns'), minecraftIcon);
                }

                args.push(`-Xdock:name=${this.assetHandler.getDistribution()["client_name"]}`);
                args.push(`-Xdock:icon=${minecraftIcon}`);
            }

            args.push(`-Xmx${Math.round(configHandler.getConfig().java.memory)}M`);
            args.push(`-Xms${Math.round(configHandler.getConfig().java.memory)}M`);
            args.push(...configHandler.getConfig().java.jvmArgs);
            args.push(`-Djava.library.path=${nativesPath}`);

            // get the main class
            const version = configHandler.getCurrentVersion();
            const clientJson = this.assetHandler.getInheritedVersion(version);
            args.push(clientJson["mainClass"]);

            // build the mc arguments
            args.push(...this._buildMcArgs());

            res(args);
        });
    }

    /**
     * Generates Minecraft-related arguments based on the current version.
     * @private
     *
     * @returns {string[]} The Minecraft arguments.
     */
    _buildMcArgs() {
        let mcArgs = '';
        for (const version of this.assetHandler.getInheritedVersions()) {
            if (version["minecraftArguments"])
                mcArgs += version["minecraftArguments"] + ' ';
        }
        mcArgs = mcArgs.trimEnd();

        let args = [];
        let last = null;

        for (const arg of mcArgs.split(/ +/g)) {
            if (arg.startsWith('-')) {
                if (last)
                    args.push(last);
                last = arg;
            }
            else {
                last += ' ' + arg;
            }
        }

        if (last)
            args.push(last);

        // remove duplicate args
        args = [...new Set(args)].join(' ').split(' ');

        // get the current client distribution
        const distro = this.assetHandler.getDistribution();
        const clientJson = this.assetHandler.getInheritedVersion(distro["version"]["mc_version"]);

        // replace values in the arguments
        const placeholderRegexp = /\${*(.*)}/;
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (placeholderRegexp.test(arg)) {
                const placeholder = arg.match(placeholderRegexp)[1];
                let val = '';
                switch (placeholder) {
                    case 'version_name':
                        val = distro["client_name"].replace(/ +/g, '_').toLowerCase();
                        break;

                    case 'game_directory':
                        val = configHandler.getConfig().launcher.mcDataDir;
                        break;

                    case 'assets_root':
                        val = path.join(this.commonDirectory, 'assets');
                        break;

                    case 'assets_index_name':
                        val = clientJson["assets"];
                        break;

                    case 'auth_access_token':
                        val = 'FML:' + distro["client_name"].replace(/ +/g, '_').toLowerCase();
                        break;

                    case 'version_type':
                        val = 'release';
                        break;

                    case 'user_properties':
                        val = '{}';
                        break;

                    case 'profile_properties':
                        val = '{}';
                        break;
                }

                if (val.length > 0)
                    args[i] = val;
            }
        }

        if (configHandler.getConfig().game.fullscreen)
            args.push(...['--fullscreen', 'true']);
        else {
            args.push(...['--width', configHandler.getConfig().game.resolution.width]);
            args.push(...['--height', configHandler.getConfig().game.resolution.height]);
        }

        this.logger.info(`Minecraft arguments: ${args.join(' ')}`);

        return args;
    }

    /**
     * Resolve the classpath argument list for this process - all libraries.
     *
     * @param nativesPath Path to store native libraries.
     * @param jrePath Path to the JRE.
     * @returns {Promise<string[]>} Classpath argument list.
     */
    async _generateClasspathArgument(nativesPath, jrePath) {
        return new Promise(async res => {
            let args = [];

            // ensure the natives path exists
            fsExtra.ensureDirSync(nativesPath);

            // add the version jar (i.e. 1.8.9.jar)
            const mcVersion = this.assetHandler.getDistribution()["version"]["mc_version"];
            args.push(path.join(configHandler.getCommonDir(), 'versions', `${mcVersion}.jar`));

            // TODO: Add forge to classpath if forge is enabled.
            // -----

            // Resolve libraries
            const libs = await this._resolveVersionLibraries(nativesPath);
            args.push(...Object.values(libs));

            args.push(...require('glob').sync(path.join(jrePath, 'lib', 'ext') + '/**/*.jar'));

            res(this._processClasspathLibs(args));
        });
    }

    /**
     * Ensure all libraries point to an archive.
     * @private
     *
     * @returns {string[]} The argument list.
     */
    _processClasspathLibs(args) {
        const ext = '.jar';
        const extLen = ext.length;

        for (let i = 0; i < args.length; i++) {
            const extIndex = args[i].indexOf(ext);
            if (extIndex > -1 && extIndex !== args[i].length - extLen)
                args[i] = args[i].substring(0, extIndex + extLen);
        }

        return args;
    }

    /**
     * Resolve the libraries defined in the client.json files for the clients.
     * This method also extracts native libraries and points to the correct location for its classpath.
     * @private
     *
     * @param nativesPath Path to store native libraries.
     * @returns {Promise<{[id: string]: string}>} Object containing the paths of the game libraries.
     */
    async _resolveVersionLibraries(nativesPath) {
        return new Promise(async res => {
            const librariesPath = path.join(configHandler.getCommonDir(), 'libraries');
            const cpLibs = {};

            const queue = [];

            for (const json of this.assetHandler.getInheritedVersions()) {
                if (json["libraries"]) {
                    const libs = json["libraries"];
                    for (const lib of libs) {
                        queue.push(lib);
                    }
                }
            }

            // libraries distributed in the client distro, these should override libs above.
            if (this.assetHandler.getDistribution()["version_data"]["libraries"]) {
                const libs = this.assetHandler.getDistribution()["version_data"]["libraries"];
                for (const l of libs)
                    queue.push(l);
            }

            for (const lib of queue) {
                if (validateRules(lib["rules"], lib["natives"])) {
                    if (lib["natives"] == null && lib["downloads"]) {
                        const download = lib["downloads"];
                        const artifact = download["artifact"];

                        // path to jar
                        let to;

                        // download and artifact property are truthy and exist
                        if (download && artifact) {
                            to = path.join(librariesPath, artifact["path"]);
                        }

                        // reverse the name of the library to find it, if it exists.
                        else {
                            const split = lib["name"].split(":");
                            const name = split[1];
                            const group = split[0];
                            const version = split[2];

                            to = path.join(librariesPath, ...group.split("."), name, version, `${name}-${version}.jar`);
                        }

                        // add the library to the classpath
                        cpLibs[lib["name"].substring(0, lib["name"].lastIndexOf(":"))] = to;
                    }
                    else if (lib["downloads"]) {
                        // extract the native library
                        const exclude = lib.extract?.exclude || ['META-INF/'];

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
                        if (!artifact || !artifact["url"])
                            continue;

                        // locate the native library
                        const to = path.join(librariesPath, artifact["path"]);

                        // extract the native library
                        await decompress(to, nativesPath, {
                            filter: file => {
                                const filePath = path.join(nativesPath, file.path);
                                return !exclude.some(ex => file.path.indexOf(ex) > -1) && !fs.existsSync(filePath);
                            }
                        });
                    }
                }
            }

            res(cpLibs);
        });
    }

    /**
     * Ensure the user has the correct version of Java.
     * @private
     *
     * @param build {import("../objects/javaBuild")}
     * @returns {Promise<string>} path to the java executable.
     */
    async _ensureJava(build) {
        return new Promise(async resolve => {
            const jreCommon = path.join(this.commonDirectory, 'java');
            const jre = path.join(jreCommon, build.name);
            let javaw;

            switch (require('../util/mojangUtils').mojangFriendlyOS()) {
                case 'windows':
                    javaw = path.join(jre, 'bin', 'javaw.exe');
                    break;
                // case 'osx':
                //     javaw = path.join(jre, `zulu-${build.version}.jre`, 'Contents', 'home', 'bin', 'java');
                //     break;
                default:
                    javaw = path.join(jre, 'bin', 'java');
                    break;
            }

            // ensure the JRE folder exists
            fsExtra.ensureDirSync(jreCommon);

            if (!fs.existsSync(javaw)) {
                this.logger.info('Java not found, downloading...');

                // download the JRE
                const zipFile = path.join(jreCommon, `${build.name}${build.ext}`);
                await this.downloadHandler.addToDownloadQueue([new Asset({
                    url: build.downloadLink,
                    destination: zipFile,
                    size: build.expectedSize
                })]);

                // extract the JRE
                await decompress(zipFile, jreCommon);

                // delete the zip file
                fs.unlinkSync(zipFile);
            }

            resolve(javaw);
        });
    }
}

module.exports = ProcessHandler;