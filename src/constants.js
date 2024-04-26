const path = require('path');

module.exports.NAME = 'Tune Client Launcher';
module.exports.TUNE_VERSION = '1.0.3';
module.exports.VERSION = require(path.join(__dirname, '../package.json')).version;
module.exports.LIBRARIES_ROOT_URL = 'https://velbit.app/public/';
module.exports.ICON = (() => {
    let ext;
    switch (process.platform) {
        case 'win32':
            ext = 'ico'
            break
        case 'darwin':
            ext = 'icns';
            break;
        default:
            ext = 'png'
            break
    }

    return path.join(__dirname, 'ui', 'images', `icon.${ext}`)
})();