const uuid = require('uuid').v1;

module.exports = class {
    constructor(assets = []) {
        this._id = uuid();
        this._complete = false;
        /** @type {import("./asset")[]} */
        this._assets = assets;

        this._totalSize = 0;
        this._progress = 0;
        this._currentAssetProgress = 0;
        this._currentPercentage = 0;

        // calculate total size of all assets
        for (const asset of this._assets)
            this._totalSize += (asset.getSize() || 0);
    }

    /**
     * @return {string} The ID of the download tracker.
     */
    getUniqueId() {
        return this._id;
    }

    /**
     * Get queued assets.
     * @return {import("./asset")[]}
     */
    getAssets() {
        return this._assets;
    }

    /**
     * @return {boolean} True if there are no queued assets.
     */
    isComplete() {
        return this._complete && this._assets.every(asset => asset.isComplete());
    }

    /**
     * Update the current asset download progress.
     * @param progress {number} The progress of the download.
     */
    setCurrentAssetProgress(progress) {
        this._currentAssetProgress = progress;
    }

    /**
     * @param asset {import("./asset")} Mark a given asset as complete and update the progress.
     */
    markComplete(asset = null) {
        if (asset !== null) {
            asset.setComplete(true);
            this._progress += asset.getSize();
        }
        else this._complete = true;
        this._currentAssetProgress = 0;
    }

    /**
     * @return {number} Get the progress of this download tracker.
     */
    getProgress() {
        let percent = (this._progress + this._currentAssetProgress) / this._totalSize;
        return this._currentPercentage = Math.min(1.0, Math.max(this._currentPercentage, percent));
    }
}