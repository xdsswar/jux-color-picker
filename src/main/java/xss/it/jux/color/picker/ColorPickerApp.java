package xss.it.jux.color.picker;

import com.xss.it.jux.color.picker.IpcCommandRegistry;
import com.xss.it.jux.color.picker.ScriptInjector;
import com.xss.it.jux.color.picker.WindowConfigurator;
import xss.it.jux.robot.GlobalHotkey;
import xss.it.jux.robot.KeyCode;
import xss.it.jux.robot.Modifier;
import xss.it.jux.ui.Application;
import xss.it.jux.ui.Platform;
import xss.it.jux.ui.gui.Window;
import xss.it.jux.ui.gui.events.WindowEvent;

/**
 * Entry point for the Jux Color Picker application.
 *
 * <p>This class is intentionally lean — it orchestrates the startup
 * lifecycle by delegating to specialized internal classes:</p>
 * <ul>
 *   <li>{@link WindowConfigurator} — window size, chrome, and controls</li>
 *   <li>{@link IpcCommandRegistry} — IPC command handler registration</li>
 *   <li>{@link ScriptInjector}     — JavaScript module loading and injection</li>
 * </ul>
 *
 * <h3>Startup sequence</h3>
 * <ol>
 *   <li>Configure window properties (size, chrome, controls)</li>
 *   <li>Register all IPC command handlers</li>
 *   <li>Register a DOCUMENT_READY handler for JS injection</li>
 *   <li>Load web resources from classpath and initialize webview</li>
 *   <li>Center and show the window</li>
 * </ol>
 *
 * <h3>Resource loading</h3>
 * <p>{@code window.loadResources()} extracts the {@code /web/} classpath
 * directory to disk and loads {@code index.html} as the entry page.
 * Once the document is ready, all JS modules are injected in dependency
 * order via {@link ScriptInjector}.</p>
 */
public class ColorPickerApp extends Application<Window> {

    /**
     * Called by the Jux framework on the main UI thread after the native
     * window has been created. Configures, initializes, and shows the window.
     *
     * @param window the primary application window provided by the framework
     */
    @Override
    public void start(Window window) {
        // Step 1: Configure window properties and custom chrome
        WindowConfigurator.configure(window);

        // Step 2: Register all IPC command handlers
        // Done before loadResources so handlers are ready when JS initializes
        IpcCommandRegistry.registerAll(window, getHostServices());

        // Step 3: When the HTML document has finished loading, inject all
        // JavaScript modules in the correct dependency order
        window.addEventHandler(WindowEvent.DOCUMENT_READY, event -> {
           if (!event.isMainFrame()){
               return;
           }
            // Disable default browser context menu (we use custom menus)
            window.setDefaultContextMenuEnabled(false);
            window.setBrowserAcceleratorKeysEnabled(false);

            // Inject all JS modules into the live document
            ScriptInjector.injectAll(window.getDocument());
            window.requestFocus();

        });

        // Step 4: Extract web resources from classpath /web/ to disk
        // and load index.html as the entry page in the webview.
        // The "color-picker" name is used as the resource directory identifier.
        window.loadResources("color-picker", "/web", "index.html");

        // Step 5: Center on screen, show, and request focus
        window.center();
        window.show();

        // Step 6: Register Alt+X as a global hotkey for instant color pick.
        // The callback runs on a virtual thread, so we use executeScript
        // to invoke the JS-side quick pick which handles the IPC call.
        GlobalHotkey.register(KeyCode.X, () -> Platform.runLater(() -> {
            window.getDocument().executeScript(
                    "if(window.EyeDropper)EyeDropper.quickPick()"
            );
        }), Modifier.ALT);
    }

    /**
     * Exit
     */
    @Override
    public void stop() {
        GlobalHotkey.shutdownAll();
    }

    /**
     * Standard Java entry point. Delegates to {@link Application#launch(String...)}
     * which handles native library loading, Application instantiation, and
     * event loop startup.
     *
     * @param args command-line arguments (forwarded to the framework)
     */
    static void main(String[] args) {
        launch(args);
    }
}
