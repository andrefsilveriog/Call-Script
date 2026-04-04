import { BRANCH_COLORS } from "./defaults.js";
import {
  isConfigured,
  subscribeToAuth,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  loadWorkspace,
  saveWorkspace,
  seedWorkspaceIfEmpty,
} from "./firebase-service.js";

const root = document.getElementById("app");

const state = {
  user: null,
  loading: true,
  workspace: null,
  draft: null,
  activeFlowId: null,
  activeStepId: null,
  editMode: false,
  authMode: "signin",
  authError: "",
  authInfo: "",
  saveError: "",
  saveInfo: "",
  authPending: false,
};

const palette = {
  light: {
    bg: "#f1f5f9",
    sidebar: "#ffffff",
    sidebarBorder: "#e2e8f0",
    card: "#ffffff",
    cardBorder: "#e2e8f0",
    scriptBg: "#ecfdf5",
    scriptBorder: "#0891b2",
    scriptText: "#134e4a",
    text: "#0f172a",
    textSecondary: "#475569",
    textMuted: "#94a3b8",
    accent: "#0891b2",
    accentSoft: "#cffafe",
    topBar: "#0f172a",
    topBarText: "#e2e8f0",
    topBarInactive: "rgba(255,255,255,0.08)",
    surface2: "#f8fafc",
    input: "#ffffff",
    danger: "#dc2626",
    success: "#059669",
  },
  dark: {
    bg: "#0f172a",
    sidebar: "#1e293b",
    sidebarBorder: "#334155",
    card: "#1e293b",
    cardBorder: "#334155",
    scriptBg: "#064e3b",
    scriptBorder: "#14b8a6",
    scriptText: "#a7f3d0",
    text: "#e2e8f0",
    textSecondary: "#94a3b8",
    textMuted: "#64748b",
    accent: "#14b8a6",
    accentSoft: "#134e4a",
    topBar: "#020617",
    topBarText: "#e2e8f0",
    topBarInactive: "rgba(255,255,255,0.06)",
    surface2: "#0f172a",
    input: "#0f172a",
    danger: "#f87171",
    success: "#34d399",
  },
};

function currentWorkspace() {
  return state.editMode ? state.draft : state.workspace;
}

function currentTheme() {
  return currentWorkspace()?.theme || state.workspace?.theme || "dark";
}

function themeVars() {
  return palette[currentTheme()] || palette.dark;
}

function currentFlowIndex() {
  const flows = currentWorkspace()?.flows || [];
  const index = flows.findIndex((flow) => flow.id === state.activeFlowId);
  return index >= 0 ? index : 0;
}

function currentFlow() {
  const flows = currentWorkspace()?.flows || [];
  return flows[currentFlowIndex()] || null;
}

function currentStepIndex() {
  const flow = currentFlow();
  const steps = flow?.steps || [];
  const index = steps.findIndex((step) => step.id === state.activeStepId);
  return index >= 0 ? index : 0;
}

function currentStep() {
  const flow = currentFlow();
  return flow?.steps?.[currentStepIndex()] || null;
}

function parentStep() {
  const step = currentStep();
  const flow = currentFlow();
  return step?.parentId ? flow?.steps?.find((item) => item.id === step.parentId) || null : null;
}

function ensureSelections() {
  const workspace = currentWorkspace();
  if (!workspace) return;
  if (!workspace.flows.length) {
    state.activeFlowId = null;
    state.activeStepId = null;
    return;
  }
  const flow = workspace.flows.find((item) => item.id === state.activeFlowId) || workspace.flows[0];
  state.activeFlowId = flow.id;
  if (!flow.steps.length) {
    state.activeStepId = null;
    return;
  }
  const step = flow.steps.find((item) => item.id === state.activeStepId) || flow.steps[0];
  state.activeStepId = step.id;
}

function deepClone(value) {
  return structuredClone(value);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderText(value = "") {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

function pathString(parts) {
  return parts.join("|");
}

function readPath(obj, path) {
  return path.split("|").reduce((acc, part) => {
    if (acc == null) return undefined;
    if (/^\d+$/.test(part)) return acc[Number(part)];
    return acc[part];
  }, obj);
}

function setPath(obj, path, value) {
  const parts = path.split("|");
  let cursor = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
    cursor = cursor[part];
  }
  const lastPart = /^\d+$/.test(parts.at(-1)) ? Number(parts.at(-1)) : parts.at(-1);
  cursor[lastPart] = value;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || `item-${Date.now().toString(36)}`;
}

function uniqueId(base, existingIds) {
  let next = slugify(base);
  let counter = 2;
  while (existingIds.has(next)) {
    next = `${slugify(base)}-${counter}`;
    counter += 1;
  }
  return next;
}

function sortByOrder(items) {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function normalizeWorkspace(workspace) {
  const flows = sortByOrder(workspace.flows || []).map((flow, flowIndex) => ({
    ...flow,
    order: flowIndex,
    steps: sortByOrder(flow.steps || []).map((step, stepIndex) => ({
      keyPoints: [],
      branches: [],
      main: false,
      special: false,
      guarantees: null,
      followUp: null,
      extra: null,
      ...step,
      order: stepIndex,
    })),
  }));
  return {
    theme: workspace.theme || "dark",
    flows,
  };
}

function statusMarkup() {
  const notices = [];
  if (!isConfigured()) {
    notices.push(`<div class="notice notice-warn">Firebase is not configured yet. Add your project's web config to <code>js/firebase-config.js</code>.</div>`);
  }
  if (state.saveError) notices.push(`<div class="notice notice-error">${escapeHtml(state.saveError)}</div>`);
  if (state.saveInfo) notices.push(`<div class="notice notice-success">${escapeHtml(state.saveInfo)}</div>`);
  if (state.authError) notices.push(`<div class="notice notice-error">${escapeHtml(state.authError)}</div>`);
  if (state.authInfo) notices.push(`<div class="notice notice-success">${escapeHtml(state.authInfo)}</div>`);
  return notices.join("");
}

function renderField(label, path, options = {}) {
  const value = readPath(state.draft, path) ?? options.fallback ?? "";
  const type = options.type || "text";
  const checked = type === "checkbox" ? Boolean(value) : false;
  const desc = options.desc ? `<div class="builder-help">${escapeHtml(options.desc)}</div>` : "";
  const input = type === "textarea"
    ? `<textarea class="form-control ${options.mono ? "mono" : ""}" data-path="${path}">${escapeHtml(value)}</textarea>`
    : type === "checkbox"
      ? `<label class="checkbox-row"><input type="checkbox" data-path="${path}" ${checked ? "checked" : ""}> <span>${escapeHtml(options.checkboxLabel || label)}</span></label>`
      : type === "select"
        ? `<select class="form-control" data-path="${path}">${(options.options || []).map((opt) => `<option value="${escapeHtml(opt.value)}" ${String(opt.value) === String(value ?? "") ? "selected" : ""}>${escapeHtml(opt.label)}</option>`).join("")}</select>`
        : `<input class="form-control ${options.mono ? "mono" : ""}" type="${type}" data-path="${path}" value="${escapeHtml(value)}">`;

  return `
    <div class="field-group ${type === "checkbox" ? "field-group-checkbox" : ""}">
      ${type === "checkbox" ? "" : `<label class="field-label">${escapeHtml(label)}</label>`}
      ${input}
      ${desc}
    </div>
  `;
}

function renderDisplayOrInput(path, value, kind = "text", placeholder = "") {
  if (!state.editMode) {
    return kind === "textarea"
      ? `<div class="display-block">${renderText(value)}</div>`
      : `<div class="display-inline">${escapeHtml(value || placeholder)}</div>`;
  }
  return kind === "textarea"
    ? `<textarea class="inline-edit ${kind}" data-path="${path}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value || "")}</textarea>`
    : `<input class="inline-edit" data-path="${path}" value="${escapeHtml(value || "")}" placeholder="${escapeHtml(placeholder)}">`;
}

function renderStepContent() {
  const flow = currentFlow();
  const step = currentStep();
  const theme = themeVars();
  if (!flow || !step) {
    return `<div class="empty-state"><div class="emoji">🧩</div><h3>No step selected</h3><p>Create a step in edit mode to get started.</p></div>`;
  }

  const flowIndex = currentFlowIndex();
  const stepIndex = currentStepIndex();
  const base = ["flows", flowIndex, "steps", stepIndex];

  const specialGuarantees = Array.isArray(step.guarantees) ? `
    <div class="stack-list">
      ${step.guarantees.map((item, index) => `
        <article class="stack-card" style="border-left-color:${escapeHtml(item.color || theme.success)}">
          <div class="stack-topline">GUARANTEE #${index + 1}</div>
          ${renderDisplayOrInput(pathString([...base, "guarantees", index, "name"]), item.name || "", "text", "Guarantee name")}
          ${renderDisplayOrInput(pathString([...base, "guarantees", index, "script"]), item.script || "", "textarea", "Guarantee script")}
          ${state.editMode ? `<div class="inline-row">${renderField("Color", pathString([...base, "guarantees", index, "color"]), { type: "text" })}<button class="ghost danger" data-action="remove-guarantee" data-index="${index}">Remove</button></div>` : ""}
        </article>
      `).join("")}
      ${state.editMode ? `<button class="ghost" data-action="add-guarantee">+ Add guarantee</button>` : ""}
    </div>
  ` : "";

  const specialFollowUp = Array.isArray(step.followUp) ? `
    <div class="stack-list">
      ${step.followUp.map((item, index) => `
        <article class="stack-card stack-card-purple">
          <div class="stack-topline">${escapeHtml(item.day || `Day ${index + 1}`)}</div>
          ${renderDisplayOrInput(pathString([...base, "followUp", index, "day"]), item.day || "", "text", "Timing label")}
          ${renderDisplayOrInput(pathString([...base, "followUp", index, "content"]), item.content || "", "textarea", "Follow-up content")}
          ${state.editMode ? `<button class="ghost danger" data-action="remove-followup" data-index="${index}">Remove</button>` : ""}
        </article>
      `).join("")}
      ${state.editMode ? `<button class="ghost" data-action="add-followup">+ Add follow-up item</button>` : ""}
    </div>
  ` : "";

  const standardScript = !step.guarantees && !step.followUp ? `
    ${step.script || state.editMode ? `
      <section class="script-card">
        <div class="eyebrow">SCRIPT</div>
        ${renderDisplayOrInput(pathString([...base, "script"]), step.script || "", "textarea", "Add script")}
      </section>
    ` : ""}

    ${step.keyPoints?.length || state.editMode ? `
      <section class="content-section">
        <div class="eyebrow muted">KEY POINTS</div>
        <div class="bullet-list">
          ${(step.keyPoints || []).map((point, index) => `
            <div class="bullet-row">
              <span class="bullet-dot">●</span>
              ${renderDisplayOrInput(pathString([...base, "keyPoints", index]), point, "text", "Key point")}
              ${state.editMode ? `<button class="icon-button danger" data-action="remove-key-point" data-index="${index}">✕</button>` : ""}
            </div>
          `).join("")}
          ${state.editMode ? `<button class="ghost" data-action="add-key-point">+ Add key point</button>` : ""}
        </div>
      </section>
    ` : ""}

    ${step.extra ? `
      <section class="content-section extra-card">
        ${renderDisplayOrInput(pathString([...base, "extra", "title"]), step.extra.title || "", "text", "Extra section title")}
        <div class="extra-items">
          ${(step.extra.items || []).map((item, index) => `
            <div class="bullet-row">
              <span class="extra-dot">•</span>
              ${renderDisplayOrInput(pathString([...base, "extra", "items", index]), item, "text", "Extra item")}
              ${state.editMode ? `<button class="icon-button danger" data-action="remove-extra-item" data-index="${index}">✕</button>` : ""}
            </div>
          `).join("")}
          ${state.editMode ? `<div class="inline-row"><button class="ghost" data-action="add-extra-item">+ Add extra item</button><button class="ghost" data-action="remove-extra-block">Remove block</button></div>` : ""}
        </div>
      </section>
    ` : state.editMode ? `<button class="ghost" data-action="add-extra-block">+ Add extra reference block</button>` : ""}
  ` : "";

  const branches = step.branches?.length ? `
    <div class="branch-wrap">
      ${step.branches.map((branch, index) => {
        const colors = BRANCH_COLORS[branch.color] || BRANCH_COLORS.flow;
        return `
          <button class="branch-btn" data-nav-step="${escapeHtml(branch.targetId || "")}" style="background:${colors.bg};color:${colors.text}">
            ${escapeHtml(branch.label || `Branch ${index + 1}`)}
          </button>
        `;
      }).join("")}
    </div>
  ` : "";

  return `
    <div class="step-shell">
      ${specialGuarantees || specialFollowUp || standardScript}
      ${branches}
      ${step.next ? `<div class="next-wrap"><button class="branch-btn" data-nav-step="${escapeHtml(step.next)}">Next →</button></div>` : ""}
      ${step.toneCue || state.editMode ? `<section class="tone-card">${renderDisplayOrInput(pathString([...base, "toneCue"]), step.toneCue || "", "textarea", "Tone cue")}</section>` : ""}
    </div>
  `;
}

function renderBuilder() {
  if (!state.editMode) return "";
  const flow = currentFlow();
  const step = currentStep();
  const flowIndex = currentFlowIndex();
  const stepIndex = currentStepIndex();
  const flows = state.draft?.flows || [];
  const stepOptions = [{ value: "", label: "None" }, ...(flow?.steps || []).map((item) => ({ value: item.id, label: `${item.num || "•"} — ${item.label || item.title || item.id}` }))];

  return `
    <aside class="builder-panel">
      <div class="builder-head">
        <div>
          <div class="builder-kicker">EDIT MODE</div>
          <h2>Builder</h2>
        </div>
        <p>Everything you change stays local until you hit the floating checkmark.</p>
      </div>

      <section class="builder-section">
        <div class="section-head">
          <h3>Call Types</h3>
          <button class="ghost" data-action="create-flow">+ New call type</button>
        </div>
        <div class="builder-list">
          ${flows.map((item, index) => `
            <div class="builder-list-item ${item.id === state.activeFlowId ? "active" : ""}">
              <button class="builder-nav" data-nav-flow="${escapeHtml(item.id)}">${escapeHtml(item.icon || "📞")} ${escapeHtml(item.name || item.id)}</button>
              <span class="builder-actions-inline">
                <button class="mini-btn" data-action="move-flow-up" data-flow-index="${index}">↑</button>
                <button class="mini-btn" data-action="move-flow-down" data-flow-index="${index}">↓</button>
                <button class="mini-btn danger" data-action="delete-flow" data-flow-index="${index}">✕</button>
              </span>
            </div>
          `).join("")}
        </div>
        ${flow ? `
          <div class="builder-grid two-col">
            ${renderField("Flow name", pathString(["flows", flowIndex, "name"]))}
            ${renderField("Icon", pathString(["flows", flowIndex, "icon"]))}
            <div class="field-group"><label class="field-label">Flow ID</label><code class="readonly-code">${escapeHtml(flow.id)}</code><div class="builder-help">Auto-generated for reliability.</div></div>
            ${renderField("Description", pathString(["flows", flowIndex, "desc"]))}
          </div>
        ` : ""}
      </section>

      <section class="builder-section">
        <div class="section-head">
          <h3>Steps</h3>
          <div class="inline-row compact">
            <button class="ghost" data-action="create-step">+ New step</button>
            ${step ? `<button class="ghost" data-action="duplicate-step">Duplicate</button>` : ""}
          </div>
        </div>
        ${flow?.steps?.length ? `
          <div class="builder-list step-list">
            ${flow.steps.map((item, index) => `
              <div class="builder-list-item ${item.id === state.activeStepId ? "active" : ""}">
                <button class="builder-nav" data-nav-step="${escapeHtml(item.id)}">${escapeHtml(item.num || "•")} — ${escapeHtml(item.label || item.title || item.id)}</button>
                <span class="builder-actions-inline">
                  <button class="mini-btn" data-action="move-step-up" data-step-index="${index}">↑</button>
                  <button class="mini-btn" data-action="move-step-down" data-step-index="${index}">↓</button>
                  <button class="mini-btn danger" data-action="delete-step" data-step-index="${index}">✕</button>
                </span>
              </div>
            `).join("")}
          </div>
        ` : `<div class="empty-mini">No steps yet in this flow.</div>`}

        ${step ? `
          <div class="builder-grid two-col">
            ${renderField("Step label", pathString(["flows", flowIndex, "steps", stepIndex, "label"]))}
            ${renderField("Step number", pathString(["flows", flowIndex, "steps", stepIndex, "num"]))}
            <div class="field-group"><label class="field-label">Step ID</label><code class="readonly-code">${escapeHtml(step.id)}</code><div class="builder-help">Auto-generated for branches and next-step links.</div></div>
            ${renderField("Title", pathString(["flows", flowIndex, "steps", stepIndex, "title"]))}
            ${renderField("Subtitle", pathString(["flows", flowIndex, "steps", stepIndex, "subtitle"]))}
            ${renderField("Main step", pathString(["flows", flowIndex, "steps", stepIndex, "main"]), { type: "checkbox", checkboxLabel: "Show in main sidebar section" })}
            ${renderField("Special step", pathString(["flows", flowIndex, "steps", stepIndex, "special"]), { type: "checkbox", checkboxLabel: "Show in special sidebar section" })}
            ${renderField("Parent step", pathString(["flows", flowIndex, "steps", stepIndex, "parentId"]), { type: "select", options: stepOptions })}
            ${renderField("Next step", pathString(["flows", flowIndex, "steps", stepIndex, "next"]), { type: "select", options: stepOptions })}
          </div>

          <div class="builder-subsection">
            <div class="section-head small">
              <h4>Step type</h4>
              <div class="inline-row compact">
                <button class="ghost" data-action="set-step-template" data-template="standard">Standard</button>
                <button class="ghost" data-action="set-step-template" data-template="guarantees">Guarantees</button>
                <button class="ghost" data-action="set-step-template" data-template="followup">Follow-up</button>
              </div>
            </div>
            <div class="builder-help">Standard steps use script, key points, branches, and tone cue. Guarantee and follow-up steps switch the content blocks.</div>
          </div>

          <div class="builder-subsection">
            <div class="section-head small">
              <h4>Branches</h4>
              <button class="ghost" data-action="add-branch">+ Add branch</button>
            </div>
            ${(step.branches || []).length ? step.branches.map((branch, index) => `
              <div class="branch-editor">
                ${renderField("Label", pathString(["flows", flowIndex, "steps", stepIndex, "branches", index, "label"]))}
                ${renderField("Target", pathString(["flows", flowIndex, "steps", stepIndex, "branches", index, "targetId"]), { type: "select", options: stepOptions })}
                ${renderField("Color", pathString(["flows", flowIndex, "steps", stepIndex, "branches", index, "color"]), { type: "select", options: Object.keys(BRANCH_COLORS).map((color) => ({ value: color, label: color })) })}
                <button class="ghost danger" data-action="remove-branch" data-index="${index}">Remove branch</button>
              </div>
            `).join("") : `<div class="empty-mini">No branch buttons on this step yet.</div>`}
          </div>
        ` : ""}
      </section>
    </aside>
  `;
}

function renderWorkspace() {
  const theme = themeVars();
  const workspace = currentWorkspace();
  if (!workspace) {
    return `
      <div class="auth-shell">
        <div class="auth-card">
          <div class="auth-brand">JOC</div>
          <h1>Loading workspace…</h1>
          <p>Your account is signed in, but the workspace has not loaded yet.</p>
          ${statusMarkup()}
        </div>
      </div>
    `;
  }
  const flow = currentFlow();
  const step = currentStep();
  const parent = parentStep();
  const regularSteps = flow ? flow.steps.filter((item) => item.main && !item.special) : [];
  const specialSteps = flow ? flow.steps.filter((item) => item.special) : [];

  document.documentElement.setAttribute("data-theme", currentTheme());
  Object.entries({
    "--bg": theme.bg,
    "--sidebar": theme.sidebar,
    "--sidebar-border": theme.sidebarBorder,
    "--card": theme.card,
    "--card-border": theme.cardBorder,
    "--script-bg": theme.scriptBg,
    "--script-border": theme.scriptBorder,
    "--script-text": theme.scriptText,
    "--text": theme.text,
    "--text-secondary": theme.textSecondary,
    "--text-muted": theme.textMuted,
    "--accent": theme.accent,
    "--accent-soft": theme.accentSoft,
    "--topbar": theme.topBar,
    "--topbar-text": theme.topBarText,
    "--topbar-inactive": theme.topBarInactive,
    "--surface-2": theme.surface2,
    "--input": theme.input,
    "--danger": theme.danger,
    "--success": theme.success,
  }).forEach(([key, value]) => document.documentElement.style.setProperty(key, value));

  return `
    <div class="app-shell ${state.editMode ? "editing" : ""}">
      <header class="topbar">
        <div class="brand">JOC</div>
        <div class="tab-strip">
          ${workspace.flows.map((item) => `
            <button class="tab ${item.id === state.activeFlowId ? "active" : ""}" data-nav-flow="${escapeHtml(item.id)}">
              <span>${escapeHtml(item.icon || "📞")}</span>
              <span>${escapeHtml(item.name || item.id)}</span>
            </button>
          `).join("")}
        </div>
        <div class="topbar-right">
          <button class="pill" data-action="toggle-theme">${currentTheme() === "dark" ? "☀️ Light" : "🌙 Dark"}</button>
          <button class="pill" data-action="signout">Sign out</button>
        </div>
      </header>

      <div class="main-grid">
        <aside class="sidebar">
          <div class="sidebar-section">
            ${flow ? regularSteps.map((item) => `
              <button class="sidebar-item ${(item.id === state.activeStepId || item.id === parent?.id) ? "active" : ""}" data-nav-step="${escapeHtml(item.id)}">
                <span class="step-num">${escapeHtml(item.num || "•")}</span>
                <span class="step-label">${escapeHtml(item.label || item.title || item.id)}</span>
              </button>
            `).join("") : `<div class="empty-mini">No call types yet.</div>`}
          </div>
          <div class="sidebar-divider"></div>
          <div class="sidebar-section">
            ${flow ? specialSteps.map((item) => `
              <button class="sidebar-item ${(item.id === state.activeStepId) ? "active" : ""}" data-nav-step="${escapeHtml(item.id)}">
                <span class="step-num special">${escapeHtml(item.num || "•")}</span>
                <span class="step-label">${escapeHtml(item.label || item.title || item.id)}</span>
              </button>
            `).join("") : ""}
          </div>
        </aside>

        <main class="content-area">
          ${statusMarkup()}
          ${flow && step ? `
            ${parent ? `<button class="back-link" data-nav-step="${escapeHtml(parent.id)}">← Back to ${escapeHtml(parent.title)}</button>` : ""}
            <div class="step-header">
              <div class="step-badge">${escapeHtml(step.num || parent?.num || "•")}</div>
              <div class="step-copy">
                ${renderDisplayOrInput(pathString(["flows", currentFlowIndex(), "steps", currentStepIndex(), "title"]), step.title || "", "text", "Step title")}
                ${renderDisplayOrInput(pathString(["flows", currentFlowIndex(), "steps", currentStepIndex(), "subtitle"]), step.subtitle || "", "text", "Step subtitle")}
              </div>
            </div>
            ${renderStepContent()}
          ` : `
            <div class="empty-state">
              <div class="emoji">🚧</div>
              <h3>No flow content yet</h3>
              <p>Use edit mode to create your first call type or step.</p>
            </div>
          `}
        </main>

        ${renderBuilder()}
      </div>

      <button class="fab ${state.editMode ? "saving" : ""}" data-action="toggle-edit" title="${state.editMode ? "Save changes" : "Enter edit mode"}">
        ${state.editMode ? "✓" : "✎"}
      </button>
    </div>
  `;
}

function renderAuth() {
  document.documentElement.setAttribute("data-theme", "dark");
  return `
    <div class="auth-shell">
      <div class="auth-card">
        <div class="auth-brand">JOC</div>
        <h1>Call Script Builder</h1>
        <p>Vanilla HTML + Firebase version with login, live flow management, and edit mode locking.</p>
        ${statusMarkup()}
        <div class="auth-toggle">
          <button class="${state.authMode === "signin" ? "active" : ""}" data-action="set-auth-mode" data-mode="signin" ${state.authPending ? "disabled" : ""}>Sign in</button>
          <button class="${state.authMode === "signup" ? "active" : ""}" data-action="set-auth-mode" data-mode="signup" ${state.authPending ? "disabled" : ""}>Create account</button>
        </div>
        <form id="auth-form" class="auth-form">
          <label>
            <span>Email</span>
            <input type="email" name="email" required autocomplete="email" placeholder="you@company.com">
          </label>
          <label>
            <span>Password</span>
            <input type="password" name="password" required minlength="6" autocomplete="current-password" placeholder="At least 6 characters">
          </label>
          <button class="auth-submit" type="submit" ${state.authPending ? "disabled" : ""}>${state.authPending ? "Working…" : state.authMode === "signin" ? "Sign in" : "Create account"}</button>
        </form>
        <div class="setup-note">
          Enable Email/Password in Firebase Authentication, then paste your web app config into <code>js/firebase-config.js</code>.
        </div>
      </div>
    </div>
  `;
}

function render() {
  ensureSelections();
  if (state.user && (state.loading || !currentWorkspace())) {
    const theme = themeVars();
    document.documentElement.setAttribute("data-theme", currentTheme());
    Object.entries({
      "--bg": theme.bg,
      "--text": theme.text,
      "--text-secondary": theme.textSecondary,
      "--accent": theme.accent,
    }).forEach(([key, value]) => document.documentElement.style.setProperty(key, value));
    root.innerHTML = `
      <div class="auth-shell">
        <div class="auth-card">
          <div class="auth-brand">JOC</div>
          <h1>Loading workspace…</h1>
          <p>Your account was accepted. The app is pulling your flows and settings now.</p>
          ${statusMarkup()}
        </div>
      </div>
    `;
    return;
  }
  root.innerHTML = state.user ? renderWorkspace() : renderAuth();
}

function resetNotices() {
  state.authError = "";
  state.authInfo = "";
  state.saveError = "";
  state.saveInfo = "";
}

function moveItem(array, fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= array.length) return array;
  const next = [...array];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next.map((entry, index) => ({ ...entry, order: index }));
}

function updateDraft(path, rawValue, type = "text") {
  if (!state.editMode || !state.draft) return;
  const value = type === "checkbox" ? Boolean(rawValue) : rawValue;
  setPath(state.draft, path, value);
}

function createDefaultStep(flow) {
  const existingIds = new Set((flow.steps || []).map((item) => item.id));
  const number = String((flow.steps || []).filter((item) => item.main && !item.special).length + 1).padStart(2, "0");
  return {
    id: uniqueId("new-step", existingIds),
    num: number,
    label: `Step ${number}`,
    title: "New Step",
    subtitle: "Describe this step.",
    script: "",
    keyPoints: [],
    toneCue: "",
    branches: [],
    main: true,
    special: false,
    parentId: null,
    next: null,
    order: (flow.steps || []).length,
  };
}

function createDefaultFlow() {
  const existingIds = new Set((state.draft?.flows || []).map((item) => item.id));
  const id = uniqueId("new-call-type", existingIds);
  const flow = {
    id,
    name: "New Call Type",
    icon: "📞",
    desc: "",
    order: (state.draft?.flows || []).length,
    steps: [],
  };
  flow.steps.push(createDefaultStep(flow));
  return flow;
}

function ensureStepTemplate(step, template) {
  if (template === "standard") {
    delete step.guarantees;
    delete step.followUp;
    if (!Array.isArray(step.keyPoints)) step.keyPoints = [];
    if (!Array.isArray(step.branches)) step.branches = [];
    if (typeof step.script !== "string") step.script = "";
    return;
  }
  if (template === "guarantees") {
    step.guarantees = step.guarantees || [
      { name: "THE HAPPINESS PROMISE", color: "#059669", script: "" },
    ];
    delete step.followUp;
    if (typeof step.toneCue !== "string") step.toneCue = "";
    return;
  }
  if (template === "followup") {
    step.followUp = step.followUp || [
      { day: "DAY 1", content: "" },
    ];
    delete step.guarantees;
  }
}

async function handleToggleEdit() {
  resetNotices();
  if (!state.user) return;

  if (!state.editMode) {
    state.draft = deepClone(state.workspace);
    state.editMode = true;
    render();
    return;
  }

  try {
    state.saveInfo = "Saving changes…";
    render();
    const normalized = normalizeWorkspace(state.draft);
    await saveWorkspace(state.user.uid, normalized);
    state.workspace = normalized;
    state.draft = null;
    state.editMode = false;
    state.saveInfo = "Changes saved.";
  } catch (error) {
    console.error(error);
    state.saveError = error.message || "Could not save your changes.";
  }
  render();
}

async function loadUserApp(user) {
  resetNotices();
  state.loading = true;
  render();
  try {
    let workspace = await loadWorkspace(user.uid);
    if (!workspace.flows.length) {
      workspace = await seedWorkspaceIfEmpty(user.uid);
      state.saveInfo = "Seeded your workspace with the current script.";
    }
    state.workspace = normalizeWorkspace(workspace);
    state.activeFlowId = state.workspace.flows[0]?.id || null;
    state.activeStepId = state.workspace.flows[0]?.steps?.[0]?.id || null;
  } catch (error) {
    console.error(error);
    state.saveError = error.message || "Failed to load workspace.";
  }
  state.loading = false;
  render();
}

root.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action], [data-nav-flow], [data-nav-step]");
  if (!target) return;

  const navFlow = target.dataset.navFlow;
  const navStep = target.dataset.navStep;
  if (navFlow) {
    state.activeFlowId = navFlow;
    const flow = currentWorkspace()?.flows?.find((item) => item.id === navFlow);
    state.activeStepId = flow?.steps?.[0]?.id || null;
    render();
    return;
  }
  if (navStep) {
    state.activeStepId = navStep;
    render();
    return;
  }

  const { action } = target.dataset;
  if (action === "toggle-edit") {
    await handleToggleEdit();
    return;
  }
  if (action === "toggle-theme") {
    resetNotices();
    const holder = state.editMode ? state.draft : state.workspace;
    holder.theme = holder.theme === "dark" ? "light" : "dark";
    if (!state.editMode && state.user && state.workspace) {
      try {
        await saveWorkspace(state.user.uid, normalizeWorkspace(state.workspace));
        state.saveInfo = "Theme saved.";
      } catch (error) {
        state.saveError = error.message || "Could not save theme.";
      }
    }
    render();
    return;
  }
  if (action === "signout") {
    try {
      await signOutUser();
    } catch (error) {
      state.saveError = error.message || "Could not sign out.";
      render();
    }
    return;
  }
  if (action === "set-auth-mode") {
    resetNotices();
    state.authMode = target.dataset.mode;
    render();
    return;
  }
  if (!state.editMode || !state.draft) return;

  const flow = currentFlow();
  const step = currentStep();
  const flowIndex = currentFlowIndex();
  const stepIndex = currentStepIndex();

  switch (action) {
    case "create-flow": {
      const newFlow = createDefaultFlow();
      state.draft.flows.push(newFlow);
      state.activeFlowId = newFlow.id;
      state.activeStepId = newFlow.steps[0]?.id || null;
      break;
    }
    case "delete-flow": {
      if (state.draft.flows.length <= 1) {
        state.saveError = "Keep at least one call type in the workspace.";
        break;
      }
      const index = Number(target.dataset.flowIndex);
      state.draft.flows.splice(index, 1);
      state.draft.flows = state.draft.flows.map((item, idx) => ({ ...item, order: idx }));
      state.activeFlowId = state.draft.flows[Math.max(0, index - 1)]?.id || state.draft.flows[0]?.id || null;
      state.activeStepId = state.draft.flows.find((item) => item.id === state.activeFlowId)?.steps?.[0]?.id || null;
      break;
    }
    case "move-flow-up": {
      const index = Number(target.dataset.flowIndex);
      state.draft.flows = moveItem(state.draft.flows, index, index - 1);
      break;
    }
    case "move-flow-down": {
      const index = Number(target.dataset.flowIndex);
      state.draft.flows = moveItem(state.draft.flows, index, index + 1);
      break;
    }
    case "create-step": {
      const newStep = createDefaultStep(flow);
      flow.steps.push(newStep);
      flow.steps = flow.steps.map((item, idx) => ({ ...item, order: idx }));
      state.activeStepId = newStep.id;
      break;
    }
    case "duplicate-step": {
      if (!step) break;
      const existingIds = new Set(flow.steps.map((item) => item.id));
      const cloned = deepClone(step);
      cloned.id = uniqueId(`${step.id}-copy`, existingIds);
      cloned.title = `${step.title || "Step"} Copy`;
      cloned.label = `${step.label || step.title || "Step"} Copy`;
      cloned.order = flow.steps.length;
      flow.steps.push(cloned);
      flow.steps = flow.steps.map((item, idx) => ({ ...item, order: idx }));
      state.activeStepId = cloned.id;
      break;
    }
    case "delete-step": {
      if ((flow.steps || []).length <= 1) {
        state.saveError = "Keep at least one step in each call type.";
        break;
      }
      const index = Number(target.dataset.stepIndex);
      const removed = flow.steps[index];
      flow.steps.splice(index, 1);
      flow.steps = flow.steps.map((item, idx) => ({
        ...item,
        order: idx,
        branches: (item.branches || []).filter((branch) => branch.targetId !== removed.id),
        parentId: item.parentId === removed.id ? null : item.parentId,
        next: item.next === removed.id ? null : item.next,
      }));
      state.activeStepId = flow.steps[Math.max(0, index - 1)]?.id || flow.steps[0]?.id || null;
      break;
    }
    case "move-step-up": {
      const index = Number(target.dataset.stepIndex);
      flow.steps = moveItem(flow.steps, index, index - 1);
      break;
    }
    case "move-step-down": {
      const index = Number(target.dataset.stepIndex);
      flow.steps = moveItem(flow.steps, index, index + 1);
      break;
    }
    case "set-step-template": {
      ensureStepTemplate(step, target.dataset.template);
      break;
    }
    case "add-key-point": {
      step.keyPoints = step.keyPoints || [];
      step.keyPoints.push("");
      break;
    }
    case "remove-key-point": {
      step.keyPoints.splice(Number(target.dataset.index), 1);
      break;
    }
    case "add-extra-block": {
      step.extra = { title: "Reference", items: [""] };
      break;
    }
    case "remove-extra-block": {
      step.extra = null;
      break;
    }
    case "add-extra-item": {
      step.extra = step.extra || { title: "Reference", items: [] };
      step.extra.items = step.extra.items || [];
      step.extra.items.push("");
      break;
    }
    case "remove-extra-item": {
      if (!step.extra?.items) break;
      step.extra.items.splice(Number(target.dataset.index), 1);
      break;
    }
    case "add-branch": {
      step.branches = step.branches || [];
      step.branches.push({
        label: "New Branch",
        color: "flow",
        targetId: flow.steps.find((item) => item.id !== step.id)?.id || "",
      });
      break;
    }
    case "remove-branch": {
      step.branches.splice(Number(target.dataset.index), 1);
      break;
    }
    case "add-guarantee": {
      step.guarantees = step.guarantees || [];
      step.guarantees.push({ name: "New Guarantee", color: "#059669", script: "" });
      break;
    }
    case "remove-guarantee": {
      step.guarantees.splice(Number(target.dataset.index), 1);
      break;
    }
    case "add-followup": {
      step.followUp = step.followUp || [];
      step.followUp.push({ day: `DAY ${step.followUp.length + 1}`, content: "" });
      break;
    }
    case "remove-followup": {
      step.followUp.splice(Number(target.dataset.index), 1);
      break;
    }
    default:
      return;
  }

  state.saveError = "";
  state.saveInfo = "Draft updated. Click ✓ to save to Firebase.";
  render();
});

root.addEventListener("input", (event) => {
  const input = event.target.closest("[data-path]");
  if (!input || !state.editMode || !state.draft) return;
  const type = input.type === "checkbox" ? "checkbox" : "text";
  updateDraft(input.dataset.path, type === "checkbox" ? input.checked : input.value, type);
});

root.addEventListener("change", (event) => {
  const input = event.target.closest("[data-path]");
  if (!input || !state.editMode || !state.draft) return;
  const type = input.type === "checkbox" ? "checkbox" : "text";
  updateDraft(input.dataset.path, type === "checkbox" ? input.checked : input.value, type);
  render();
});

root.addEventListener("submit", async (event) => {
  if (event.target.id !== "auth-form") return;
  event.preventDefault();
  if (state.authPending) return;
  resetNotices();
  state.authPending = true;
  render();

  const formData = new FormData(event.target);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  try {
    if (state.authMode === "signin") {
      state.authInfo = "Signing you in…";
      render();
      await signInWithEmail(email, password);
    } else {
      state.authInfo = "Creating your account…";
      render();
      await signUpWithEmail(email, password);
      state.authInfo = "Account created. Loading your workspace…";
      render();
    }
  } catch (error) {
    console.error(error);
    state.authError = error.message || "Authentication failed.";
  } finally {
    state.authPending = false;
    render();
  }
});

function boot() {
  if (!isConfigured()) {
    state.loading = false;
    render();
    return;
  }

  subscribeToAuth(async (user) => {
    state.user = user || null;
    state.editMode = false;
    state.draft = null;
    if (!user) {
      state.workspace = null;
      state.activeFlowId = null;
      state.activeStepId = null;
      render();
      return;
    }
    await loadUserApp(user);
  });
}

boot();
render();
