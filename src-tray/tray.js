/**
 * tray.js — System tray menu definition (reference / documentation).
 *
 * The actual tray is constructed in Rust (src-tauri/src/main.rs) using
 * Tauri's native tray API. This file describes the menu structure in JS
 * for documentation purposes and can be used if you migrate to a JS-driven
 * tray via the Tauri plugin-positioner or similar.
 *
 * Menu structure:
 *
 *   LegionIO               <- tray icon tooltip
 *   ┌──────────────────┐
 *   │ Show Dashboard   │   <- bring main window to front
 *   │ ──────────────── │
 *   │ Status: online   │   <- dynamic status item (updated via IPC)
 *   │ ──────────────── │
 *   │ Quit LegionIO    │   <- app.exit(0)
 *   └──────────────────┘
 */

const TrayMenu = {
  /**
   * Build the menu items array (for use with a JS-based tray library).
   * @param {{ status: string }} state
   * @returns {Array}
   */
  build(state = {}) {
    const status = state.status || 'unknown';
    const statusLabel = `Status: ${status}`;

    return [
      { id: 'show',   label: 'Show Dashboard', enabled: true },
      { type: 'separator' },
      { id: 'status', label: statusLabel,       enabled: false },
      { type: 'separator' },
      { id: 'quit',   label: 'Quit LegionIO',   enabled: true },
    ];
  },

  /**
   * Handle a menu item click.
   * In production this is wired up inside main.rs via on_menu_event.
   * This is provided for testing / alternative JS integrations.
   *
   * @param {string} id - Menu item id
   * @param {object} app - App handle (Tauri or mock)
   */
  handleClick(id, app) {
    switch (id) {
      case 'show':
        app.getWebviewWindow('main')?.show?.();
        break;
      case 'quit':
        app.exit?.(0);
        break;
      default:
        break;
    }
  },
};

if (typeof module !== 'undefined') {
  module.exports = TrayMenu;
}
