const fs = require('fs');
const chalk = require('chalk');
const moment = require('moment');

let logFile = null;

function setLogFile(file) {
  logFile = file;

  if (logFile && fs.existsSync(logFile))
      fs.unlinkSync(logFile);
}

function log(data) {
    console.log(data);
    if (logFile != null && fs.existsSync(logFile)) {
        if (!fs.existsSync(logFile))
            fs.writeFileSync(logFile, '');
        fs.appendFileSync(logFile, data + '\n');
    }
}

function info(message, ...args) {
    if (!args || args.length === 0) args = '';
    log(_getTimestamp('gray') + chalk.gray('[INFO] ') + chalk.reset(message), args || '');
}

function error(message, ...args) {
    let stack;
    if (args && args[0] && args[0] instanceof Error) stack = args.shift().stack;
    if (!args || args.length === 0) args = '';

    log(_getTimestamp('red') + chalk.red('[ERROR] ') + chalk.reset(message), args || '');
    if (stack) log(stack);
}

function debug(message, ...args) {
    if (!args || args.length === 0) args = '';
    log(_getTimestamp('orange') + chalk.blue('[DEBUG] ') + chalk.reset(message), args || '');
 }

function _getTimestamp(color = 'white') {
    return chalk[color](`[${moment().format('h:mm:ss a, MM/DD/YYYY')}]`) + chalk.reset(' ');
}

class Logger {
    constructor(name = 'Logger', color = 'gray', timestampColor) {
        this.name = name;
        this.color = color;
        this.timestampColor = timestampColor || this.color;
    }

    info(message, ...args) {
        if (!args || args.length === 0) args = '';
        log(_getTimestamp(this.timestampColor) + chalk[this.color](`[INFO @ ${this.name}] `) + chalk.reset(message), args || '');
    }

    error(message, ...args) {
        let stack;
        if (args && args[0] && args[0] instanceof Error) stack = args.shift().stack;
        if (!args || args.length === 0) args = '';

        log(_getTimestamp('red') + chalk.red(`[ERROR @ ${this.name}] `) + chalk.reset(message), args || '');
        if (stack) log(stack);
    }

    debug(message, ...args) {
        if (!args || args.length === 0) args = '';
        log(_getTimestamp('orange') + chalk.blue(`[DEBUG @ ${this.name}] `) + chalk.reset(message), args || '');
    }
}

module.exports = {
    setLogFile, info, error, debug, Logger
}