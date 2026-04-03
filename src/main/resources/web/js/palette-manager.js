/**
 * palette-manager.js — Preset Palettes & Import/Export
 *
 * Manages a collection of built-in color palettes (Material, Tailwind,
 * Pastel, Earth Tones, Neon) plus a user-editable "Custom" palette.
 *
 * Features:
 *   - Dropdown selector to switch between palettes
 *   - Each palette is a grid of clickable color swatches (10 columns)
 *   - Clicking a palette swatch sets it as the current color and adds to history
 *   - Import palette from a JSON file (via IPC file dialog)
 *   - Export current palette to a JSON file (via IPC file dialog)
 *   - Copy current color as a JSON object to clipboard (Ctrl+J)
 *   - Custom palette persisted in localStorage
 *
 * Export JSON format:
 *   { name, version, created, colors: [{hex, rgb, hsl}], history: [hex...] }
 *
 * Exposed as `window.PaletteManager` (singleton object).
 * Depends on: ColorEngine, ColorPicker, ClipboardManager
 */
window.PaletteManager = (() => {
    'use strict';

    // ════════════════════════════════════════════════════════════
    // STATE
    // ════════════════════════════════════════════════════════════

    /** Currently selected palette name. Matches a key in `palettes` or 'custom'. */
    let _currentPalette = 'material';

    /** User-defined custom palette colors (array of hex strings). */
    let _customColors = [];

    /** Imported palettes keyed by name (stored in localStorage). */
    let _importedPalettes = {};

    // ════════════════════════════════════════════════════════════
    // BUILT-IN PALETTE DEFINITIONS
    // Each palette is an array of 20 hex color strings.
    // ════════════════════════════════════════════════════════════

    const palettes = {
        /** Google Material Design primary colors */
        material: [
            '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
            '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50',
            '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800',
            '#FF5722', '#795548', '#9E9E9E', '#607D8B', '#000000',
        ],
        /** Tailwind CSS default palette selection */
        tailwind: [
            '#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4',
            '#3B82F6', '#8B5CF6', '#EC4899', '#F43F5E', '#14B8A6',
            '#6366F1', '#A855F7', '#D946EF', '#F59E0B', '#10B981',
            '#0EA5E9', '#64748B', '#1E293B', '#E2E8F0', '#FFFFFF',
        ],
        /** Soft pastel colors — low saturation, high lightness */
        pastel: [
            '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF',
            '#E8BAFF', '#FFB3E6', '#B3FFE6', '#FFE6B3', '#B3D9FF',
            '#D9B3FF', '#B3FFD9', '#FFB3B3', '#B3FFB3', '#B3B3FF',
            '#FFE6E6', '#E6FFE6', '#E6E6FF', '#FFF0E6', '#E6FFF0',
        ],
        /** Natural earth tones — browns, greens, grays */
        earth: [
            '#8B4513', '#A0522D', '#D2691E', '#CD853F', '#DEB887',
            '#F5DEB3', '#D2B48C', '#BC8F8F', '#F4A460', '#DAA520',
            '#B8860B', '#808000', '#6B8E23', '#556B2F', '#2E8B57',
            '#8FBC8F', '#696969', '#708090', '#778899', '#2F4F4F',
        ],
        /** Vivid neon/fluorescent colors */
        neon: [
            '#FF0080', '#FF00FF', '#8000FF', '#0000FF', '#0080FF',
            '#00FFFF', '#00FF80', '#00FF00', '#80FF00', '#FFFF00',
            '#FF8000', '#FF0000', '#FF1493', '#7B68EE', '#00CED1',
            '#32CD32', '#FFD700', '#FF6347', '#FF69B4', '#BA55D3',
        ],
    };

    // ════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ════════════════════════════════════════════════════════════

    /**
     * Initializes the palette manager.
     * Renders the default palette, binds the dropdown selector,
     * and loads the custom palette from localStorage.
     */
    function init() {
        // Load custom palette colors from localStorage (if any)
        try {
            const stored = localStorage.getItem('custom-palette');
            if (stored) _customColors = JSON.parse(stored);
        } catch (e) { /* ignore parse errors — start with empty custom palette */ }

        // Imported palettes are pushed from Java via _loadImported() after script injection

        render(); // Render the initial palette swatch grid

        // Bind the palette dropdown selector
        const select = document.getElementById('palette-select');
        if (select) {
            select.addEventListener('change', () => switchPalette(select.value));
        }
    }

    // ════════════════════════════════════════════════════════════
    // PALETTE SWITCHING & RENDERING
    // ════════════════════════════════════════════════════════════

    /**
     * Switches to a different palette and re-renders the swatch grid.
     *
     * @param {string} name - Palette name (e.g. 'material', 'tailwind', 'custom')
     */
    function switchPalette(name) {
        _currentPalette = name;
        render();
    }

    /**
     * Renders the swatch grid for the currently selected palette.
     *
     * Creates a colored div for each hex in the palette array.
     * Each swatch has a click handler that sets the picker color and commits to history.
     * Swatches are animated with staggered delays using the swatchPop CSS animation.
     */
    function render() {
        const grid = document.getElementById('palette-grid');
        if (!grid) return;

        grid.innerHTML = ''; // Clear existing swatches

        // Get the color array for the current palette
        let colors;
        if (_currentPalette === 'custom') {
            colors = _customColors;
        } else if (palettes[_currentPalette]) {
            colors = palettes[_currentPalette];
        } else {
            const entry = _importedPalettes[_currentPalette];
            // Support both old format (array) and new format ({ colors, label })
            colors = Array.isArray(entry) ? entry : (entry && entry.colors ? entry.colors : []);
        }

        // Show empty state for custom palette with no colors
        if (colors.length === 0 && _currentPalette === 'custom') {
            grid.innerHTML = '<div class="col-span-10 text-center text-xs text-muted/50 py-3 italic">No custom colors — right-click preview to add</div>';
            return;
        }

        // Create a swatch element for each color
        colors.forEach((hex, i) => {
            const swatch = document.createElement('div');
            swatch.className = 'swatch swatch-enter';
            swatch.style.backgroundColor = hex;
            swatch.title = hex;
            // Staggered animation: each swatch appears 20ms after the previous
            swatch.style.animationDelay = `${i * 20}ms`;

            // Click handler: set as current color and add to history
            swatch.addEventListener('click', () => {
                if (window.ColorPicker) {
                    ColorPicker.setColorFromHex(hex);
                    ColorPicker.commitColor(); // Also adds to history
                }
            });

            grid.appendChild(swatch);
        });
    }

    // ════════════════════════════════════════════════════════════
    // IMPORT / EXPORT
    // ════════════════════════════════════════════════════════════

    /**
     * Exports the current palette as a JSON file via the IPC file dialog.
     *
     * Builds a structured JSON object with color data (hex, RGB, HSL)
     * and sends it to the Java side via the "export-palette" IPC command,
     * which opens a native "Save File" dialog.
     */
    /**
     * Shows the export name modal pre-filled with the current palette's display name,
     * then proceeds with the actual export on confirm.
     */
    function exportPalette() {
        const overlay = document.getElementById('export-name-overlay');
        const input = document.getElementById('export-name-input');
        const confirmBtn = document.getElementById('export-name-confirm');
        const cancelBtn = document.getElementById('export-name-cancel');
        const closeBtn = document.getElementById('export-name-close');
        if (!overlay || !input) return;

        // Pre-fill with current palette's display name
        input.value = _getDisplayName(_currentPalette);
        overlay.classList.remove('hidden');
        input.focus();
        input.select();

        // Cleanup function to remove listeners and hide modal
        function hide() {
            overlay.classList.add('hidden');
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', hide);
            closeBtn.removeEventListener('click', hide);
            input.removeEventListener('keydown', onKeyDown);
        }

        function onConfirm() {
            const name = input.value.trim() || 'My Palette';
            hide();
            _doExport(name);
        }

        function onKeyDown(e) {
            if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
            if (e.key === 'Escape') { e.preventDefault(); hide(); }
        }

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', hide);
        closeBtn.addEventListener('click', hide);
        input.addEventListener('keydown', onKeyDown);
    }

    /**
     * Returns a human-readable display name for a palette key.
     * Built-in palettes use title case; imported palettes strip the prefix.
     */
    function _getDisplayName(key) {
        if (key === 'custom') return 'Custom';
        if (key.startsWith('imported:')) {
            const entry = _importedPalettes[key];
            if (entry && entry.label) return entry.label;
            return key.replace('imported:', '').replace(/-/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase());
        }
        // Built-in palette — title case the key
        const names = { material: 'Material', tailwind: 'Tailwind', pastel: 'Pastel', earth: 'Earth Tones', neon: 'Neon' };
        return names[key] || key.charAt(0).toUpperCase() + key.slice(1);
    }

    /**
     * Performs the actual palette export with the given name.
     */
    function _doExport(name) {
        // Export the current history colors — preserves the user's curated selection
        const historyColors = window.ColorHistory ? ColorHistory._getHexList() : [];

        const data = {
            name: name,
            version: 1,
            created: new Date().toISOString(),
            colors: historyColors.map(hex => {
                const rgb = ColorEngine.hexToRgb(hex);
                const hsl = ColorEngine.rgbToHsl(rgb.r, rgb.g, rgb.b);
                const hsb = ColorEngine.rgbToHsb(rgb.r, rgb.g, rgb.b);
                return {
                    hex,
                    rgb: { r: rgb.r, g: rgb.g, b: rgb.b },
                    hsl: { h: hsl.h, s: hsl.s, l: hsl.l },
                    hsb: { h: hsb.h, s: hsb.s, b: hsb.b }
                };
            })
        };

        if (typeof __jux !== 'undefined') {
            __jux.invoke('export-palette', data, (response) => {
                try {
                    const result = JSON.parse(response);
                    if (result.result === 'saved') {
                        _showToast('Palette exported as "' + name + '"');
                    }
                } catch (e) { /* User cancelled the dialog */ }
            });
        }
    }

    /**
     * Imports a palette from a JSON file via the IPC file dialog.
     *
     * Opens a native "Open File" dialog through the "import-palette" IPC command.
     * The returned JSON is parsed and loaded into the custom palette.
     * Automatically switches to the custom palette view.
     */
    /**
     * Triggers the import flow — opens the native file dialog via IPC.
     * The Java side reads the file and calls _handleImport() via executeScript.
     */
    function importPalette() {
        if (typeof __jux !== 'undefined') {
            __jux.invoke('import-palette', '{}', function() {});
        }
    }

    /**
     * Called from Java via executeScript with the raw JSON string
     * after the user selects a file in the import dialog.
     */
    function _handleImport(jsonStr) {
        try {
            const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;

            if (data && data.colors && Array.isArray(data.colors)) {
                const hexColors = data.colors.map(c => typeof c === 'string' ? c : c.hex).filter(Boolean);
                const name = (data.name && data.name.trim()) ? data.name.trim() : 'Imported';
                const key = 'imported:' + name.toLowerCase().replace(/[^a-z0-9]/g, '-');

                _importedPalettes[key] = { colors: hexColors, label: name };
                _saveImported();

                _rebuildDropdown();
                _currentPalette = key;
                const select = document.getElementById('palette-select');
                if (select) select.value = key;

                render();
                _showToast('Imported "' + name + '"');
            } else {
                _showToast('Invalid palette file');
            }
        } catch (e) {
            console.warn('Failed to import palette:', e);
            _showToast('Failed to import palette');
        }
    }

    /**
     * Copies the current picker color as a formatted JSON object to the clipboard.
     * Includes hex, RGB, HSL, HSB, and alpha values.
     * Triggered by Ctrl+J or File → Copy Current as JSON.
     */
    function exportCurrentAsJson() {
        if (!window.ColorPicker) return;

        // Get the current color state from the picker
        const state = ColorPicker.getState();
        const data = {
            hex: ColorEngine.formatHex(state.r, state.g, state.b),
            rgb: { r: state.r, g: state.g, b: state.b },
            hsl: ColorEngine.rgbToHsl(state.r, state.g, state.b),
            hsb: ColorEngine.rgbToHsb(state.r, state.g, state.b),
            alpha: state.a / 100  // Convert 0-100 to 0.0-1.0
        };

        // Copy the pretty-printed JSON to clipboard (with toast notification)
        ClipboardManager.copyToClipboard(JSON.stringify(data, null, 2));
    }

    // ════════════════════════════════════════════════════════════
    // IMPORTED PALETTE MANAGEMENT
    // ════════════════════════════════════════════════════════════

    /**
     * Removes all imported palettes, clears persistence, and resets dropdown.
     */
    function clearImported() {
        _importedPalettes = {};
        _saveImported();
        _rebuildDropdown();
        // If currently viewing an imported palette, switch to material
        if (_currentPalette.startsWith('imported:')) {
            _currentPalette = 'material';
            const select = document.getElementById('palette-select');
            if (select) select.value = 'material';
        }
        render();
        _showToast('Imported palettes cleared');
    }

    /**
     * Called from Java via executeScript on startup to load persisted imported palettes.
     */
    function _loadImported(jsonStr) {
        try {
            const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
            if (data && typeof data === 'object' && Object.keys(data).length > 0) {
                _importedPalettes = data;
                _rebuildDropdown();
                render();
            }
        } catch (e) { /* ignore */ }
    }

    // ════════════════════════════════════════════════════════════
    // CUSTOM PALETTE MANAGEMENT
    // ════════════════════════════════════════════════════════════

    /**
     * Adds a hex color to the custom palette (if not already present).
     * Persists the updated custom palette to localStorage.
     *
     * @param {string} hex - HEX color string to add
     */
    function addToCustom(hex) {
        if (!_customColors.includes(hex.toUpperCase())) {
            _customColors.push(hex.toUpperCase());
            _saveCustom();
            // Re-render grid if currently viewing the custom palette
            if (_currentPalette === 'custom') render();
        }
    }

    /**
     * Removes a color from the custom palette by index.
     *
     * @param {number} index - Index in the _customColors array
     */
    function removeFromCustom(index) {
        _customColors.splice(index, 1);
        _saveCustom();
        if (_currentPalette === 'custom') render();
    }

    /**
     * Persists the custom palette to localStorage.
     */
    function _saveCustom() {
        localStorage.setItem('custom-palette', JSON.stringify(_customColors));
    }

    /** Persists imported palettes via IPC (Java-side file). */
    function _saveImported() {
        if (typeof __jux !== 'undefined') {
            __jux.invoke('save-palettes', JSON.stringify(_importedPalettes), function() {});
        }
    }

    /** Rebuilds the palette dropdown to include imported palettes. */
    function _rebuildDropdown() {
        const select = document.getElementById('palette-select');
        if (!select) return;

        // Remove previously added imported options
        select.querySelectorAll('option[data-imported]').forEach(o => o.remove());

        // Append imported palettes to the end of the dropdown
        for (const key of Object.keys(_importedPalettes)) {
            const entry = _importedPalettes[key];
            const label = (entry && entry.label)
                ? entry.label
                : key.replace('imported:', '').replace(/-/g, ' ')
                    .replace(/\b\w/g, c => c.toUpperCase());
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = label;
            opt.setAttribute('data-imported', 'true');
            select.appendChild(opt);
        }
    }

    function _showToast(message) {
        const toast = document.getElementById('toast');
        const msg = document.getElementById('toast-message');
        if (toast && msg) {
            msg.textContent = message;
            toast.classList.add('toast-show');
            setTimeout(() => toast.classList.remove('toast-show'), 2000);
        }
    }

    // ════════════════════════════════════════════════════════════
    // PUBLIC API
    // ════════════════════════════════════════════════════════════

    return {
        init, switchPalette, render,
        exportPalette, importPalette, exportCurrentAsJson,
        addToCustom, removeFromCustom, clearImported, _handleImport, _loadImported
    };
})();

// Self-initialize after script injection
PaletteManager.init();
