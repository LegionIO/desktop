/**
 * api.js — Thin wrapper around Tauri invoke commands.
 *
 * All public methods return a Promise that resolves to an ApiResponse:
 *   { success: boolean, data: any, error: string|null }
 *
 * Falls back to fetch() when running outside Tauri (browser dev mode).
 */

const LegionAPI = (() => {
  // ----- Tauri detection ---------------------------------------------------

  function isTauri() {
    return typeof window !== 'undefined' &&
           typeof window.__TAURI__ !== 'undefined' &&
           typeof window.__TAURI__.core !== 'undefined';
  }

  // ----- Core invoke wrapper -----------------------------------------------

  /**
   * Invoke a Tauri command by name.
   * @param {string} cmd - Command name registered in lib.rs
   * @param {object} args - Arguments to pass
   * @returns {Promise<object>}
   */
  async function invoke(cmd, args = {}) {
    if (isTauri()) {
      return window.__TAURI__.core.invoke(cmd, args);
    }
    // Dev-mode fallback: proxy to Legion REST directly.
    return devFallback(cmd, args);
  }

  // ----- Dev-mode fallback (browser) ---------------------------------------

  const DEV_BASE = 'http://localhost:9999';

  async function devFallback(cmd, args) {
    try {
      switch (cmd) {
        case 'get_status': {
          const r = await fetch(`${DEV_BASE}/api/health`);
          const data = await r.json();
          return { success: true, data, error: null };
        }
        case 'get_tasks': {
          const r = await fetch(`${DEV_BASE}/api/tasks`);
          const data = await r.json();
          return { success: true, data, error: null };
        }
        case 'invoke_runner': {
          const { extension, runner, method, params } = args;
          const r = await fetch(`${DEV_BASE}/api/invoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ extension, runner, method, params }),
          });
          const data = await r.json();
          return { success: true, data, error: null };
        }
        case 'get_api_base':
          return { success: true, data: DEV_BASE, error: null };
        case 'set_api_base':
          return { success: true, data: null, error: null };
        default:
          return { success: false, data: null, error: `Unknown command: ${cmd}` };
      }
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  // ----- Public API --------------------------------------------------------

  /**
   * Fetch Legion node health.
   * @returns {Promise<{success, data, error}>}
   */
  function getStatus() {
    return invoke('get_status');
  }

  /**
   * Fetch the current task list.
   * @returns {Promise<{success, data, error}>}
   */
  function getTasks() {
    return invoke('get_tasks');
  }

  /**
   * Invoke a runner method.
   * @param {string} extension
   * @param {string} runner
   * @param {string} method
   * @param {object} [params={}]
   * @returns {Promise<{success, data, error}>}
   */
  function invokeRunner(extension, runner, method, params = {}) {
    return invoke('invoke_runner', { extension, runner, method, params });
  }

  /**
   * Get the configured API base URL.
   * @returns {Promise<string>}
   */
  async function getApiBase() {
    const resp = await invoke('get_api_base');
    return resp.success ? resp.data : 'http://localhost:9999';
  }

  /**
   * Update the API base URL (takes effect immediately, no restart).
   * @param {string} url
   * @returns {Promise<void>}
   */
  function setApiBase(url) {
    return invoke('set_api_base', { url });
  }

  return { getStatus, getTasks, invokeRunner, getApiBase, setApiBase };
})();
