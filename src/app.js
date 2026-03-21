/**
 * app.js — LegionIO Dashboard logic.
 *
 * Responsibilities:
 *  - Fetch + render node status and summary bar
 *  - Fetch + render task table
 *  - Handle quick-invoke form
 *  - Auto-refresh every 10 seconds
 *  - Settings panel (API URL)
 *
 * Security: All user-visible strings are passed through escHtml() before
 * being interpolated into HTML. No raw untrusted content is ever set via
 * innerHTML without escaping.
 */

(() => {
  'use strict';

  const REFRESH_INTERVAL_MS = 10_000;

  // -------------------------------------------------------------------------
  // DOM references
  // -------------------------------------------------------------------------

  const els = {
    statusDot:       document.getElementById('status-dot'),
    statusLabel:     document.getElementById('status-label'),
    nodeName:        document.getElementById('node-name'),
    uptimeValue:     document.getElementById('uptime-value'),
    taskCount:       document.getElementById('task-count'),
    extensionCount:  document.getElementById('extension-count'),
    taskTbody:       document.getElementById('task-tbody'),
    taskRefreshTs:   document.getElementById('task-refresh-ts'),
    lastRefresh:     document.getElementById('last-refresh'),
    btnRefresh:      document.getElementById('btn-refresh'),
    btnSettings:     document.getElementById('btn-settings'),
    settingsPanel:   document.getElementById('settings-panel'),
    apiBaseInput:    document.getElementById('api-base-input'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    invokeForm:      document.getElementById('invoke-form'),
    invExtension:    document.getElementById('inv-extension'),
    invRunner:       document.getElementById('inv-runner'),
    invMethod:       document.getElementById('inv-method'),
    invParams:       document.getElementById('inv-params'),
    invokeResult:    document.getElementById('invoke-result'),
  };

  // -------------------------------------------------------------------------
  // HTML escape — used before EVERY innerHTML interpolation
  // -------------------------------------------------------------------------

  /**
   * Escape a value for safe inclusion in an HTML context.
   * This function MUST be called on every piece of data-origin content
   * before it is used in innerHTML template strings.
   * @param {*} str
   * @returns {string}
   */
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // -------------------------------------------------------------------------
  // Status rendering
  // -------------------------------------------------------------------------

  function setStatus(level, label) {
    els.statusDot.className = `status-dot status-${level}`;
    els.statusLabel.textContent = label;  // textContent — no escaping needed
  }

  /**
   * Format seconds into a human-readable uptime string.
   * @param {number} secs
   * @returns {string}
   */
  function formatUptime(secs) {
    if (typeof secs !== 'number' || isNaN(secs)) return '\u2014';
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  /**
   * Format a UTC timestamp into a relative age string.
   * @param {string|number} ts - ISO8601 or Unix seconds
   * @returns {string}
   */
  function formatAge(ts) {
    if (!ts) return '\u2014';
    const created = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
    const diff = Math.floor((Date.now() - created.getTime()) / 1000);
    if (isNaN(diff) || diff < 0) return '\u2014';
    return formatUptime(diff) + ' ago';
  }

  /**
   * Map a task status string to a CSS badge class.
   * @param {string} status
   * @returns {string}
   */
  function badgeClass(status) {
    const s = (status || '').toLowerCase();
    if (s === 'running' || s === 'active') return 'badge-running';
    if (s === 'done' || s === 'complete' || s === 'completed') return 'badge-done';
    if (s === 'failed' || s === 'error') return 'badge-failed';
    if (s === 'pending' || s === 'queued' || s === 'waiting') return 'badge-pending';
    return 'badge-unknown';
  }

  // -------------------------------------------------------------------------
  // Status fetch + render
  // -------------------------------------------------------------------------

  async function refreshStatus() {
    try {
      const resp = await LegionAPI.getStatus();

      if (!resp.success) {
        setStatus('error', 'offline');
        els.nodeName.textContent      = '\u2014';
        els.uptimeValue.textContent   = '\u2014';
        els.extensionCount.textContent = '\u2014';
        return;
      }

      const d = resp.data || {};

      // Top-level status field (expect "ok", "warn", or "error" / "degraded")
      const rawStatus = (d.status || '').toLowerCase();
      if (rawStatus === 'ok' || rawStatus === 'healthy') {
        setStatus('ok', 'online');
      } else if (rawStatus === 'warn' || rawStatus === 'degraded') {
        setStatus('warn', rawStatus);
      } else if (rawStatus === 'error' || rawStatus === 'unhealthy') {
        setStatus('error', rawStatus);
      } else {
        setStatus('warn', rawStatus || 'unknown');
      }

      // textContent — safe for all values; no escaping required here
      els.nodeName.textContent        = d.node || d.hostname || d.name || '\u2014';
      els.uptimeValue.textContent     = formatUptime(d.uptime);
      els.extensionCount.textContent  = d.extensions !== undefined ? String(d.extensions) : '\u2014';

    } catch (err) {
      setStatus('error', 'error');
      console.error('[LegionIO] Status fetch error:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Task table fetch + render
  // -------------------------------------------------------------------------

  async function refreshTasks() {
    try {
      const resp = await LegionAPI.getTasks();
      const now = new Date();
      els.taskRefreshTs.textContent = now.toLocaleTimeString();

      if (!resp.success) {
        renderTaskError(resp.error || 'Failed to load tasks');
        return;
      }

      // Normalise: accept { tasks: [...] } or a bare array
      let tasks = [];
      if (Array.isArray(resp.data)) {
        tasks = resp.data;
      } else if (resp.data && Array.isArray(resp.data.tasks)) {
        tasks = resp.data.tasks;
      } else if (resp.data && Array.isArray(resp.data.data)) {
        tasks = resp.data.data;
      }

      els.taskCount.textContent = String(tasks.length);
      renderTaskTable(tasks);
    } catch (err) {
      renderTaskError(err.message);
      console.error('[LegionIO] Task fetch error:', err);
    }
  }

  /**
   * Render the task table body.
   * All data values are passed through escHtml() before innerHTML insertion.
   * @param {Array} tasks
   */
  function renderTaskTable(tasks) {
    if (tasks.length === 0) {
      // Static string — no external data, safe without escaping
      els.taskTbody.innerHTML = '<tr class="empty-row"><td colspan="6">No tasks found</td></tr>';
      return;
    }

    // Every value from the API response is escaped before interpolation.
    const rows = tasks.map(t => {
      const id        = escHtml(String(t.id ?? '\u2014'));
      const status    = escHtml(t.status ?? t.state ?? 'unknown');
      const extension = escHtml(t.extension ?? t.lex ?? '\u2014');
      const runner    = escHtml(t.runner ?? '\u2014');
      const method    = escHtml(t.method ?? t.action ?? '\u2014');
      const age       = escHtml(formatAge(t.created_at ?? t.created ?? t.timestamp));
      const cls       = badgeClass(status);  // derived from status — already escaped above

      return `<tr>
        <td>${id}</td>
        <td><span class="badge ${cls}">${status}</span></td>
        <td>${extension}</td>
        <td>${runner}</td>
        <td>${method}</td>
        <td>${age}</td>
      </tr>`;
    });

    els.taskTbody.innerHTML = rows.join('');
  }

  function renderTaskError(message) {
    // message is escaped before insertion
    els.taskTbody.innerHTML =
      `<tr class="empty-row"><td colspan="6">Error: ${escHtml(message)}</td></tr>`;
  }

  // -------------------------------------------------------------------------
  // Full refresh cycle
  // -------------------------------------------------------------------------

  async function refresh() {
    await Promise.all([refreshStatus(), refreshTasks()]);
    els.lastRefresh.textContent = `Last refresh: ${new Date().toLocaleTimeString()}`;
  }

  // -------------------------------------------------------------------------
  // Invoke form
  // -------------------------------------------------------------------------

  els.invokeForm.addEventListener('submit', async e => {
    e.preventDefault();

    const extension = els.invExtension.value.trim();
    const runner    = els.invRunner.value.trim();
    const method    = els.invMethod.value.trim();
    const rawParams = els.invParams.value.trim() || '{}';

    let params;
    try {
      params = JSON.parse(rawParams);
    } catch {
      showInvokeResult(false, `Invalid JSON in params: ${rawParams}`);
      return;
    }

    showInvokeResult(null, 'Invoking\u2026');

    try {
      const resp = await LegionAPI.invokeRunner(extension, runner, method, params);
      showInvokeResult(
        resp.success,
        resp.success
          ? JSON.stringify(resp.data, null, 2)
          : (resp.error || 'Unknown error')
      );
    } catch (err) {
      showInvokeResult(false, err.message);
    }
  });

  /**
   * Display the result of an invoke call.
   * Uses textContent — no escaping needed, no HTML injection risk.
   * @param {boolean|null} success - true=ok, false=error, null=pending
   * @param {string} message
   */
  function showInvokeResult(success, message) {
    const el = els.invokeResult;
    el.textContent = message;  // textContent — safe, no escaping required
    el.classList.remove('hidden', 'result-ok', 'result-error');

    if (success === true)  el.classList.add('result-ok');
    if (success === false) el.classList.add('result-error');
  }

  // -------------------------------------------------------------------------
  // Settings panel
  // -------------------------------------------------------------------------

  els.btnSettings.addEventListener('click', async () => {
    const panel = els.settingsPanel;
    const isHidden = panel.classList.contains('hidden');
    panel.classList.toggle('hidden');
    if (isHidden) {
      const base = await LegionAPI.getApiBase();
      els.apiBaseInput.value = base;
      els.apiBaseInput.focus();
    }
  });

  els.btnSaveSettings.addEventListener('click', async () => {
    const url = els.apiBaseInput.value.trim();
    if (!url) return;
    await LegionAPI.setApiBase(url);
    els.settingsPanel.classList.add('hidden');
    await refresh();
  });

  // Allow Enter key in the URL input
  els.apiBaseInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') els.btnSaveSettings.click();
    if (e.key === 'Escape') els.settingsPanel.classList.add('hidden');
  });

  // Manual refresh button
  els.btnRefresh.addEventListener('click', refresh);

  // -------------------------------------------------------------------------
  // Boot
  // -------------------------------------------------------------------------

  refresh();
  setInterval(refresh, REFRESH_INTERVAL_MS);

})();
