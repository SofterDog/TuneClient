/**
 * Script for overlay.ejs
 */

/* Overlay Wrapper Functions */

/**
 * Check to see if the overlay is visible.
 *
 * @returns {boolean} Whether or not the overlay is visible.
 */
function isOverlayVisible() {
    return document.getElementById('launcherContainer').hasAttribute('overlay')
}

let overlayHandlerContent

/**
 * Overlay keydown handler for a non-dismissible overlay.
 *
 * @param {KeyboardEvent} e The keydown event.
 */
function overlayKeyHandler(e) {
    if (e.key === 'Enter' || e.key === 'Escape') {
        document.getElementById(overlayHandlerContent).getElementsByClassName('overlayKeybindEnter')[0].click()
    }
}

/**
 * Overlay keydown handler for a dismissible overlay.
 *
 * @param {KeyboardEvent} e The keydown event.
 */
function overlayKeydismissibleHandler(e) {
    if (e.key === 'Enter') {
        document.getElementById(overlayHandlerContent).getElementsByClassName('overlayKeybindEnter')[0].click()
    }
    else if (e.key === 'Escape') {
        document.getElementById(overlayHandlerContent).getElementsByClassName('overlayKeybindEsc')[0].click()
    }
}

/**
 * Bind overlay keydown listeners for escape and exit.
 *
 * @param {boolean} state Whether or not to add new event listeners.
 * @param {string} content The overlay content which will be shown.
 * @param {boolean} dismissible Whether or not the overlay is dismissible
 */
function bindOverlayKeys(state, content, dismissible) {
    overlayHandlerContent = content
    document.removeEventListener('keydown', overlayKeyHandler)
    document.removeEventListener('keydown', overlayKeydismissibleHandler)
    if (state) {
        if (dismissible) {
            document.addEventListener('keydown', overlayKeydismissibleHandler)
        }
        else {
            document.addEventListener('keydown', overlayKeyHandler)
        }
    }
}

/**
 * Toggle the visibility of the overlay.
 *
 * @param {boolean} toggleState True to display, false to hide.
 * @param {boolean} dismissible Optional. True to show the dismiss option, otherwise false.
 * @param {string} content Optional. The content div to be shown.
 */
function toggleOverlay(toggleState, dismissible = false, content = 'overlayContent') {
    if (toggleState == null) {
        toggleState = !document.getElementById('launcherContainer').hasAttribute('overlay')
    }
    if (typeof dismissible === 'string') {
        content = dismissible
        dismissible = false
    }
    bindOverlayKeys(toggleState, content, dismissible)
    if (toggleState) {
        document.getElementById('launcherContainer').setAttribute('overlay', true)
        // Make things untabbable.
        $('#main *').attr('tabindex', '-1')
        $('#' + content).parent().children().hide()
        $('#' + content).show()
        if (dismissible) {
            $('#overlayDismiss').show()
        }
        else {
            $('#overlayDismiss').hide()
        }
        $('#overlayContainer').fadeIn({
            duration: 250
        })
    }
    else {
        document.getElementById('launcherContainer').removeAttribute('overlay')
        // Make things tabbable.
        $('#main *').removeAttr('tabindex')
        $('#overlayContainer').fadeOut({
            duration: 250,
            complete: () => {
                $('#' + content).parent().children().hide()
                $('#' + content).show()
                if (dismissible) {
                    $('#overlayDismiss').show()
                }
                else {
                    $('#overlayDismiss').hide()
                }
            }
        })
    }
}

/**
 * Set the content of the overlay.
 *
 * @param {string} title Overlay title text.
 * @param {string} description Overlay description text.
 * @param {string} acknowledge Acknowledge button text.
 * @param {string} dismiss Dismiss button text.
 */
function setOverlayContent(title, description, acknowledge, dismiss = 'Dismiss') {
    document.getElementById('overlayTitle').innerHTML = title
    document.getElementById('overlayDesc').innerHTML = description
    document.getElementById('overlayAcknowledge').innerHTML = acknowledge
    document.getElementById('overlayDismiss').innerHTML = dismiss
}

/**
 * Set the onclick handler of the overlay acknowledge button.
 * If the handler is null, a default handler will be added.
 *
 * @param {function} handler
 */
function setOverlayHandler(handler) {
    if (handler == null) {
        document.getElementById('overlayAcknowledge').onclick = () => {
            toggleOverlay(false)
        }
    }
    else {
        document.getElementById('overlayAcknowledge').onclick = handler
    }
}

/**
 * Set the onclick handler of the overlay dismiss button.
 * If the handler is null, a default handler will be added.
 *
 * @param {function} handler
 */
function setDismissHandler(handler) {
    if (handler == null) {
        document.getElementById('overlayDismiss').onclick = () => {
            toggleOverlay(false)
        }
    }
    else {
        document.getElementById('overlayDismiss').onclick = handler
    }
}