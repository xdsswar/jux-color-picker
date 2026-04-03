package com.xss.it.jux.color.picker;

import xss.it.jux.dom.Document;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Loads JavaScript modules from classpath resources and injects them
 * into the webview document.
 *
 * <p>All JS sources are read at class-load time (static fields) so that
 * I/O happens only once and missing resources are caught early with a
 * fail-fast error. The scripts are then injected into the live document
 * via {@link Document#executeScript(String)} when
 * {@link #injectAll(Document)} is called.</p>
 *
 * <h3>Injection order (dependency chain)</h3>
 * <ol>
 *   <li>{@code color-engine.js}    — Pure color math (no DOM). Depended on by all others.</li>
 *   <li>{@code color-picker.js}    — Main picker UI: canvases, sliders, formats, shortcuts.</li>
 *   <li>{@code color-history.js}   — History swatch grid, IPC persistence.</li>
 *   <li>{@code palette-manager.js} — Built-in palettes, custom palette, import/export.</li>
 *   <li>{@code theme-manager.js}   — Dark/light theme toggle with smooth transitions.</li>
 *   <li>{@code clipboard.js}       — Copy-to-clipboard with flash animation and toast.</li>
 * </ol>
 *
 * <p>Each module self-initializes by calling its own {@code init()} at the
 * bottom of the script, so no additional bootstrap is needed after injection.</p>
 */
public final class ScriptInjector {

    // ════════════════════════════════════════════════════════════
    // STATIC JS MODULE SOURCES
    // Read once at class initialization from classpath resources.
    // ════════════════════════════════════════════════════════════

    /** Color conversion engine — pure math, no DOM. Must load first. */
    private static final String COLOR_ENGINE_JS = loadResource("/web/js/color-engine.js");

    /** Main picker logic — canvases, sliders, keyboard shortcuts, menus. */
    private static final String COLOR_PICKER_JS = loadResource("/web/js/color-picker.js");

    /** Color history — swatch grid, IPC persistence, right-click context menu. */
    private static final String COLOR_HISTORY_JS = loadResource("/web/js/color-history.js");

    /** Palette manager — built-in palettes, custom palette, import/export. */
    private static final String PALETTE_MANAGER_JS = loadResource("/web/js/palette-manager.js");

    /** Theme manager — dark/light toggle with smooth CSS transitions. */
    private static final String THEME_MANAGER_JS = loadResource("/web/js/theme-manager.js");

    /** Clipboard manager — copy-to-clipboard with flash animation and toast. */
    private static final String CLIPBOARD_JS = loadResource("/web/js/clipboard.js");

    /** Preferences — font family, mono font, and font size settings dialog. */
    private static final String PREFERENCES_JS = loadResource("/web/js/preferences.js");

    /** Eyedropper — screen color picker with live magnifier overlay. */
    private static final String EYEDROPPER_JS = loadResource("/web/js/eyedropper.js");

    /** Prevent instantiation — utility class. */
    private ScriptInjector() {}

    /**
     * Injects all JavaScript modules into the given document in dependency order.
     *
     * <p>Should be called once, from the {@code DOCUMENT_READY} event handler,
     * after the HTML page has been fully loaded by the webview.</p>
     *
     * @param document the webview document proxy to inject scripts into
     */
    public static void injectAll(Document document) {
        // 1. Engine (pure math) — depended on by everything else
        document.executeScript(COLOR_ENGINE_JS);
        // 2. Picker logic — uses Engine, sets up canvases and sliders
        document.executeScript(COLOR_PICKER_JS);
        // 3. History — uses Engine + Picker for swatch click handling
        document.executeScript(COLOR_HISTORY_JS);
        // 4. Palette — uses Engine + Picker + ClipboardManager
        document.executeScript(PALETTE_MANAGER_JS);
        // 4b. Push saved imported palettes into PaletteManager
        String savedPalettes = PaletteStore.getPalettes();
        if (savedPalettes != null && !savedPalettes.equals("{}")) {
            String escaped = savedPalettes.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "");
            document.executeScript("PaletteManager._loadImported('" + escaped + "');");
        }
        // 5. Theme — standalone, but loaded after picker to avoid flash
        document.executeScript(THEME_MANAGER_JS);
        // 6. Clipboard — copy utility and toast notifications
        document.executeScript(CLIPBOARD_JS);
        // 7. Preferences — font settings dialog, applies saved settings on init
        document.executeScript(PREFERENCES_JS);
        // 8. Eyedropper — screen color picker with live magnifier
        document.executeScript(EYEDROPPER_JS);
    }

    /**
     * Reads a text resource from the classpath and returns it as a UTF-8 string.
     *
     * <p>Uses an absolute classpath path (leading {@code /}) so the resource
     * is resolved from the root of the module's classpath. Fails fast during
     * class loading if the resource is missing.</p>
     *
     * @param path absolute classpath path (e.g. {@code "/web/js/color-engine.js"})
     * @return the resource content as a UTF-8 string
     * @throws ExceptionInInitializerError if the resource is not found or cannot be read
     */
    private static String loadResource(String path) {
        try (InputStream in = ScriptInjector.class.getResourceAsStream(path)) {
            if (in == null) {
                throw new IllegalStateException("Classpath resource not found: " + path);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new ExceptionInInitializerError(e);
        }
    }
}
