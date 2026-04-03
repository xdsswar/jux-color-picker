package com.xss.it.jux.color.picker;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Persistence layer for imported palettes using a JSON file in the user's app data directory.
 *
 * <p>The palettes file is stored alongside history at:
 * {@code <app-dir>/palettes.json}</p>
 *
 * <p>The file contains a JSON object keyed by palette key, each value
 * holding colors and label: {@code {"imported:my-palette":{"colors":["#hex",...],"label":"My Palette"}}}</p>
 */
public final class PaletteStore {

    private static final Path APP_DIR = resolveAppDir();

    private static Path resolveAppDir() {
        String os = System.getProperty("os.name", "").toLowerCase();
        String home = System.getProperty("user.home");

        if (os.contains("win")) {
            String appData = System.getenv("APPDATA");
            if (appData != null) return Path.of(appData, "jux-color-picker");
        } else if (os.contains("mac")) {
            return Path.of(home, "Library", "Application Support", "jux-color-picker");
        }
        return Path.of(home, ".local", "share", "jux-color-picker");
    }

    private static final Path PALETTES_FILE = APP_DIR.resolve("palettes.json");

    private static final String EMPTY = "{}";

    private PaletteStore() {}

    /**
     * Retrieves saved imported palettes as a JSON object string.
     *
     * @return JSON object string of imported palettes
     */
    public static String getPalettes() {
        try {
            if (Files.exists(PALETTES_FILE)) {
                return Files.readString(PALETTES_FILE, StandardCharsets.UTF_8);
            }
        } catch (IOException e) {
            System.err.println("Failed to read palettes file: " + e.getMessage());
        }
        return EMPTY;
    }

    /**
     * Saves imported palettes JSON string to file.
     *
     * @param json JSON object string of imported palettes
     */
    public static void savePalettes(String json) {
        try {
            Files.createDirectories(APP_DIR);
            Files.writeString(PALETTES_FILE, json, StandardCharsets.UTF_8);
        } catch (IOException e) {
            System.err.println("Failed to save palettes file: " + e.getMessage());
        }
    }
}
