/**
 * eyedropper.js — Screen Color Picker (two modes)
 *
 * 1. Magnifier mode (eyedropper button): toggles the SB canvas with
 *    a live zoomed feed of the area around the mouse cursor. Click
 *    the magnifier to pick. Escape to cancel.
 *
 * 2. Quick pick (Alt+X): instantly grabs the pixel color at the
 *    current cursor position and pushes it to history.
 *
 * Magnifier frames are pushed from Java via EyeDropper._onFrame(...).
 */
window.EyeDropper = (() => {
    'use strict';

    // ── State ──
    var _active = false;
    var _lastColor = null;

    // ── DOM refs (set in init) ──
    var _magnifierCanvas, _magnifierCtx;
    var _sbCanvas, _sbIndicator;

    // Reusable Image for decoding base64 PNG frames
    var _frameImg = new Image();
    var _framePending = false;

    // ════════════════════════════════════════════════
    // INIT
    // ════════════════════════════════════════════════

    function init() {
        var btn = document.getElementById('btn-eyedropper');
        if (btn) {
            btn.removeAttribute('onclick');
            btn.addEventListener('click', toggle);
        }

        _magnifierCanvas = document.getElementById('magnifier-canvas');
        _sbCanvas = document.getElementById('sb-canvas');
        _sbIndicator = document.getElementById('sb-indicator');

        if (_magnifierCanvas) {
            _magnifierCtx = _magnifierCanvas.getContext('2d');
            _magnifierCanvas.addEventListener('click', function () {
                _pickAndStop();
            });
        }

        // Escape cancels the magnifier
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && _active) {
                e.preventDefault();
                e.stopPropagation();
                stop(false);
            }
        });
    }

    // ════════════════════════════════════════════════
    // START / STOP / TOGGLE
    // ════════════════════════════════════════════════

    function toggle() {
        if (_active) stop(false);
        else start();
    }

    /** Also exposed as pick() for the Alt+X shortcut. */
    function pick() { toggle(); }

    function start() {
        if (_active) return;
        if (typeof __jux === 'undefined') return;

        _active = true;
        _lastColor = null;

        // Swap: hide SB canvas, show magnifier
        if (_sbCanvas) _sbCanvas.classList.add('hidden');
        if (_sbIndicator) _sbIndicator.classList.add('hidden');
        if (_magnifierCanvas) _magnifierCanvas.classList.remove('hidden');

        // Highlight the eyedropper button
        var btn = document.getElementById('btn-eyedropper');
        if (btn) {
            btn.classList.add('border-accent', 'text-accent', 'bg-accent/10');
        }

        // Tell Java to start streaming frames
        __jux.invoke('eyedropper-start', '{}', function () {});
    }

    function stop(picked) {
        if (!_active) return;
        _active = false;

        // Tell Java to stop streaming
        if (typeof __jux !== 'undefined') {
            __jux.invoke('eyedropper-stop', '{}', function () {});
        }

        // Swap back: show SB canvas, hide magnifier
        if (_sbCanvas) _sbCanvas.classList.remove('hidden');
        if (_sbIndicator) _sbIndicator.classList.remove('hidden');
        if (_magnifierCanvas) _magnifierCanvas.classList.add('hidden');

        // Un-highlight the button
        var btn = document.getElementById('btn-eyedropper');
        if (btn) {
            btn.classList.remove('border-accent', 'text-accent', 'bg-accent/10');
        }

        // Sync picker UI to the last color seen (whether picked via click or Alt+X)
        if (_lastColor && window.ColorPicker) {
            ColorPicker.setColorFromRGB(_lastColor.r, _lastColor.g, _lastColor.b);
            if (picked) {
                ColorPicker.commitColor();
                _showToast('Picked ' + _lastColor.hex);
            }
        }
    }

    function _pickAndStop() {
        stop(true);
    }

    // ════════════════════════════════════════════════
    // FRAME RENDERING (called from Java)
    // ════════════════════════════════════════════════

    /**
     * Called from Java via document.executeScript on each capture frame.
     *
     * @param {string} base64  Base64-encoded PNG of the captured region
     * @param {number} r       Red component of center pixel
     * @param {number} g       Green component of center pixel
     * @param {number} b       Blue component of center pixel
     * @param {string} hex     Hex string of center pixel
     * @param {number} fw      Frame width in physical pixels
     * @param {number} fh      Frame height in physical pixels
     */
    function _onFrame(base64, r, g, b, hex, fw, fh) {
        if (!_active || !_magnifierCtx) return;

        _lastColor = { r: r, g: g, b: b, hex: hex };

        // Update the color swatch live
        var swatch = document.getElementById('color-swatch');
        if (swatch) swatch.style.background = hex;

        // Throttle: skip if the previous frame is still decoding
        if (_framePending) return;
        _framePending = true;

        _frameImg.onload = function () {
            _framePending = false;
            if (!_active || !_magnifierCtx) return;

            var cw = _magnifierCanvas.width;
            var ch = _magnifierCanvas.height;
            var iw = _frameImg.naturalWidth;
            var ih = _frameImg.naturalHeight;

            // Crop center portion of the capture for higher zoom.
            // Use ~30% of the frame → roughly 3x more zoom on top of base scale.
            var cropW = Math.round(iw * 0.3);
            var cropH = Math.round(ih * 0.3);
            var srcX = Math.round((iw - cropW) / 2);
            var srcY = Math.round((ih - cropH) / 2);

            // Draw cropped center, scaled to fill canvas (pixelated)
            _magnifierCtx.imageSmoothingEnabled = false;
            _magnifierCtx.drawImage(_frameImg, srcX, srcY, cropW, cropH, 0, 0, cw, ch);

            // ── Grid lines (pixel boundaries) ──
            var pixelW = cw / cropW;
            var pixelH = ch / cropH;
            _magnifierCtx.strokeStyle = 'rgba(255,255,255,0.08)';
            _magnifierCtx.lineWidth = 0.5;
            for (var gx = 0; gx <= cropW; gx++) {
                var x = Math.round(gx * pixelW);
                _magnifierCtx.beginPath();
                _magnifierCtx.moveTo(x, 0);
                _magnifierCtx.lineTo(x, ch);
                _magnifierCtx.stroke();
            }
            for (var gy = 0; gy <= cropH; gy++) {
                var y = Math.round(gy * pixelH);
                _magnifierCtx.beginPath();
                _magnifierCtx.moveTo(0, y);
                _magnifierCtx.lineTo(cw, y);
                _magnifierCtx.stroke();
            }

            // ── Crosshair (full-span red lines) ──
            var cx = Math.round(cw / 2);
            var cy = Math.round(ch / 2);
            _magnifierCtx.strokeStyle = 'rgba(255, 60, 60, 0.85)';
            _magnifierCtx.lineWidth = 1;
            _magnifierCtx.beginPath();
            _magnifierCtx.moveTo(0, cy);  _magnifierCtx.lineTo(cw, cy);
            _magnifierCtx.moveTo(cx, 0);  _magnifierCtx.lineTo(cx, ch);
            _magnifierCtx.stroke();

            // ── Bottom info bar ──
            var barH = 28;
            _magnifierCtx.fillStyle = 'rgba(0,0,0,0.65)';
            _magnifierCtx.fillRect(0, ch - barH, cw, barH);

            // Color swatch in bar
            _magnifierCtx.fillStyle = hex;
            _magnifierCtx.beginPath();
            _magnifierCtx.roundRect(8, ch - barH + 6, 16, 16, 3);
            _magnifierCtx.fill();

            // Hex label
            _magnifierCtx.fillStyle = '#ffffff';
            _magnifierCtx.font = 'bold 12px monospace';
            _magnifierCtx.fillText(hex, 30, ch - barH + 18);

            // RGB label
            _magnifierCtx.fillStyle = 'rgba(255,255,255,0.6)';
            _magnifierCtx.font = '11px monospace';
            _magnifierCtx.fillText('rgb(' + r + ', ' + g + ', ' + b + ')', 110, ch - barH + 18);

            // Hint
            _magnifierCtx.fillStyle = 'rgba(255,255,255,0.4)';
            _magnifierCtx.font = '10px sans-serif';
            _magnifierCtx.textAlign = 'right';
            _magnifierCtx.fillText('Click to pick \u00B7 Esc to cancel', cw - 8, ch - barH + 17);
            _magnifierCtx.textAlign = 'left';
        };

        _frameImg.onerror = function () {
            _framePending = false;
        };

        _frameImg.src = 'data:image/png;base64,' + base64;
    }

    // ════════════════════════════════════════════════
    // QUICK PICK (Alt+X) — instant pick at cursor
    // ════════════════════════════════════════════════

    function quickPick() {
        if (typeof __jux === 'undefined') return;

        // If magnifier is active, pick the current color and stay in capture mode.
        // Only commit to history — defer the full picker UI update to avoid
        // blocking the frame loop with canvas redraws.
        if (_active && _lastColor) {
            if (window.ColorHistory) {
                ColorHistory.addColor(
                    _lastColor.hex, _lastColor.r, _lastColor.g, _lastColor.b, 1
                );
            }
            _showToast('Picked ' + _lastColor.hex);
            return;
        }

        // Not in magnifier — do a one-shot pick
        __jux.invoke('eyedropper-pick', '{}', function (response) {
            if (!response) return;
            try {
                var data = JSON.parse(response);
                var color = (data && data.result && data.result.hex) ? data.result
                          : (data && data.hex) ? data : null;

                if (color) {
                    var r = parseInt(color.r);
                    var g = parseInt(color.g);
                    var b = parseInt(color.b);
                    var hex = color.hex;

                    if (window.ColorPicker) {
                        ColorPicker.setColorFromRGB(r, g, b);
                        ColorPicker.commitColor();
                    }
                    _showToast('Picked ' + hex);
                }
            } catch (e) {
                console.error('[EyeDropper] quickPick error:', e);
            }
        });
    }

    // ════════════════════════════════════════════════
    // TOAST
    // ════════════════════════════════════════════════

    function _showToast(message) {
        var toast = document.getElementById('toast');
        var msg = document.getElementById('toast-message');
        if (toast && msg) {
            msg.textContent = message;
            toast.classList.add('toast-show');
            clearTimeout(toast._hideTimer);
            toast._hideTimer = setTimeout(function () {
                toast.classList.remove('toast-show');
            }, 2000);
        }
    }

    // ════════════════════════════════════════════════
    // PUBLIC API
    // ════════════════════════════════════════════════

    return {
        init: init,
        pick: pick,
        toggle: toggle,
        start: start,
        stop: stop,
        quickPick: quickPick,
        _onFrame: _onFrame
    };
})();

EyeDropper.init();
