/**
 * theme-manager.js — Dark/Light Theme Toggle
 *
 * Manages the application's visual theme (dark or light). The theme is
 * applied by setting the `data-theme` attribute on the root `<html>` element,
 * which activates the corresponding CSS variable block in app.css.
 *
 * Theme transitions use a CSS class (`theme-transitioning`) that enables
 * smooth color transitions for 300ms during the switch, preventing a
 * jarring instant color change.
 *
 * The selected theme is persisted in localStorage so it is remembered
 * across sessions.
 *
 * Keyboard shortcut: Ctrl+T toggles the theme.
 *
 * Exposed as `window.ThemeManager` (singleton object).
 * No dependencies (standalone module).
 */
window.ThemeManager = (() => {
    'use strict';

    /** Current theme: 'dark' (default) or 'light'. */
    let _theme = 'light';

    // ════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ════════════════════════════════════════════════════════════

    /**
     * Initializes the theme manager.
     * Reads the saved theme preference from localStorage (if any)
     * and applies it immediately without a transition animation.
     */
    function init() {
        const saved = localStorage.getItem('color-picker-theme');
        if (saved === 'light' || saved === 'dark') {
            _theme = saved;
        }
        setTheme(_theme);
    }

    // ════════════════════════════════════════════════════════════
    // THEME OPERATIONS
    // ════════════════════════════════════════════════════════════

    /**
     * Toggles between dark and light themes with a smooth transition.
     *
     * The transition animation is triggered BEFORE the theme switch so
     * that all CSS variable changes are smoothly interpolated over 300ms.
     */
    function toggle() {
        _animateTransition();
        setTheme(_theme === 'dark' ? 'light' : 'dark');
    }

    /**
     * Applies a specific theme.
     *
     * Sets the `data-theme` attribute on `<html>`, which activates
     * the matching CSS variable block ([data-theme="dark"] or [data-theme="light"]).
     * Persists the choice to localStorage.
     *
     * @param {string} theme - 'dark' or 'light'
     */
    function setTheme(theme) {
        _theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('color-picker-theme', theme);
    }

    /**
     * Returns the current theme name.
     *
     * @returns {string} 'dark' or 'light'
     */
    function getTheme() {
        return _theme;
    }

    // ════════════════════════════════════════════════════════════
    // TRANSITION ANIMATION
    // ════════════════════════════════════════════════════════════

    /**
     * Adds the 'theme-transitioning' class to `<html>` for 300ms.
     *
     * While this class is active, the CSS rule in app.css applies
     * transition properties to ALL elements, ensuring background-color,
     * color, border-color, and box-shadow changes animate smoothly.
     * The class is removed after the transition completes to avoid
     * interfering with other animations.
     */
    function _animateTransition() {
        document.documentElement.classList.add('theme-transitioning');
        setTimeout(() => {
            document.documentElement.classList.remove('theme-transitioning');
        }, 300);
    }

    // ════════════════════════════════════════════════════════════
    // PUBLIC API
    // ════════════════════════════════════════════════════════════

    return { init, toggle, setTheme, getTheme };
})();

// Self-initialize after script injection
ThemeManager.init();
