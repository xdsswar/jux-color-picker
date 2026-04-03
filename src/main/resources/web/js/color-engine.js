/**
 * color-engine.js — Color Conversion Engine
 *
 * Pure-function module responsible for ALL color math in the application.
 * This module has ZERO DOM access — it only performs calculations and
 * returns values. Every other JS module depends on this one.
 *
 * Exposed as `window.ColorEngine` (singleton object).
 *
 * Supported color models:
 *   - RGB  (0-255 per channel)
 *   - HEX  (#RRGGBB, always uppercase, always with # prefix)
 *   - HEX8 (#RRGGBBAA, alpha as 2-digit hex)
 *   - HSL  (H: 0-360, S/L: 0-100)
 *   - HSB  (H: 0-360, S/B: 0-100)  — also known as HSV
 *
 * Conventions:
 *   - All integer outputs are rounded (Math.round)
 *   - Alpha is 0.0–1.0 in formatting functions, 0–100 in internal state
 *   - HEX always uppercase with # prefix
 */
window.ColorEngine = (() => {
    'use strict';

    // ════════════════════════════════════════════════════════════
    // UTILITY
    // ════════════════════════════════════════════════════════════

    /**
     * Clamps a numeric value between min and max (inclusive).
     *
     * @param {number} val - The value to clamp
     * @param {number} min - Minimum allowed value
     * @param {number} max - Maximum allowed value
     * @returns {number} The clamped value
     */
    function clamp(val, min, max) {
        return Math.min(Math.max(val, min), max);
    }

    // ════════════════════════════════════════════════════════════
    // RGB ↔ HEX CONVERSIONS
    // ════════════════════════════════════════════════════════════

    /**
     * Converts RGB values to a 6-digit uppercase HEX string.
     * Values are clamped to 0-255 and rounded to nearest integer.
     *
     * @param {number} r - Red channel (0-255)
     * @param {number} g - Green channel (0-255)
     * @param {number} b - Blue channel (0-255)
     * @returns {string} HEX color string, e.g. "#6366F1"
     */
    function rgbToHex(r, g, b) {
        r = clamp(Math.round(r), 0, 255);
        g = clamp(Math.round(g), 0, 255);
        b = clamp(Math.round(b), 0, 255);
        // Bitwise OR with 1<<24 ensures leading zeros are preserved,
        // then we slice off the leading "1" from the hex string.
        return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase();
    }

    /**
     * Converts RGBA values to an 8-digit HEX string (with alpha channel).
     * The alpha value (0.0-1.0) is mapped to a 2-digit hex (00-FF).
     *
     * @param {number} r - Red channel (0-255)
     * @param {number} g - Green channel (0-255)
     * @param {number} b - Blue channel (0-255)
     * @param {number} [a=1] - Alpha (0.0-1.0)
     * @returns {string} HEX8 color string, e.g. "#6366F1FF"
     */
    function rgbToHex8(r, g, b, a) {
        const hex = rgbToHex(r, g, b);
        // Convert 0.0-1.0 alpha to 0-255 integer, then to 2-char uppercase hex
        const alpha = clamp(Math.round((a ?? 1) * 255), 0, 255);
        return hex + alpha.toString(16).toUpperCase().padStart(2, '0');
    }

    /**
     * Parses a HEX string into RGB (and optionally alpha) values.
     * Accepts 3-digit (#RGB), 4-digit (#RGBA), 6-digit (#RRGGBB),
     * or 8-digit (#RRGGBBAA) formats. The # prefix is optional.
     *
     * @param {string} hex - HEX color string
     * @returns {{r: number, g: number, b: number, a?: number}} RGB object
     */
    function hexToRgb(hex) {
        hex = hex.replace(/^#/, '');

        // Expand shorthand: #RGB → #RRGGBB, #RGBA → #RRGGBBAA
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        if (hex.length === 4) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }

        // Parse the first 6 hex digits as a single integer for RGB
        const num = parseInt(hex.substring(0, 6), 16);
        const result = {
            r: (num >> 16) & 255,  // Extract red from bits 16-23
            g: (num >> 8) & 255,   // Extract green from bits 8-15
            b: num & 255           // Extract blue from bits 0-7
        };

        // If 8-digit hex, parse the last 2 digits as alpha (0-255 → 0.0-1.0)
        if (hex.length === 8) {
            result.a = parseInt(hex.substring(6, 8), 16) / 255;
        }
        return result;
    }

    // ════════════════════════════════════════════════════════════
    // RGB ↔ HSL CONVERSIONS
    // ════════════════════════════════════════════════════════════

    /**
     * Converts RGB (0-255) to HSL (H: 0-360, S: 0-100, L: 0-100).
     *
     * Algorithm:
     * 1. Normalize RGB to 0-1 range
     * 2. Find min/max channel values
     * 3. Lightness = average of min and max
     * 4. Saturation depends on lightness (different formula for L > 0.5)
     * 5. Hue is determined by which channel is max
     *
     * @param {number} r - Red (0-255)
     * @param {number} g - Green (0-255)
     * @param {number} b - Blue (0-255)
     * @returns {{h: number, s: number, l: number}} HSL values
     */
    function rgbToHsl(r, g, b) {
        // Normalize to 0-1 range for calculation
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;
        let h = 0, s = 0;

        if (max !== min) {
            const d = max - min; // Chroma (color difference)

            // Saturation formula differs based on lightness
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            // Hue calculation: depends on which channel is the max
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return {
            h: Math.round(h * 360),  // Convert 0-1 to 0-360 degrees
            s: Math.round(s * 100),  // Convert 0-1 to 0-100 percent
            l: Math.round(l * 100)
        };
    }

    /**
     * Converts HSL to RGB. Uses the standard hue-to-RGB helper function.
     *
     * @param {number} h - Hue (0-360)
     * @param {number} s - Saturation (0-100)
     * @param {number} l - Lightness (0-100)
     * @returns {{r: number, g: number, b: number}} RGB values (0-255)
     */
    function hslToRgb(h, s, l) {
        // Normalize to 0-1 range
        h /= 360; s /= 100; l /= 100;
        let r, g, b;

        if (s === 0) {
            // Achromatic (grayscale): all channels equal lightness
            r = g = b = l;
        } else {
            // Helper: converts a hue sector to an RGB channel value
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            // q and p are intermediate values based on lightness and saturation
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;

            // Each RGB channel is offset by 1/3 around the hue circle
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    // ════════════════════════════════════════════════════════════
    // RGB ↔ HSB/HSV CONVERSIONS
    // ════════════════════════════════════════════════════════════

    /**
     * Converts RGB to HSB (Hue-Saturation-Brightness), also known as HSV.
     *
     * Key difference from HSL:
     *   - HSB brightness = max(R, G, B)  (the brightest channel)
     *   - HSL lightness  = avg(min, max) (midpoint of min and max)
     *
     * @param {number} r - Red (0-255)
     * @param {number} g - Green (0-255)
     * @param {number} b - Blue (0-255)
     * @returns {{h: number, s: number, b: number}} HSB values
     */
    function rgbToHsb(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        let h = 0;

        // Saturation: ratio of chroma to brightness (0 when brightness is 0)
        const s = max === 0 ? 0 : d / max;
        // Brightness (Value): simply the maximum channel
        const v = max;

        if (max !== min) {
            // Hue calculation: same as HSL
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            b: Math.round(v * 100)
        };
    }

    /**
     * Converts HSB (HSV) to RGB using the sector-based algorithm.
     *
     * The hue circle is divided into 6 sectors of 60° each. For each sector,
     * three of the intermediate values (p, q, t) are assigned to R, G, B
     * in different orders.
     *
     * @param {number} h - Hue (0-360)
     * @param {number} s - Saturation (0-100)
     * @param {number} b - Brightness/Value (0-100)
     * @returns {{r: number, g: number, b: number}} RGB values (0-255)
     */
    function hsbToRgb(h, s, b) {
        h /= 360; s /= 100; b /= 100;
        let r, g, bl;

        const i = Math.floor(h * 6);            // Sector index (0-5)
        const f = h * 6 - i;                     // Fractional part within sector
        const p = b * (1 - s);                   // Minimum RGB value
        const q = b * (1 - f * s);               // Descending intermediate
        const t = b * (1 - (1 - f) * s);         // Ascending intermediate

        // Assign R, G, B based on which 60° sector the hue falls in
        switch (i % 6) {
            case 0: r = b; g = t; bl = p; break;  // 0°-60°:   Red → Yellow
            case 1: r = q; g = b; bl = p; break;  // 60°-120°:  Yellow → Green
            case 2: r = p; g = b; bl = t; break;  // 120°-180°: Green → Cyan
            case 3: r = p; g = q; bl = b; break;  // 180°-240°: Cyan → Blue
            case 4: r = t; g = p; bl = b; break;  // 240°-300°: Blue → Magenta
            case 5: r = b; g = p; bl = q; break;  // 300°-360°: Magenta → Red
        }

        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(bl * 255)
        };
    }

    // ════════════════════════════════════════════════════════════
    // STRING FORMATTING
    // ════════════════════════════════════════════════════════════

    /**
     * Formats RGB as a HEX string. Alias for rgbToHex.
     * @returns {string} e.g. "#6366F1"
     */
    function formatHex(r, g, b) {
        return rgbToHex(r, g, b);
    }

    /**
     * Formats RGBA as an 8-digit HEX string. Alias for rgbToHex8.
     * @returns {string} e.g. "#6366F1FF"
     */
    function formatHex8(r, g, b, a) {
        return rgbToHex8(r, g, b, a);
    }

    /**
     * Formats as CSS rgb() function string.
     * @returns {string} e.g. "rgb(99, 102, 241)"
     */
    function formatRgb(r, g, b) {
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    }

    /**
     * Formats as CSS rgba() function string. Alpha shown with 1 decimal place.
     * @returns {string} e.g. "rgba(99, 102, 241, 1.0)"
     */
    function formatRgba(r, g, b, a) {
        return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${(a ?? 1).toFixed(1)})`;
    }

    /**
     * Formats as CSS hsl() function string.
     * @returns {string} e.g. "hsl(239, 84%, 67%)"
     */
    function formatHsl(h, s, l) {
        return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
    }

    /**
     * Formats as CSS hsla() function string. Alpha shown with 1 decimal place.
     * @returns {string} e.g. "hsla(239, 84%, 67%, 1.0)"
     */
    function formatHsla(h, s, l, a) {
        return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${(a ?? 1).toFixed(1)})`;
    }

    /**
     * Formats as HSB string (not a standard CSS function, but useful for display).
     * @returns {string} e.g. "hsb(239, 59%, 95%)"
     */
    function formatHsb(h, s, b) {
        return `hsb(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(b)}%)`;
    }

    // ════════════════════════════════════════════════════════════
    // WCAG CONTRAST UTILITIES
    // ════════════════════════════════════════════════════════════

    /**
     * Calculates the relative luminance of a color per WCAG 2.1.
     *
     * The sRGB values are linearized (gamma removed) before applying
     * the luminance weights (0.2126 R + 0.7152 G + 0.0722 B).
     *
     * @param {number} r - Red (0-255)
     * @param {number} g - Green (0-255)
     * @param {number} b - Blue (0-255)
     * @returns {number} Relative luminance (0.0 to 1.0)
     */
    function luminance(r, g, b) {
        const a = [r, g, b].map(v => {
            v /= 255;
            // Linearize sRGB: low values use simple division, high values use power curve
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }

    /**
     * Calculates the WCAG 2.1 contrast ratio between two colors.
     *
     * The ratio ranges from 1:1 (identical) to 21:1 (black vs white).
     * WCAG AA requires >= 4.5:1 for normal text, AAA requires >= 7:1.
     *
     * @param {{r: number, g: number, b: number}} rgb1 - First color
     * @param {{r: number, g: number, b: number}} rgb2 - Second color
     * @returns {number} Contrast ratio (1.0 to 21.0)
     */
    function contrastRatio(rgb1, rgb2) {
        const l1 = luminance(rgb1.r, rgb1.g, rgb1.b);
        const l2 = luminance(rgb2.r, rgb2.g, rgb2.b);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    /**
     * Determines if a color is perceptually "light" (suitable for dark text on top).
     * Uses the standard 0.179 luminance threshold.
     *
     * @param {number} r - Red (0-255)
     * @param {number} g - Green (0-255)
     * @param {number} b - Blue (0-255)
     * @returns {boolean} true if the color is light
     */
    function isLight(r, g, b) {
        return luminance(r, g, b) > 0.179;
    }

    // ════════════════════════════════════════════════════════════
    // COLOR STRING PARSING
    // ════════════════════════════════════════════════════════════

    /**
     * Parses a color string in any common CSS format and returns RGBA values.
     *
     * Supported formats:
     *   - HEX:  #RGB, #RRGGBB, #RRGGBBAA (with or without #)
     *   - RGB:  rgb(r, g, b)
     *   - RGBA: rgba(r, g, b, a)
     *   - HSL:  hsl(h, s%, l%)
     *   - HSLA: hsla(h, s%, l%, a)
     *
     * @param {string} str - Color string to parse
     * @returns {{r: number, g: number, b: number, a: number}|null} RGBA object or null if unparseable
     */
    function parseColor(str) {
        if (!str || typeof str !== 'string') return null;
        str = str.trim();

        // ── Try HEX format ──
        const hexMatch = str.match(/^#?([0-9A-Fa-f]{3,8})$/);
        if (hexMatch) {
            const hex = hexMatch[1];
            if (hex.length === 3 || hex.length === 6 || hex.length === 8 || hex.length === 4) {
                const result = hexToRgb(hex);
                return { r: result.r, g: result.g, b: result.b, a: result.a ?? 1 };
            }
        }

        // ── Try rgb() / rgba() format ──
        const rgbMatch = str.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/);
        if (rgbMatch) {
            return {
                r: clamp(parseInt(rgbMatch[1]), 0, 255),
                g: clamp(parseInt(rgbMatch[2]), 0, 255),
                b: clamp(parseInt(rgbMatch[3]), 0, 255),
                a: rgbMatch[4] !== undefined ? clamp(parseFloat(rgbMatch[4]), 0, 1) : 1
            };
        }

        // ── Try hsl() / hsla() format ──
        const hslMatch = str.match(/^hsla?\(\s*(\d{1,3})\s*,\s*(\d{1,3})%?\s*,\s*(\d{1,3})%?\s*(?:,\s*([\d.]+)\s*)?\)$/);
        if (hslMatch) {
            // Convert HSL to RGB first, then return as RGBA
            const rgb = hslToRgb(
                clamp(parseInt(hslMatch[1]), 0, 360),
                clamp(parseInt(hslMatch[2]), 0, 100),
                clamp(parseInt(hslMatch[3]), 0, 100)
            );
            return {
                r: rgb.r, g: rgb.g, b: rgb.b,
                a: hslMatch[4] !== undefined ? clamp(parseFloat(hslMatch[4]), 0, 1) : 1
            };
        }

        // No format matched
        return null;
    }

    // ════════════════════════════════════════════════════════════
    // PUBLIC API
    // ════════════════════════════════════════════════════════════

    return {
        // Conversions
        rgbToHex, rgbToHex8, hexToRgb,
        rgbToHsl, hslToRgb,
        rgbToHsb, hsbToRgb,
        // Formatting
        formatHex, formatHex8, formatRgb, formatRgba,
        formatHsl, formatHsla, formatHsb,
        // WCAG utilities
        contrastRatio, luminance, isLight,
        // General utilities
        clamp,
        // Parsing
        parseColor
    };
})();
