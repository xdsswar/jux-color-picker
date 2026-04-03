<p align="center">
  <img src="icon.png" alt="Jux Color Picker" width="128" height="128" />
</p>

<h1 align="center">Jux Color Picker</h1>

<p align="center">
  <strong>A modern, professional color picker for Windows.</strong><br/>
  Built with the <a href="https://github.com/xdsswar/jux-toolkit">Jux Toolkit</a> framework.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Windows Only" />
  <img src="https://img.shields.io/badge/java-25-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white" alt="Java 25" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License" />
</p>

---

> **WINDOWS ONLY** - This application uses native Windows APIs through Jux Toolkit's webview engine and robot module. It does not run on macOS or Linux.

---

## Features

- **Live Magnifier Eyedropper** - Click the eyedropper button to activate a real-time zoomed pixel view with crosshair. Click to pick. Alt+X for instant pick at cursor.
- **Multiple Color Formats** - HEX, RGB, RGBA, HSL, HSB with tab switching and direct input editing.
- **Saturation-Brightness Canvas** - Full 2D color plane with hue and alpha strips.
- **Color History** - Tracks your last 30 picked colors with persistent storage across sessions.
- **Palette Presets** - Material, Tailwind, Pastel, Earth Tones, Neon, and Custom palettes.
- **Import / Export** - Save and load palettes as JSON files.
- **Dark & Light Themes** - Smooth animated theme toggle (Ctrl+T).
- **Custom Titlebar** - Clean, minimal window chrome with no native decorations.
- **Keyboard Shortcuts** - Full keyboard workflow for power users.
- **Font Preferences** - Configurable UI and mono fonts with adjustable size.

## Screenshots

> *Coming soon*

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+X` | Instant color pick at cursor position |
| `Ctrl+T` | Toggle dark/light theme |
| `Ctrl+C` | Copy current color value |
| `Ctrl+I` | Import palette |
| `Ctrl+E` | Export palette |
| `Ctrl+J` | Copy current color as JSON |
| `Escape` | Close menus / cancel eyedropper |

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Java 25 |
| Build | Gradle 9.1.0 (Groovy DSL) |
| Framework | [Jux Toolkit](https://github.com/xdsswar/jux-toolkit) (jux-base, jux-core, jux-dom, jux-ui, jux-net, jux-robot) |
| Styling | Tailwind CSS (bundled) |
| Icons | Font Awesome 6 (bundled) |
| Fonts | Inter (UI), JetBrains Mono (code/values) |

## Requirements

- **Windows 10/11** (64-bit)
- **Java 25** or later (with `--enable-preview`)

## Building from Source

```bash
# Clone the repository
git clone https://github.com/xdsswar/jux-color-picker.git
cd jux-color-picker

# Run the application
./gradlew run

# Build a native installer (requires JDK 25 with jpackage)
./gradlew jpackage
```

## Project Structure

```
jux-color-picker/
├── libs/                          # Jux Toolkit JARs
├── src/main/
│   ├── java/
│   │   ├── xss/it/jux/color/picker/
│   │   │   └── ColorPickerApp.java        # Entry point
│   │   └── com/xss/it/jux/color/picker/
│   │       ├── WindowConfigurator.java     # Window setup
│   │       ├── IpcCommandRegistry.java     # IPC command handlers
│   │       ├── ScriptInjector.java         # JS module loading
│   │       ├── EyeDropperTool.java         # Screen color picker
│   │       ├── PaletteFileHandler.java     # File dialog I/O
│   │       └── HistoryStore.java           # Persistent history
│   └── resources/web/
│       ├── index.html                      # Main UI shell
│       ├── css/                            # Tailwind + app theme
│       └── js/                             # Color engine, picker, history, etc.
└── build.gradle
```

## License

MIT License. Free and open source for everyone. See [LICENSE](LICENSE) for details.

Copyright &copy; 2026 **XTREME SOFTWARE SOLUTIONS (XSS&IT)**.
