const { NsisUpdater, MacUpdater, AppImageUpdater } = require('electron-updater');
const ProgressBar = require('electron-progressbar');
const { Logger } = require('./util/logger');

let updater;

module.exports = class {
    constructor() {
        this._options = {
            provider: 'github',
            owner: 'SofterDog',
            repo: 'NotCrystalClient'
        };

        /** @type {import("electron-updater").AppUpdater} */
        this._autoUpdater = null;
        switch (process.platform) {
            case 'win32':
                this._autoUpdater = new NsisUpdater(this._options);
                break;

            case 'darwin':
                this._autoUpdater = new MacUpdater(this._options);
                break;

            default:
                this._autoUpdater = new AppImageUpdater(this._options);
        }

        updater = this._autoUpdater;

        /** @type {ProgressBar} */
        this._progressBar = null;

        this.logger = new Logger('Updater');
    }

    checkForUpdates() {

        if (require('fs').existsSync(require('path').join(__dirname, '..', 'build.js'))) {
            this.logger.info('Build script exists, skipping update check.');
            return;
        }

        // check for updates, install if available
        this._autoUpdater.on('update-not-available', () => this.logger.info('No update available'));
        this._autoUpdater.on('update-available', this._updateAvailable);
        this._autoUpdater.on('update-downloaded', this._updateDownloaded);
        this._autoUpdater.on('download-progress', this._onUpdateProgress);
        this._autoUpdater.on('error', err => this.logger.error('Unable to update.', err));
        this._autoUpdater.checkForUpdates();
    }

    /** @param updateInfo {import("electron-updater").UpdateInfo} */
    _updateAvailable(updateInfo) {
        try {
            this._progressBar = new ProgressBar({
                title: 'Launcher Update',
                text: 'Downloading update...',
                detail: 'Preparing update',
                indeterminate: false,
                value: 0,
                hideCancel: true,
                browserWindow: {
                    alwaysOnTop: true,
                    webPreferences: {
                        nodeIntegration: true
                    }
                }
            }, require('./index').app);
        }
        catch (ex) {
            this.logger.error('An error occurred while preparing the progress bar.', ex);
        }
    }

    /** @param updateInfo {import("electron-updater").UpdateInfo} */
    _updateDownloaded(updateInfo) {
        this.logger.info('Update downloaded');
        if (this._progressBar) {
            this._progressBar.close();
            this._progressBar = null;
        }

        try {
            this._progressBar = new ProgressBar({
                title: 'Launcher Update',
                text: 'Installing update...',
                detail: 'Preparing installation',
                hideCancel: true,
                browserWindow: {
                    alwaysOnTop: true,
                    webPreferences: {
                        nodeIntegration: true
                    }
                }
            }, require('./index').app);
        }
        catch (ex) {
            this.logger.error('An error occurred while preparing the progress bar.', ex);
        }

        const self = this;
        setTimeout(() => {
            if (self._progressBar) {
                self._progressBar.close();
                self._progressBar = null;
            }

            updater.quitAndInstall(false, true);
        }, 5000);
    }

    /** @param progress {import("electron-updater").ProgressInfo} */
    _onUpdateProgress(progress) {
        if (this._progressBar) {
            const percent = Math.round(progress.percent);
            this._progressBar.detail = `Downloading update (${percent}%)`;
            this._progressBar.value = progress.percent;
        }
    }
}