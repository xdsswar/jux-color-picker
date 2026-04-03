/**
 * preferences.js — User Preferences (Font, Size)
 *
 * Manages a modal dialog for configuring:
 *   - UI font family (Inter, System UI, Segoe UI, etc.)
 *   - Mono font family (JetBrains Mono, Cascadia Code, etc.)
 *   - Base font size (10–16px)
 *
 * Settings are persisted in localStorage and applied on startup.
 *
 * Exposed as `window.Preferences` (singleton).
 */
window.Preferences = (() => {
    'use strict';

    const STORAGE_KEY = 'color-picker-prefs';

    const DEFAULTS = {
        fontFamily: "'Inter', system-ui, sans-serif",
        fontMono: "'JetBrains Mono', monospace",
        fontSize: 12
    };

    let _prefs = { ...DEFAULTS };

    // ════════════════════════════════════════════════
    // INIT
    // ════════════════════════════════════════════════

    function init() {
        _load();
        _apply();
        _bindUI();
    }

    // ════════════════════════════════════════════════
    // PERSISTENCE
    // ════════════════════════════════════════════════

    function _load() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                _prefs = { ...DEFAULTS, ...parsed };
            }
        } catch (e) { /* ignore */ }
    }

    function _save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_prefs));
    }

    // ════════════════════════════════════════════════
    // APPLY
    // ════════════════════════════════════════════════

    /** Applies current preferences to the document. */
    function _apply() {
        const root = document.documentElement;
        root.style.setProperty('--font-ui', _prefs.fontFamily);
        root.style.setProperty('--font-mono', _prefs.fontMono);
        document.body.style.fontFamily = _prefs.fontFamily;
        document.body.style.fontSize = _prefs.fontSize + 'px';

        // Update all mono elements
        document.querySelectorAll('.font-mono').forEach(el => {
            el.style.fontFamily = _prefs.fontMono;
        });
    }

    // ════════════════════════════════════════════════
    // DIALOG UI
    // ════════════════════════════════════════════════

    function _bindUI() {
        const overlay = document.getElementById('prefs-overlay');
        const fontFamily = document.getElementById('pref-font-family');
        const fontMono = document.getElementById('pref-font-mono');
        const fontSize = document.getElementById('pref-font-size');
        const sizeLabel = document.getElementById('pref-size-label');
        const closeBtn = document.getElementById('prefs-close');
        const resetBtn = document.getElementById('prefs-reset');
        const applyBtn = document.getElementById('prefs-apply');

        if (!overlay) return;

        // Live preview font size label
        if (fontSize && sizeLabel) {
            fontSize.addEventListener('input', () => {
                sizeLabel.textContent = fontSize.value + 'px';
            });
        }

        // Close on overlay background click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        // Close button
        closeBtn?.addEventListener('click', close);

        // Escape key closes
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
        });

        // Reset defaults
        resetBtn?.addEventListener('click', () => {
            _prefs = { ...DEFAULTS };
            _syncUI();
            _apply();
            _save();
        });

        // Apply
        applyBtn?.addEventListener('click', () => {
            if (fontFamily) _prefs.fontFamily = fontFamily.value;
            if (fontMono) _prefs.fontMono = fontMono.value;
            if (fontSize) _prefs.fontSize = parseInt(fontSize.value);
            _apply();
            _save();
            close();
        });
    }

    /** Syncs the dialog inputs to match current _prefs. */
    function _syncUI() {
        const fontFamily = document.getElementById('pref-font-family');
        const fontMono = document.getElementById('pref-font-mono');
        const fontSize = document.getElementById('pref-font-size');
        const sizeLabel = document.getElementById('pref-size-label');

        if (fontFamily) fontFamily.value = _prefs.fontFamily;
        if (fontMono) fontMono.value = _prefs.fontMono;
        if (fontSize) fontSize.value = _prefs.fontSize;
        if (sizeLabel) sizeLabel.textContent = _prefs.fontSize + 'px';
    }

    /** Opens the preferences dialog. */
    function open() {
        _syncUI();
        const overlay = document.getElementById('prefs-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.classList.add('flex');
        }
    }

    /** Closes the preferences dialog. */
    function close() {
        const overlay = document.getElementById('prefs-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('flex');
        }
    }

    return { init, open, close };
})();

Preferences.init();
