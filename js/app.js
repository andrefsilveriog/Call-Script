import { observeAuth, signIn, signUp, signOut, loadSettings, saveSettings, loadWorkspace, saveWorkspace } from './firebase-service.js';
import { exportWorkspaceToText, importWorkspaceFromText } from './schema-io.js';
import { quoteApiConfig } from './quote-config.js';

const appEl = document.getElementById('app');
const state = {
  user: null,
  settings: { repName: '', theme: 'light' },
  workspace: null,
  selectedGroupId: 'inbound',
  activeCallTypeId: null,
  activeStepId: null,
  callContext: {},
  history: [],
  settingsOpen: false,
  clientInfoOpen: false,
  quoteOpen: false,
  quoteDraft: null,
  quoteError: '',
  quoteLoading: false,
  authError: '',
};

const RATE_MODES = {
  decreasePrice: { label: 'Decrease Price', hourlyRate: 60 },
  currentRate: { label: 'Current Rate', hourlyRate: 65 },
  increasePrice: { label: 'Increase Price', hourlyRate: 80 },
};

const SERVICE_TYPES = {
  DEEP: 'DEEP',
  MOVE_IN_OUT: 'MOVE-IN/OUT',
  POST_CONSTRUCTION: 'POST CONSTRUCTION',
};

const QUOTE_BANDS = [
  { id: '0-700', min: 0, max: 700, deepToHours: 4.0, moveToHours: 5.5, weeklyToHours: 2.0, biweeklyToHours: 2.25, monthlyToHours: 2.5 },
  { id: '701-1000', min: 701, max: 1000, deepToHours: 4.25, moveToHours: 6.0, weeklyToHours: 2.0, biweeklyToHours: 2.5, monthlyToHours: 3.0 },
  { id: '1001-1250', min: 1001, max: 1250, deepToHours: 4.5, moveToHours: 6.5, weeklyToHours: 2.25, biweeklyToHours: 2.75, monthlyToHours: 3.5 },
  { id: '1251-1500', min: 1251, max: 1500, deepToHours: 5.0, moveToHours: 7.0, weeklyToHours: 2.5, biweeklyToHours: 3.0, monthlyToHours: 3.75 },
  { id: '1501-1750', min: 1501, max: 1750, deepToHours: 5.5, moveToHours: 8.0, weeklyToHours: 3.0, biweeklyToHours: 3.25, monthlyToHours: 4.0 },
  { id: '1751-2000', min: 1751, max: 2000, deepToHours: 6.0, moveToHours: 8.5, weeklyToHours: 3.25, biweeklyToHours: 3.5, monthlyToHours: 4.5 },
  { id: '2001-2250', min: 2001, max: 2250, deepToHours: 6.5, moveToHours: 9.5, weeklyToHours: 3.5, biweeklyToHours: 3.75, monthlyToHours: 5.0 },
  { id: '2251-2500', min: 2251, max: 2500, deepToHours: 7.0, moveToHours: 10.0, weeklyToHours: 3.75, biweeklyToHours: 4.0, monthlyToHours: 5.5 },
  { id: '2501-2750', min: 2501, max: 2750, deepToHours: 7.5, moveToHours: 11.0, weeklyToHours: 4.0, biweeklyToHours: 4.25, monthlyToHours: 6.0 },
  { id: '2751-3000', min: 2751, max: 3000, deepToHours: 8.0, moveToHours: 12.0, weeklyToHours: 4.25, biweeklyToHours: 4.5, monthlyToHours: 6.5 },
  { id: '3001-3500', min: 3001, max: 3500, deepToHours: 9.0, moveToHours: 13.0, weeklyToHours: 5.0, biweeklyToHours: 5.75, monthlyToHours: 7.0 },
  { id: '3501-4000', min: 3501, max: 4000, deepToHours: 10.0, moveToHours: 15.0, weeklyToHours: 5.75, biweeklyToHours: 6.25, monthlyToHours: 8.5 },
  { id: '4001-5000', min: 4001, max: 5000, deepToHours: 11.0, moveToHours: 17.0, weeklyToHours: 6.5, biweeklyToHours: 7.0, monthlyToHours: 9.0 },
  { id: '5001-6000', min: 5001, max: 6000, deepToHours: 12.0, moveToHours: 18.0, weeklyToHours: 7.5, biweeklyToHours: 8.0, monthlyToHours: 10.0 },
  { id: '6001-8000', min: 6001, max: 8000, deepToHours: 13.0, moveToHours: 22.0, weeklyToHours: 7.0, biweeklyToHours: 9.5, monthlyToHours: 11.0 },
];

const ADD_ONS = {
  doors: 30,
  windows: 10,
  laundry: 35,
  fridge: 70,
  oven: 60,
  fAndS: 115,
  laundryAndFS: 140,
};

const ADMIN_FEE_RATE = 0.03;
const INITIAL_DISCOUNT_RATE = 0.25;
const CANCELLATION_FEE_RATE = 0.05;

const PET_SURCHARGES = {
  1: { '0-700':0, '701-1000':0, '1001-1250':0, '1251-1500':0, '1501-1750':0, '1751-2000':0, '2001-2250':15, '2251-2500':15, '2501-2750':30, '2751-3000':30, '3001-3500':30, '3501-4000':30, '4001-5000':30, '5001-6000':30, '6001-8000':30 },
  2: { '0-700':15, '701-1000':15, '1001-1250':20, '1251-1500':20, '1501-1750':30, '1751-2000':30, '2001-2250':30, '2251-2500':30, '2501-2750':30, '2751-3000':30, '3001-3500':30, '3501-4000':30, '4001-5000':30, '5001-6000':30, '6001-8000':30 },
  3: { '0-700':30, '701-1000':30, '1001-1250':30, '1251-1500':30, '1501-1750':45, '1751-2000':45, '2001-2250':60, '2251-2500':60, '2501-2750':75, '2751-3000':75, '3001-3500':75, '3501-4000':75, '4001-5000':75, '5001-6000':75, '6001-8000':75 },
  4: { '0-700':45, '701-1000':45, '1001-1250':45, '1251-1500':45, '1501-1750':60, '1751-2000':60, '2001-2250':75, '2251-2500':75, '2501-2750':75, '2751-3000':75, '3001-3500':90, '3501-4000':90, '4001-5000':90, '5001-6000':90, '6001-8000':90 },
  5: { '0-700':60, '701-1000':60, '1001-1250':60, '1251-1500':60, '1501-1750':75, '1751-2000':75, '2001-2250':90, '2251-2500':90, '2501-2750':90, '2751-3000':90, '3001-3500':120, '3501-4000':120, '4001-5000':120, '5001-6000':120, '6001-8000':120 },
};

observeAuth(async (user) => {
  state.user = user;
  if (!user) {
    state.workspace = null;
    state.activeCallTypeId = null;
    state.activeStepId = null;
    render();
    return;
  }
  state.settings = await loadSettings(user.uid);
  state.workspace = await loadWorkspace(user.uid);
  applyTheme();
  render();
});

function applyTheme() {
  document.body.classList.toggle('theme-dark', state.settings.theme === 'dark');
}

function safeText(value) { return value == null ? '' : String(value); }
function firstName(value) { return String(value || '').trim().split(/\s+/)[0] || ''; }
function money(value) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0)); }
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function ceilQuarter(n) { return Math.ceil(n * 4) / 4; }
function ceilHalf(n) { return Math.ceil(n * 2) / 2; }

function deriveContext() {
  const ctx = { ...state.callContext };
  ctx.rep_name = state.settings.repName || '';
  ctx.rep_first_name = firstName(ctx.rep_name);
  ctx.client_first_name = firstName(ctx.client_name);
  return ctx;
}

function resolveTokens(text) {
  const ctx = deriveContext();
  return safeText(text).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => safeText(ctx[key]));
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#096;'); }
function valueOf(id) { return document.getElementById(id)?.value || ''; }

function getGroups() { return state.workspace?.workspace?.groups || []; }
function getCallTypes() { return state.workspace?.workspace?.call_types || []; }
function getActiveCallType() { return getCallTypes().find((ct) => ct.id === state.activeCallTypeId) || null; }
function getActiveSteps() { return getActiveCallType()?.steps || []; }
function getActiveStep() { return getActiveSteps().find((s) => s.id === state.activeStepId) || null; }

function callContextKey() {
  return state.user && state.activeCallTypeId ? `joc-call-context-${state.user.uid}-${state.activeCallTypeId}` : '';
}
function persistCallContext() {
  const key = callContextKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(state.callContext));
}
function loadCallContext(callTypeId) {
  const key = state.user ? `joc-call-context-${state.user.uid}-${callTypeId}` : '';
  if (!key) return {};
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}

function startCallType(callTypeId) {
  state.activeCallTypeId = callTypeId;
  state.activeStepId = getCallTypes().find((c) => c.id === callTypeId)?.steps?.[0]?.id || null;
  state.callContext = loadCallContext(callTypeId);
  state.history = [];
  state.clientInfoOpen = false;
  state.quoteOpen = false;
  state.quoteDraft = buildQuoteDraftFromContext();
  render();
}
function goHome() {
  state.activeCallTypeId = null;
  state.activeStepId = null;
  state.history = [];
  state.clientInfoOpen = false;
  state.quoteOpen = false;
  render();
}
function getNextStepId() {
  const step = getActiveStep();
  const steps = getActiveSteps();
  if (!step) return null;
  if (step.next_rules?.field && step.next_rules?.map) {
    const value = state.callContext[step.next_rules.field];
    if (value && step.next_rules.map[value]) return step.next_rules.map[value];
  }
  if (step.next_step_id) return step.next_step_id;
  const idx = steps.findIndex((s) => s.id === step.id);
  return steps[idx + 1]?.id || null;
}
function goNext() {
  const nextId = getNextStepId();
  if (!nextId) return;
  if (state.activeStepId) state.history.push(state.activeStepId);
  state.activeStepId = nextId;
  persistCallContext();
  render();
}
function goBack() {
  if (state.history.length) {
    state.activeStepId = state.history.pop();
    render();
    return;
  }
  const steps = getActiveSteps();
  const idx = steps.findIndex((s) => s.id === state.activeStepId);
  if (idx > 0) {
    state.activeStepId = steps[idx - 1].id;
    render();
  }
}

function normalizeFieldValue(field, value) {
  if (field === 'client_phone') return formatPhone(value);
  return value;
}
function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 10);
  const p1 = digits.slice(0, 3);
  const p2 = digits.slice(3, 6);
  const p3 = digits.slice(6, 10);
  if (!p1) return '';
  if (!p2) return `(${p1}`;
  if (!p3) return `(${p1}) ${p2}`;
  return `(${p1}) ${p2}-${p3}`;
}
function currentValue(field) { return state.callContext[field] ?? ''; }
function updateField(field, value, options = {}) {
  const { renderAfter = true } = options;
  const normalized = normalizeFieldValue(field, value);
  state.callContext[field] = normalized;
  if (field === 'client_address' && state.quoteDraft && !state.quoteOpen) state.quoteDraft.address = normalized;
  persistCallContext();
  if (renderAfter) render();
  return normalized;
}

function blockVisible(block) {
  if (block.show_when_any?.length) {
    return block.show_when_any.some((field) => safeText(state.callContext[field]).trim());
  }
  if (block.show_when_equals?.field) {
    return safeText(state.callContext[block.show_when_equals.field]) === safeText(block.show_when_equals.value);
  }
  return true;
}

function renderScriptBlock(block) {
  if (!blockVisible(block)) return '';
  switch (block.type) {
    case 'text':
      return `<div class="script-line">${escapeHtml(resolveTokens(block.text))}</div>`;
    case 'dynamic_text':
      return `<div class="script-line dynamic-line">${escapeHtml(resolveTokens(block.text))}</div>`;
    case 'field':
      return renderFieldBlock(block);
    case 'action_row':
      return renderActionRow(block);
    default:
      return '';
  }
}

function renderFieldBlock(block) {
  const value = currentValue(block.field);
  const label = escapeHtml(block.label || '');
  if (block.input === 'select') {
    const options = (block.options || []).map((opt) => `<option value="${escapeAttr(opt.value)}" ${String(value) === String(opt.value) ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`).join('');
    return `<div class="inline-field"><label>${label}</label><select data-field="${escapeAttr(block.field)}">${options}</select></div>`;
  }
  const type = block.input === 'email' ? 'email' : block.input === 'phone' ? 'tel' : 'text';
  return `<div class="inline-field"><label>${label}</label><input type="${type}" data-field="${escapeAttr(block.field)}" value="${escapeAttr(value)}" placeholder="${escapeAttr(block.placeholder || '')}" /></div>`;
}

function renderActionRow(block) {
  const buttons = (block.actions || []).map((action) => `<button class="btn" data-action="${escapeAttr(action.action)}">${escapeHtml(action.label)}</button>`).join('');
  return `<div class="inline-actions">${buttons}</div>`;
}

function renderAuth() {
  appEl.innerHTML = `
    <div class="auth-wrap">
      <div class="panel auth-card">
        <h2>Joy of Cleaning Call Guide</h2>
        <p>Clean rebuild, same Firebase project, same repo.</p>
        <div class="form-stack">
          <div class="field"><label>Email</label><input id="auth-email" type="email" autocomplete="email" /></div>
          <div class="field"><label>Password</label><input id="auth-password" type="password" autocomplete="current-password" /></div>
          <div class="auth-error">${escapeHtml(state.authError || '')}</div>
          <div class="auth-actions">
            <button class="btn primary" id="signin-btn">Sign in</button>
            <button class="btn" id="signup-btn">Create account</button>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById('signin-btn').onclick = async () => {
    try { await signIn(valueOf('auth-email'), valueOf('auth-password')); }
    catch (error) { state.authError = error.message; renderAuth(); }
  };
  document.getElementById('signup-btn').onclick = async () => {
    try { await signUp(valueOf('auth-email'), valueOf('auth-password')); }
    catch (error) { state.authError = error.message; renderAuth(); }
  };
}

function renderHome() {
  const groups = getGroups();
  const callTypes = getCallTypes().filter((ct) => ct.group_id === state.selectedGroupId);
  appEl.innerHTML = `
    <div class="app-shell">
      <div class="topbar">
        <h1>Joy of Cleaning Call Guide</h1>
        <div class="topbar-actions">
          <button class="btn" id="export-btn">Export .txt</button>
          <button class="btn" id="import-btn">Import .txt</button>
          <input class="file-input" id="import-file" type="file" accept=".txt,.json" />
          <button class="btn" id="settings-btn">Settings</button>
          <button class="btn danger" id="signout-btn">Sign out</button>
        </div>
      </div>
      <div class="group-tabs">
        ${groups.map((g) => `<button class="tab ${g.id === state.selectedGroupId ? 'active' : ''}" data-group="${escapeAttr(g.id)}">${escapeHtml(g.name)}</button>`).join('')}
      </div>
      ${callTypes.length ? `<div class="call-type-grid">${callTypes.map((ct) => `
        <div class="panel call-type-card">
          <h3>${escapeHtml(ct.name)}</h3>
          <p>${escapeHtml(ct.description || '')}</p>
          <button class="btn primary" data-start="${escapeAttr(ct.id)}">Open</button>
        </div>`).join('')}</div>` : `<div class="panel home-empty">No call types in this group yet.</div>`}
      ${state.settingsOpen ? renderSettingsModal() : ''}
    </div>`;

  appEl.querySelectorAll('[data-group]').forEach((btn) => btn.onclick = () => { state.selectedGroupId = btn.dataset.group; renderHome(); });
  appEl.querySelectorAll('[data-start]').forEach((btn) => btn.onclick = () => startCallType(btn.dataset.start));
  document.getElementById('settings-btn').onclick = () => { state.settingsOpen = true; renderHome(); };
  document.getElementById('signout-btn').onclick = () => signOut();
  document.getElementById('export-btn').onclick = () => {
    const text = exportWorkspaceToText(state.workspace);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'call-guide-workspace.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  document.getElementById('import-btn').onclick = () => document.getElementById('import-file').click();
  document.getElementById('import-file').onchange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      state.workspace = importWorkspaceFromText(text);
      await saveWorkspace(state.user.uid, state.workspace);
      renderHome();
    } catch (error) {
      alert(error.message || 'Import failed.');
    }
  };
  if (state.settingsOpen) bindSettingsModal();
}

function renderSettingsModal() {
  return `
    <div class="modal-backdrop" id="settings-backdrop">
      <div class="modal modal-small">
        <div class="modal-head"><h3>Settings</h3><div class="row"><button class="btn" id="settings-close">Close</button></div></div>
        <div class="modal-body form-stack">
          <div class="field"><label>Rep name</label><input id="settings-rep" type="text" value="${escapeAttr(state.settings.repName || '')}" placeholder="Andre" /></div>
          <div class="field"><label>Theme</label><select id="settings-theme"><option value="light" ${state.settings.theme === 'light' ? 'selected' : ''}>Light</option><option value="dark" ${state.settings.theme === 'dark' ? 'selected' : ''}>Dark</option></select></div>
          <div class="auth-actions"><button class="btn primary" id="settings-save">Save</button></div>
        </div>
      </div>
    </div>`;
}
function bindSettingsModal() {
  document.getElementById('settings-close').onclick = () => { state.settingsOpen = false; renderHome(); };
  document.getElementById('settings-backdrop').onclick = (e) => { if (e.target.id === 'settings-backdrop') { state.settingsOpen = false; renderHome(); } };
  document.getElementById('settings-save').onclick = async () => {
    state.settings.repName = valueOf('settings-rep');
    state.settings.theme = valueOf('settings-theme');
    applyTheme();
    await saveSettings(state.user.uid, state.settings);
    state.settingsOpen = false;
    renderHome();
  };
}

function renderCall() {
  const callType = getActiveCallType();
  const step = getActiveStep();
  if (!callType || !step) { goHome(); return; }
  const steps = getActiveSteps();
  appEl.innerHTML = `
    <div class="app-shell call-shell">
      <div class="call-header-row">
        <button class="btn home-btn" id="home-btn">Home</button>
        <div class="stepbar">
          ${steps.map((s, idx) => `<button class="step-tab ${s.id === step.id ? 'active' : ''}" data-step="${escapeAttr(s.id)}"><span class="step-num">${String(idx + 1).padStart(2, '0')}</span><span>${escapeHtml(s.sidebar_label || s.title || s.id)}</span></button>`).join('')}
        </div>
      </div>
      <div class="call-content-grid">
        <div class="tools-rail panel">
          <button class="tool-btn" id="tool-quote" title="Open calculator"><span class="tool-icon">🧮</span><span>Calc</span></button>
          <button class="tool-btn" id="tool-client" title="Open client info"><span class="tool-icon">👤</span><span>Client</span></button>
        </div>
        <div class="panel script-panel">
          <div class="script-stack">
            ${renderStepContent(step)}
          </div>
          <div class="nav-row">
            <button class="btn" id="back-btn">Back</button>
            <button class="btn primary" id="next-btn">Next</button>
          </div>
        </div>
      </div>
      ${state.clientInfoOpen ? renderClientInfoModal() : ''}
      ${state.quoteOpen ? renderQuoteModal() : ''}
    </div>`;

  bindCallHandlers();
}

function renderStepContent(step) {
  if (Array.isArray(step.script_blocks) && step.script_blocks.length) {
    return step.script_blocks.map(renderScriptBlock).join('');
  }
  const lines = safeText(step.script).split('\n').filter(Boolean);
  return lines.map((line) => `<div class="script-line">${escapeHtml(resolveTokens(line))}</div>`).join('');
}

function bindCallHandlers() {
  document.getElementById('home-btn').onclick = goHome;
  document.getElementById('back-btn').onclick = goBack;
  document.getElementById('next-btn').onclick = goNext;
  document.getElementById('tool-quote').onclick = openQuoteTool;
  document.getElementById('tool-client').onclick = () => { state.clientInfoOpen = true; renderCall(); };
  appEl.querySelectorAll('[data-step]').forEach((btn) => btn.onclick = () => { state.activeStepId = btn.dataset.step; renderCall(); });

  appEl.querySelectorAll('[data-field]').forEach((el) => {
    const field = el.dataset.field;
    const tag = (el.tagName || '').toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    const isTextLike = tag === 'input' && ['text', 'email', 'tel', 'search', 'number', ''].includes(type);

    if (isTextLike) {
      el.addEventListener('input', (event) => {
        const normalized = updateField(field, event.target.value, { renderAfter: false });
        if (normalized !== event.target.value) event.target.value = normalized;
      });
      el.addEventListener('blur', async (event) => {
        const prev = currentValue(field);
        const normalized = updateField(field, event.target.value, { renderAfter: false });
        if (field === 'client_address' && normalized && normalized !== prev) {
          await lookupZillowInline();
          return;
        }
        renderCall();
      });
      el.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          const prev = currentValue(field);
          const normalized = updateField(field, event.target.value, { renderAfter: false });
          if (field === 'client_address' && normalized && normalized !== prev) {
            await lookupZillowInline();
            return;
          }
          renderCall();
        }
      });
    } else {
      el.addEventListener('change', (event) => {
        updateField(field, event.target.value, { renderAfter: true });
      });
    }
  });

  appEl.querySelectorAll('[data-action]').forEach((btn) => {
    btn.onclick = async () => {
      const action = btn.dataset.action;
      if (action === 'open_quote_tool') return openQuoteTool();
      if (action === 'lookup_zillow') return lookupZillowInline();
      if (action === 'apply_latest_quote' || action === 'apply_quote_to_call') return applyQuoteToCall();
    };
  });

  if (state.clientInfoOpen) bindClientInfoModal();
  if (state.quoteOpen) bindQuoteModal();
}

async function lookupZillowInline() {
  const address = state.callContext.client_address;
  if (!address || !quoteApiConfig.rapidApiKey || quoteApiConfig.rapidApiKey === 'REPLACE_ME') {
    alert('Add your RapidAPI key in js/quote-config.js first, then enter an address.');
    return;
  }
  try {
    const data = await fetchZillow(address);
    applyZillowDataToContext(data);
    state.quoteDraft = mergeQuoteDraftWithContext(buildQuoteDraftFromContext());
    renderCall();
  } catch (error) {
    alert(error.message || 'Lookup failed.');
  }
}

async function fetchZillow(address) {
  const res = await fetch(`https://${quoteApiConfig.rapidApiHost}/byaddress?propertyaddress=${encodeURIComponent(address)}`, {
    headers: {
      'x-rapidapi-key': quoteApiConfig.rapidApiKey,
      'x-rapidapi-host': quoteApiConfig.rapidApiHost,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Lookup failed (${res.status}).`);
  return res.json();
}

function applyZillowDataToContext(data) {
  const sqft = data['Area(sqft)'] != null ? Number(data['Area(sqft)']) : '';
  state.callContext.client_address = [data?.PropertyAddress?.streetAddress, data?.PropertyAddress?.city, data?.PropertyAddress?.state, data?.PropertyAddress?.zipcode].filter(Boolean).join(', ') || state.callContext.client_address || '';
  state.callContext.sqft = sqft ? String(Math.round(sqft)) : state.callContext.sqft || '';
  state.callContext.beds = data.Bedrooms != null ? String(data.Bedrooms) : state.callContext.beds || '';
  state.callContext.baths = data.Bathrooms != null ? String(data.Bathrooms) : state.callContext.baths || '';
  persistCallContext();
}

function renderClientInfoModal() {
  return `
    <div class="modal-backdrop" id="client-backdrop">
      <div class="modal modal-small">
        <div class="modal-head"><h3>Current Client</h3><div class="row"><button class="btn" id="client-close">Close</button></div></div>
        <div class="modal-body form-stack">
          <div class="field"><label>Full name</label><input id="client-name" type="text" value="${escapeAttr(currentValue('client_name'))}" /></div>
          <div class="field"><label>Email</label><input id="client-email" type="email" value="${escapeAttr(currentValue('client_email'))}" /></div>
          <div class="field"><label>Phone</label><input id="client-phone" type="tel" value="${escapeAttr(currentValue('client_phone'))}" /></div>
          <div class="field"><label>Address</label><input id="client-address" type="text" value="${escapeAttr(currentValue('client_address'))}" /></div>
          <div class="field"><label>Sqft</label><input id="client-sqft" type="text" value="${escapeAttr(currentValue('sqft'))}" /></div>
          <div class="field"><label>Beds</label><input id="client-beds" type="text" value="${escapeAttr(currentValue('beds'))}" /></div>
          <div class="field"><label>Baths</label><input id="client-baths" type="text" value="${escapeAttr(currentValue('baths'))}" /></div>
          <div class="field"><label>Cleaning path</label><input id="client-path" type="text" value="${escapeAttr(currentValue('cleaning_path'))}" /></div>
          <div class="auth-actions">
            <button class="btn danger" id="client-clear">Clear form</button>
            <button class="btn primary" id="client-done">Done</button>
          </div>
        </div>
      </div>
    </div>`;
}

function bindClientInfoModal() {
  const softBind = (id, field) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', (event) => {
      const normalized = updateField(field, event.target.value, { renderAfter: false });
      if (normalized !== event.target.value) event.target.value = normalized;
    });
    el.addEventListener('blur', () => { persistCallContext(); });
  };
  softBind('client-name', 'client_name');
  softBind('client-email', 'client_email');
  softBind('client-phone', 'client_phone');
  softBind('client-address', 'client_address');
  softBind('client-sqft', 'sqft');
  softBind('client-beds', 'beds');
  softBind('client-baths', 'baths');
  softBind('client-path', 'cleaning_path');

  document.getElementById('client-close').onclick = () => { state.clientInfoOpen = false; renderCall(); };
  document.getElementById('client-done').onclick = () => { persistCallContext(); state.clientInfoOpen = false; renderCall(); };
  document.getElementById('client-clear').onclick = () => {
    if (!confirm('Clear the current call info?')) return;
    state.callContext = {};
    persistCallContext();
    state.quoteDraft = buildQuoteDraftFromContext();
    state.clientInfoOpen = false;
    renderCall();
  };
  document.getElementById('client-backdrop').onclick = (e) => { if (e.target.id === 'client-backdrop') { state.clientInfoOpen = false; renderCall(); } };
}

function buildQuoteDraftFromContext() {
  const serviceType = mapContextServiceToQuoteType(state.callContext.service_type || state.callContext.cleaning_path || 'DEEP');
  return {
    address: state.callContext.client_address || '',
    sqft: state.callContext.sqft || '',
    beds: state.callContext.beds || '',
    baths: state.callContext.baths || '',
    serviceType,
    rateMode: 'currentRate',
    dirtLevel: state.callContext.dirt_level || '3',
    bandId: findBandBySqft(Number(state.callContext.sqft || 0))?.id || '0-700',
    addOns: { pets: 0, doors: 0, windows: 0, laundry: 0, fridge: 0, oven: 0, fAndS: 0, laundryAndFS: 0 },
    lookup: null,
  };
}
function mergeQuoteDraftWithContext(draft) {
  const current = state.quoteDraft || {};
  return { ...current, ...draft, addOns: { ...(current.addOns || {}), ...(draft.addOns || {}) } };
}
function mapContextServiceToQuoteType(value) {
  const v = safeText(value).toLowerCase();
  if (v.includes('post')) return SERVICE_TYPES.POST_CONSTRUCTION;
  if (v.includes('move')) return SERVICE_TYPES.MOVE_IN_OUT;
  return SERVICE_TYPES.DEEP;
}

function openQuoteTool() {
  state.quoteOpen = true;
  state.quoteError = '';
  state.quoteDraft = mergeQuoteDraftWithContext(buildQuoteDraftFromContext());
  renderCall();
}
function closeQuoteTool() {
  state.quoteOpen = false;
  state.quoteLoading = false;
  state.quoteError = '';
  renderCall();
}

function readNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}
function findBandBySqft(sqft) {
  return QUOTE_BANDS.find((b) => sqft >= b.min && sqft <= b.max) || null;
}
function getBand(draft) {
  if (draft.bandId) return QUOTE_BANDS.find((b) => b.id === draft.bandId) || QUOTE_BANDS[0];
  if (draft.sqft) return findBandBySqft(Number(draft.sqft)) || QUOTE_BANDS[0];
  return QUOTE_BANDS[0];
}
function getDirtCharge(serviceType, dirt) {
  const d = readNumber(dirt, 3);
  if (d <= 3) return 0;
  const base = (d - 3) * 30;
  return serviceType === SERVICE_TYPES.MOVE_IN_OUT ? base + 30 : base;
}
function getPetCharge(pets, bandId) {
  const p = Math.max(0, Math.min(5, readNumber(pets, 0)));
  if (!p) return 0;
  return PET_SURCHARGES[p]?.[bandId] || 0;
}
function getAddOnBreakdown(addOns = {}) {
  return {
    doors: (addOns.doors || 0) * ADD_ONS.doors,
    windows: (addOns.windows || 0) * ADD_ONS.windows,
    laundry: (addOns.laundry || 0) * ADD_ONS.laundry,
    fridge: (addOns.fridge || 0) * ADD_ONS.fridge,
    oven: (addOns.oven || 0) * ADD_ONS.oven,
    fAndS: (addOns.fAndS || 0) * ADD_ONS.fAndS,
    laundryAndFS: (addOns.laundryAndFS || 0) * ADD_ONS.laundryAndFS,
  };
}
function getAddOnTotal(addOns = {}) {
  const d = getAddOnBreakdown(addOns);
  return Object.values(d).reduce((a, b) => a + b, 0);
}
function getBaseOneTimeBeforeFees(serviceType, band, rate) {
  return serviceType === SERVICE_TYPES.DEEP ? band.deepToHours * rate : band.moveToHours * rate;
}
function getRecurringBaseBeforeFees(kind, band, rate) {
  if (kind === 'weekly') return band.weeklyToHours * rate;
  if (kind === 'biweekly') return band.biweeklyToHours * rate;
  return band.monthlyToHours * rate;
}
function withAdminFee(beforeFees) {
  const adminFee = round2(beforeFees * ADMIN_FEE_RATE);
  return { beforeFees: round2(beforeFees), adminFee, total: round2(beforeFees + adminFee) };
}
function formatAddOnSummaryFromInputs(pets = 0, addOns = {}) {
  const labels = [];
  if (Number(pets) > 0) labels.push(`Pets × ${pets}`);
  [['Doors', addOns.doors], ['Windows', addOns.windows], ['Laundry', addOns.laundry], ['Fridge', addOns.fridge], ['Oven', addOns.oven], ['F&S', addOns.fAndS], ['Laundry + F&S', addOns.laundryAndFS]].forEach(([label, count]) => {
    if (Number(count) > 0) labels.push(`${label} × ${count}`);
  });
  return labels.join(' • ');
}
function calculateQuote(draft) {
  const band = getBand(draft);
  const rate = RATE_MODES[draft.rateMode || 'currentRate'].hourlyRate;
  const dirtCharge = getDirtCharge(draft.serviceType, draft.dirtLevel);
  const petCharge = getPetCharge(draft.addOns?.pets, band.id);
  const addOnBreakdown = getAddOnBreakdown(draft.addOns);
  const addOnTotal = getAddOnTotal(draft.addOns);
  let oneTimeBeforeFees = getBaseOneTimeBeforeFees(draft.serviceType, band, rate) + dirtCharge + petCharge + addOnTotal;
  let hoursEstimate;
  if (draft.serviceType === SERVICE_TYPES.POST_CONSTRUCTION) {
    oneTimeBeforeFees = round2((oneTimeBeforeFees / rate) * 1.3 * 80);
    hoursEstimate = ceilHalf(oneTimeBeforeFees / 70);
  } else {
    hoursEstimate = ceilQuarter((oneTimeBeforeFees - 10) / rate);
  }
  const oneTime = withAdminFee(oneTimeBeforeFees);
  const weekly = withAdminFee(getRecurringBaseBeforeFees('weekly', band, rate));
  const biweekly = withAdminFee(getRecurringBaseBeforeFees('biweekly', band, rate));
  const monthly = withAdminFee(getRecurringBaseBeforeFees('monthly', band, rate));
  return {
    selected: { bandId: band.id, rate, serviceType: draft.serviceType, dirt: draft.dirtLevel },
    breakdown: { baseOneTimeBeforeFees: round2(getBaseOneTimeBeforeFees(draft.serviceType === SERVICE_TYPES.DEEP ? SERVICE_TYPES.DEEP : SERVICE_TYPES.MOVE_IN_OUT, band, rate)), dirtCharge: round2(dirtCharge), petCharge: round2(petCharge), addOnBreakdown, addOnTotal: round2(addOnTotal) },
    oneTime: { ...oneTime, initial25OffAmount: round2(oneTime.beforeFees * INITIAL_DISCOUNT_RATE), discountedTotal: round2(oneTime.total * (1 - INITIAL_DISCOUNT_RATE)), cancellationFee: round2(oneTime.beforeFees * CANCELLATION_FEE_RATE), hoursEstimate },
    recurring: { weekly, biweekly, monthly },
    addOnSummary: formatAddOnSummaryFromInputs(draft.addOns?.pets, draft.addOns),
  };
}

function renderQuoteModal() {
  const draft = state.quoteDraft || buildQuoteDraftFromContext();
  const quote = calculateQuote(draft);
  const lookup = draft.lookup || {};
  const addonSummary = quote.addOnSummary || 'None selected';
  const showSplit = draft.serviceType === SERVICE_TYPES.DEEP;
  return `
    <div class="modal-backdrop" id="quote-backdrop">
      <div class="modal modal-quote">
        <div class="modal-head">
          <h3>Quote Calculator</h3>
          <div class="row">
            <button class="btn" id="quote-apply-top">Apply to Call</button>
            <button class="btn" id="quote-close-top">Close</button>
          </div>
        </div>
        <div class="modal-body quote-body">
          <div class="quote-toolbar quote-panel">
            <div class="field quote-address-field"><label>Property address</label><input id="quote-address" type="text" value="${escapeAttr(draft.address || '')}" placeholder="833 Marco Dr NE, St Petersburg, FL 33702" /></div>
            <div class="field"><label>Exact sqft</label><input id="quote-sqft" type="number" min="0" step="1" value="${escapeAttr(draft.sqft || '')}" /></div>
            <div class="toolbar-actions-inline"><button class="btn primary" id="quote-lookup">Search Zillow</button><button class="btn" id="quote-reset">Reset</button></div>
          </div>

          <div class="quote-property-card quote-panel">
            <div class="quote-property-top">
              <div>
                <div class="quote-section-title">Property summary</div>
                <div class="quote-status">${state.quoteLoading ? 'Searching Zillow…' : state.quoteError ? escapeHtml(state.quoteError) : lookup.address ? 'Property loaded' : 'No property loaded yet'}</div>
              </div>
              <div class="quote-status-chip">${lookup.address ? 'Loaded' : 'Waiting for lookup'}</div>
            </div>
            <div class="quote-property-main ${lookup.address ? 'active' : ''}">
              <div class="prop-big">
                <div class="address">${escapeHtml(lookup.address || draft.address || '—')}</div>
                <div class="meta">${buildMetaRow(lookup)}</div>
              </div>
              <div class="prop-stat"><div class="k">Bedrooms</div><div class="v">${escapeHtml(draft.beds || '—')}</div></div>
              <div class="prop-stat"><div class="k">Bathrooms</div><div class="v">${escapeHtml(draft.baths || '—')}</div></div>
              <div class="prop-stat"><div class="k">Sq. Footage</div><div class="v">${escapeHtml(draft.sqft || '—')}</div></div>
            </div>
          </div>

          <div class="quote-sheet quote-panel">
            <div class="sheet-grid">
              <div class="cell-label">Rate Mode</div>
              <div class="cell-label">Type of Cleaning</div>
              <div class="cell-label">Sq Ft Band</div>
              <div class="cell-label">Dirt</div>
              <div class="cell-label">Add-ons</div>

              <div class="cell-input"><select id="quote-rate-mode">${Object.entries(RATE_MODES).map(([key, item]) => `<option value="${key}" ${draft.rateMode === key ? 'selected' : ''}>${escapeHtml(item.label)} — ${money(item.hourlyRate)}/hr</option>`).join('')}</select></div>
              <div class="cell-input"><select id="quote-service"><option value="${SERVICE_TYPES.DEEP}" ${draft.serviceType === SERVICE_TYPES.DEEP ? 'selected' : ''}>DEEP</option><option value="${SERVICE_TYPES.MOVE_IN_OUT}" ${draft.serviceType === SERVICE_TYPES.MOVE_IN_OUT ? 'selected' : ''}>MOVE-IN/OUT</option><option value="${SERVICE_TYPES.POST_CONSTRUCTION}" ${draft.serviceType === SERVICE_TYPES.POST_CONSTRUCTION ? 'selected' : ''}>POST CONSTRUCTION</option></select></div>
              <div class="cell-input"><select id="quote-band">${QUOTE_BANDS.map((b) => `<option value="${b.id}" ${draft.bandId === b.id ? 'selected' : ''}>${b.id}</option>`).join('')}</select></div>
              <div class="cell-input"><select id="quote-dirt">${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${String(draft.dirtLevel) === String(i + 1) ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></div>
              <div class="cell-input"><details class="addons-details" ${addonSummary !== 'None selected' ? 'open' : ''}><summary><span>Add-ons menu</span><span class="addons-summary-note">${escapeHtml(addonSummary)}</span></summary>
                <div class="addons-grid">
                  ${renderAddonInput('Pets', 'quote-pets', draft.addOns?.pets || 0)}
                  ${renderAddonInput('Doors', 'quote-doors', draft.addOns?.doors || 0)}
                  ${renderAddonInput('Windows', 'quote-windows', draft.addOns?.windows || 0)}
                  ${renderAddonInput('Laundry', 'quote-laundry', draft.addOns?.laundry || 0)}
                  ${renderAddonInput('Fridge', 'quote-fridge', draft.addOns?.fridge || 0)}
                  ${renderAddonInput('Oven', 'quote-oven', draft.addOns?.oven || 0)}
                  ${renderAddonInput('F & S', 'quote-fs', draft.addOns?.fAndS || 0)}
                  ${renderAddonInput('Laundry + F&S', 'quote-laundryfs', draft.addOns?.laundryAndFS || 0)}
                </div>
              </details></div>
            </div>

            <div class="pricing-head">
              <div class="pricing-title">Base Pricing</div>
              <div class="pricing-title">Dirt</div>
              <div class="pricing-title">Add-ons</div>
            </div>
            <div class="pricing-values">
              <div class="cell-value base"><div class="k">Base one-time before fees</div><div class="v">${money(quote.breakdown.baseOneTimeBeforeFees)}</div></div>
              <div class="cell-value alt"><div class="k">Dirt</div><div class="v">${money(quote.breakdown.dirtCharge)}</div></div>
              <div class="cell-value"><div class="k">Add-ons total</div><div class="v">${money(quote.breakdown.addOnTotal + quote.breakdown.petCharge)}</div></div>
            </div>
            ${addonSummary !== 'None selected' ? `<div class="addon-breakdown-strip"><div class="addon-breakdown-title">Selected add-ons</div><div class="addon-breakdown-text">${escapeHtml(addonSummary)}</div></div>` : ''}

            <div class="bottom-grid">
              <div class="block">
                <div class="block-title">Recurring prices</div>
                <div class="table">
                  <div class="table-head">Visit</div><div class="table-head">Before Fees</div><div class="table-head">Admin Fee</div><div class="table-head">Total</div>
                  <div class="table-cell label">Weekly visit</div><div class="table-cell">${money(quote.recurring.weekly.beforeFees)}</div><div class="table-cell">${money(quote.recurring.weekly.adminFee)}</div><div class="table-cell green">${money(quote.recurring.weekly.total)}</div>
                  <div class="table-cell label">Biweekly visit</div><div class="table-cell">${money(quote.recurring.biweekly.beforeFees)}</div><div class="table-cell">${money(quote.recurring.biweekly.adminFee)}</div><div class="table-cell green">${money(quote.recurring.biweekly.total)}</div>
                  <div class="table-cell label">Monthly visit</div><div class="table-cell">${money(quote.recurring.monthly.beforeFees)}</div><div class="table-cell">${money(quote.recurring.monthly.adminFee)}</div><div class="table-cell green">${money(quote.recurring.monthly.total)}</div>
                </div>
              </div>
              <div class="block">
                <div class="block-title">One-time total</div>
                <div class="meta-grid">
                  <div class="summary-box"><div class="k">Before fees</div><div class="v">${money(quote.oneTime.beforeFees)}</div></div>
                  <div class="summary-box"><div class="k">Admin fee 3%</div><div class="v">${money(quote.oneTime.adminFee)}</div></div>
                  <div class="summary-box green big split" style="grid-column:span 2;">
                    ${showSplit ? `<div class="split-total active"><div class="split-half"><div class="k">Recurring sign-up price</div><div class="v">${money(quote.oneTime.discountedTotal)}</div></div><div class="split-half"><div class="k">Full price</div><div class="v">${money(quote.oneTime.total)}</div></div></div>` : `<div class="single-total"><div class="k">Total after fees</div><div class="v">${money(quote.oneTime.total)}</div></div>`}
                  </div>
                  <div class="summary-box"><div class="k">Initial 25% off</div><div class="v">${money(quote.oneTime.initial25OffAmount)}</div></div>
                  <div class="summary-box"><div class="k">Cancellation fee</div><div class="v">${money(quote.oneTime.cancellationFee)}</div></div>
                </div>
              </div>
              <div class="block">
                <div class="block-title">Quick facts</div>
                <div class="meta-grid">
                  <div class="summary-box"><div class="k">Service</div><div class="v">${escapeHtml(draft.serviceType)}</div></div>
                  <div class="summary-box"><div class="k">Hourly rate</div><div class="v">${money(quote.selected.rate)}</div></div>
                  <div class="summary-box"><div class="k">Hours</div><div class="v">${quote.oneTime.hoursEstimate}</div></div>
                  <div class="summary-box"><div class="k">Add-ons total</div><div class="v">${money(quote.breakdown.addOnTotal + quote.breakdown.petCharge)}</div></div>
                  <div class="summary-box" style="grid-column:span 2;"><div class="k">Band</div><div class="v">${escapeHtml(quote.selected.bandId)}</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

function buildMetaRow(lookup) {
  const metas = [];
  if (lookup.yearBuilt) metas.push(`Built ${lookup.yearBuilt}`);
  if (lookup.price) metas.push(`Listed ${money(Number(lookup.price))}`);
  if (lookup.daysOnZillow) metas.push(`${Number(lookup.daysOnZillow).toLocaleString()} days on Zillow`);
  if (lookup.url) metas.push(`<a href="${escapeAttr(lookup.url)}" target="_blank" rel="noopener">View on Zillow ↗</a>`);
  return metas.length ? metas.map((m) => `<span>${m}</span>`).join('') : '<span>No Zillow metadata yet</span>';
}
function renderAddonInput(label, id, value) {
  return `<div class="addon-item"><label for="${id}">${escapeHtml(label)}</label><select id="${id}">${Array.from({ length: 11 }, (_, i) => `<option value="${i}" ${String(value) === String(i) ? 'selected' : ''}>${i}</option>`).join('')}</select></div>`;
}

function bindQuoteModal() {
  const draft = state.quoteDraft;
  const textIds = ['quote-address', 'quote-sqft'];
  textIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => syncQuoteDraft({ renderAfter: false }));
    el.addEventListener('blur', () => syncQuoteDraft({ renderAfter: true }));
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); syncQuoteDraft({ renderAfter: true }); }
    });
  });
  ['quote-rate-mode', 'quote-service', 'quote-band', 'quote-dirt', 'quote-pets', 'quote-doors', 'quote-windows', 'quote-laundry', 'quote-fridge', 'quote-oven', 'quote-fs', 'quote-laundryfs'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => syncQuoteDraft({ renderAfter: true }));
  });

  document.getElementById('quote-close-top').onclick = closeQuoteTool;
  document.getElementById('quote-apply-top').onclick = applyQuoteToCall;
  document.getElementById('quote-backdrop').onclick = (e) => { if (e.target.id === 'quote-backdrop') closeQuoteTool(); };
  document.getElementById('quote-reset').onclick = () => { state.quoteDraft = buildQuoteDraftFromContext(); state.quoteError = ''; renderCall(); };
  document.getElementById('quote-lookup').onclick = async () => {
    syncQuoteDraft({ renderAfter: false });
    const address = state.quoteDraft.address;
    if (!address || !quoteApiConfig.rapidApiKey || quoteApiConfig.rapidApiKey === 'REPLACE_ME') {
      state.quoteError = 'Add your RapidAPI key in js/quote-config.js and enter an address.';
      renderCall();
      return;
    }
    try {
      state.quoteLoading = true;
      state.quoteError = '';
      renderCall();
      const data = await fetchZillow(address);
      state.quoteDraft.address = [data?.PropertyAddress?.streetAddress, data?.PropertyAddress?.city, data?.PropertyAddress?.state, data?.PropertyAddress?.zipcode].filter(Boolean).join(', ') || address;
      state.quoteDraft.sqft = data['Area(sqft)'] != null ? String(Math.round(Number(data['Area(sqft)']))) : state.quoteDraft.sqft;
      state.quoteDraft.beds = data.Bedrooms != null ? String(data.Bedrooms) : state.quoteDraft.beds;
      state.quoteDraft.baths = data.Bathrooms != null ? String(data.Bathrooms) : state.quoteDraft.baths;
      const band = findBandBySqft(Number(state.quoteDraft.sqft || 0));
      if (band) state.quoteDraft.bandId = band.id;
      state.quoteDraft.lookup = {
        address: state.quoteDraft.address,
        beds: state.quoteDraft.beds,
        baths: state.quoteDraft.baths,
        sqft: state.quoteDraft.sqft,
        url: data.PropertyZillowURL || '',
        yearBuilt: data.yearBuilt || '',
        price: data.Price || '',
        daysOnZillow: data.daysOnZillow || '',
      };
      state.quoteLoading = false;
      renderCall();
    } catch (error) {
      state.quoteLoading = false;
      state.quoteError = error.message || 'Lookup failed.';
      renderCall();
    }
  };
  document.addEventListener('keydown', escQuoteClose, { once: true });
}
function escQuoteClose(event) { if (event.key === 'Escape' && state.quoteOpen) closeQuoteTool(); }

function syncQuoteDraft({ renderAfter = true } = {}) {
  const draft = state.quoteDraft;
  draft.address = valueOf('quote-address');
  draft.sqft = valueOf('quote-sqft');
  draft.rateMode = valueOf('quote-rate-mode');
  draft.serviceType = valueOf('quote-service');
  draft.bandId = valueOf('quote-band');
  draft.dirtLevel = valueOf('quote-dirt');
  draft.addOns.pets = Number(valueOf('quote-pets') || 0);
  draft.addOns.doors = Number(valueOf('quote-doors') || 0);
  draft.addOns.windows = Number(valueOf('quote-windows') || 0);
  draft.addOns.laundry = Number(valueOf('quote-laundry') || 0);
  draft.addOns.fridge = Number(valueOf('quote-fridge') || 0);
  draft.addOns.oven = Number(valueOf('quote-oven') || 0);
  draft.addOns.fAndS = Number(valueOf('quote-fs') || 0);
  draft.addOns.laundryAndFS = Number(valueOf('quote-laundryfs') || 0);
  if (draft.sqft) {
    const band = findBandBySqft(Number(draft.sqft));
    if (band) draft.bandId = band.id;
  }
  state.quoteDraft = draft;
  if (renderAfter) renderCall();
}

function applyQuoteToCall() {
  if (!state.quoteDraft) return;
  const q = calculateQuote(state.quoteDraft);
  state.callContext.client_address = state.quoteDraft.address || state.callContext.client_address || '';
  state.callContext.sqft = state.quoteDraft.sqft || state.callContext.sqft || '';
  state.callContext.beds = state.quoteDraft.beds || state.callContext.beds || '';
  state.callContext.baths = state.quoteDraft.baths || state.callContext.baths || '';
  state.callContext.service_type = state.quoteDraft.serviceType || state.callContext.service_type || '';
  state.callContext.dirt_level = String(state.quoteDraft.dirtLevel || state.callContext.dirt_level || '');
  state.callContext.one_time_price = money(q.oneTime.total);
  state.callContext.weekly_price = money(q.recurring.weekly.total);
  state.callContext.biweekly_price = money(q.recurring.biweekly.total);
  state.callContext.monthly_price = money(q.recurring.monthly.total);
  state.callContext.add_on_summary = q.addOnSummary;
  persistCallContext();
  closeQuoteTool();
}

function render() {
  applyTheme();
  if (!state.user) return renderAuth();
  if (!state.workspace) {
    appEl.innerHTML = '<div class="app-shell"><div class="panel home-empty">Loading workspace…</div></div>';
    return;
  }
  if (!state.activeCallTypeId) return renderHome();
  return renderCall();
}
