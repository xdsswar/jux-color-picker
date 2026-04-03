package com.xss.it.jux.color.picker;

import xss.it.jux.ui.gui.Image;
import xss.it.jux.ui.gui.Window;

/**
 * Configures the application window properties and custom chrome.
 *
 * <p>Encapsulates all window setup logic in one place so that the
 * Application class stays lean and focused on lifecycle orchestration.
 * All values are defined as constants for easy adjustment.</p>
 *
 * <h3>Window specification</h3>
 * <ul>
 *   <li>Fixed size: 520 × 720 px (not resizable)</li>
 *   <li>No native decorations (custom chrome)</li>
 *   <li>Custom titlebar at 44px height</li>
 *   <li>Minimize and close buttons only (no maximize)</li>
 *   <li>Centered on screen at launch</li>
 * </ul>
 */
public final class WindowConfigurator {

    // ── Window Dimensions ──
    private static final int WINDOW_WIDTH = 500;
    private static final int WINDOW_HEIGHT = 760;

    // ── Application Icon ──
    private static final String ICON_PATH = "/web/icon.png";

    // ── Custom Chrome ──
    private static final int TITLEBAR_HEIGHT = 44;
    private static final String DRAG_ELEMENT_ID = "titlebar";
    private static final String MINIMIZE_ELEMENT_ID = "btn-minimize";
    private static final String CLOSE_ELEMENT_ID = "btn-close";

    /** Prevent instantiation — utility class. */
    private WindowConfigurator() {}

    /**
     * Applies all window configuration settings.
     *
     * <p>Sets the window title, size, resizability, and decorations.
     * Configures custom chrome with a drag region, minimize button, and
     * close button. Intentionally omits {@code setMaximizeControl} so
     * the window cannot be maximized.</p>
     *
     * @param window the application window to configure
     */
    public static void configure(Window window) {
        // ── Basic Properties ──
        window.setTitle("Color Picker");
        window.setSize(WINDOW_WIDTH, WINDOW_HEIGHT);
        window.setResizable(false);     // Fixed window size
        window.setMaximizable(false);   // Prevent maximize on double-click titlebar
        window.setDecorated(false);     // Remove native title bar and borders

        // ── Application Icon ──
        // Sets the taskbar/dock icon from a classpath PNG resource
        window.setIcon(Image.of(ICON_PATH));

        // ── Custom Chrome ──
        // Enables the framework's custom titlebar support, which intercepts
        // native hit-testing for drag, minimize, and close regions.
        window.setCustomChrome(true);
        window.setTitleBarHeight(TITLEBAR_HEIGHT);

        // Map HTML element IDs to window control actions.
        // The framework listens for clicks on these elements and performs
        // the corresponding native window operation.
        window.setDragControl(DRAG_ELEMENT_ID);
        window.setMinimizeControl(MINIMIZE_ELEMENT_ID);
        // NOTE: No setMaximizeControl — window is intentionally not maximizable
        window.setCloseControl(CLOSE_ELEMENT_ID);
    }
}
