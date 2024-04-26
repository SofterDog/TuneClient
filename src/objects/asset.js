const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

module.exports = class {
    constructor({
        url,
        destination,
        sha1 = undefined,
        md5 = undefined,
        size = undefined
                }) {

        if (!url || !destination)
            throw new Error(`'url' and 'destination' are required and cannot be null.`);

        this._url = url;
        this._destination = destination;
        this._sha1 = sha1;
        this._md5 = md5;
        this._size = size;
        this._complete = false;
    }

    /**
     * @return {string} The URL of this asset.
     */
    getUrl() {
        return this._url;
    }

    /**
     * @return {string} The destination of this asset.
     */
    getDestination() {
        return this._destination;
    }

    /**
     * @return {string} The algorithm used to calculate the hash of this asset.
     */
    getAlgorithm() {
        return this._md5 ? 'md5' : this._sha1 ? 'sha1' : null;
    }

    /**
     * @return {string} The expected hash of this asset.
     */
    getExpectedHash() {
        return this._md5 || this._sha1;
    }

    /**
     * @return {number|bigint} The expected size of this asset.
     */
    getSize() {
        return this._size;
    }

    /**
     * @return {boolean} Whether this asset has been downloaded.
     */
    isComplete() {
        return this._complete;
    }

    /**
     * @return {boolean} Set whether this asset has been downloaded.
     */
    setComplete(complete) {
        return this._complete = complete;
    }

    /**
     * @return {boolean} Whether this asset matches the given SHA1 hash.
     */
    verify() {
        const algo = this.getAlgorithm();
        if (!algo)
            return this.setComplete(true);

        if (!fs.existsSync(this.getDestination()))
            return this.setComplete(false);

        return this.setComplete(crypto.createHash(algo).update(fs.readFileSync(this.getDestination())).digest('hex') === (this._md5 || this._sha1));
    }
}