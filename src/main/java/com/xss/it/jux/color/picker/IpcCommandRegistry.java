package com.xss.it.jux.color.picker;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import xss.it.jux.ui.HostServices;
import xss.it.jux.ui.gui.Window;
import xss.it.jux.ui.ipc.IpcResponse;

import java.util.Optional;
import java.nio.file.Path;

/**
 * Registers all IPC command handlers that bridge the JavaScript frontend
 * with Java-side operations.
 *
 * <p>This class serves as the single registration point for all command
 * handlers. Each handler runs on a virtual thread (guaranteed by the
 * framework), so blocking I/O operations are safe and encouraged.</p>
 *
 * <h3>Registered commands</h3>
 * <table>
 *   <tr><th>Command</th><th>Direction</th><th>Description</th></tr>
 *   <tr><td>{@code export-palette}</td><td>JS → Java</td><td>Save palette JSON to a user-chosen file</td></tr>
 *   <tr><td>{@code import-palette}</td><td>JS → Java</td><td>Read palette JSON from a user-chosen file</td></tr>
 *   <tr><td>{@code get-history}</td><td>JS → Java</td><td>Retrieve persisted color history</td></tr>
 *   <tr><td>{@code save-history}</td><td>JS → Java</td><td>Persist color history</td></tr>
 * </table>
 *
 * @see PaletteFileHandler  Handles the native file dialog and I/O for palettes
 * @see HistoryStore         Handles Preferences-based history persistence
 */
public final class IpcCommandRegistry {

    /** Prevent instantiation — utility class. */
    private IpcCommandRegistry() {}

    /**
     * Registers all IPC command handlers on the given window.
     *
     * <p>Should be called after {@code window.initWebView()} but before
     * {@code window.show()}, so that all handlers are ready when the
     * JavaScript modules initialize and start invoking commands.</p>
     *
     * @param window the application window to register commands on
     */
    public static void registerAll(Window window, HostServices hostServices) {
        registerExportPalette(window);
        registerImportPalette(window);
        registerSavePalettes(window);
        registerGetHistory(window);
        registerSaveHistory(window);
        registerEyeDropper(window);
        registerOpenUrl(window, hostServices);
    }

    private static void registerEyeDropper(Window window) {
        window.command("eyedropper-start", msg -> EyeDropperTool.start(window));
        window.command("eyedropper-stop", msg -> EyeDropperTool.stop(window));
        window.command("eyedropper-pick", msg -> EyeDropperTool.quickPick());
    }

    private static void registerOpenUrl(Window window, HostServices hostServices) {
        window.command("open-url", msg -> {
            String url = msg.getString("url");
            if (url.startsWith("https://") || url.startsWith("http://")) {
                hostServices.showDocument(url);
                return IpcResponse.ok("opened");
            }
            return IpcResponse.error("invalid url");
        });
    }

    // ════════════════════════════════════════════════════════════
    // PALETTE COMMANDS
    // ════════════════════════════════════════════════════════════

    /**
     * Registers the "export-palette" command.
     *
     * <p>Receives a JSON string from the JS frontend, opens a native
     * "Save File" dialog via {@link PaletteFileHandler}, and writes
     * the JSON to the selected file.</p>
     * window the window to register the command on
     * Shared Jackson mapper for pretty-printing JSON exports. */
    private static final ObjectMapper PRETTY_MAPPER = new ObjectMapper()
            .enable(SerializationFeature.INDENT_OUTPUT);

    private static void registerExportPalette(Window window) {
        window.command("export-palette", msg -> {
            // Parse the raw JSON object and re-serialize with pretty indentation (2-space)
            JsonNode tree = PRETTY_MAPPER.readTree(msg.rawJson());
            String json = PRETTY_MAPPER.writeValueAsString(tree);
            Optional<Path> saved = PaletteFileHandler.exportToFile(window, json);
            return saved.isPresent()
                    ? IpcResponse.ok("saved")
                    : IpcResponse.error("cancelled");
        });
    }

    /**
     * Registers the "import-palette" command.
     *
     * <p>Opens a native "Open File" dialog via {@link PaletteFileHandler},
     * reads the selected JSON file, and returns its raw content to the
     * JS frontend for parsing.</p>
     *
     * @param window the window to register the command on
     */
    private static void registerImportPalette(Window window) {
        window.command("import-palette", msg -> {
            try {
                Optional<String> json = PaletteFileHandler.importFromFile(window);
                if (json.isPresent()) {
                    ObjectMapper mapper = new ObjectMapper();
                    JsonNode tree = mapper.readTree(json.get());
                    String compact = mapper.writeValueAsString(tree);

                    // Also persist on the Java side so it survives restart
                    String name = tree.has("name") ? tree.get("name").asText("Imported") : "Imported";
                    String key = "imported:" + name.toLowerCase().replaceAll("[^a-z0-9]", "-");
                    // Read existing palettes, merge the new one, save
                    String existing = PaletteStore.getPalettes();
                    JsonNode existingNode = mapper.readTree(existing);
                    var merged = existingNode.isObject()
                            ? (com.fasterxml.jackson.databind.node.ObjectNode) existingNode
                            : mapper.createObjectNode();

                    // Build the entry: {"colors":["#hex",...],"label":"Name"}
                    var entry = mapper.createObjectNode();
                    var colorsArray = mapper.createArrayNode();
                    if (tree.has("colors")) {
                        for (JsonNode c : tree.get("colors")) {
                            if (c.has("hex")) colorsArray.add(c.get("hex").asText());
                            else if (c.isTextual()) colorsArray.add(c.asText());
                        }
                    }
                    entry.set("colors", colorsArray);
                    entry.put("label", name);
                    merged.set(key, entry);
                    PaletteStore.savePalettes(mapper.writeValueAsString(merged));

                    // Push to JS
                    String escaped = compact.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "");
                    window.getDocument().executeScript("PaletteManager._handleImport('" + escaped + "');");
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
            return IpcResponse.ok("ok");
        });
    }

    // ════════════════════════════════════════════════════════════
    // PALETTE PERSISTENCE COMMANDS
    // ════════════════════════════════════════════════════════════

    private static void registerSavePalettes(Window window) {
        window.command("save-palettes", msg -> {
            String json = msg.as(String.class);
            PaletteStore.savePalettes(json);
            return IpcResponse.ok("saved");
        });
    }

    // ════════════════════════════════════════════════════════════
    // HISTORY COMMANDS
    // ════════════════════════════════════════════════════════════

    /**
     * Registers the "get-history" command.
     *
     * <p>Returns the persisted color history as a raw JSON array string.
     * Called by the JS frontend on initialization to restore the
     * previous session's history.</p>
     *
     * @param window the window to register the command on
     */
    private static void registerGetHistory(Window window) {
        window.command("get-history", msg ->
                IpcResponse.Ok.raw(HistoryStore.getHistory())
        );
    }

    /**
     * Registers the "save-history" command.
     *
     * <p>Receives the color history as a JSON array string from the JS
     * frontend and persists it via {@link HistoryStore}. Called whenever
     * the history changes (color added, removed, or cleared).</p>
     *
     * @param window the window to register the command on
     */
    private static void registerSaveHistory(Window window) {
        window.command("save-history", msg -> {
            // JS sends JSON.stringify(hexArray) — a string payload.
            // as(String.class) deserializes the JSON string back to the original array string.
            String colors = msg.as(String.class);
            HistoryStore.saveHistory(colors);
            return IpcResponse.ok("saved");
        });
    }
}
