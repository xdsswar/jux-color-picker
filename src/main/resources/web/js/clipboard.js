/**
 * clipboard.js — Copy with Animations
 *
 * Handles copying color format values to the system clipboard and
 * provides visual feedback through two animation mechanisms:
 *
 * 1. **Format box flash**: When a format box is clicked, it receives the
 *    'copied' CSS class which triggers:
 *    - A green check icon overlay that fades in/out (copyFlash animation)
 *    - An accent border glow pulse (copyPulse animation)
 *    Both animations last 600ms.
 *
 * 2. **Toast notification**: A small pill slides up from the bottom center
 *    of the window showing "Copied #6366F1" (or whatever value was copied).
 *    The toast auto-dismisses after 2 seconds.
 *
 * Clipboard access uses the modern navigator.clipboard API with a
 * document.execCommand('copy') fallback for environments that don't
 * support it (e.g., older webview builds).
 *
 * Exposed as `window.ClipboardManager` (singleton object).
 * No dependencies (standalone module, but format boxes must exist in DOM).
 */
window.ClipboardManager = (() => {
    'use strict';

    /** Timer ID for the current toast auto-dismiss. Used to reset on rapid copies. */
    let _toastTimer = null;

    // ════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ════════════════════════════════════════════════════════════

    /**
     * Initializes the clipboard manager.
     * Finds all `.format-box` elements in the DOM and attaches click
     * handlers that copy the format value text to the clipboard.
     */
    function init() {
        // Copy is now handled by the format copy button in color-picker.js.
        // This module only provides the copyToClipboard() and toast utilities.
    }

    // ════════════════════════════════════════════════════════════
    // CLIPBOARD OPERATIONS
    // ════════════════════════════════════════════════════════════

    /**
     * Copies text to the system clipboard and triggers visual feedback.
     *
     * Tries the modern Clipboard API first (navigator.clipboard.writeText).
     * Falls back to the deprecated document.execCommand('copy') for
     * environments without Clipboard API support.
     *
     * @param {string} text      - The text to copy to the clipboard
     * @param {HTMLElement} [element] - Optional: the element to flash with the copy animation
     */
    function copyToClipboard(text, element) {
        navigator.clipboard.writeText(text).then(() => {
            // Success: trigger visual feedback
            if (element) _flashElement(element);
            _showToast(`Copied ${text}`);
        }).catch(() => {
            // Fallback: create a temporary textarea, select its content, and copy
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';  // Prevent page scroll
            ta.style.opacity = '0';       // Hide from view
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);

            // Still trigger visual feedback on fallback success
            if (element) _flashElement(element);
            _showToast(`Copied ${text}`);
        });
    }

    // ════════════════════════════════════════════════════════════
    // VISUAL FEEDBACK ANIMATIONS
    // ════════════════════════════════════════════════════════════

    /**
     * Triggers the copy animation on a format box element.
     *
     * Adds the 'copied' class which activates CSS animations:
     *   - .format-box.copied → copyPulse animation (border glow)
     *   - .format-box.copied .copy-flash → copyFlash animation (check icon overlay)
     *
     * The class is removed after 600ms to reset for the next click.
     *
     * @param {HTMLElement} el - The format box element to animate
     */
    function _flashElement(el) {
        el.classList.add('copied');
        setTimeout(() => el.classList.remove('copied'), 600);
    }

    /**
     * Shows a toast notification at the bottom center of the window.
     *
     * The toast slides up (via CSS class 'toast-show') and auto-dismisses
     * after 2 seconds. If a toast is already showing, its timer is reset
     * and the message is updated immediately.
     *
     * @param {string} message - The message to display (e.g. "Copied #6366F1")
     */
    function _showToast(message) {
        const toast = document.getElementById('toast');
        const msgEl = document.getElementById('toast-message');
        if (!toast || !msgEl) return;

        // Update the toast message text
        msgEl.textContent = message;
        // Make the toast visible (CSS class adds opacity and transform)
        toast.classList.add('toast-show');

        // Reset the auto-dismiss timer if a previous toast is still showing
        if (_toastTimer) clearTimeout(_toastTimer);

        // Auto-dismiss after 2 seconds
        _toastTimer = setTimeout(() => {
            toast.classList.remove('toast-show');
            _toastTimer = null;
        }, 2000);
    }

    // ════════════════════════════════════════════════════════════
    // PUBLIC API
    // ════════════════════════════════════════════════════════════

    return { init, copyToClipboard };
})();

// Self-initialize after script injection
ClipboardManager.init();
