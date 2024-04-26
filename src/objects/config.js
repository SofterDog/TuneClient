const version = require('../util/version');

module.exports = class {
    constructor(dataDir = '') {
        this.java = {
            memory: 2048,
            jvmArgs: [
                '-XX:+UnlockExperimentalVMOptions',
                '-XX:+UseG1GC',
                '-XX:G1NewSizePercent=20',
                '-XX:G1ReservePercent=20',
                '-XX:MaxGCPauseMillis=50',
                '-XX:G1HeapRegionSize=32M',
                '-XX:-DisableExplicitGC',
                '-Xmn128M'
            ]
        };

        this.game = {
            resolution: {
                width: 1280,
                height: 720
            },
            fullscreen: false,
            detached: true,
            hideLauncher: true,
            version: version.CRYSTAL_CLIENT.v1_8
        };

        this.launcher = {
            developerBuilds: false,
            mcDataDir: dataDir
        }
    }

    /**
     * Get a configuration element.
     *
     * @param obj {object} Parent object.
     * @param props {string|string[]} The property to get.
     */
    getElement(obj, props) {
        if (!obj)
            obj = this;

        if (typeof props === 'string')
            props = props.split('.');

        let element = obj[props.shift()];
        if (typeof element === 'object')
            return this.getElement(element, props);
        else if (element)
            return element;

        return null;
    }

    /**
     * Set a configuration element.
     *
     * @param obj {object} Parent object.
     * @param props {string|string[]} The property to set.
     * @param value {any} The value to set.
     */
    setElement(obj, props, value) {
        if (!obj)
            obj = this;

        if (typeof props === 'string')
            props = props.split('.');

        let prop = props.shift();
        let element = obj[prop];
        if (typeof element === 'object')
            this.setElement(element, props, value);
        else if (element != null)
            obj[prop] = value;
    }
}