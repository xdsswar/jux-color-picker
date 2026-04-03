package com.xss.it.jux.color.picker;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Persistence layer for color history using a JSON file in the user's home directory.
 *
 * <p>The history file is stored at:
 * {@code ~/.jux-color-picker/history.json}</p>
 *
 * <p>The file contains a JSON array of uppercase hex strings:
 * {@code ["#6366F1", "#EF4444", "#22C55E"]}</p>
 */
public final class HistoryStore {

    /**
     * App data directory — uses the OS-standard writable user location:
     *   Windows: %APPDATA%\jux-color-picker  (e.g. C:\Users\X\AppData\Roaming\jux-color-picker)
     *   macOS:   ~/Library/Application Support/jux-color-picker
     *   Linux:   ~/.local/share/jux-color-picker
     * No admin rights required.
     */
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
        // Linux / fallback
        return Path.of(home, ".local", "share", "jux-color-picker");
    }

    /** The history JSON file. */
    private static final Path HISTORY_FILE = APP_DIR.resolve("history.json");

    /** Default value when no history file exists. */
    private static final String EMPTY_HISTORY = "[]";

    private HistoryStore() {}

    /**
     * Retrieves the saved color history as a JSON array string.
     * Returns {@code "[]"} if the file does not exist or cannot be read.
     *
     * @return JSON array string of hex colors
     */
    public static String getHistory() {
        try {
            if (Files.exists(HISTORY_FILE)) {
                return Files.readString(HISTORY_FILE, StandardCharsets.UTF_8);
            }
        } catch (IOException e) {
            System.err.println("Failed to read history file: " + e.getMessage());
        }
        return EMPTY_HISTORY;
    }

    /**
     * Saves the color history JSON string to the history file.
     * Creates the app directory if it does not exist.
     *
     * @param json JSON array string of hex colors
     */
    public static void saveHistory(String json) {
        try {
            Files.createDirectories(APP_DIR);
            Files.writeString(HISTORY_FILE, json, StandardCharsets.UTF_8);
        } catch (IOException e) {
            System.err.println("Failed to save history file: " + e.getMessage());
        }
    }
}
