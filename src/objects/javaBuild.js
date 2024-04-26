module.exports = class {
    /**
     * Java build object.
     *
     * @param {string} name             The name of the build.
     * @param {string} ext              The extension of the archived file.
     * @param {string} downloadLink     The download link of the java build (zipped archive).
     * @param {string} version          The JRE version build.
     * @param {number}  expectedSize    The expected size of the build.
     * @param {number} id               The id of the java build.
     */
    constructor(name, ext, downloadLink, version, expectedSize, id) {
        this.name = name;
        this.ext = ext;
        this.downloadLink = downloadLink;
        this.version = version;
        this.expectedSize = expectedSize;
        this.id = id;
    }
}