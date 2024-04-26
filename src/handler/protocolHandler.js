const msmc = require('msmc');

const PROTOCOL_REGEX = /^launcherProtocol\.(.+)\((.+)*\)$/g;
const ARGUMENT_REGEX = /"([^"]+)"|'([^']+)'|([^\s]+)/g;
const FUNCTIONS = {
    openMicrosoftWindow: child => {
        msmc.fastLaunch("electron", update => {
            if (update.error) {
                write(child, {
                    final: false,
                    status: "error",
                    message: update.error.reason
                });
            }
        }, undefined, {
            icon: require('../constants').ICON
        })
            .then(res => {
                if (res.type !== 'Success') {
                    write(child, {
                        final: true,
                        status: 'error',
                        message: 'You do not own Minecraft: Java Edition.'
                    });
                    return;
                }

                write(child, {
                    final: true,
                    status: 'success',
                    message: {
                        token: res.access_token,
                        profile: {
                            uuid: res.profile.id,
                            username: res.profile.name
                        }
                    }
                });
            })
            .catch(err => {
                write(child, {
                    final: true,
                    status: 'error',
                    message: err.reason,
                    json: err
                });
            });
    }
};

function write(child, json) {
    child.stdin.setEncoding('utf-8');
    child.stdin.uncork();
    child.stdin.write(JSON.stringify(json) + "\r\n");
    child.stdin.cork();
}

class ProtocolHandler {
    /**
     * Is the given string a valid launcher protocol?
     *
     * @param input {string} The string to check.
     * @return {boolean} True if the string is a valid launcher protocol.
     */
    matches(input) {
        if (typeof input !== 'string')
            return false;
        return PROTOCOL_REGEX.test(input);
    }

    /**
     * Parse the given string as a launcher protocol.
     *
     * @param child {ChildProcessWithoutNullStreams} The child instance.
     * @param input {string} The string to parse.
     *
     * @return {boolean} If the protocol succeeded.
     */
    handleProtocol(child, input) {
        input = input.replace(/[\n\r]+$/g, '');

        if (!this.matches(input))
            return false;

        const match = input.match(PROTOCOL_REGEX);
        const func = match[0].replace(PROTOCOL_REGEX, '$1');
        const opts = [child, ...this._handleArguments(match[0].replace(PROTOCOL_REGEX, '$2'))];
        if (FUNCTIONS[func]) {
            FUNCTIONS[func](...opts);
            return true;
        }

        return false;
    }

    /**
     * Parse the given string as a launcher protocol argument(s).
     * @private
     *
     * @param input {string} The string to parse.
     * @return {string[]} The parsed arguments.
     */
    _handleArguments(input) {
        if (!input)
            return [];

        const matches = input.match(ARGUMENT_REGEX);
        const args = [];

        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            if (match) {
                args.push(match.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1').trim());
            }
        }

        return args;
    }
}

module.exports = ProtocolHandler;