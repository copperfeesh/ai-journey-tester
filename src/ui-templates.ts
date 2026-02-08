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
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         margin: 0; padding: 0; background: #f5f5f5; color: #333; line-height: 1.5; }
  a { color: #0066cc; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .container { max-width: 960px; margin: 0 auto; padding: 24px; }
  header { background: #1a1a2e; color: #fff; padding: 16px 0; margin-bottom: 24px; }
  header .container { display: flex; align-items: center; justify-content: space-between; padding-top: 0; padding-bottom: 0; }
  header h1 { margin: 0; font-size: 20px; font-weight: 600; }
  header a { color: #a0c4ff; }
  .card { background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.1); padding: 24px; margin-bottom: 24px; }
  .card h2 { margin-top: 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #eee; }
  th { font-weight: 600; color: #666; font-size: 13px; text-transform: uppercase; letter-spacing: .5px; }
  .actions { white-space: nowrap; }
  .actions a, .actions button { margin-right: 8px; }
  .btn { display: inline-block; padding: 8px 16px; border-radius: 6px; border: none;
         font-size: 14px; cursor: pointer; font-family: inherit; }
  .btn-primary { background: #0066cc; color: #fff; }
  .btn-primary:hover { background: #0052a3; text-decoration: none; }
  .btn-danger { background: #dc3545; color: #fff; }
  .btn-danger:hover { background: #b02a37; }
  .btn-secondary { background: #e9ecef; color: #333; }
  .btn-secondary:hover { background: #d3d7db; }
  .btn-sm { padding: 4px 10px; font-size: 13px; }
  label { display: block; font-weight: 600; margin-bottom: 4px; margin-top: 16px; font-size: 14px; }
  input[type="text"], input[type="number"], input[type="url"], textarea, select {
    width: 100%; padding: 8px 12px; border: 1px solid #ccc; border-radius: 6px;
    font-size: 14px; font-family: inherit; }
  input:focus, textarea:focus, select:focus { outline: none; border-color: #0066cc; box-shadow: 0 0 0 3px rgba(0,102,204,.15); }
  textarea { resize: vertical; min-height: 60px; }
  .field-row { display: flex; gap: 8px; align-items: flex-end; margin-bottom: 8px; }
  .field-row input, .field-row select { flex: 1; }
  .step-item { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 12px; margin-bottom: 8px; position: relative; }
  .step-item .step-num { font-weight: 700; color: #666; font-size: 13px; margin-bottom: 6px; }
  .step-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; }
  .empty-state { color: #888; font-style: italic; padding: 20px; text-align: center; }
  .form-help { font-size: 13px; color: #888; margin-top: 2px; }
  .toast { position: fixed; top: 20px; right: 20px; background: #333; color: #fff;
           padding: 12px 20px; border-radius: 6px; display: none; z-index: 999; }
  .toast.error { background: #dc3545; }
</style>
</head>
<body>
<header>
  <div class="container">
    <h1><a href="/" style="color:#fff">AI Journey Tester</a></h1>
    <nav><a href="/">Dashboard</a></nav>
  </div>
</header>
<div class="container">
${body}
</div>
<div id="toast" class="toast"></div>
</body>
</html>`;
}

export function dashboardPage(journeys: JourneySummary[], suites: SuiteSummary[]): string {
  const journeyRows = journeys.length === 0
    ? `<tr><td colspan="4" class="empty-state">No journeys yet. Create one to get started.</td></tr>`
    : journeys.map(j => `<tr>
        <td><a href="/journeys/${esc(j.filename)}/edit">${esc(j.name)}</a></td>
        <td>${esc(j.url)}</td>
        <td>${j.stepCount}</td>
        <td class="actions">
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

  return layout('Dashboard', `
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
<script>
async function deleteItem(type, filename) {
  if (!confirm('Delete ' + filename + '?')) return;
  const res = await fetch('/api/' + type + '/' + encodeURIComponent(filename), { method: 'DELETE' });
  if (res.ok) { location.reload(); }
  else { showToast('Delete failed: ' + (await res.text()), true); }
}
function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3000);
}
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

    <label for="description">Description</label>
    <textarea id="description">${esc(j.description || '')}</textarea>

    <label for="url">URL</label>
    <input type="text" id="url" value="${esc(j.url)}" required placeholder="https://example.com">
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
    <div id="steps-container">${stepItems}</div>
    <button type="button" class="btn btn-secondary btn-sm" onclick="addStep()" style="margin-top:4px">+ Add Step</button>

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

async function save() {
  const data = collectData();
  if (!data.name || !data.url || !data.steps.length) {
    showToast('Name, URL, and at least one step are required.', true);
    return;
  }
  let url, method;
  if (IS_EDIT) {
    url = '/api/journeys/' + encodeURIComponent(ORIGINAL_FILENAME);
    method = 'PUT';
  } else {
    const fn = document.getElementById('filename').value.trim();
    if (!fn) { showToast('Filename is required.', true); return; }
    url = '/api/journeys';
    method = 'POST';
    data._filename = fn;
  }
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, filename: IS_EDIT ? undefined : data._filename }),
  });
  if (res.ok) { window.location.href = '/'; }
  else { showToast('Save failed: ' + (await res.text()), true); }
}

async function deleteItem() {
  if (!confirm('Delete this journey?')) return;
  const res = await fetch('/api/journeys/' + encodeURIComponent(ORIGINAL_FILENAME), { method: 'DELETE' });
  if (res.ok) { window.location.href = '/'; }
  else { showToast('Delete failed: ' + (await res.text()), true); }
}

function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3000);
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

    <label for="description">Description</label>
    <textarea id="description">${esc(s.description || '')}</textarea>

    <label>Variables</label>
    <div id="vars-container">${varRows}</div>
    <button type="button" class="btn btn-secondary btn-sm" onclick="addVariable()" style="margin-top:4px">+ Add Variable</button>

    <label>Journeys</label>
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

async function save() {
  const data = collectData();
  if (!data.name || !data.journeys.length) {
    showToast('Name and at least one journey are required.', true);
    return;
  }
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, filename: IS_EDIT ? undefined : data._filename }),
  });
  if (res.ok) { window.location.href = '/'; }
  else { showToast('Save failed: ' + (await res.text()), true); }
}

async function deleteItem() {
  if (!confirm('Delete this suite?')) return;
  const res = await fetch('/api/suites/' + encodeURIComponent(ORIGINAL_FILENAME), { method: 'DELETE' });
  if (res.ok) { window.location.href = '/'; }
  else { showToast('Delete failed: ' + (await res.text()), true); }
}

function showToast(msg, isError) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3000);
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
