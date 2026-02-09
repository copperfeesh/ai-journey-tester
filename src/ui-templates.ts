// HTML template functions for the web UI — no template engine, just string returns.

interface JourneySummary {
  filename: string;
  name: string;
  url: string;
  stepCount: number;
}

interface SuiteSummary {
  filename: string;
  name: string;
  journeyCount: number;
}

export interface ReportSummary {
  filename: string;
  name: string;
  type: 'journey' | 'suite';
  timestamp: string;
  sizeKb: number;
}

interface JourneyData {
  name: string;
  description?: string;
  url: string;
  viewport?: { width: number; height: number };
  variables?: Record<string, string>;
  steps: Array<{ action: string; description?: string; timeout?: number; waitAfter?: number }>;
}

interface SuiteData {
  name: string;
  description?: string;
  variables?: Record<string, string>;
  journeys: Array<{ path: string; variables?: Record<string, string> }>;
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — AI Journey Tester</title>
<style>
  :root {
    color-scheme: light dark;

    /* Brand colors */
    --brand-primary: #0066cc;
    --brand-primary-hover: #0052a3;
    --brand-header-bg: #1a1a2e;
    --brand-header-text: #fff;
    --brand-header-link: #a0c4ff;
    --brand-success: #198754;
    --brand-success-hover: #146c43;
    --brand-danger: #dc3545;
    --brand-danger-hover: #b02a37;

    /* Neutral / layout */
    --bg-page: #f5f5f5;
    --bg-card: #fff;
    --text-primary: #333;
    --text-secondary: #666;
    --text-muted: #888;
    --border-color: #eee;
    --border-input: #ccc;
    --bg-secondary: #e9ecef;
    --bg-secondary-hover: #d3d7db;
    --bg-step: #f8f9fa;
    --border-step: #e9ecef;

    /* Focus ring */
    --focus-ring: rgba(0, 102, 204, 0.15);

    /* Badge colors */
    --badge-journey-bg: #e8f4fd;
    --badge-journey-text: #0066cc;
    --badge-suite-bg: #f0e8fd;
    --badge-suite-text: #6f42c1;
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --brand-primary: #4da3ff;
      --brand-primary-hover: #7dbdff;
      --brand-header-bg: #0d0d1a;
      --brand-header-text: #e0e0e0;
      --brand-header-link: #80b3ff;
      --brand-success: #2ecc71;
      --brand-danger: #e74c3c;
      --bg-page: #121218;
      --bg-card: #1e1e2a;
      --text-primary: #e0e0e0;
      --text-secondary: #a0a0b0;
      --text-muted: #707080;
      --border-color: #2a2a3a;
      --border-input: #3a3a4a;
      --bg-secondary: #2a2a3a;
      --bg-secondary-hover: #3a3a4a;
      --bg-step: #1a1a26;
      --border-step: #2a2a3a;
      --focus-ring: rgba(77, 163, 255, 0.2);
      --badge-journey-bg: #1a2a3a;
      --badge-journey-text: #4da3ff;
      --badge-suite-bg: #2a1a3a;
      --badge-suite-text: #b08aff;
    }
  }

  [data-theme="dark"] {
    --brand-primary: #4da3ff;
    --brand-primary-hover: #7dbdff;
    --brand-header-bg: #0d0d1a;
    --brand-header-text: #e0e0e0;
    --brand-header-link: #80b3ff;
    --brand-success: #2ecc71;
    --brand-danger: #e74c3c;
    --bg-page: #121218;
    --bg-card: #1e1e2a;
    --text-primary: #e0e0e0;
    --text-secondary: #a0a0b0;
    --text-muted: #707080;
    --border-color: #2a2a3a;
    --border-input: #3a3a4a;
    --bg-secondary: #2a2a3a;
    --bg-secondary-hover: #3a3a4a;
    --bg-step: #1a1a26;
    --border-step: #2a2a3a;
    --focus-ring: rgba(77, 163, 255, 0.2);
    --badge-journey-bg: #1a2a3a;
    --badge-journey-text: #4da3ff;
    --badge-suite-bg: #2a1a3a;
    --badge-suite-text: #b08aff;
  }

  [data-theme="light"] {
    --brand-primary: #0066cc;
    --brand-primary-hover: #0052a3;
    --brand-header-bg: #1a1a2e;
    --brand-header-text: #fff;
    --brand-header-link: #a0c4ff;
    --brand-success: #198754;
    --brand-danger: #dc3545;
    --bg-page: #f5f5f5;
    --bg-card: #fff;
    --text-primary: #333;
    --text-secondary: #666;
    --text-muted: #888;
    --border-color: #eee;
    --border-input: #ccc;
    --bg-secondary: #e9ecef;
    --bg-secondary-hover: #d3d7db;
    --bg-step: #f8f9fa;
    --border-step: #e9ecef;
    --focus-ring: rgba(0, 102, 204, 0.15);
    --badge-journey-bg: #e8f4fd;
    --badge-journey-text: #0066cc;
    --badge-suite-bg: #f0e8fd;
    --badge-suite-text: #6f42c1;
  }

  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         margin: 0; padding: 0; background: var(--bg-page); color: var(--text-primary); line-height: 1.5; }
  a { color: var(--brand-primary); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .container { max-width: 960px; margin: 0 auto; padding: 24px; }
  header { background: var(--brand-header-bg); color: var(--brand-header-text); padding: 16px 0; margin-bottom: 24px; }
  header .container { display: flex; align-items: center; justify-content: space-between; padding-top: 0; padding-bottom: 0; }
  header h1 { margin: 0; font-size: 20px; font-weight: 600; }
  header a { color: var(--brand-header-link); }
  .card { background: var(--bg-card); border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.1); padding: 24px; margin-bottom: 24px; }
  .card h2 { margin-top: 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border-color); }
  th { font-weight: 600; color: var(--text-secondary); font-size: 13px; text-transform: uppercase; letter-spacing: .5px; }
  .actions { white-space: nowrap; }
  .actions a, .actions button { margin-right: 8px; }
  .btn { display: inline-block; padding: 8px 16px; border-radius: 6px; border: none;
         font-size: 14px; cursor: pointer; font-family: inherit; }
  .btn-primary { background: var(--brand-primary); color: var(--brand-header-text); }
  .btn-primary:hover { background: var(--brand-primary-hover); text-decoration: none; }
  .btn-danger { background: var(--brand-danger); color: var(--brand-header-text); }
  .btn-danger:hover { background: var(--brand-danger-hover); }
  .btn-secondary { background: var(--bg-secondary); color: var(--text-primary); }
  .btn-secondary:hover { background: var(--bg-secondary-hover); }
  .btn-success { background: var(--brand-success); color: var(--brand-header-text); }
  .btn-success:hover { background: var(--brand-success-hover); }
  .btn-sm { padding: 4px 10px; font-size: 13px; }
  label { display: block; font-weight: 600; margin-bottom: 4px; margin-top: 16px; font-size: 14px; }
  input[type="text"], input[type="number"], input[type="url"], textarea, select {
    width: 100%; padding: 8px 12px; border: 1px solid var(--border-input); border-radius: 6px;
    font-size: 14px; font-family: inherit; }
  input:focus, textarea:focus, select:focus { outline: none; border-color: var(--brand-primary); box-shadow: 0 0 0 3px var(--focus-ring); }
  textarea { resize: vertical; min-height: 60px; }
  .field-row { display: flex; gap: 8px; align-items: flex-end; margin-bottom: 8px; }
  .field-row input, .field-row select { flex: 1; }
  .step-item { background: var(--bg-step); border: 1px solid var(--border-step); border-radius: 6px; padding: 12px; margin-bottom: 8px; position: relative; }
  .step-item .step-num { font-weight: 700; color: var(--text-secondary); font-size: 13px; margin-bottom: 6px; }
  .step-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; }
  .empty-state { color: var(--text-muted); font-style: italic; padding: 20px; text-align: center; }
  .form-help { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
  .toast { position: fixed; top: 20px; right: 20px; background: var(--text-primary); color: var(--brand-header-text);
           padding: 12px 20px; border-radius: 6px; display: none; z-index: 999; }
  .toast.error { background: var(--brand-danger); }
  .field-error { color: var(--brand-danger); font-size: 13px; margin-top: 2px; }
  .run-banner { background: var(--bg-card); border: 2px solid var(--brand-primary); border-radius: 8px; padding: 16px 20px;
                margin-bottom: 24px; display: none; }
  .run-banner.active { display: block; }
  .run-banner.completed { border-color: var(--brand-success); }
  .run-banner.failed { border-color: var(--brand-danger); }
  .run-banner-content { display: flex; align-items: center; gap: 12px; }
  .run-spinner { width: 20px; height: 20px; border: 3px solid var(--bg-secondary); border-top: 3px solid var(--brand-primary);
                 border-radius: 50%; animation: spin 1s linear infinite; flex-shrink: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .run-info { flex: 1; }
  .run-info strong { font-size: 15px; }
  .run-info .run-detail { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }
  .run-actions { display: flex; gap: 8px; align-items: center; }
  .badge-type { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px;
                font-weight: 600; text-transform: uppercase; }
  .badge-type.journey { background: var(--badge-journey-bg); color: var(--badge-journey-text); }
  .badge-type.suite { background: var(--badge-suite-bg); color: var(--badge-suite-text); }

  /* Dark mode enhancements */
  [data-theme="dark"] .card,
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .card { box-shadow: 0 1px 3px rgba(0,0,0,.4); } }
  [data-theme="dark"] .card { box-shadow: 0 1px 3px rgba(0,0,0,.4); }

  /* Theme toggle */
  .theme-toggle { background: transparent; border: 1px solid var(--brand-header-link); color: var(--brand-header-link);
                   padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 14px; font-family: inherit;
                   display: flex; align-items: center; gap: 4px; }
  .theme-toggle:hover { background: rgba(255,255,255,0.1); }
</style>
<script>
  // Apply saved theme immediately to prevent flash
  (function(){
    var t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  })();
</script>
</head>
<body>
<header>
  <div class="container">
    <h1><a href="/" style="color:var(--brand-header-text)">AI Journey Tester</a></h1>
    <button class="theme-toggle" id="theme-toggle" onclick="cycleTheme()" title="Toggle theme"></button>
    <nav><a href="/">Dashboard</a></nav>
  </div>
</header>
<div class="container">
${body}
</div>
<div id="toast" class="toast"></div>
<script>
function cycleTheme() {
  var current = localStorage.getItem('theme') || 'system';
  var next = current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system';
  if (next === 'system') {
    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem('theme');
  } else {
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  }
  updateToggleLabel();
}
function updateToggleLabel() {
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;
  var t = localStorage.getItem('theme') || 'system';
  var labels = { system: '\u2699\uFE0F System', light: '\u2600\uFE0F Light', dark: '\uD83C\uDF19 Dark' };
  btn.textContent = labels[t] || labels.system;
}
updateToggleLabel();
</script>
</body>
</html>`;
}

export function dashboardPage(journeys: JourneySummary[], suites: SuiteSummary[], reports: ReportSummary[] = []): string {
  const journeyRows = journeys.length === 0
    ? `<tr><td colspan="4" class="empty-state">No journeys yet. Create one to get started.</td></tr>`
    : journeys.map(j => `<tr>
        <td><a href="/journeys/${esc(j.filename)}/edit">${esc(j.name)}</a></td>
        <td>${esc(j.url)}</td>
        <td>${j.stepCount}</td>
        <td class="actions">
          <button class="btn btn-success btn-sm run-btn" onclick="runJourney('${esc(j.filename)}')">Run</button>
          <a href="/journeys/${esc(j.filename)}/edit" class="btn btn-secondary btn-sm">Edit</a>
          <button class="btn btn-danger btn-sm" onclick="deleteItem('journeys','${esc(j.filename)}')">Delete</button>
        </td>
      </tr>`).join('\n');

  const suiteRows = suites.length === 0
    ? `<tr><td colspan="3" class="empty-state">No suites yet. Create one to get started.</td></tr>`
    : suites.map(s => `<tr>
        <td><a href="/suites/${esc(s.filename)}/edit">${esc(s.name)}</a></td>
        <td>${s.journeyCount}</td>
        <td class="actions">
          <a href="/suites/${esc(s.filename)}/edit" class="btn btn-secondary btn-sm">Edit</a>
          <button class="btn btn-danger btn-sm" onclick="deleteItem('suites','${esc(s.filename)}')">Delete</button>
        </td>
      </tr>`).join('\n');

  const reportRows = reports.length === 0
    ? `<tr><td colspan="4" class="empty-state">No reports yet. Run a journey to generate one.</td></tr>`
    : reports.map(r => `<tr>
        <td>${esc(r.name)}</td>
        <td><span class="badge-type ${r.type}">${r.type}</span></td>
        <td>${esc(r.timestamp)}</td>
        <td class="actions">
          <a href="/reports/${esc(r.filename)}" target="_blank" class="btn btn-secondary btn-sm">View</a>
        </td>
      </tr>`).join('\n');

  return layout('Dashboard', `
<div id="run-banner" class="run-banner">
  <div class="run-banner-content">
    <div class="run-spinner" id="run-spinner"></div>
    <div class="run-info">
      <strong id="run-title">Running journey...</strong>
      <div class="run-detail" id="run-detail">Starting...</div>
    </div>
    <div class="run-actions" id="run-actions"></div>
  </div>
</div>
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center">
    <h2>Journeys</h2>
    <a href="/journeys/new" class="btn btn-primary">New Journey</a>
  </div>
  <table>
    <thead><tr><th>Name</th><th>URL</th><th>Steps</th><th>Actions</th></tr></thead>
    <tbody>${journeyRows}</tbody>
  </table>
</div>
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center">
    <h2>Suites</h2>
    <a href="/suites/new" class="btn btn-primary">New Suite</a>
  </div>
  <table>
    <thead><tr><th>Name</th><th>Journeys</th><th>Actions</th></tr></thead>
    <tbody>${suiteRows}</tbody>
  </table>
</div>
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center">
    <h2>Reports</h2>
  </div>
  <table>
    <thead><tr><th>Name</th><th>Type</th><th>Date</th><th>Actions</th></tr></thead>
    <tbody>${reportRows}</tbody>
  </table>
</div>
<script>
let _pollTimer = null;
let _elapsedTimer = null;
let _startTime = null;

async function deleteItem(type, filename) {
  if (!confirm('Delete ' + filename + '?')) return;
  const res = await fetch('/api/' + type + '/' + encodeURIComponent(filename), { method: 'DELETE', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  if (res.ok) { location.reload(); }
  else { showToast('Delete failed: ' + (await res.text()), true); }
}

function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 4000);
}

function setRunButtonsDisabled(disabled) {
  document.querySelectorAll('.run-btn').forEach(btn => {
    btn.disabled = disabled;
    btn.style.opacity = disabled ? '0.5' : '1';
    btn.style.pointerEvents = disabled ? 'none' : 'auto';
  });
}

async function runJourney(filename) {
  setRunButtonsDisabled(true);
  try {
    const res = await fetch('/api/run/journey/' + encodeURIComponent(filename), { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    if (res.status === 409) {
      const body = await res.json();
      showToast('A run is already in progress.', true);
      showRunProgress(body.runId);
      return;
    }
    if (!res.ok) {
      showToast('Failed to start run: ' + (await res.text()), true);
      setRunButtonsDisabled(false);
      return;
    }
    const { runId } = await res.json();
    showRunProgress(runId);
  } catch (e) {
    showToast('Error starting run: ' + e.message, true);
    setRunButtonsDisabled(false);
  }
}

function showRunProgress(runId) {
  const banner = document.getElementById('run-banner');
  const title = document.getElementById('run-title');
  const detail = document.getElementById('run-detail');
  const spinner = document.getElementById('run-spinner');
  const actions = document.getElementById('run-actions');

  banner.className = 'run-banner active';
  title.textContent = 'Running journey...';
  detail.textContent = 'Starting...';
  spinner.style.display = 'block';
  actions.innerHTML = '';
  _startTime = Date.now();

  _elapsedTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - _startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    detail.textContent = 'Elapsed: ' + (mins > 0 ? mins + 'm ' : '') + secs + 's';
  }, 1000);

  setRunButtonsDisabled(true);

  _pollTimer = setInterval(async () => {
    try {
      const res = await fetch('/api/run/' + encodeURIComponent(runId));
      if (!res.ok) return;
      const job = await res.json();

      if (job.status === 'running') return;

      clearInterval(_pollTimer);
      clearInterval(_elapsedTimer);
      _pollTimer = null;
      _elapsedTimer = null;

      spinner.style.display = 'none';
      setRunButtonsDisabled(false);

      if (job.status === 'completed') {
        banner.className = 'run-banner active completed';
        const s = job.summary;
        title.textContent = 'Run completed — ' + (s.status === 'passed' ? 'PASSED' : s.status === 'failed' ? 'FAILED' : 'WARNING');
        detail.textContent = s.passed + '/' + s.totalSteps + ' steps passed, ' + s.failed + ' failed';
        if (job.reportUrl) {
          actions.innerHTML = '<a href="' + job.reportUrl + '" target="_blank" class="btn btn-primary btn-sm">View Report</a>';
        }
      } else {
        banner.className = 'run-banner active failed';
        title.textContent = 'Run failed';
        detail.textContent = job.error || 'Unknown error';
      }
    } catch (e) {
      // Network error during poll — keep polling
    }
  }, 2000);
}

// Check for ?runId= param to resume polling
(function() {
  const params = new URLSearchParams(window.location.search);
  const runId = params.get('runId');
  if (runId) {
    showRunProgress(runId);
    // Clean up URL
    window.history.replaceState({}, '', '/');
  }
})();
</script>
`);
}

export function journeyFormPage(journey: JourneyData | null, filename: string | null): string {
  const isEdit = !!filename;
  const j = journey || { name: '', description: '', url: '', steps: [{ action: '' }], variables: {}, viewport: undefined };
  const vars = j.variables || {};
  const varEntries = Object.entries(vars);

  const varRows = varEntries.length === 0
    ? ''
    : varEntries.map(([k, v], i) => varRowHtml(i, k, v)).join('\n');

  const stepItems = j.steps.map((s, i) => stepItemHtml(i, s, j.steps.length)).join('\n');

  return layout(isEdit ? `Edit ${j.name}` : 'New Journey', `
<div class="card">
  <h2>${isEdit ? 'Edit Journey' : 'New Journey'}</h2>
  <form id="journey-form" onsubmit="return false">
    ${isEdit ? '' : `<label for="filename">Filename</label>
    <input type="text" id="filename" placeholder="my-journey.yaml" value="" required>
    <div class="form-help">Will be saved to the journeys/ folder. Must end in .yaml</div>`}

    <label for="name">Name</label>
    <input type="text" id="name" value="${esc(j.name)}" required>
    <div class="field-error" id="error-name"></div>

    <label for="description">Description</label>
    <textarea id="description">${esc(j.description || '')}</textarea>

    <label for="url">URL</label>
    <input type="text" id="url" value="${esc(j.url)}" required placeholder="https://example.com">
    <div class="field-error" id="error-url"></div>
    <div class="form-help">Supports variables like {{base_url}}</div>

    <label>Viewport (optional)</label>
    <div class="field-row">
      <input type="number" id="vp-width" placeholder="Width" value="${j.viewport?.width || ''}" style="max-width:120px">
      <span style="padding-bottom:8px">x</span>
      <input type="number" id="vp-height" placeholder="Height" value="${j.viewport?.height || ''}" style="max-width:120px">
    </div>

    <label>Variables</label>
    <div id="vars-container">${varRows}</div>
    <button type="button" class="btn btn-secondary btn-sm" onclick="addVariable()" style="margin-top:4px">+ Add Variable</button>

    <label>Steps</label>
    <div class="field-error" id="error-steps"></div>
    <div id="steps-container">${stepItems}</div>
    <button type="button" class="btn btn-secondary btn-sm" onclick="addStep()" style="margin-top:4px">+ Add Step</button>

    <div style="margin-top:24px;display:flex;gap:8px">
      <button type="button" class="btn btn-primary" onclick="save()">Save</button>
      ${isEdit ? `<button type="button" class="btn btn-success" onclick="saveAndRun()">Save &amp; Run</button>` : ''}
      <a href="/" class="btn btn-secondary">Cancel</a>
      ${isEdit ? `<button type="button" class="btn btn-danger" style="margin-left:auto" onclick="deleteItem()">Delete</button>` : ''}
    </div>
  </form>
</div>
<script>
const IS_EDIT = ${isEdit};
const ORIGINAL_FILENAME = ${isEdit ? `"${esc(filename!)}"` : 'null'};
let stepCount = document.querySelectorAll('.step-item').length;
let varCount = document.querySelectorAll('.var-row').length;

function addVariable() {
  const c = document.getElementById('vars-container');
  const idx = varCount++;
  const div = document.createElement('div');
  div.className = 'field-row var-row';
  div.innerHTML = '<input type="text" placeholder="key" class="var-key">' +
    '<input type="text" placeholder="value" class="var-val">' +
    '<button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">x</button>';
  c.appendChild(div);
}

function removeVariable(btn) { btn.parentElement.remove(); }

function addStep() {
  const c = document.getElementById('steps-container');
  const idx = c.children.length;
  const div = document.createElement('div');
  div.className = 'step-item';
  div.innerHTML = stepInnerHtml(idx, '', '', '', '');
  c.appendChild(div);
  renumberSteps();
}

function removeStep(btn) {
  btn.closest('.step-item').remove();
  renumberSteps();
}

function moveStep(btn, dir) {
  const item = btn.closest('.step-item');
  const container = item.parentElement;
  if (dir === -1 && item.previousElementSibling) {
    container.insertBefore(item, item.previousElementSibling);
  } else if (dir === 1 && item.nextElementSibling) {
    container.insertBefore(item.nextElementSibling, item);
  }
  renumberSteps();
}

function renumberSteps() {
  document.querySelectorAll('.step-item').forEach((el, i) => {
    el.querySelector('.step-num').textContent = 'Step ' + (i + 1);
  });
}

function stepInnerHtml(idx, action, desc, timeout, waitAfter) {
  return '<div class="step-num">Step ' + (idx + 1) + '</div>' +
    '<div class="step-actions">' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="moveStep(this,-1)" title="Move up">&#9650;</button>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="moveStep(this,1)" title="Move down">&#9660;</button>' +
    '<button type="button" class="btn btn-danger btn-sm" onclick="removeStep(this)">x</button>' +
    '</div>' +
    '<input type="text" class="step-action" placeholder="Natural language action..." value="' + escAttr(action) + '" style="margin-bottom:6px">' +
    '<div class="field-row">' +
    '<input type="text" class="step-desc" placeholder="Description (optional)" value="' + escAttr(desc) + '">' +
    '<input type="number" class="step-timeout" placeholder="Timeout ms" value="' + escAttr(timeout) + '" style="max-width:110px">' +
    '<input type="number" class="step-wait" placeholder="Wait ms" value="' + escAttr(waitAfter) + '" style="max-width:110px">' +
    '</div>';
}

function escAttr(s) { return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function collectData() {
  const data = {
    name: document.getElementById('name').value.trim(),
    url: document.getElementById('url').value.trim(),
  };
  const desc = document.getElementById('description').value.trim();
  if (desc) data.description = desc;

  const vpW = parseInt(document.getElementById('vp-width').value);
  const vpH = parseInt(document.getElementById('vp-height').value);
  if (vpW && vpH) data.viewport = { width: vpW, height: vpH };

  const vars = {};
  document.querySelectorAll('.var-row').forEach(row => {
    const k = row.querySelector('.var-key').value.trim();
    const v = row.querySelector('.var-val').value.trim();
    if (k) vars[k] = v;
  });
  if (Object.keys(vars).length) data.variables = vars;

  data.steps = [];
  document.querySelectorAll('.step-item').forEach(el => {
    const action = el.querySelector('.step-action').value.trim();
    if (!action) return;
    const step = { action };
    const d = el.querySelector('.step-desc').value.trim();
    if (d) step.description = d;
    const t = parseInt(el.querySelector('.step-timeout').value);
    if (t) step.timeout = t;
    const w = parseInt(el.querySelector('.step-wait').value);
    if (w) step.waitAfter = w;
    data.steps.push(step);
  });

  return data;
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; });
}

function showFieldErrors(errors) {
  clearErrors();
  for (const err of errors) {
    // Map field names to DOM error elements
    let id = null;
    if (err.field === 'name') id = 'error-name';
    else if (err.field === 'url') id = 'error-url';
    else if (err.field === 'steps' || err.field.startsWith('steps[')) id = 'error-steps';
    if (id) {
      const el = document.getElementById(id);
      if (el) el.textContent = (el.textContent ? el.textContent + ' ' : '') + err.message;
    }
  }
}

async function save(redirectTo) {
  clearErrors();
  const data = collectData();
  let url, method;
  if (IS_EDIT) {
    url = '/api/journeys/' + encodeURIComponent(ORIGINAL_FILENAME);
    method = 'PUT';
  } else {
    const fn = document.getElementById('filename').value.trim();
    if (!fn) { showToast('Filename is required.', true); return false; }
    url = '/api/journeys';
    method = 'POST';
    data._filename = fn;
  }
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify({ data, filename: IS_EDIT ? undefined : data._filename }),
  });
  if (res.ok) {
    if (redirectTo) { window.location.href = redirectTo; }
    else { window.location.href = '/'; }
    return true;
  }
  // Try to parse validation errors
  const contentType = res.headers.get('content-type') || '';
  if (res.status === 400 && contentType.includes('json')) {
    try {
      const body = await res.json();
      if (body.errors && Array.isArray(body.errors)) {
        showFieldErrors(body.errors);
        return false;
      }
    } catch {}
  }
  showToast('Save failed: ' + (await res.text()), true);
  return false;
}

async function saveAndRun() {
  clearErrors();
  const data = collectData();
  // Save first
  let url, method;
  if (IS_EDIT) {
    url = '/api/journeys/' + encodeURIComponent(ORIGINAL_FILENAME);
    method = 'PUT';
  } else {
    return; // Should not happen — button only shown in edit mode
  }
  const saveRes = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify({ data }),
  });
  if (!saveRes.ok) {
    const contentType = saveRes.headers.get('content-type') || '';
    if (saveRes.status === 400 && contentType.includes('json')) {
      try {
        const body = await saveRes.json();
        if (body.errors && Array.isArray(body.errors)) { showFieldErrors(body.errors); return; }
      } catch {}
    }
    showToast('Save failed: ' + (await saveRes.text()), true);
    return;
  }
  // Start run
  const runRes = await fetch('/api/run/journey/' + encodeURIComponent(ORIGINAL_FILENAME), { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  if (runRes.status === 409) {
    showToast('A run is already in progress.', true);
    return;
  }
  if (!runRes.ok) {
    showToast('Failed to start run: ' + (await runRes.text()), true);
    return;
  }
  const { runId } = await runRes.json();
  window.location.href = '/?runId=' + encodeURIComponent(runId);
}

async function deleteItem() {
  if (!confirm('Delete this journey?')) return;
  const res = await fetch('/api/journeys/' + encodeURIComponent(ORIGINAL_FILENAME), { method: 'DELETE', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  if (res.ok) { window.location.href = '/'; }
  else { showToast('Delete failed: ' + (await res.text()), true); }
}

function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 4000);
}
</script>
`);
}

function varRowHtml(idx: number, key: string, value: string): string {
  return `<div class="field-row var-row">
    <input type="text" placeholder="key" class="var-key" value="${esc(key)}">
    <input type="text" placeholder="value" class="var-val" value="${esc(value)}">
    <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">x</button>
  </div>`;
}

function stepItemHtml(idx: number, step: { action: string; description?: string; timeout?: number; waitAfter?: number }, total: number): string {
  return `<div class="step-item">
    <div class="step-num">Step ${idx + 1}</div>
    <div class="step-actions">
      <button type="button" class="btn btn-secondary btn-sm" onclick="moveStep(this,-1)" title="Move up">&#9650;</button>
      <button type="button" class="btn btn-secondary btn-sm" onclick="moveStep(this,1)" title="Move down">&#9660;</button>
      <button type="button" class="btn btn-danger btn-sm" onclick="removeStep(this)">x</button>
    </div>
    <input type="text" class="step-action" placeholder="Natural language action..." value="${esc(step.action)}" style="margin-bottom:6px">
    <div class="field-row">
      <input type="text" class="step-desc" placeholder="Description (optional)" value="${esc(step.description || '')}">
      <input type="number" class="step-timeout" placeholder="Timeout ms" value="${step.timeout || ''}" style="max-width:110px">
      <input type="number" class="step-wait" placeholder="Wait ms" value="${step.waitAfter || ''}" style="max-width:110px">
    </div>
  </div>`;
}

export function suiteFormPage(suite: SuiteData | null, filename: string | null, journeyFiles: string[]): string {
  const isEdit = !!filename;
  const s = suite || { name: '', description: '', variables: {}, journeys: [{ path: '' }] };
  const vars = s.variables || {};
  const varEntries = Object.entries(vars);

  const varRows = varEntries.length === 0
    ? ''
    : varEntries.map(([k, v], i) => varRowHtml(i, k, v)).join('\n');

  const journeyItems = s.journeys.map((j, i) => suiteJourneyItemHtml(i, j, journeyFiles)).join('\n');

  const optionsHtml = journeyFiles.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join('');

  return layout(isEdit ? `Edit ${s.name}` : 'New Suite', `
<div class="card">
  <h2>${isEdit ? 'Edit Suite' : 'New Suite'}</h2>
  <form id="suite-form" onsubmit="return false">
    ${isEdit ? '' : `<label for="filename">Filename</label>
    <input type="text" id="filename" placeholder="my-suite.yaml" value="" required>
    <div class="form-help">Will be saved to the suites/ folder. Must end in .yaml</div>`}

    <label for="name">Name</label>
    <input type="text" id="name" value="${esc(s.name)}" required>
    <div class="field-error" id="error-name"></div>

    <label for="description">Description</label>
    <textarea id="description">${esc(s.description || '')}</textarea>

    <label>Variables</label>
    <div id="vars-container">${varRows}</div>
    <button type="button" class="btn btn-secondary btn-sm" onclick="addVariable()" style="margin-top:4px">+ Add Variable</button>

    <label>Journeys</label>
    <div class="field-error" id="error-journeys"></div>
    <div id="journeys-container">${journeyItems}</div>
    <button type="button" class="btn btn-secondary btn-sm" onclick="addJourney()" style="margin-top:4px">+ Add Journey</button>

    <div style="margin-top:24px;display:flex;gap:8px">
      <button type="button" class="btn btn-primary" onclick="save()">Save</button>
      <a href="/" class="btn btn-secondary">Cancel</a>
      ${isEdit ? `<button type="button" class="btn btn-danger" style="margin-left:auto" onclick="deleteItem()">Delete</button>` : ''}
    </div>
  </form>
</div>
<script>
const IS_EDIT = ${isEdit};
const ORIGINAL_FILENAME = ${isEdit ? `"${esc(filename!)}"` : 'null'};
const JOURNEY_OPTIONS = ${JSON.stringify(journeyFiles)};
let varCount = document.querySelectorAll('.var-row').length;

function addVariable() {
  const c = document.getElementById('vars-container');
  const div = document.createElement('div');
  div.className = 'field-row var-row';
  div.innerHTML = '<input type="text" placeholder="key" class="var-key">' +
    '<input type="text" placeholder="value" class="var-val">' +
    '<button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">x</button>';
  c.appendChild(div);
}

function escAttr(s) { return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function journeySelectHtml(selected) {
  let html = '<option value="">-- select journey --</option>';
  JOURNEY_OPTIONS.forEach(f => {
    html += '<option value="' + escAttr(f) + '"' + (f === selected ? ' selected' : '') + '>' + escAttr(f) + '</option>';
  });
  return html;
}

function addJourney() {
  const c = document.getElementById('journeys-container');
  const idx = c.children.length;
  const div = document.createElement('div');
  div.className = 'step-item journey-ref';
  div.innerHTML = journeyRefInnerHtml(idx, '', []);
  c.appendChild(div);
  renumberJourneys();
}

function journeyRefInnerHtml(idx, selectedFile, vars) {
  let varsHtml = '';
  vars.forEach(function(v) {
    varsHtml += '<div class="field-row ref-var-row">' +
      '<input type="text" placeholder="key" class="ref-var-key" value="' + escAttr(v[0]) + '">' +
      '<input type="text" placeholder="value" class="ref-var-val" value="' + escAttr(v[1]) + '">' +
      '<button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">x</button></div>';
  });
  return '<div class="step-num">Journey ' + (idx + 1) + '</div>' +
    '<div class="step-actions">' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="moveJourney(this,-1)" title="Move up">&#9650;</button>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="moveJourney(this,1)" title="Move down">&#9660;</button>' +
    '<button type="button" class="btn btn-danger btn-sm" onclick="removeJourney(this)">x</button></div>' +
    '<select class="journey-path" style="margin-bottom:6px">' + journeySelectHtml(selectedFile) + '</select>' +
    '<div class="ref-vars">' + varsHtml + '</div>' +
    '<button type="button" class="btn btn-secondary btn-sm" onclick="addRefVar(this)" style="margin-top:2px">+ Variable Override</button>';
}

function addRefVar(btn) {
  const container = btn.previousElementSibling;
  const div = document.createElement('div');
  div.className = 'field-row ref-var-row';
  div.innerHTML = '<input type="text" placeholder="key" class="ref-var-key">' +
    '<input type="text" placeholder="value" class="ref-var-val">' +
    '<button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">x</button>';
  container.appendChild(div);
}

function removeJourney(btn) { btn.closest('.journey-ref').remove(); renumberJourneys(); }

function moveJourney(btn, dir) {
  const item = btn.closest('.journey-ref');
  const container = item.parentElement;
  if (dir === -1 && item.previousElementSibling) {
    container.insertBefore(item, item.previousElementSibling);
  } else if (dir === 1 && item.nextElementSibling) {
    container.insertBefore(item.nextElementSibling, item);
  }
  renumberJourneys();
}

function renumberJourneys() {
  document.querySelectorAll('.journey-ref').forEach((el, i) => {
    el.querySelector('.step-num').textContent = 'Journey ' + (i + 1);
  });
}

function collectData() {
  const data = {
    name: document.getElementById('name').value.trim(),
  };
  const desc = document.getElementById('description').value.trim();
  if (desc) data.description = desc;

  const vars = {};
  document.querySelectorAll('#vars-container .var-row').forEach(row => {
    const k = row.querySelector('.var-key').value.trim();
    const v = row.querySelector('.var-val').value.trim();
    if (k) vars[k] = v;
  });
  if (Object.keys(vars).length) data.variables = vars;

  data.journeys = [];
  document.querySelectorAll('.journey-ref').forEach(el => {
    const path = el.querySelector('.journey-path').value;
    if (!path) return;
    const ref = { path };
    const refVars = {};
    el.querySelectorAll('.ref-var-row').forEach(row => {
      const k = row.querySelector('.ref-var-key').value.trim();
      const v = row.querySelector('.ref-var-val').value.trim();
      if (k) refVars[k] = v;
    });
    if (Object.keys(refVars).length) ref.variables = refVars;
    data.journeys.push(ref);
  });

  return data;
}

function clearErrors() {
  document.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; });
}

function showFieldErrors(errors) {
  clearErrors();
  for (const err of errors) {
    let id = null;
    if (err.field === 'name') id = 'error-name';
    else if (err.field === 'journeys' || err.field.startsWith('journeys[')) id = 'error-journeys';
    if (id) {
      const el = document.getElementById(id);
      if (el) el.textContent = (el.textContent ? el.textContent + ' ' : '') + err.message;
    }
  }
}

async function save() {
  clearErrors();
  const data = collectData();
  let url, method;
  if (IS_EDIT) {
    url = '/api/suites/' + encodeURIComponent(ORIGINAL_FILENAME);
    method = 'PUT';
  } else {
    const fn = document.getElementById('filename').value.trim();
    if (!fn) { showToast('Filename is required.', true); return; }
    url = '/api/suites';
    method = 'POST';
    data._filename = fn;
  }
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify({ data, filename: IS_EDIT ? undefined : data._filename }),
  });
  if (res.ok) { window.location.href = '/'; return; }
  const contentType = res.headers.get('content-type') || '';
  if (res.status === 400 && contentType.includes('json')) {
    try {
      const body = await res.json();
      if (body.errors && Array.isArray(body.errors)) { showFieldErrors(body.errors); return; }
    } catch {}
  }
  showToast('Save failed: ' + (await res.text()), true);
}

async function deleteItem() {
  if (!confirm('Delete this suite?')) return;
  const res = await fetch('/api/suites/' + encodeURIComponent(ORIGINAL_FILENAME), { method: 'DELETE', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  if (res.ok) { window.location.href = '/'; }
  else { showToast('Delete failed: ' + (await res.text()), true); }
}

function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 4000);
}
</script>
`);
}

function suiteJourneyItemHtml(idx: number, ref: { path: string; variables?: Record<string, string> }, journeyFiles: string[]): string {
  // Convert relative path (../journeys/X.yaml) to just filename for the picker
  const pathFilename = ref.path.replace(/^.*[\\/]/, '');
  const vars = ref.variables ? Object.entries(ref.variables) : [];

  const optionsHtml = journeyFiles.map(f =>
    `<option value="${esc(f)}"${f === pathFilename ? ' selected' : ''}>${esc(f)}</option>`
  ).join('');

  const varsHtml = vars.map(([k, v]) =>
    `<div class="field-row ref-var-row">
      <input type="text" placeholder="key" class="ref-var-key" value="${esc(k)}">
      <input type="text" placeholder="value" class="ref-var-val" value="${esc(v)}">
      <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.remove()">x</button>
    </div>`
  ).join('');

  return `<div class="step-item journey-ref">
    <div class="step-num">Journey ${idx + 1}</div>
    <div class="step-actions">
      <button type="button" class="btn btn-secondary btn-sm" onclick="moveJourney(this,-1)" title="Move up">&#9650;</button>
      <button type="button" class="btn btn-secondary btn-sm" onclick="moveJourney(this,1)" title="Move down">&#9660;</button>
      <button type="button" class="btn btn-danger btn-sm" onclick="removeJourney(this)">x</button>
    </div>
    <select class="journey-path" style="margin-bottom:6px">
      <option value="">-- select journey --</option>
      ${optionsHtml}
    </select>
    <div class="ref-vars">${varsHtml}</div>
    <button type="button" class="btn btn-secondary btn-sm" onclick="addRefVar(this)" style="margin-top:2px">+ Variable Override</button>
  </div>`;
}
