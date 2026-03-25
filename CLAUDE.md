# desktop: LegionIO Desktop App

**Repository Level 3 Documentation**
- **Parent**: `/Users/miverso2/rubymine/legion/CLAUDE.md`

## Purpose

Lightweight Tauri v2 desktop wrapper for LegionIO. Provides a system tray icon, dashboard UI with auto-refresh, and native notifications by connecting to the LegionIO REST API.

**GitHub**: https://github.com/LegionIO/desktop
**Version**: 0.1.0
**License**: MIT
**Stack**: Tauri v2, Rust backend, vanilla HTML/CSS/JS frontend

## Architecture

```
desktop/
├── package.json          # Node.js build config
├── src/                  # Frontend (HTML/CSS/JS, no framework)
│   ├── index.html        # Dashboard UI
│   ├── styles.css        # Dark theme (VS Code-style)
│   ├── app.js            # Dashboard logic, auto-refresh (10s)
│   └── api.js            # Tauri command wrappers (invoke)
├── src-tauri/            # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs       # App builder, system tray setup
│       └── lib.rs        # Tauri commands
└── src-tray/
    └── tray.js           # Tray menu reference definition
```

## Tauri Commands

| Command | Description |
|---------|-------------|
| `get_status` | GET `/api/health` — node health JSON |
| `get_tasks` | GET `/api/tasks` — task list JSON |
| `invoke_runner` | POST `/api/invoke` — invoke a runner method |
| `get_api_base` | Returns current API base URL |
| `set_api_base` | Updates API base URL (no restart needed) |

## Default API Endpoint

Connects to `http://localhost:9999` by default. Change at runtime via the gear icon or at build time in `src-tauri/src/lib.rs`.

## Development

```bash
npm install
npm run dev      # development with hot-reload
npm run build    # production build
```

## Prerequisites

- Rust 1.77+
- Node.js 18+
- Tauri CLI 2.x

---

**Maintained By**: Matthew Iverson (@Esity)
