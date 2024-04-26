const os = require('os');
const got = require('got');
const JavaBuild = require('../objects/javaBuild');

/**
 * Get the current architecture.
 * @returns {(string,number)[]} The current architecture.
 */
function getArchitecture() {
    const arch = process.arch;
    switch (arch) {
        case 'x64':
        case 'ia32':
            return ['x64', 64];
        case 'x32':
            return ['x86', 32];
        case 'arm':
        case 'arm64':
            return ['arm', arch === 'arm64' ? 64 : 32];

        default:
            return ['x86', 32];
    }
}

/**
 * Get the current platform.
 * @returns {string} The current platform.
 */
function getPlatform() {
    const platform = os.platform();
    switch (platform) {
        case 'win32':
            return 'windows';
        case 'darwin':
            return 'macos';
        default:
            return 'linux';
    }
}

/**
 * Get the latest Azul Zulu JRE version for current platform and architecture.
 *
 * @param javaVersion The major version of the desired JRE.
 * @return {string} The generated download link.
 */
function buildJavaDownload(javaVersion) {
    javaVersion = "8.0.412"
    const arch = getArchitecture();
    const platform = getPlatform();
    return [
        'https://api.azul.com/metadata/v1/zulu/packages/?availability_types=ca',
        `&java_version=${javaVersion}`,
        `&os=${platform}`,
        `&arch=${arch[0]}`,
        `&archive_type=${platform === 'windows' ? 'zip' : 'tar.gz'}`,
        `&javafx_bundled=true`,
        `&release_status=ga`,
        `&java_package_features=fx`,
        `&latest=true`,
        `&java_package_type=jre`
    ].join('');
}

/**
 * Get the latest Azul Zulu JRE version for current platform and architecture.
 *
 * @param javaVersion The major version of the desired JRE.
 * @return {Promise<JavaBuild>} The generated download link.
 */
async function getLatestJavaBuild(javaVersion) {
    const url = buildJavaDownload(javaVersion);

    const response = await got(url, {
        json: true,
        method: 'GET'
    });
    const data = response.body;

    // The latest filtered version given by the Zulu API.
    const build = data[data.length - 1];

    const bundleResponse = await got(`https://api.azul.com/metadata/v1/zulu/packages/${build.package_uuid}`, {
        json: true,
        method: 'GET'
    });
    const bundle = bundleResponse.body;

    // data from the build
    const ext = build.name.endsWith('.tar.gz') ? '.tar.gz' : '.zip';
    const name = build.name.substr(0, build.name.length - ext.length);
    const download = build.download_url;
    const majorVersion = javaVersion;
    const size = bundle.size;
    const id = build.package_uuid;

    // return the JavaBuild
    return new JavaBuild(name, ext, download, majorVersion, size, id);
}

module.exports = getLatestJavaBuild;