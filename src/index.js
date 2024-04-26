// 
// Crystal Development, LLC.
// Crystal Client Launcher
// Copyright (c) 2020-2022. All rights reserved.
// 

require('@electron/remote/main').initialize();

const { app, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');
const ejse = require('ejs-electron');

// disable hardware acceleration to improve compatibility
app.disableHardwareAcceleration();
app.allowRendererProcessReuse = true;

// misc windows functionality & scaling fix
if (process.platform === 'win32') {
    app.commandLine.appendSwitch('high-dpi-support', 1);
    app.commandLine.appendSwitch('force-device-scale-factor', 1);
}

// create the main window
async function createWindow() {
    let win = new BrowserWindow({
        width: 1280,
        height: 720,
        icon: require('./src/constants').ICON,
        frame: false,
        backgroundColor: '#171614',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            worldSafeExecuteJavaScript: true,
            zoomFactor: 1.0
        }
    });

    win.removeMenu();
    win.setResizable(false);
    win.loadFile(path.join(__dirname, 'ui', 'app.ejs'));

    win.webContents.setWindowOpenHandler(details => {
        if (!details.url.includes("microsoft"))
            return { action: 'deny' };
    });

    win.on('closed', () => win = null);

    require('@electron/remote/main').enable(win.webContents);
}

// when the app is ready, create the window
app.on('ready', async () => {
    await createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });

    new (require('./src/updater'))().checkForUpdates();
});

// quit the app when all windows are closed
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        app.quit();
});

module.exports = {
    app
};