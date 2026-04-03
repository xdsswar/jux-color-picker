package com.xss.it.jux.color.picker;

import xss.it.jux.ui.dialog.FileDialogBuilder;
import xss.it.jux.ui.gui.Window;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

/**
 * Handles file I/O for palette import and export operations.
 *
 * <p>Uses the Jux {@link FileDialogBuilder} to present native OS file
 * dialogs (open/save). All methods are designed to run on virtual threads
 * (as required by IPC command handlers) and are safe to block.</p>
 *
 * <h3>File format</h3>
 * <p>Palette files are JSON with the structure:
 * {@code { name, version, created, colors: [{hex, rgb, hsl}], history: [...] }}</p>
 */
public final class PaletteFileHandler {

    /** Prevent instantiation — utility class. */
    private PaletteFileHandler() {}

    /**
     * Opens a native "Save File" dialog and writes JSON data to the chosen path.
     *
     * <p>The dialog is modal to the given window and filtered to show only
     * {@code .json} files. If the user cancels, this method returns
     * {@link Optional#empty()}.</p>
     *
     * @param window the owner window for the modal dialog
     * @param json   the JSON string to write to the file
     * @return the path where the file was saved, or empty if cancelled
     * @throws IOException if writing to the file fails
     */
    public static Optional<Path> exportToFile(Window window, String json) throws IOException {
        Optional<Path> path = new FileDialogBuilder()
                .owner(window)
                .title("Export Palette")
                .addFilter("JSON Files", "json")
                .saveFile();

        if (path.isPresent()) {
            Files.writeString(path.get(), json, StandardCharsets.UTF_8);
        }
        return path;
    }

    /**
     * Opens a native "Open File" dialog and reads the selected file's content.
     *
     * <p>The dialog is modal to the given window and shows both JSON files
     * and all files as filter options. If the user cancels, this method
     * returns {@link Optional#empty()}.</p>
     *
     * @param window the owner window for the modal dialog
     * @return the file content as a string, or empty if cancelled
     * @throws IOException if reading the file fails
     */
    public static Optional<String> importFromFile(Window window) throws IOException {
        Optional<Path> path = new FileDialogBuilder()
                .owner(window)
                .title("Import Palette")
                .addFilter("JSON Files", "json")
                .addFilter("All Files", "*")
                .openFile();

        if (path.isPresent()) {
            return Optional.of(Files.readString(path.get(), StandardCharsets.UTF_8));
        }
        return Optional.empty();
    }
}
