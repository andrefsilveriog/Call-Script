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
  quoteOpen: false,
  quoteDraft: null,
  quoteError: '',
  authMode: 'signin',
  authError: '',
};

const QUOTE_BANDS = [
  { id: '0-700', min: 0, max: 700, deep: 4.0, move: 5.5, weekly: 2.0, biweekly: 2.25, monthly: 2.5 },
  { id: '701-1000', min: 701, max: 1000, deep: 4.25, move: 6.0, weekly: 2.0, biweekly: 2.5, monthly: 3.0 },
  { id: '1001-1250', min: 1001, max: 1250, deep: 4.5, move: 6.5, weekly: 2.25, biweekly: 2.75, monthly: 3.5 },
  { id: '1251-1500', min: 1251, max: 1500, deep: 5.0, move: 7.0, weekly: 2.5, biweekly: 3.0, monthly: 3.75 },
  { id: '1501-1750', min: 1501, max: 1750, deep: 5.5, move: 8.0, weekly: 3.0, biweekly: 3.25, monthly: 4.0 },
  { id: '1751-2000', min: 1751, max: 2000, deep: 6.0, move: 8.5, weekly: 3.25, biweekly: 3.5, monthly: 4.5 },
  { id: '2001-2250', min: 2001, max: 2250, deep: 6.5, move: 9.5, weekly: 3.5, biweekly: 3.75, monthly: 5.0 },
  { id: '2251-2500', min: 2251, max: 2500, deep: 7.0, move: 10.0, weekly: 3.75, biweekly: 4.0, monthly: 5.5 },
  { id: '2501-2750', min: 2501, max: 2750, deep: 7.5, move: 11.0, weekly: 4.0, biweekly: 4.25, monthly: 6.0 },
  { id: '2751-3000', min: 2751, max: 3000, deep: 8.0, move: 12.0, weekly: 4.25, biweekly: 4.5, monthly: 6.5 },
  { id: '3001-3500', min: 3001, max: 3500, deep: 9.0, move: 13.0, weekly: 5.0, biweekly: 5.75, monthly: 7.0 },
  { id: '3501-4000', min: 3501, max: 4000, deep: 10.0, move: 15.0, weekly: 5.75, biweekly: 6.25, monthly: 8.5 },
  { id: '4001-5000', min: 4001, max: 5000, deep: 11.0, move: 17.0, weekly: 6.5, biweekly: 7.0, monthly: 9.0 },
  { id: '5001-6000', min: 5001, max: 6000, deep: 12.0, move: 18.0, weekly: 7.5, biweekly: 8.0, monthly: 10.0 },
  { id: '6001-8000', min: 6001, max: 8000, deep: 13.0, move: 22.0, weekly: 7.0, biweekly: 9.5, monthly: 11.0 },
];
const ADD_ON_RATES = { fridge: 70, oven: 60, windows: 10, pets: 30 };
const RATE = 65;

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

function deriveContext() {
  const ctx = { ...state.callContext };
  ctx.rep_name = state.settings.repName || '';
  ctx.rep_first_name = firstName(ctx.rep_name);
  ctx.client_first_name = firstName(ctx.client_name);
  return ctx;
}

function firstName(value) {
  return String(value || '').trim().split(/\s+/)[0] || '';
}

function safeText(value) {
  return value == null ? '' : String(value);
}

function resolveTokens(text) {
  const ctx = deriveContext();
  return safeText(text).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => safeText(ctx[key]));
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

function getGroups() {
  return state.workspace?.workspace?.groups || [];
}

function getCallTypes() {
  return state.workspace?.workspace?.call_types || [];
}

function getActiveCallType() {
  return getCallTypes().find((ct) => ct.id === state.activeCallTypeId) || null;
}

function getActiveSteps() {
  return getActiveCallType()?.steps || [];
}

function getActiveStep() {
  return getActiveSteps().find((s) => s.id === state.activeStepId) || null;
}

function startCallType(callTypeId) {
  state.activeCallTypeId = callTypeId;
  const firstStep = getActiveCallType()?.steps?.[0];
  state.activeStepId = firstStep?.id || null;
  state.callContext = loadCallContext(callTypeId);
  state.history = [];
  render();
}

function goHome() {
  state.activeCallTypeId = null;
  state.activeStepId = null;
  state.history = [];
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
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
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

function currentValue(field) {
  return state.callContext[field] ?? '';
}

function updateField(field, value) {
  if (field === 'client_phone') value = formatPhone(value);
  state.callContext[field] = value;
  persistCallContext();
  render();
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
    render();
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
        <p>Fresh rebuild. Same Firebase project, same repo, clean foundation.</p>
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
    state.authError = '';
    renderAuth();
    try {
      await signIn(valueOf('auth-email'), valueOf('auth-password'));
    } catch (error) {
      state.authError = error.message;
      renderAuth();
    }
  };
  document.getElementById('signup-btn').onclick = async () => {
    state.authError = '';
    renderAuth();
    try {
      await signUp(valueOf('auth-email'), valueOf('auth-password'));
    } catch (error) {
      state.authError = error.message;
      renderAuth();
    }
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
      <div class="modal" style="width:min(460px,100%)">
        <div class="modal-head">
          <h3>Settings</h3>
          <div class="row"><button class="btn" id="settings-close">Close</button></div>
        </div>
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
  if (!callType || !step) {
    goHome();
    return;
  }
  const steps = getActiveSteps();
  appEl.innerHTML = `
    <div class="app-shell call-shell">
      <div class="stepbar">
        <button class="btn home-btn" id="home-btn">Home</button>
        ${steps.map((s) => `<button class="step-tab ${s.id === step.id ? 'active' : ''}" data-step="${escapeAttr(s.id)}">${escapeHtml(s.sidebar_label || s.title || s.id)}</button>`).join('')}
      </div>
      <div class="panel script-panel">
        <div class="script-stack">
          ${(step.script_blocks || []).map(renderScriptBlock).join('')}
        </div>
        <div class="nav-row">
          <button class="btn" id="back-btn">Back</button>
          <button class="btn primary" id="next-btn">Next</button>
        </div>
      </div>
      ${state.quoteOpen ? renderQuoteModal() : ''}
    </div>`;

  document.getElementById('home-btn').onclick = goHome;
  document.getElementById('back-btn').onclick = goBack;
  document.getElementById('next-btn').onclick = goNext;
  appEl.querySelectorAll('[data-step]').forEach((btn) => btn.onclick = () => { state.activeStepId = btn.dataset.step; renderCall(); });
  appEl.querySelectorAll('[data-field]').forEach((el) => {
    const field = el.dataset.field;
    const handler = (event) => updateField(field, event.target.value);
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  });
  appEl.querySelectorAll('[data-action]').forEach((btn) => btn.onclick = handleActionClick);
  if (state.quoteOpen) bindQuoteModal();
}

function handleActionClick(event) {
  const action = event.currentTarget.dataset.action;
  if (action === 'lookup_zillow') return lookupZillowInline();
  if (action === 'open_quote_tool') return openQuoteTool();
  if (action === 'apply_quote_to_call') return applyQuoteToCall();
}

function openQuoteTool() {
  if (!state.quoteDraft) {
    state.quoteDraft = {
      address: state.callContext.client_address || '',
      sqft: state.callContext.sqft || '',
      beds: state.callContext.beds || '',
      baths: state.callContext.baths || '',
      serviceType: mapCleaningPathToServiceType(state.callContext.cleaning_path) || state.callContext.service_type || 'DEEP',
      dirtLevel: state.callContext.dirt_level || '3',
      addOns: { fridge: 0, oven: 0, windows: 0, pets: 0 },
    };
  }
  state.quoteOpen = true;
  renderCall();
}

function mapCleaningPathToServiceType(path) {
  if (path === 'move_in_out') return 'MOVE-IN/OUT';
  if (path === 'post_construction') return 'POST CONSTRUCTION';
  return 'DEEP';
}

function calculateQuote(draft) {
  const sqft = Number(draft.sqft || 0);
  const band = QUOTE_BANDS.find((b) => sqft >= b.min && sqft <= b.max) || QUOTE_BANDS[0];
  const serviceType = draft.serviceType || 'DEEP';
  const rate = RATE;
  const dirt = Math.max(1, Math.min(10, Number(draft.dirtLevel || 3)));
  const dirtCharge = dirt > 3 ? (dirt - 3) * 30 + (serviceType === 'MOVE-IN/OUT' ? 30 : 0) : 0;
  const addOnTotal = Number(draft.addOns?.fridge || 0) * ADD_ON_RATES.fridge + Number(draft.addOns?.oven || 0) * ADD_ON_RATES.oven + Number(draft.addOns?.windows || 0) * ADD_ON_RATES.windows + Number(draft.addOns?.pets || 0) * ADD_ON_RATES.pets;
  const baseHours = serviceType === 'DEEP' ? band.deep : band.move;
  const recurringWeekly = money(band.weekly * rate * 1.03);
  const recurringBiweekly = money(band.biweekly * rate * 1.03);
  const recurringMonthly = money(band.monthly * rate * 1.03);
  const oneTimeBeforeFees = baseHours * rate + dirtCharge + addOnTotal;
  const oneTime = money(oneTimeBeforeFees * 1.03);
  return {
    bandId: band.id,
    oneTime,
    weekly: recurringWeekly,
    biweekly: recurringBiweekly,
    monthly: recurringMonthly,
    addOnSummary: summarizeAddOns(draft.addOns),
  };
}

function summarizeAddOns(addOns = {}) {
  const parts = [];
  if (Number(addOns.fridge || 0)) parts.push(`Fridge × ${addOns.fridge}`);
  if (Number(addOns.oven || 0)) parts.push(`Oven × ${addOns.oven}`);
  if (Number(addOns.windows || 0)) parts.push(`Windows × ${addOns.windows}`);
  if (Number(addOns.pets || 0)) parts.push(`Pets × ${addOns.pets}`);
  return parts.join(' • ');
}

function renderQuoteModal() {
  const draft = state.quoteDraft || {
    address: '', sqft: '', beds: '', baths: '', serviceType: 'DEEP', dirtLevel: '3', addOns: { fridge: 0, oven: 0, windows: 0, pets: 0 },
  };
  const quote = calculateQuote(draft);
  return `
    <div class="modal-backdrop" id="quote-backdrop">
      <div class="modal">
        <div class="modal-head">
          <h3>Quote Calculator</h3>
          <div class="row">
            <button class="btn" id="quote-apply-top">Apply to Call</button>
            <button class="btn" id="quote-close-top">Close</button>
          </div>
        </div>
        <div class="modal-body quote-grid">
          <div class="quote-toolbar">
            <div class="field"><label>Property address</label><input id="quote-address" type="text" value="${escapeAttr(draft.address || '')}" placeholder="833 Marco Dr NE, St Petersburg, FL 33702" /></div>
            <div class="field"><label>Exact sqft</label><input id="quote-sqft" type="number" min="0" step="1" value="${escapeAttr(draft.sqft || '')}" /></div>
            <div class="topbar-actions" style="align-items:end"><button class="btn primary" id="quote-lookup">Search Zillow</button></div>
          </div>
          ${state.quoteError ? `<div class="quote-note" style="color: var(--danger)">${escapeHtml(state.quoteError)}</div>` : ''}
          <div class="quote-summary">
            <div class="summary-card"><div class="k">Beds</div><div class="v">${escapeHtml(draft.beds || '—')}</div></div>
            <div class="summary-card"><div class="k">Baths</div><div class="v">${escapeHtml(draft.baths || '—')}</div></div>
            <div class="summary-card"><div class="k">One-Time</div><div class="v">${escapeHtml(quote.oneTime)}</div></div>
            <div class="summary-card"><div class="k">Biweekly</div><div class="v">${escapeHtml(quote.biweekly)}</div></div>
          </div>
          <div class="quote-fields">
            <div class="field"><label>Service type</label><select id="quote-service"><option ${draft.serviceType === 'DEEP' ? 'selected' : ''}>DEEP</option><option ${draft.serviceType === 'MOVE-IN/OUT' ? 'selected' : ''}>MOVE-IN/OUT</option><option ${draft.serviceType === 'POST CONSTRUCTION' ? 'selected' : ''}>POST CONSTRUCTION</option></select></div>
            <div class="field"><label>Dirt level</label><select id="quote-dirt">${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}" ${String(draft.dirtLevel) === String(i + 1) ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></div>
            <div class="field"><label>Band</label><input type="text" value="${escapeAttr(quote.bandId)}" disabled /></div>
            <div class="field"><label>Fridge</label><input id="quote-fridge" type="number" min="0" step="1" value="${escapeAttr(draft.addOns.fridge || 0)}" /></div>
            <div class="field"><label>Oven</label><input id="quote-oven" type="number" min="0" step="1" value="${escapeAttr(draft.addOns.oven || 0)}" /></div>
            <div class="field"><label>Windows</label><input id="quote-windows" type="number" min="0" step="1" value="${escapeAttr(draft.addOns.windows || 0)}" /></div>
            <div class="field"><label>Pets</label><input id="quote-pets" type="number" min="0" step="1" value="${escapeAttr(draft.addOns.pets || 0)}" /></div>
          </div>
          <div class="quote-summary">
            <div class="summary-card"><div class="k">Weekly</div><div class="v">${escapeHtml(quote.weekly)}</div></div>
            <div class="summary-card"><div class="k">Biweekly</div><div class="v">${escapeHtml(quote.biweekly)}</div></div>
            <div class="summary-card"><div class="k">Monthly</div><div class="v">${escapeHtml(quote.monthly)}</div></div>
            <div class="summary-card"><div class="k">Add-ons</div><div class="v">${escapeHtml(quote.addOnSummary || '—')}</div></div>
          </div>
          <div class="topbar-actions"><button class="btn primary" id="quote-apply-bottom">Apply to Call</button></div>
        </div>
      </div>
    </div>`;
}

function bindQuoteModal() {
  const draft = state.quoteDraft;
  const bind = (id, cb) => { const el = document.getElementById(id); if (el) el.oninput = cb, el.onchange = cb; };
  const refreshDraft = () => {
    draft.address = valueOf('quote-address');
    draft.sqft = valueOf('quote-sqft');
    draft.serviceType = valueOf('quote-service');
    draft.dirtLevel = valueOf('quote-dirt');
    draft.addOns.fridge = Number(valueOf('quote-fridge') || 0);
    draft.addOns.oven = Number(valueOf('quote-oven') || 0);
    draft.addOns.windows = Number(valueOf('quote-windows') || 0);
    draft.addOns.pets = Number(valueOf('quote-pets') || 0);
    state.quoteDraft = draft;
    renderCall();
  };
  ['quote-address', 'quote-sqft', 'quote-service', 'quote-dirt', 'quote-fridge', 'quote-oven', 'quote-windows', 'quote-pets'].forEach((id) => bind(id, refreshDraft));
  document.getElementById('quote-close-top').onclick = closeQuoteTool;
  document.getElementById('quote-apply-top').onclick = applyQuoteToCall;
  document.getElementById('quote-apply-bottom').onclick = applyQuoteToCall;
  document.getElementById('quote-backdrop').onclick = (e) => { if (e.target.id === 'quote-backdrop') closeQuoteTool(); };
  document.getElementById('quote-lookup').onclick = async () => {
    state.quoteError = '';
    const address = valueOf('quote-address');
    if (!address || !quoteApiConfig.rapidApiKey || quoteApiConfig.rapidApiKey === 'REPLACE_ME') {
      state.quoteError = 'Add your RapidAPI key in js/quote-config.js and enter an address.';
      renderCall();
      return;
    }
    try {
      const data = await fetchZillow(address);
      draft.address = [data?.PropertyAddress?.streetAddress, data?.PropertyAddress?.city, data?.PropertyAddress?.state, data?.PropertyAddress?.zipcode].filter(Boolean).join(', ') || address;
      draft.sqft = data['Area(sqft)'] != null ? String(Math.round(Number(data['Area(sqft)']))) : draft.sqft;
      draft.beds = data.Bedrooms != null ? String(data.Bedrooms) : draft.beds;
      draft.baths = data.Bathrooms != null ? String(data.Bathrooms) : draft.baths;
      state.quoteDraft = draft;
      state.quoteError = '';
      renderCall();
    } catch (error) {
      state.quoteError = error.message || 'Lookup failed.';
      renderCall();
    }
  };
  document.addEventListener('keydown', escQuoteClose, { once: true });
}

function escQuoteClose(event) {
  if (event.key === 'Escape' && state.quoteOpen) closeQuoteTool();
}

function closeQuoteTool() {
  state.quoteOpen = false;
  state.quoteError = '';
  renderCall();
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
  state.callContext.one_time_price = q.oneTime;
  state.callContext.weekly_price = q.weekly;
  state.callContext.biweekly_price = q.biweekly;
  state.callContext.monthly_price = q.monthly;
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

function valueOf(id) {
  return document.getElementById(id)?.value || '';
}

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}
