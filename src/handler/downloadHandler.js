const got = require('got');
const async = require('async');
const fs = require('fs');
const path = require('path');
const fsExtra = require('fs-extra');

const EventEmitter = require('events');
const Tracker = require('../objects/downloadTracker');

const logger = new (require('../util/logger').Logger)('DownloadHandler');

class DownloadHandler extends EventEmitter {
    constructor(maxItems = 25) {
        super();
        this._maxItems = maxItems;
        /** @type {Tracker[]} */
        this._downloadQueue = [];
    }

    /**
     * Add items to the download queue.
     *
     * @param assets {import("../objects/asset")[]} The items to add to the queue.
     * @return {Promise<void>} A promise that resolves when the items have been downloaded.
     */
    async addToDownloadQueue(assets = []) {
        const tracker = new Tracker(assets);
        this._downloadQueue.push(tracker);

        return new Promise(resolve => {
            async.eachLimit(tracker.getAssets(), this._maxItems, (asset, cb) => this._handleDownloadFile(tracker, asset, cb), err => {
                if (err)
                    logger.error(`Error while downloading assets in queue '${tracker.getUniqueId()}': ${err}`);
                else
                    logger.info(`All items in queue '${tracker.getUniqueId()}' have downloaded successfully.`);

                tracker.markComplete();
                this.emit('progress', tracker.getProgress());

                // Remove the tracker from the queue.
                this._downloadQueue.splice(this._downloadQueue.indexOf(tracker), 1);

                // Resolve the promise.
                resolve();
            });
        });
    }

    /**
     * Backend function to download an asset.
     * @private
     *
     * @param tracker {import("../objects/downloadTracker")} The tracker for the download.
     * @param asset {import("../objects/asset")} The asset to download.
     * @param cb {Function} The callback function.
     */
    _handleDownloadFile(tracker, asset, cb) {
        fsExtra.ensureDirSync(path.join(asset.getDestination(), '..'));

        const dlStream = got.stream(asset.getUrl());
        const writeStream = fs.createWriteStream(asset.getDestination());

        dlStream
            .on('downloadProgress', progress => {
                tracker.setCurrentAssetProgress(Math.round(asset.getSize() * progress.percent));
                this.emit('progress', tracker.getProgress());
            })
            .on('error', err => {
                logger.error(`Error while downloading asset '${asset.getUrl()}' in queue '${tracker.getUniqueId()}': ${err}`);
                tracker.markComplete(asset);
                this.emit('progress', tracker.getProgress());
                cb();
            })

        writeStream
            .on('error', err => {
                logger.error(`Error while writing file '${asset.getDestination()}' in queue '${tracker.getUniqueId()}': ${err}`);
                tracker.markComplete(asset);
                this.emit('progress', tracker.getProgress());
                cb();
            })
            .on('finish', () => {
                tracker.markComplete(asset);
                this.emit('progress', tracker.getProgress());
                cb();
            });

        dlStream.pipe(writeStream);
    }
}

module.exports = DownloadHandler;