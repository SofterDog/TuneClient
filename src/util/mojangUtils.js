/**
 * @return {string} Friendly name of the current OS.
 */
function mojangFriendlyOS() {
    switch (process.platform) {
        case "win32":
            return "windows";
        case "darwin":
            return "osx";
        default:
            return "linux";
    }
}

/**
 * @return {string} Friendly name of the current CPU.
 */
function mojangFriendlyArch() {
    switch (process.arch) {
        case 'x64':
        case 'ia32':
            return 'x64';
        default:
            return process.arch;
    }
}

/**
 * Validate rules applied to a library pass depending on the current OS.
 *
 * @param rules {Object[]} Rules specified by the library.
 * @param natives {Object} Whether the library is a native library.
 * @return {boolean} Whether the library is valid for the current OS.
 */
function validateRules(rules, natives) {
    const mojangOs = mojangFriendlyOS();

    if (!rules) {
        if (!natives)
            return true;

        return natives[mojangOs] != null;
    }

    for (const rule of rules) {
        const action = rule["action"];
        const os = rule["os"];

        if (action != null && os != null) {
            if (action === "allow")
                return os === mojangOs;
            else if (action === "disallow")
                return os !== mojangOs;
        }
    }

    return true;
}

module.exports = {
    mojangFriendlyOS,
    mojangFriendlyArch,
    validateRules
};