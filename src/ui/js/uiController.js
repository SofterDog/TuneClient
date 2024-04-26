const view = require('../objects/view');

/** The current screen the launcher is on. */
let currentView = view.LANDING;

/** The last time the view was updated */
let lastSwitch = 0;

/**
 * Transition to a new screen.
 * 
 * @param {String} next The view to transition to.
 */
function switchView(next = view.LANDING) {
    if (currentView === next)
        return;

    let currentMs = new Date().getTime();
    if (currentMs - lastSwitch < 500)
        return;
    lastSwitch = currentMs;

    $(`${currentView}`).fadeOut(200, () => {
        $(`${next}`).fadeIn(200);
        currentView = next;
    });
}

/**
 * Returns the current view.
 */
function getCurrentView() {
    return currentView;
}