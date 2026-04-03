/**
 * color-history.js — Color History Management
 *
 * Manages a list of recently used colors displayed as clickable swatches
 * in a 10-column grid. Colors are persisted across sessions via IPC
 * commands (backed by Java Preferences) or localStorage as a fallback.
 *
 * Features:
 *   - Maximum 30 entries (3 rows × 10 columns)
 *   - Newest colors appear first (prepended)
 *   - Duplicate hex values are moved to front, not added twice
 *   - Click a swatch to restore that color in the picker
 *   - Right-click a swatch for a context menu (Copy HEX / Remove)
 *   - "Clear" button empties the entire history
 *   - New swatches animate in with the swatchPop CSS animation
 *
 * Exposed as `window.ColorHistory` (singleton object).
 * Depends on: ColorEngine, ColorPicker (for swatch click), ClipboardManager
 */
window.ColorHistory = (() => {
    'use strict';

    // ════════════════════════════════════════════════════════════
    // STATE
    // ════════════════════════════════════════════════════════════

    /**
     * Array of color entries, newest first.
     * Each entry: { hex: string, rgb: {r,g,b}, a: number, timestamp: number }
     */
    let _colors = [];

    /** Maximum number of history entries before oldest are trimmed. */
    const _maxItems = 20;

    // ════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ════════════════════════════════════════════════════════════

    /**
     * Initializes the history module.
     * Loads persisted history, renders the swatch grid, and binds
     * the "Clear" button click handler.
     */
    function init() {
        load();    // Fetch saved history from IPC or localStorage
        render();  // Build the swatch DOM elements

        // Bind the clear button in the history section header
        document.getElementById('btn-clear-history')?.addEventListener('click', clear);
    }

    // ════════════════════════════════════════════════════════════
    // HISTORY OPERATIONS
    // ════════════════════════════════════════════════════════════

    /**
     * Adds a color to the history. If the same hex already exists,
     * it is moved to the front instead of creating a duplicate.
     *
     * @param {string} hex - HEX color string (e.g. "#6366F1")
     * @param {number} r   - Red channel (0-255)
     * @param {number} g   - Green channel (0-255)
     * @param {number} b   - Blue channel (0-255)
     * @param {number} [a] - Alpha (0.0-1.0), defaults to 1
     */
    function addColor(hex, r, g, b, a) {
        // Remove existing duplicate (case-insensitive hex comparison)
        const idx = _colors.findIndex(c => c.hex.toUpperCase() === hex.toUpperCase());
        if (idx !== -1) _colors.splice(idx, 1);

        // Prepend the new entry to the front of the list
        _colors.unshift({
            hex: hex.toUpperCase(),
            rgb: { r, g, b },
            a: a ?? 1,
            timestamp: Date.now()
        });

        // Trim to maximum size (oldest entries are dropped)
        if (_colors.length > _maxItems) {
            _colors = _colors.slice(0, _maxItems);
        }

        render();
        save();
    }

    /**
     * Removes a color at the specified index.
     *
     * @param {number} index - Zero-based index in the _colors array
     */
    function removeColor(index) {
        if (index >= 0 && index < _colors.length) {
            _colors.splice(index, 1);
            render();
            save();
        }
    }

    /**
     * Clears all colors from the history and persists the empty state.
     */
    function clear() {
        _colors = [];
        render();
        save();
    }

    // ════════════════════════════════════════════════════════════
    // RENDERING
    // ════════════════════════════════════════════════════════════

    /**
     * Rebuilds the history swatch grid DOM from the current _colors array.
     *
     * Removes all existing swatch elements, then creates new ones.
     * Shows the empty-state message when there are no colors.
     * Each swatch gets click (restore color) and contextmenu (right-click menu) handlers.
     */
    function render() {
        const grid = document.getElementById('history-grid');
        const empty = document.getElementById('history-empty');
        const count = document.getElementById('history-count');
        if (!grid) return;

        // Remove old swatch elements (preserve the #history-empty element)
        grid.querySelectorAll('.history-swatch').forEach(el => el.remove());

        // Update the count display in the section header
        if (count) count.textContent = `(${_colors.length})`;

        // Show empty state message if no colors
        if (_colors.length === 0) {
            if (empty) empty.classList.remove('hidden');
            return;
        }

        // Hide empty state message
        if (empty) empty.classList.add('hidden');

        // Create a swatch element for each color
        _colors.forEach((color, i) => {
            const swatch = document.createElement('div');
            swatch.className = 'history-swatch swatch-enter'; // CSS animation class
            swatch.style.backgroundColor = color.hex;
            swatch.title = color.hex;    // Tooltip shows hex value on hover
            swatch.dataset.index = i;

            // Left-click: restore this color in the picker
            swatch.addEventListener('click', () => onSwatchClick(color.hex));

            // Right-click: show context menu with Copy/Remove options
            swatch.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                onSwatchRightClick(i, e);
            });

            grid.appendChild(swatch);
        });
    }

    // ════════════════════════════════════════════════════════════
    // SWATCH INTERACTIONS
    // ════════════════════════════════════════════════════════════

    /**
     * Handles left-click on a history swatch.
     * Sets the clicked color as the current color in the picker.
     *
     * @param {string} hex - HEX color of the clicked swatch
     */
    function onSwatchClick(hex) {
        if (window.ColorPicker) {
            ColorPicker.setColorFromHex(hex);
        }
    }

    /**
     * Handles right-click on a history swatch.
     * Creates a floating context menu with "Copy HEX" and "Remove" options.
     * The menu is positioned at the mouse cursor and closes on click-outside.
     *
     * @param {number} index      - Index of the swatch in the _colors array
     * @param {MouseEvent} event  - The contextmenu event (for positioning)
     */
    function onSwatchRightClick(index, event) {
        const color = _colors[index];
        if (!color) return;

        // Remove any existing context menu before creating a new one
        const existing = document.getElementById('history-context-menu');
        if (existing) existing.remove();

        // Create the floating context menu element
        const menu = document.createElement('div');
        menu.id = 'history-context-menu';
        menu.className = 'fixed z-[9999] bg-dropdown border border-divider rounded-lg shadow-xl py-1 min-w-[140px] text-xs';
        menu.style.left = event.clientX + 'px';
        menu.style.top = event.clientY + 'px';

        // "Copy HEX" button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'w-full text-left px-3 py-1.5 hover:bg-hover transition-colors text-primary';
        copyBtn.textContent = 'Copy HEX';
        copyBtn.addEventListener('click', () => {
            ClipboardManager.copyToClipboard(color.hex);
            menu.remove();
        });

        // "Remove" button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'w-full text-left px-3 py-1.5 hover:bg-hover transition-colors text-red-400';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => {
            removeColor(index);
            menu.remove();
        });

        menu.appendChild(copyBtn);
        menu.appendChild(removeBtn);
        document.body.appendChild(menu);

        // Close the context menu when clicking anywhere outside it
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        // Use setTimeout(0) so the current click event doesn't immediately close it
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    // ════════════════════════════════════════════════════════════
    // PERSISTENCE (IPC or localStorage fallback)
    // ════════════════════════════════════════════════════════════

    /**
     * Persists the current color history.
     *
     * When running in Jux (with __jux available), sends the history as a
     * JSON array of hex strings via the "save-history" IPC command.
     * Falls back to localStorage when running outside the Jux webview
     * (e.g., during development in a browser).
     */
    /**
     * Persists the current color history.
     * Uses IPC to save to ~/.jux-color-picker/history.json via Java,
     * or localStorage as fallback.
     */
    function save() {
        const hexes = _colors.map(c => c.hex);
        const json = JSON.stringify(hexes);

        if (typeof __jux !== 'undefined') {
            __jux.invoke('save-history', json, () => {});
        }
        // Always save to localStorage too as a backup
        localStorage.setItem('color-picker-history', json);
    }

    /**
     * Loads the color history from the Java-side JSON file via IPC,
     * falling back to localStorage.
     */
    function load() {
        const loadFromHexes = (hexes) => {
            if (!Array.isArray(hexes) || hexes.length === 0) return;
            _colors = hexes.map(hex => {
                const rgb = ColorEngine.hexToRgb(hex);
                return { hex: hex.toUpperCase(), rgb, a: 1, timestamp: Date.now() };
            });
            render();
        };

        if (typeof __jux !== 'undefined') {
            __jux.invoke('get-history', '{}', (response) => {
                try {
                    // Response is the raw file content: ["#hex1","#hex2"]
                    // or empty string / error
                    if (!response) return;
                    let hexes = JSON.parse(response);
                    // If wrapped in {result: ...}, unwrap
                    if (hexes && !Array.isArray(hexes) && hexes.result !== undefined) {
                        hexes = typeof hexes.result === 'string'
                            ? JSON.parse(hexes.result)
                            : hexes.result;
                    }
                    loadFromHexes(hexes);
                } catch (e) {
                    // Fallback to localStorage
                    _loadFromLocalStorage(loadFromHexes);
                }
            });
        } else {
            _loadFromLocalStorage(loadFromHexes);
        }
    }

    function _loadFromLocalStorage(callback) {
        try {
            const stored = localStorage.getItem('color-picker-history');
            if (stored) callback(JSON.parse(stored));
        } catch (e) {
            console.warn('Failed to load history from localStorage:', e);
        }
    }

    // ════════════════════════════════════════════════════════════
    // PUBLIC API
    // ════════════════════════════════════════════════════════════

    /** Returns the current history as a flat array of hex strings. */
    function _getHexList() {
        return _colors.map(c => c.hex);
    }

    return {
        init, addColor, removeColor, clear,
        render, save, load, onSwatchClick, _getHexList
    };
})();

// Self-initialize after script injection
ColorHistory.init();
