package com.xss.it.jux.color.picker;

import xss.it.jux.dom.Document;
import xss.it.jux.robot.Color;
import xss.it.jux.robot.MouseCaptureBox;
import xss.it.jux.robot.MousePosition;
import xss.it.jux.robot.Robot;
import xss.it.jux.ui.gui.Window;
import xss.it.jux.ui.ipc.IpcResponse;

import java.util.Map;

/**
 * Screen color picker using jux-robot.
 *
 * <p>Supports two modes:</p>
 * <ul>
 *   <li><b>Magnifier mode</b> (eyedropper button): replaces the SB canvas
 *       with a live zoomed feed from {@link MouseCaptureBox}. Clicking the
 *       magnifier picks the color.</li>
 *   <li><b>Quick pick</b> (Alt+X): instantly captures the pixel color at the
 *       current cursor position and returns it.</li>
 * </ul>
 *
 * <p>IPC commands:</p>
 * <ul>
 *   <li>{@code eyedropper-start} — begins the magnifier capture loop</li>
 *   <li>{@code eyedropper-stop}  — stops the magnifier capture loop</li>
 *   <li>{@code eyedropper-pick}  — instant pick at cursor position</li>
 * </ul>
 */
public final class EyeDropperTool {

    /** Active capture box (null when idle). */
    private static volatile MouseCaptureBox activeBox;

    private EyeDropperTool() {}

    /**
     * Starts the live magnifier capture loop.
     *
     * <p>On each frame the captured region (centered on the cursor) and
     * the pixel color under the cursor are pushed to the JS frontend
     * via {@code EyeDropper._onFrame(...)}.</p>
     *
     * @param window the application window (used to access the document)
     * @return IPC response confirming start or reporting an error
     */
    public static IpcResponse start(Window window) {
        // Prevent double-start
        if (activeBox != null && activeBox.isRunning()) {
            return IpcResponse.ok("already running");
        }

        try {
            Robot robot = Robot.create();

            MouseCaptureBox box = MouseCaptureBox.builder()
                    .captureSize(80, 80)
                    .frameRate(24)
                    .build();
            activeBox = box;

            Document doc = window.getDocument();

            box.start(robot, (frame, error) -> {
                if (frame != null && frame.centerColor() != null) {
                    Color c = frame.centerColor();
                    String base64 = frame.toBase64Png();
                    String hex = c.toHexRgb();

                    // Push the frame to JS — single-quoted base64 is safe
                    // (base64 contains only [A-Za-z0-9+/=])
                    doc.executeScript(
                            "if(window.EyeDropper&&EyeDropper._onFrame)EyeDropper._onFrame('"
                                    + base64 + "',"
                                    + c.red() + ","
                                    + c.green() + ","
                                    + c.blue() + ",'"
                                    + hex + "',"
                                    + frame.width() + ","
                                    + frame.height() + ")"
                    );
                }
            });

            return IpcResponse.ok("started");

        } catch (Exception e) {
            return IpcResponse.error(e.getMessage() != null ? e.getMessage() : "start failed");
        }
    }

    /**
     * Stops the live magnifier capture loop.
     *
     * @param window unused but kept for symmetry with {@link #start}
     * @return IPC response confirming stop
     */
    public static IpcResponse stop(Window window) {
        MouseCaptureBox box = activeBox;
        if (box != null) {
            box.stop();
            activeBox = null;
        }
        return IpcResponse.ok("stopped");
    }

    /**
     * Instantly picks the pixel color at the current cursor position.
     *
     * <p>Used by the Alt+X shortcut for a quick one-shot pick without
     * the magnifier UI.</p>
     *
     * @return IPC response containing r, g, b, hex fields
     */
    public static IpcResponse quickPick() {
        try {
            Robot robot = Robot.create();
            MousePosition pos = robot.mousePosition();
            Color c = robot.pixelColor(pos.x(), pos.y());
            return IpcResponse.ok(Map.of(
                    "r", c.red(),
                    "g", c.green(),
                    "b", c.blue(),
                    "hex", c.toHexRgb()
            ));
        } catch (Exception e) {
            return IpcResponse.error(e.getMessage() != null ? e.getMessage() : "pick failed");
        }
    }
}
