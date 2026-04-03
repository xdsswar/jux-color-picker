/**
 * color-picker.js — Main Picker Logic
 *
 * Controls the SB canvas, hue/alpha strips, format tab switching,
 * format input editing, keyboard shortcuts, and menu actions.
 *
 * Internal state is HSB (hue/saturation/brightness). All other
 * formats are derived on each update.
 *
 * Exposed as `window.ColorPicker` (singleton).
 * Depends on: ColorEngine
 */
window.ColorPicker = (() => {
    'use strict';

    const CE = window.ColorEngine;

    // ── State ──
    let _hue = 239;
    let _saturation = 59;
    let _brightness = 95;
    let _alpha = 100;
    let _updating = false;
    let _draggingSB = false;
    let _draggingHue = false;
    let _draggingAlpha = false;
    let _activeFormat = 'hex';   // 'hex' | 'rgb' | 'hsl' | 'hsb'

    // ── DOM refs ──
    let sbCanvas, sbCtx, sbIndicator;
    let hueCanvas, hueCtx, hueIndicator;
    let alphaCanvas, alphaCtx, alphaIndicator;
    let colorSwatch;

    // ════════════════════════════════════════════════
    // INIT
    // ════════════════════════════════════════════════

    function init() {
        sbCanvas = document.getElementById('sb-canvas');
        hueCanvas = document.getElementById('hue-canvas');
        alphaCanvas = document.getElementById('alpha-canvas');
        sbIndicator = document.getElementById('sb-indicator');
        hueIndicator = document.getElementById('hue-indicator');
        alphaIndicator = document.getElementById('alpha-indicator');
        colorSwatch = document.getElementById('color-swatch');

        if (sbCanvas) sbCtx = sbCanvas.getContext('2d');
        if (hueCanvas) hueCtx = hueCanvas.getContext('2d');
        if (alphaCanvas) alphaCtx = alphaCanvas.getContext('2d');

        _bindCanvasEvents();
        _bindFormatTabs();
        _bindFormatInputs();
        _bindKeyboardShortcuts();
        _bindMenuActions();
        _bindCopyButton();

        drawHueStrip();
        updateAll();
    }

    // ════════════════════════════════════════════════
    // CANVAS RENDERING
    // ════════════════════════════════════════════════

    function drawSBCanvas() {
        if (!sbCtx || !sbCanvas) return;
        const w = sbCanvas.width, h = sbCanvas.height;
        const hueRgb = CE.hsbToRgb(_hue, 100, 100);

        const gradH = sbCtx.createLinearGradient(0, 0, w, 0);
        gradH.addColorStop(0, '#FFFFFF');
        gradH.addColorStop(1, `rgb(${hueRgb.r},${hueRgb.g},${hueRgb.b})`);
        sbCtx.fillStyle = gradH;
        sbCtx.fillRect(0, 0, w, h);

        const gradV = sbCtx.createLinearGradient(0, 0, 0, h);
        gradV.addColorStop(0, 'rgba(0,0,0,0)');
        gradV.addColorStop(1, '#000000');
        sbCtx.fillStyle = gradV;
        sbCtx.fillRect(0, 0, w, h);
    }

    function drawHueStrip() {
        if (!hueCtx || !hueCanvas) return;
        const w = hueCanvas.width, h = hueCanvas.height;
        const grad = hueCtx.createLinearGradient(0, 0, w, 0);
        for (let i = 0; i <= 360; i += 30) {
            const rgb = CE.hsbToRgb(i, 100, 100);
            grad.addColorStop(i / 360, `rgb(${rgb.r},${rgb.g},${rgb.b})`);
        }
        hueCtx.fillStyle = grad;
        hueCtx.beginPath();
        hueCtx.roundRect(0, 0, w, h, h / 2);
        hueCtx.fill();
    }

    function drawAlphaStrip() {
        if (!alphaCtx || !alphaCanvas) return;
        const w = alphaCanvas.width, h = alphaCanvas.height;
        alphaCtx.clearRect(0, 0, w, h);

        // Checkerboard
        const sz = 6;
        for (let x = 0; x < w; x += sz)
            for (let y = 0; y < h; y += sz) {
                alphaCtx.fillStyle = ((x / sz + y / sz) % 2 === 0) ? '#ccc' : '#fff';
                alphaCtx.fillRect(x, y, sz, sz);
            }

        alphaCtx.save();
        alphaCtx.globalCompositeOperation = 'source-atop';
        const rgb = _getCurrentRgb();
        const grad = alphaCtx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},1)`);
        grad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
        alphaCtx.fillStyle = grad;
        alphaCtx.fillRect(0, 0, w, h);
        alphaCtx.restore();
    }

    // ════════════════════════════════════════════════
    // CANVAS EVENTS
    // ════════════════════════════════════════════════

    function _bindCanvasEvents() {
        if (sbCanvas) sbCanvas.addEventListener('mousedown', e => { _draggingSB = true; _handleSBMove(e); });
        if (hueCanvas) hueCanvas.addEventListener('mousedown', e => { _draggingHue = true; _handleHueMove(e); });
        if (alphaCanvas) alphaCanvas.addEventListener('mousedown', e => { _draggingAlpha = true; _handleAlphaMove(e); });

        document.addEventListener('mousemove', e => {
            if (_draggingSB) _handleSBMove(e);
            if (_draggingHue) _handleHueMove(e);
            if (_draggingAlpha) _handleAlphaMove(e);
        });
        document.addEventListener('mouseup', () => {
            if (_draggingSB || _draggingHue || _draggingAlpha) commitColor();
            _draggingSB = _draggingHue = _draggingAlpha = false;
        });
    }

    function _handleSBMove(e) {
        if (!sbCanvas) return;
        const r = sbCanvas.getBoundingClientRect();
        _saturation = Math.round(CE.clamp(e.clientX - r.left, 0, r.width) / r.width * 100);
        _brightness = Math.round((1 - CE.clamp(e.clientY - r.top, 0, r.height) / r.height) * 100);
        updateAll();
    }
    function _handleHueMove(e) {
        if (!hueCanvas) return;
        const r = hueCanvas.getBoundingClientRect();
        _hue = Math.round(CE.clamp(e.clientX - r.left, 0, r.width) / r.width * 360);
        drawSBCanvas(); drawAlphaStrip(); updateAll();
    }
    function _handleAlphaMove(e) {
        if (!alphaCanvas) return;
        const r = alphaCanvas.getBoundingClientRect();
        _alpha = Math.round((1 - CE.clamp(e.clientX - r.left, 0, r.width) / r.width) * 100);
        updateAll();
    }

    // ════════════════════════════════════════════════
    // FORMAT TABS
    // ════════════════════════════════════════════════

    function _bindFormatTabs() {
        document.querySelectorAll('.fmt-tab').forEach(btn => {
            btn.addEventListener('click', () => _switchFormat(btn.dataset.fmt));
        });
    }

    function _switchFormat(fmt) {
        _activeFormat = fmt;
        // Update tab styles
        document.querySelectorAll('.fmt-tab').forEach(t => {
            if (t.dataset.fmt === fmt) {
                t.classList.add('bg-accent', 'text-white');
                t.classList.remove('text-muted');
            } else {
                t.classList.remove('bg-accent', 'text-white');
                t.classList.add('text-muted');
            }
        });
        // Show/hide input rows
        ['hex', 'rgb', 'rgba', 'hsl', 'hsb'].forEach(f => {
            const row = document.getElementById(`fmt-${f}-row`);
            if (!row) return;
            if (f === fmt) { row.classList.remove('hidden'); row.classList.add('flex'); }
            else { row.classList.add('hidden'); row.classList.remove('flex'); }
        });
        // Show alpha input only for RGBA (other formats don't have transparency)
        const alphaGroup = document.getElementById('alpha-input-group');
        if (alphaGroup) {
            if (fmt === 'rgba') { alphaGroup.classList.remove('hidden'); }
            else { alphaGroup.classList.add('hidden'); }
        }
    }

    // ════════════════════════════════════════════════
    // FORMAT INPUTS
    // ════════════════════════════════════════════════

    function _bindFormatInputs() {
        // Hex input
        const hexInput = document.getElementById('input-hex');
        if (hexInput) {
            hexInput.addEventListener('change', () => {
                if (_updating) return;
                const parsed = CE.parseColor('#' + hexInput.value);
                if (parsed) {
                    setColorFromRGB(parsed.r, parsed.g, parsed.b);
                    commitColor();
                }
            });
        }

        // RGB
        _bindNumInput('input-r', (v) => { _setFromRGB('r', v); });
        _bindNumInput('input-g', (v) => { _setFromRGB('g', v); });
        _bindNumInput('input-b', (v) => { _setFromRGB('b', v); });

        // HSL
        _bindNumInput('input-h', (v) => { _setFromHSL('h', v); });
        _bindNumInput('input-s', (v) => { _setFromHSL('s', v); });
        _bindNumInput('input-l', (v) => { _setFromHSL('l', v); });

        // RGBA (same logic as RGB, separate inputs)
        _bindNumInput('input-rgba-r', (v) => { _setFromRGB('r', v); });
        _bindNumInput('input-rgba-g', (v) => { _setFromRGB('g', v); });
        _bindNumInput('input-rgba-b', (v) => { _setFromRGB('b', v); });

        // HSB
        _bindNumInput('input-hsb-h', (v) => { _hue = CE.clamp(v, 0, 360); drawSBCanvas(); drawAlphaStrip(); updateAll(); });
        _bindNumInput('input-hsb-s', (v) => { _saturation = CE.clamp(v, 0, 100); updateAll(); });
        _bindNumInput('input-hsb-b', (v) => { _brightness = CE.clamp(v, 0, 100); updateAll(); });

        // Alpha
        _bindNumInput('input-a', (v) => { _alpha = CE.clamp(v, 0, 100); updateAll(); });
    }

    function _bindNumInput(id, handler) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', () => { if (!_updating) handler(parseInt(el.value) || 0); });
        el.addEventListener('change', () => commitColor());
    }

    function _setFromRGB(ch, val) {
        const rgb = _getCurrentRgb();
        rgb[ch] = CE.clamp(val, 0, 255);
        const hsb = CE.rgbToHsb(rgb.r, rgb.g, rgb.b);
        _hue = hsb.h; _saturation = hsb.s; _brightness = hsb.b;
        drawSBCanvas(); drawAlphaStrip(); updateAll();
    }

    function _setFromHSL(ch, val) {
        const rgb = _getCurrentRgb();
        const hsl = CE.rgbToHsl(rgb.r, rgb.g, rgb.b);
        hsl[ch] = CE.clamp(val, 0, ch === 'h' ? 360 : 100);
        const newRgb = CE.hslToRgb(hsl.h, hsl.s, hsl.l);
        const hsb = CE.rgbToHsb(newRgb.r, newRgb.g, newRgb.b);
        _hue = hsb.h; _saturation = hsb.s; _brightness = hsb.b;
        drawSBCanvas(); drawAlphaStrip(); updateAll();
    }

    // ════════════════════════════════════════════════
    // COPY
    // ════════════════════════════════════════════════

    function _bindCopyButton() {
        document.getElementById('btn-copy-fmt')?.addEventListener('click', _copyCurrentFormat);
    }

    function _copyCurrentFormat() {
        const rgb = _getCurrentRgb();
        const a = _alpha / 100;
        let text;
        switch (_activeFormat) {
            case 'hex': text = CE.formatHex(rgb.r, rgb.g, rgb.b); break;
            case 'rgb': text = CE.formatRgb(rgb.r, rgb.g, rgb.b); break;
            case 'rgba': text = CE.formatRgba(rgb.r, rgb.g, rgb.b, a); break;
            case 'hsl': {
                const hsl = CE.rgbToHsl(rgb.r, rgb.g, rgb.b);
                text = a < 1 ? CE.formatHsla(hsl.h, hsl.s, hsl.l, a) : CE.formatHsl(hsl.h, hsl.s, hsl.l);
                break;
            }
            case 'hsb': {
                const hsb = CE.rgbToHsb(rgb.r, rgb.g, rgb.b);
                text = CE.formatHsb(hsb.h, hsb.s, hsb.b);
                break;
            }
        }
        if (text && window.ClipboardManager) {
            ClipboardManager.copyToClipboard(text);
            _animateCopy();
        }
    }

    /** Triggers the copy flash animation on the format input area and copy button. */
    function _animateCopy() {
        // Flash the active input row
        const activeRow = document.getElementById(`fmt-${_activeFormat}-row`);
        if (activeRow) {
            activeRow.classList.remove('fmt-copy-flash');
            void activeRow.offsetWidth; // Force reflow to restart animation
            activeRow.classList.add('fmt-copy-flash');
            setTimeout(() => activeRow.classList.remove('fmt-copy-flash'), 500);
        }
        // Bounce the copy button and swap icon to checkmark
        const btn = document.getElementById('btn-copy-fmt');
        if (btn) {
            btn.classList.add('copied');
            setTimeout(() => btn.classList.remove('copied'), 600);
        }
    }

    // ════════════════════════════════════════════════
    // STATE SETTERS
    // ════════════════════════════════════════════════

    function setColorFromHSB(h, s, b, a) {
        _hue = CE.clamp(h, 0, 360); _saturation = CE.clamp(s, 0, 100); _brightness = CE.clamp(b, 0, 100);
        if (a !== undefined) _alpha = CE.clamp(a, 0, 100);
        drawSBCanvas(); drawAlphaStrip(); updateAll();
    }
    function setColorFromRGB(r, g, b, a) {
        const hsb = CE.rgbToHsb(r, g, b);
        setColorFromHSB(hsb.h, hsb.s, hsb.b, a);
    }
    function setColorFromHex(hex) {
        const rgb = CE.hexToRgb(hex);
        if (!rgb) return;
        setColorFromRGB(rgb.r, rgb.g, rgb.b, rgb.a !== undefined ? Math.round(rgb.a * 100) : _alpha);
    }

    // ════════════════════════════════════════════════
    // UI UPDATES
    // ════════════════════════════════════════════════

    function updateAll() {
        _updating = true;
        drawSBCanvas();
        drawAlphaStrip();
        _updateSwatch();
        _updateFormatInputs();
        _updateIndicators();
        _updating = false;
    }

    function _updateSwatch() {
        const rgb = _getCurrentRgb();
        const hex = CE.formatHex(rgb.r, rgb.g, rgb.b);
        if (colorSwatch) {
            colorSwatch.style.background = _alpha < 100
                ? `rgba(${rgb.r},${rgb.g},${rgb.b},${_alpha / 100})`
                : hex;
        }
    }

    function _updateFormatInputs() {
        const rgb = _getCurrentRgb();
        const hsl = CE.rgbToHsl(rgb.r, rgb.g, rgb.b);
        const hsb = CE.rgbToHsb(rgb.r, rgb.g, rgb.b);

        _setVal('input-hex', CE.rgbToHex(rgb.r, rgb.g, rgb.b).substring(1));
        _setVal('input-r', rgb.r); _setVal('input-g', rgb.g); _setVal('input-b', rgb.b);
        _setVal('input-rgba-r', rgb.r); _setVal('input-rgba-g', rgb.g); _setVal('input-rgba-b', rgb.b);
        _setVal('input-h', hsl.h); _setVal('input-s', hsl.s); _setVal('input-l', hsl.l);
        _setVal('input-hsb-h', hsb.h); _setVal('input-hsb-s', hsb.s); _setVal('input-hsb-b', hsb.b);
        _setVal('input-a', _alpha);
    }

    function _setVal(id, val) {
        const el = document.getElementById(id);
        if (el) el.value = val;
    }

    function _updateIndicators() {
        const rgb = _getCurrentRgb();
        const hex = CE.formatHex(rgb.r, rgb.g, rgb.b);

        // SB indicator: 20px (w-5), offset by half = 10
        if (sbIndicator && sbCanvas) {
            const r = sbCanvas.getBoundingClientRect();
            sbIndicator.style.left = (_saturation / 100 * r.width - 10) + 'px';
            sbIndicator.style.top = ((1 - _brightness / 100) * r.height - 10) + 'px';
            sbIndicator.style.backgroundColor = hex;
        }
        // Hue indicator: 16px (w-4), offset by half = 8
        if (hueIndicator && hueCanvas) {
            const r = hueCanvas.getBoundingClientRect();
            hueIndicator.style.left = (_hue / 360 * r.width - 8) + 'px';
            hueIndicator.style.top = (r.height / 2 - 8) + 'px';
            const hRgb = CE.hsbToRgb(_hue, 100, 100);
            hueIndicator.style.backgroundColor = `rgb(${hRgb.r},${hRgb.g},${hRgb.b})`;
        }
        // Alpha indicator: 16px (w-4), offset by half = 8
        if (alphaIndicator && alphaCanvas) {
            const r = alphaCanvas.getBoundingClientRect();
            alphaIndicator.style.left = ((1 - _alpha / 100) * r.width - 8) + 'px';
            alphaIndicator.style.top = (r.height / 2 - 8) + 'px';
            alphaIndicator.style.backgroundColor = `rgba(${rgb.r},${rgb.g},${rgb.b},${_alpha / 100})`;
        }
    }

    // ════════════════════════════════════════════════
    // HISTORY
    // ════════════════════════════════════════════════

    function commitColor() {
        const rgb = _getCurrentRgb();
        const hex = CE.formatHex(rgb.r, rgb.g, rgb.b);
        if (window.ColorHistory) ColorHistory.addColor(hex, rgb.r, rgb.g, rgb.b, _alpha / 100);
    }

    // ════════════════════════════════════════════════
    // HELPERS
    // ════════════════════════════════════════════════

    function _getCurrentRgb() { return CE.hsbToRgb(_hue, _saturation, _brightness); }

    function getState() {
        const rgb = _getCurrentRgb();
        return { r: rgb.r, g: rgb.g, b: rgb.b, h: _hue, s: _saturation, v: _brightness, a: _alpha };
    }

    // ════════════════════════════════════════════════
    // KEYBOARD SHORTCUTS
    // ════════════════════════════════════════════════

    function _bindKeyboardShortcuts() {
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') { _closeAllMenus(); document.getElementById('history-context-menu')?.remove(); return; }

            // Alt+X: instant pick color at cursor → set in picker → push to history
            if (e.altKey && e.key.toLowerCase() === 'x') {
                e.preventDefault();
                if (window.EyeDropper) EyeDropper.quickPick();
                return;
            }

            if (!e.ctrlKey && !e.metaKey) return;
            switch (e.key.toLowerCase()) {
                case 't': e.preventDefault(); window.ThemeManager?.toggle(); break;
                case 'i': e.preventDefault(); window.PaletteManager?.importPalette(); break;
                case 'e': e.preventDefault(); window.PaletteManager?.exportPalette(); break;
                case 'j': e.preventDefault(); window.PaletteManager?.exportCurrentAsJson(); break;
                case 'c':
                    if (!window.getSelection()?.toString()) { e.preventDefault(); _copyCurrentFormat(); }
                    break;
            }
        });
    }

    // ════════════════════════════════════════════════
    // MENU BAR
    // ════════════════════════════════════════════════

    function _bindMenuActions() {
        document.querySelectorAll('.menu-item > button').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const dd = btn.closest('.menu-item')?.querySelector('.menu-dropdown');
                if (!dd) return;
                const vis = !dd.classList.contains('hidden');
                _closeAllMenus();
                if (!vis) dd.classList.remove('hidden');
            });
        });
        document.addEventListener('click', e => { if (!e.target.closest('.menu-item')) _closeAllMenus(); });

        document.querySelectorAll('.menu-action').forEach(btn => {
            btn.addEventListener('click', () => {
                _closeAllMenus();
                switch (btn.dataset.action) {
                    case 'import-palette': PaletteManager.importPalette(); break;
                    case 'export-palette': PaletteManager.exportPalette(); break;
                    case 'export-current': PaletteManager.exportCurrentAsJson(); break;
                    case 'clear-history': ColorHistory.clear(); break;
                    case 'clear-palettes': PaletteManager.clearImported(); break;
                    case 'toggle-theme': ThemeManager.toggle(); break;
                    case 'preferences': if (window.Preferences) Preferences.open(); break;
                    case 'about': _openAbout(); break;
                }
            });
        });

        document.getElementById('color-swatch')?.addEventListener('contextmenu', e => {
            e.preventDefault();
            const rgb = _getCurrentRgb();
            const hex = CE.formatHex(rgb.r, rgb.g, rgb.b);
            PaletteManager.addToCustom(hex);
            const toast = document.getElementById('toast');
            const msg = document.getElementById('toast-message');
            if (toast && msg) { msg.textContent = `Added ${hex} to custom palette`; toast.classList.add('toast-show'); setTimeout(() => toast.classList.remove('toast-show'), 2000); }
        });
    }

    function _closeAllMenus() { document.querySelectorAll('.menu-dropdown').forEach(d => d.classList.add('hidden')); }

    function _openAbout() {
        var overlay = document.getElementById('about-overlay');
        if (!overlay) return;
        overlay.classList.remove('hidden');

        var close = document.getElementById('about-close');
        var github = document.getElementById('about-github');

        function hide() { overlay.classList.add('hidden'); }

        close?.addEventListener('click', hide, { once: true });
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) hide();
        }, { once: true });

        github?.addEventListener('click', function (e) {
            e.preventDefault();
            if (typeof __jux !== 'undefined') {
                __jux.invoke('open-url', { url: 'https://github.com/xdsswar/jux-color-picker' }, function () {});
            }
        });
    }

    // ════════════════════════════════════════════════
    // PUBLIC API
    // ════════════════════════════════════════════════

    return {
        init, drawSBCanvas, drawHueStrip, drawAlphaStrip,
        setColorFromHSB, setColorFromRGB, setColorFromHex,
        updateAll, commitColor, getState
    };
})();

ColorPicker.init();
