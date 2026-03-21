# LegionIO Desktop

A lightweight Tauri v2 desktop wrapper for LegionIO that provides:

- **System tray icon** — left-click to show/hide, right-click for menu
- **Dashboard UI** — status summary, task table, quick invoke form
- **Auto-refresh** — polls the Legion REST API every 10 seconds
- **Dark theme** — VS Code-style dark UI with monospace fonts

## Requirements

| Tool | Minimum version |
|------|----------------|
| Rust | 1.77 |
| Node.js | 18 |
| Tauri CLI | 2.x |

Install Tauri prerequisites: https://v2.tauri.app/start/prerequisites/

## Quick Start

```bash
npm install
npm run dev        # development mode with hot-reload
npm run build      # production build
```

## Configuration

By default the app connects to `http://localhost:9999` (the Legion REST API default port).

To change the API URL at runtime: click the gear icon in the header and update the URL.

To set a different default, edit `src-tauri/src/lib.rs`:

```rust
api_base: "http://your-legion-host:9999".to_string(),
```

## Structure

```
desktop/
├── src/                  # Frontend (HTML/CSS/JS — no framework)
│   ├── index.html        # Dashboard UI
│   ├── styles.css        # Dark theme
│   ├── app.js            # Dashboard logic
│   └── api.js            # Tauri command wrappers
├── src-tauri/            # Rust backend
│   ├── src/
│   │   ├── main.rs       # App builder, tray setup
│   │   └── lib.rs        # Tauri commands (get_status, get_tasks, invoke_runner)
│   ├── Cargo.toml
│   └── tauri.conf.json
└── src-tray/
    └── tray.js           # Tray menu reference definition
```

## Tauri Commands

| Command | Description |
|---------|-------------|
| `get_status` | GET `/api/health` — returns node health JSON |
| `get_tasks` | GET `/api/tasks` — returns task list JSON |
| `invoke_runner` | POST `/api/invoke` — invokes a runner method |
| `get_api_base` | Returns current API base URL |
| `set_api_base` | Updates API base URL (no restart needed) |

## License

MIT — see [LICENSE](LICENSE)
