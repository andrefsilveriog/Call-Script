import { BRANCH_COLORS, DEFAULT_GROUPS } from "./defaults.js";
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
const importInputId = "workspace-import-input";
const LOCAL_VERSION_KEY = "call-script-ui-version";
const UI_VERSION = "2.0.0";

const state = {
  user: null,
  authReady: false,
  authPending: false,
  workspaceLoading: false,
  workspace: null,
  draft: null,
  editMode: false,
  saving: false,
  dirty: false,
  authMode: "signin",
  authForm: { email: "", password: "" },
  activeFlowId: null,
  activeStepId: null,
  openGroupId: null,
  notice: null,
};

const themeTokens = {
  dark: {
    bg: "#08111f",
    bgSoft: "#0f1b31",
    shell: "rgba(10, 18, 35, 0.86)",
    card: "#0f1b31",
    cardStrong: "#12213d",
    cardMuted: "#0d1730",
    border: "rgba(148, 163, 184, 0.14)",
    borderStrong: "rgba(148, 163, 184, 0.22)",
    text: "#f8fafc",
    textSecondary: "#cbd5e1",
    textMuted: "#8da0bf",
    accent: "#3b82f6",
    accentStrong: "#2563eb",
    accentSoft: "rgba(59,130,246,0.14)",
    teal: "#14b8a6",
    purple: "#8b5cf6",
    danger: "#fb7185",
    success: "#34d399",
    warning: "#fbbf24",
    shadow: "0 22px 70px rgba(2, 8, 23, 0.34)",
  },
  light: {
    bg: "#eef4ff",
    bgSoft: "#f8fbff",
    shell: "rgba(255,255,255,0.88)",
    card: "#ffffff",
    cardStrong: "#ffffff",
    cardMuted: "#f8fbff",
    border: "rgba(30, 41, 59, 0.10)",
    borderStrong: "rgba(30, 41, 59, 0.16)",
    text: "#0f172a",
    textSecondary: "#334155",
    textMuted: "#64748b",
    accent: "#2563eb",
    accentStrong: "#1d4ed8",
    accentSoft: "rgba(37,99,235,0.10)",
    teal: "#0f766e",
    purple: "#7c3aed",
    danger: "#e11d48",
    success: "#059669",
    warning: "#d97706",
    shadow: "0 20px 60px rgba(30, 41, 59, 0.14)",
  },
};

function workspaceSource() {
  return state.editMode ? state.draft : state.workspace;
}

function currentTheme() {
  return workspaceSource()?.theme || state.workspace?.theme || "dark";
}

function theme() {
  return themeTokens[currentTheme()] || themeTokens.dark;
}

function setThemeVars() {
  const tokenSet = theme();
  Object.entries({
    "--bg": tokenSet.bg,
    "--bg-soft": tokenSet.bgSoft,
    "--shell": tokenSet.shell,
    "--card": tokenSet.card,
    "--card-strong": tokenSet.cardStrong,
    "--card-muted": tokenSet.cardMuted,
    "--border": tokenSet.border,
    "--border-strong": tokenSet.borderStrong,
    "--text": tokenSet.text,
    "--text-secondary": tokenSet.textSecondary,
    "--text-muted": tokenSet.textMuted,
    "--accent": tokenSet.accent,
    "--accent-strong": tokenSet.accentStrong,
    "--accent-soft": tokenSet.accentSoft,
    "--teal": tokenSet.teal,
    "--purple": tokenSet.purple,
    "--danger": tokenSet.danger,
    "--success": tokenSet.success,
    "--warning": tokenSet.warning,
    "--shadow": tokenSet.shadow,
  }).forEach(([name, value]) => document.documentElement.style.setProperty(name, value));
  document.documentElement.setAttribute("data-theme", currentTheme());
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
  return path.split("|").reduce((cursor, part) => {
    if (cursor == null) return undefined;
    if (/^\d+$/.test(part)) return cursor[Number(part)];
    return cursor[part];
  }, obj);
}

function setPath(obj, path, value) {
  const parts = path.split("|");
  let cursor = obj;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = /^\d+$/.test(parts[index]) ? Number(parts[index]) : parts[index];
    cursor = cursor[part];
  }
  const last = /^\d+$/.test(parts.at(-1)) ? Number(parts.at(-1)) : parts.at(-1);
  cursor[last] = value;
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

function uniqueId(base, items) {
  const existingIds = new Set(items.map((item) => item.id));
  let id = slugify(base);
  let counter = 2;
  while (existingIds.has(id)) {
    id = `${slugify(base)}-${counter}`;
    counter += 1;
  }
  return id;
}

function sortByOrder(items = []) {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function ensureGroupList(groups = []) {
  if (Array.isArray(groups) && groups.length) {
    return sortByOrder(groups).map((group, index) => ({
      id: group.id || `group-${index + 1}`,
      name: group.name || `Group ${index + 1}`,
      icon: group.icon || "🗂️",
      order: index,
    }));
  }
  return DEFAULT_GROUPS.map((group, index) => ({ ...group, order: index }));
}

function normalizeWorkspace(workspace) {
  const groups = ensureGroupList(workspace?.groups || []);
  const fallbackGroupId = groups[0]?.id || "general";
  const flows = sortByOrder(workspace?.flows || []).map((flow, flowIndex) => ({
    id: flow.id || `flow-${flowIndex + 1}`,
    name: flow.name || "Untitled Flow",
    icon: flow.icon || "📞",
    desc: flow.desc || "",
    groupId: groups.some((group) => group.id === flow.groupId) ? flow.groupId : fallbackGroupId,
    order: flowIndex,
    steps: sortByOrder(flow.steps || []).map((step, stepIndex) => ({
      id: step.id || `step-${stepIndex + 1}`,
      num: step.num || "",
      label: step.label || "Untitled",
      title: step.title || "Untitled Step",
      subtitle: step.subtitle || "",
      script: typeof step.script === "string" ? step.script : "",
      toneCue: typeof step.toneCue === "string" ? step.toneCue : "",
      keyPoints: Array.isArray(step.keyPoints) ? step.keyPoints : [],
      branches: Array.isArray(step.branches) ? step.branches : [],
      main: Boolean(step.main),
      special: Boolean(step.special),
      parentId: step.parentId || null,
      next: step.next || null,
      guarantees: Array.isArray(step.guarantees) ? step.guarantees : null,
      followUp: Array.isArray(step.followUp) ? step.followUp : null,
      extra: step.extra && typeof step.extra === "object"
        ? {
            title: step.extra.title || "Notes",
            items: Array.isArray(step.extra.items) ? step.extra.items : [],
          }
        : null,
      order: stepIndex,
    })),
  }));
  return {
    theme: workspace?.theme === "light" ? "light" : "dark",
    groups,
    flows,
  };
}

function activeFlowIndex() {
  const flows = workspaceSource()?.flows || [];
  const index = flows.findIndex((flow) => flow.id === state.activeFlowId);
  return index >= 0 ? index : 0;
}

function activeFlow() {
  const flows = workspaceSource()?.flows || [];
  return flows[activeFlowIndex()] || null;
}

function activeStepIndex() {
  const steps = activeFlow()?.steps || [];
  const index = steps.findIndex((step) => step.id === state.activeStepId);
  return index >= 0 ? index : 0;
}

function activeStep() {
  const steps = activeFlow()?.steps || [];
  return steps[activeStepIndex()] || null;
}

function activeGroup() {
  const source = workspaceSource();
  const flow = activeFlow();
  return source?.groups?.find((group) => group.id === flow?.groupId) || source?.groups?.[0] || null;
}

function parentStep() {
  const flow = activeFlow();
  const step = activeStep();
  return step?.parentId ? flow?.steps?.find((item) => item.id === step.parentId) || null : null;
}

function groupedFlows() {
  const source = workspaceSource();
  const groups = source?.groups || [];
  const flows = source?.flows || [];
  return groups.map((group) => ({
    ...group,
    flows: flows.filter((flow) => flow.groupId === group.id),
  }));
}

function ensureSelections() {
  const source = workspaceSource();
  if (!source) return;
  if (!source.flows.length) {
    state.activeFlowId = null;
    state.activeStepId = null;
    return;
  }
  const nextFlow = source.flows.find((flow) => flow.id === state.activeFlowId) || source.flows[0];
  state.activeFlowId = nextFlow.id;
  if (!nextFlow.steps.length) {
    state.activeStepId = null;
    return;
  }
  const nextStep = nextFlow.steps.find((step) => step.id === state.activeStepId) || nextFlow.steps[0];
  state.activeStepId = nextStep.id;
}

function showNotice(type, message) {
  state.notice = { type, message, time: Date.now() };
}

function clearNotice() {
  state.notice = null;
}

function isBusy() {
  return state.authPending || state.saving || state.workspaceLoading;
}

function hasUnsavedChanges() {
  return state.editMode && state.dirty;
}

function getStepOptions(flow = activeFlow()) {
  return [{ value: "", label: "None" }, ...((flow?.steps || []).map((step) => ({
    value: step.id,
    label: `${step.num || "•"} — ${step.label || step.title || step.id}`,
  })))];
}

function renderField(label, path, options = {}) {
  const value = readPath(state.draft, path) ?? options.fallback ?? "";
  const type = options.type || "text";
  const description = options.description ? `<p class="field-help">${escapeHtml(options.description)}</p>` : "";
  let control = "";

  if (type === "textarea") {
    control = `<textarea class="field-control ${options.tall ? "tall" : ""}" data-path="${path}" placeholder="${escapeHtml(options.placeholder || "")}">${escapeHtml(value)}</textarea>`;
  } else if (type === "checkbox") {
    control = `
      <label class="toggle-field">
        <input type="checkbox" data-path="${path}" ${value ? "checked" : ""}>
        <span>${escapeHtml(options.checkboxLabel || label)}</span>
      </label>
    `;
  } else if (type === "select") {
    control = `
      <select class="field-control" data-path="${path}">
        ${(options.options || []).map((option) => `<option value="${escapeHtml(option.value)}" ${String(option.value) === String(value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
      </select>
    `;
  } else {
    control = `<input class="field-control" type="${type}" data-path="${path}" value="${escapeHtml(value)}" placeholder="${escapeHtml(options.placeholder || "")}">`;
  }

  return `
    <label class="field-block ${type === "checkbox" ? "checkbox-block" : ""}">
      ${type === "checkbox" ? "" : `<span class="field-label">${escapeHtml(label)}</span>`}
      ${control}
      ${description}
    </label>
  `;
}

function renderInline(path, value, type = "text", placeholder = "") {
  if (!state.editMode) {
    if (type === "textarea") {
      return `<div class="display-block ${!value ? "empty-value" : ""}">${value ? renderText(value) : escapeHtml(placeholder || "—")}</div>`;
    }
    return `<div class="display-inline ${!value ? "empty-value" : ""}">${escapeHtml(value || placeholder || "—")}</div>`;
  }

  if (type === "textarea") {
    return `<textarea class="inline-control ${type}" data-path="${path}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value || "")}</textarea>`;
  }

  return `<input class="inline-control" data-path="${path}" value="${escapeHtml(value || "")}" placeholder="${escapeHtml(placeholder)}">`;
}

function renderNotice() {
  if (!state.notice) return "";
  return `<div class="floating-notice ${escapeHtml(state.notice.type)}">${escapeHtml(state.notice.message)}</div>`;
}

function renderStatusPills() {
  const items = [];
  if (!isConfigured()) items.push(`<span class="status-pill warn">Firebase not configured</span>`);
  if (state.editMode) items.push(`<span class="status-pill ${state.dirty ? "warn" : "ok"}">${state.dirty ? "Unsaved changes" : "Edit mode"}</span>`);
  return items.join("");
}

function renderAuthScreen() {
  setThemeVars();
  return `
    <div class="auth-shell">
      <div class="auth-glow"></div>
      <section class="auth-card premium-card">
        <div class="auth-brand-row">
          <div class="brand-mark">JOC</div>
          <div>
            <div class="eyebrow">Call workflow studio</div>
            <h1>Sign in to your script builder</h1>
          </div>
        </div>
        <p class="auth-copy">Email/password auth, Firestore-backed flows, grouped call types, and a locked presentation mode with one floating edit button.</p>
        <div class="auth-toggle">
          <button class="seg-btn ${state.authMode === "signin" ? "active" : ""}" type="button" data-action="set-auth-mode" data-mode="signin">Sign in</button>
          <button class="seg-btn ${state.authMode === "signup" ? "active" : ""}" type="button" data-action="set-auth-mode" data-mode="signup">Create account</button>
        </div>
        <form id="auth-form" class="auth-form">
          <label>
            <span>Email</span>
            <input type="email" name="email" required autocomplete="email" inputmode="email" value="${escapeHtml(state.authForm.email || "")}" placeholder="you@company.com" ${state.authPending ? "disabled" : ""}>
          </label>
          <label>
            <span>Password</span>
            <input type="password" name="password" minlength="6" required autocomplete="current-password" value="${escapeHtml(state.authForm.password || "")}" placeholder="At least 6 characters" ${state.authPending ? "disabled" : ""}>
          </label>
          <button class="primary-btn auth-submit" type="submit" ${state.authPending ? "disabled" : ""}>${state.authPending ? "Working…" : state.authMode === "signin" ? "Sign in" : "Create account"}</button>
        </form>
        <div class="auth-actions">
          <button class="secondary-btn" type="button" data-action="reset-browser">Reset browser data for this app</button>
          <span class="muted-note">Use this if the normal tab acts cursed while anonymous tabs work.</span>
        </div>
        ${!isConfigured() ? `<div class="notice-block warn">Firebase is not configured yet. Paste your web app config into <code>js/firebase-config.js</code>.</div>` : ""}
      </section>
      ${renderNotice()}
    </div>
  `;
}

function renderLoadingScreen() {
  setThemeVars();
  return `
    <div class="loading-shell">
      <div class="loading-card premium-card">
        <div class="brand-mark">JOC</div>
        <h2>Loading workspace…</h2>
        <p>Pulling your flows, steps, and layout from Firebase.</p>
      </div>
    </div>
  `;
}

function renderTopNavigation() {
  return groupedFlows().map((group) => {
    const isActiveGroup = group.id === activeGroup()?.id;
    const isOpen = state.openGroupId === group.id;
    const currentLabel = group.flows.find((flow) => flow.id === state.activeFlowId)?.name;
    return `
      <div class="nav-group ${isOpen ? "open" : ""}">
        <button class="nav-group-btn ${isActiveGroup ? "active" : ""}" data-action="toggle-group-menu" data-group-id="${escapeHtml(group.id)}">
          <span class="nav-group-main">${escapeHtml(group.icon || "🗂️")} ${escapeHtml(group.name)}</span>
          <span class="nav-group-sub">${escapeHtml(currentLabel || `${group.flows.length} flow${group.flows.length === 1 ? "" : "s"}`)}</span>
          <span class="nav-chevron">▾</span>
        </button>
        <div class="nav-menu ${isOpen ? "show" : ""}">
          ${group.flows.length ? group.flows.map((flow) => `
            <button class="nav-menu-item ${flow.id === state.activeFlowId ? "active" : ""}" data-nav-flow="${escapeHtml(flow.id)}">
              <span class="flow-icon">${escapeHtml(flow.icon || "📞")}</span>
              <span>
                <strong>${escapeHtml(flow.name)}</strong>
                <small>${escapeHtml(flow.desc || "No description yet")}</small>
              </span>
            </button>
          `).join("") : `<div class="nav-empty">No call types in this group yet.</div>`}
        </div>
      </div>
    `;
  }).join("");
}

function renderSidebar() {
  const flow = activeFlow();
  const step = activeStep();
  const group = activeGroup();
  if (!flow) {
    return `
      <aside class="sidebar premium-card">
        <div class="sidebar-empty">
          <div class="eyebrow">No call types yet</div>
          <p>Enter edit mode and create your first group or call type.</p>
        </div>
      </aside>
    `;
  }
  const regularSteps = flow.steps.filter((item) => item.main && !item.special);
  const specialSteps = flow.steps.filter((item) => item.special);

  return `
    <aside class="sidebar premium-card">
      <div class="sidebar-head">
        <div class="sidebar-kicker">${escapeHtml(group?.name || "Workspace")}</div>
        <h2>${escapeHtml(flow.name)}</h2>
        <p>${escapeHtml(flow.desc || "No flow description yet.")}</p>
      </div>
      <div class="sidebar-section-label">Main flow</div>
      <div class="sidebar-list">
        ${regularSteps.length ? regularSteps.map((item) => `
          <button class="sidebar-item ${item.id === step?.id || item.id === parentStep()?.id ? "active" : ""}" data-nav-step="${escapeHtml(item.id)}">
            <span class="sidebar-num">${escapeHtml(item.num || "•")}</span>
            <span>
              <strong>${escapeHtml(item.label || item.title || item.id)}</strong>
              <small>${escapeHtml(item.title || "")}</small>
            </span>
          </button>
        `).join("") : `<div class="empty-mini">No main steps yet.</div>`}
      </div>
      <div class="sidebar-section-label">Support</div>
      <div class="sidebar-list">
        ${specialSteps.length ? specialSteps.map((item) => `
          <button class="sidebar-item special ${item.id === step?.id ? "active" : ""}" data-nav-step="${escapeHtml(item.id)}">
            <span class="sidebar-num special">${escapeHtml(item.num || "•")}</span>
            <span>
              <strong>${escapeHtml(item.label || item.title || item.id)}</strong>
              <small>${escapeHtml(item.subtitle || item.title || "")}</small>
            </span>
          </button>
        `).join("") : `<div class="empty-mini">No support sections yet.</div>`}
      </div>
    </aside>
  `;
}

function renderSpecialContent(stepBase, step) {
  if (Array.isArray(step.guarantees)) {
    return `
      <section class="content-stack">
        ${step.guarantees.map((item, index) => `
          <article class="content-card stack-card" style="--stack-color:${escapeHtml(item.color || "#059669")}">
            <div class="content-card-kicker">Guarantee ${index + 1}</div>
            ${renderInline(pathString([...stepBase, "guarantees", index, "name"]), item.name || "", "text", "Guarantee name")}
            ${renderInline(pathString([...stepBase, "guarantees", index, "script"]), item.script || "", "textarea", "Guarantee script")}
            ${state.editMode ? `
              <div class="inline-admin-row">
                ${renderField("Color", pathString([...stepBase, "guarantees", index, "color"]), { placeholder: "#059669" })}
                <button class="ghost-btn danger" data-action="remove-guarantee" data-index="${index}">Remove</button>
              </div>
            ` : ""}
          </article>
        `).join("")}
        ${state.editMode ? `<button class="ghost-btn" data-action="add-guarantee">+ Add guarantee</button>` : ""}
      </section>
    `;
  }

  if (Array.isArray(step.followUp)) {
    return `
      <section class="content-stack">
        ${step.followUp.map((item, index) => `
          <article class="content-card stack-card purple">
            <div class="content-card-kicker">Cadence item</div>
            ${renderInline(pathString([...stepBase, "followUp", index, "day"]), item.day || "", "text", "Day label")}
            ${renderInline(pathString([...stepBase, "followUp", index, "content"]), item.content || "", "textarea", "Follow-up content")}
            ${state.editMode ? `<button class="ghost-btn danger" data-action="remove-followup" data-index="${index}">Remove</button>` : ""}
          </article>
        `).join("")}
        ${state.editMode ? `<button class="ghost-btn" data-action="add-followup">+ Add follow-up item</button>` : ""}
      </section>
    `;
  }

  return "";
}

function renderStandardContent(stepBase, step) {
  return `
    ${step.script || state.editMode ? `
      <section class="content-card script-card">
        <div class="content-card-kicker teal">Script</div>
        ${renderInline(pathString([...stepBase, "script"]), step.script || "", "textarea", "Type the spoken script here")}
      </section>
    ` : ""}

    ${step.keyPoints?.length || state.editMode ? `
      <section class="content-card">
        <div class="section-row">
          <div>
            <div class="content-card-kicker muted">Key points</div>
            <h3>What matters here</h3>
          </div>
          ${state.editMode ? `<button class="ghost-btn" data-action="add-key-point">+ Add point</button>` : ""}
        </div>
        <div class="bullet-list">
          ${(step.keyPoints || []).map((point, index) => `
            <div class="bullet-row">
              <span class="bullet-dot">●</span>
              ${renderInline(pathString([...stepBase, "keyPoints", index]), point, "text", "Key point")}
              ${state.editMode ? `<button class="icon-btn danger" data-action="remove-key-point" data-index="${index}">✕</button>` : ""}
            </div>
          `).join("") || `<div class="empty-mini">No key points yet.</div>`}
        </div>
      </section>
    ` : ""}

    ${step.extra || state.editMode ? `
      <section class="content-card reference-card">
        <div class="section-row">
          <div>
            <div class="content-card-kicker muted">Reference</div>
            ${step.extra ? renderInline(pathString([...stepBase, "extra", "title"]), step.extra.title || "", "text", "Reference block title") : `<h3>Reference block</h3>`}
          </div>
          ${state.editMode ? step.extra ? `<button class="ghost-btn danger" data-action="remove-extra-block">Remove block</button>` : `<button class="ghost-btn" data-action="add-extra-block">+ Add reference block</button>` : ""}
        </div>
        ${step.extra ? `
          <div class="bullet-list">
            ${(step.extra.items || []).map((item, index) => `
              <div class="bullet-row">
                <span class="bullet-dot small">•</span>
                ${renderInline(pathString([...stepBase, "extra", "items", index]), item, "text", "Reference item")}
                ${state.editMode ? `<button class="icon-btn danger" data-action="remove-extra-item" data-index="${index}">✕</button>` : ""}
              </div>
            `).join("") || `<div class="empty-mini">No items yet.</div>`}
          </div>
          ${state.editMode ? `<button class="ghost-btn" data-action="add-extra-item">+ Add item</button>` : ""}
        ` : state.editMode ? `<div class="empty-mini">Add a reference block for checklists, pricing notes, or reminders.</div>` : ""}
      </section>
    ` : ""}
  `;
}

function renderBranchButtons(step) {
  if (!step.branches?.length) return "";
  return `
    <div class="branch-wrap">
      ${step.branches.map((branch, index) => {
        const color = BRANCH_COLORS[branch.color] || BRANCH_COLORS.flow;
        return `
          <button class="branch-btn" data-nav-step="${escapeHtml(branch.targetId || "")}" style="background:${color.bg};color:${color.text}">
            ${escapeHtml(branch.label || `Branch ${index + 1}`)}
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderMainContent() {
  const flow = activeFlow();
  const step = activeStep();
  if (!flow || !step) {
    return `
      <main class="content-column premium-card empty-main">
        <div class="eyebrow">Nothing here yet</div>
        <h2>Create your first flow or step</h2>
        <p>Enter edit mode and build the shell before you pour content into it.</p>
      </main>
    `;
  }

  const group = activeGroup();
  const stepBase = ["flows", activeFlowIndex(), "steps", activeStepIndex()];
  const parent = parentStep();

  return `
    <main class="content-column">
      <section class="hero-card premium-card">
        <div class="hero-top">
          <div class="hero-tags">
            <span class="hero-tag">${escapeHtml(group?.name || "Group")}</span>
            <span class="hero-tag soft">${escapeHtml(flow.name)}</span>
            ${renderStatusPills()}
          </div>
          <div class="hero-tools">
            ${parent ? `<button class="ghost-btn" data-nav-step="${escapeHtml(parent.id)}">← Back to ${escapeHtml(parent.label || parent.title)}</button>` : ""}
          </div>
        </div>
        <div class="hero-header">
          <div class="hero-badge">${escapeHtml(step.num || "•")}</div>
          <div class="hero-copy">
            ${renderInline(pathString([...stepBase, "title"]), step.title || "", "text", "Step title")}
            ${renderInline(pathString([...stepBase, "subtitle"]), step.subtitle || "", "text", "Step subtitle")}
          </div>
        </div>
      </section>

      ${step.guarantees || step.followUp ? renderSpecialContent(stepBase, step) : renderStandardContent(stepBase, step)}

      ${renderBranchButtons(step)}
      ${step.next ? `<div class="next-wrap"><button class="branch-btn next" data-nav-step="${escapeHtml(step.next)}">Next →</button></div>` : ""}

      ${step.toneCue || state.editMode ? `
        <section class="content-card tone-card">
          <div class="content-card-kicker purple">Tone cue</div>
          ${renderInline(pathString([...stepBase, "toneCue"]), step.toneCue || "", "textarea", "Coach yourself on tone, pace, and energy")}
        </section>
      ` : ""}
    </main>
  `;
}

function renderBuilderPanel() {
  if (!state.editMode) return "";
  const draft = state.draft;
  const flow = activeFlow();
  const step = activeStep();
  const flowIndex = activeFlowIndex();
  const stepIndex = activeStepIndex();
  const groups = draft?.groups || [];
  const flowSteps = flow?.steps || [];
  const stepOptions = getStepOptions(flow);

  return `
    <aside class="builder-panel premium-card">
      <div class="builder-header">
        <div>
          <div class="eyebrow">Edit mode</div>
          <h2>Structure builder</h2>
        </div>
        <div class="builder-status ${state.dirty ? "dirty" : "clean"}">${state.dirty ? "Unsaved" : "Ready"}</div>
      </div>

      <section class="builder-section">
        <div class="section-row compact">
          <div>
            <h3>Workspace</h3>
            <p>Theme, backups, and browser recovery.</p>
          </div>
        </div>
        <div class="builder-grid two-col">
          ${renderField("Theme", pathString(["theme"]), { type: "select", options: [{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }] })}
        </div>
        <div class="action-grid">
          <button class="ghost-btn" data-action="discard-draft">Discard draft</button>
          <button class="ghost-btn" data-action="export-json">Export JSON</button>
          <button class="ghost-btn" data-action="trigger-import">Import JSON</button>
          <button class="ghost-btn danger" data-action="reset-browser">Reset browser data</button>
        </div>
      </section>

      <section class="builder-section">
        <div class="section-row compact">
          <div>
            <h3>Top navigation groups</h3>
            <p>These become the dropdown tabs across the top.</p>
          </div>
          <button class="ghost-btn" data-action="create-group">+ Group</button>
        </div>
        <div class="builder-list">
          ${groups.map((group, index) => `
            <article class="builder-item ${group.id === activeGroup()?.id ? "active" : ""}">
              <div class="builder-item-top">
                <div class="builder-item-title">${escapeHtml(group.icon || "🗂️")} ${escapeHtml(group.name)}</div>
                <div class="mini-actions">
                  <button class="mini-btn" data-action="move-group-up" data-group-index="${index}">↑</button>
                  <button class="mini-btn" data-action="move-group-down" data-group-index="${index}">↓</button>
                  <button class="mini-btn danger" data-action="delete-group" data-group-index="${index}">✕</button>
                </div>
              </div>
              <div class="builder-grid two-col">
                ${renderField("Group name", pathString(["groups", index, "name"]))}
                ${renderField("Icon", pathString(["groups", index, "icon"]))}
              </div>
            </article>
          `).join("")}
        </div>
      </section>

      <section class="builder-section">
        <div class="section-row compact">
          <div>
            <h3>Call types</h3>
            <p>Flows live inside the top navigation groups.</p>
          </div>
          <div class="mini-toolbar">
            <button class="ghost-btn" data-action="create-flow">+ Flow</button>
            ${flow ? `<button class="ghost-btn" data-action="duplicate-flow">Duplicate</button>` : ""}
          </div>
        </div>
        <div class="builder-list">
          ${(draft?.flows || []).map((item, index) => `
            <article class="builder-item ${item.id === state.activeFlowId ? "active" : ""}">
              <div class="builder-item-top">
                <button class="builder-nav-btn" data-nav-flow="${escapeHtml(item.id)}">${escapeHtml(item.icon || "📞")} ${escapeHtml(item.name)}</button>
                <div class="mini-actions">
                  <button class="mini-btn" data-action="move-flow-up" data-flow-index="${index}">↑</button>
                  <button class="mini-btn" data-action="move-flow-down" data-flow-index="${index}">↓</button>
                  <button class="mini-btn danger" data-action="delete-flow" data-flow-index="${index}">✕</button>
                </div>
              </div>
              <div class="builder-meta">${escapeHtml((draft.groups || []).find((group) => group.id === item.groupId)?.name || "No group")}</div>
            </article>
          `).join("") || `<div class="empty-mini">No call types yet.</div>`}
        </div>

        ${flow ? `
          <div class="builder-grid two-col">
            ${renderField("Flow name", pathString(["flows", flowIndex, "name"]))}
            ${renderField("Icon", pathString(["flows", flowIndex, "icon"]))}
            ${renderField("Group", pathString(["flows", flowIndex, "groupId"]), { type: "select", options: groups.map((group) => ({ value: group.id, label: `${group.icon} ${group.name}` })) })}
            ${renderField("Description", pathString(["flows", flowIndex, "desc"]))}
          </div>
          <div class="readonly-block">Flow ID: <code>${escapeHtml(flow.id)}</code></div>
        ` : ""}
      </section>

      <section class="builder-section">
        <div class="section-row compact">
          <div>
            <h3>Steps</h3>
            <p>Build the path, then polish the copy in the main canvas.</p>
          </div>
          <div class="mini-toolbar">
            <button class="ghost-btn" data-action="create-step">+ Step</button>
            ${step ? `<button class="ghost-btn" data-action="duplicate-step">Duplicate</button>` : ""}
          </div>
        </div>
        <div class="builder-list">
          ${flowSteps.length ? flowSteps.map((item, index) => `
            <article class="builder-item ${item.id === state.activeStepId ? "active" : ""}">
              <div class="builder-item-top">
                <button class="builder-nav-btn" data-nav-step="${escapeHtml(item.id)}">${escapeHtml(item.num || "•")} — ${escapeHtml(item.label || item.title)}</button>
                <div class="mini-actions">
                  <button class="mini-btn" data-action="move-step-up" data-step-index="${index}">↑</button>
                  <button class="mini-btn" data-action="move-step-down" data-step-index="${index}">↓</button>
                  <button class="mini-btn danger" data-action="delete-step" data-step-index="${index}">✕</button>
                </div>
              </div>
              <div class="builder-meta">${item.special ? "Support" : item.main ? "Main flow" : "Hidden"}</div>
            </article>
          `).join("") : `<div class="empty-mini">No steps yet.</div>`}
        </div>

        ${step ? `
          <div class="builder-grid two-col">
            ${renderField("Sidebar label", pathString(["flows", flowIndex, "steps", stepIndex, "label"]))}
            ${renderField("Step number", pathString(["flows", flowIndex, "steps", stepIndex, "num"]))}
            ${renderField("Title", pathString(["flows", flowIndex, "steps", stepIndex, "title"]))}
            ${renderField("Subtitle", pathString(["flows", flowIndex, "steps", stepIndex, "subtitle"]))}
            ${renderField("Main step", pathString(["flows", flowIndex, "steps", stepIndex, "main"]), { type: "checkbox", checkboxLabel: "Show in main sidebar" })}
            ${renderField("Support step", pathString(["flows", flowIndex, "steps", stepIndex, "special"]), { type: "checkbox", checkboxLabel: "Show in support section" })}
            ${renderField("Parent step", pathString(["flows", flowIndex, "steps", stepIndex, "parentId"]), { type: "select", options: stepOptions })}
            ${renderField("Next step", pathString(["flows", flowIndex, "steps", stepIndex, "next"]), { type: "select", options: stepOptions })}
          </div>
          <div class="readonly-block">Step ID: <code>${escapeHtml(step.id)}</code></div>

          <div class="template-panel">
            <div class="section-row compact">
              <div>
                <h4>Step type</h4>
                <p>Switch the content block structure.</p>
              </div>
            </div>
            <div class="mini-toolbar">
              <button class="ghost-btn" data-action="set-step-template" data-template="standard">Standard</button>
              <button class="ghost-btn" data-action="set-step-template" data-template="guarantees">Guarantees</button>
              <button class="ghost-btn" data-action="set-step-template" data-template="followup">Follow-up</button>
            </div>
          </div>

          <div class="template-panel">
            <div class="section-row compact">
              <div>
                <h4>Branches</h4>
                <p>These buttons appear below the script.</p>
              </div>
              <button class="ghost-btn" data-action="add-branch">+ Branch</button>
            </div>
            ${(step.branches || []).length ? step.branches.map((branch, index) => `
              <div class="branch-editor">
                ${renderField("Label", pathString(["flows", flowIndex, "steps", stepIndex, "branches", index, "label"]))}
                ${renderField("Target", pathString(["flows", flowIndex, "steps", stepIndex, "branches", index, "targetId"]), { type: "select", options: stepOptions })}
                ${renderField("Color", pathString(["flows", flowIndex, "steps", stepIndex, "branches", index, "color"]), { type: "select", options: Object.keys(BRANCH_COLORS).map((color) => ({ value: color, label: color })) })}
                <button class="ghost-btn danger" data-action="remove-branch" data-index="${index}">Remove branch</button>
              </div>
            `).join("") : `<div class="empty-mini">No branches yet.</div>`}
          </div>
        ` : ""}
      </section>
    </aside>
  `;
}

function renderWorkspaceShell() {
  const workspace = workspaceSource();
  setThemeVars();

  return `
    <div class="workspace-shell ${state.editMode ? "editing" : ""}">
      <header class="topbar-shell premium-card">
        <div class="brand-cluster">
          <div class="brand-mark">JOC</div>
          <div>
            <div class="eyebrow">Call workflow studio</div>
            <div class="brand-copy">Build the shell first. Fill content second.</div>
          </div>
        </div>
        <nav class="top-nav">
          ${renderTopNavigation()}
        </nav>
        <div class="topbar-actions">
          <button class="secondary-btn" data-action="toggle-theme">${currentTheme() === "dark" ? "☀️ Light" : "🌙 Dark"}</button>
          <button class="secondary-btn" data-action="signout">Sign out</button>
        </div>
      </header>

      <div class="workspace-grid ${state.editMode ? "with-builder" : ""}">
        ${renderSidebar()}
        ${renderMainContent()}
        ${renderBuilderPanel()}
      </div>

      <input id="${importInputId}" type="file" accept="application/json" hidden>

      <button class="fab ${state.editMode ? "save" : "edit"}" data-action="toggle-edit" title="${state.editMode ? "Save changes" : "Enter edit mode"}">
        <span>${state.editMode ? "✓" : "✎"}</span>
      </button>

      ${renderNotice()}
    </div>
  `;
}

function render() {
  ensureSelections();
  if (!state.authReady) {
    root.innerHTML = renderLoadingScreen();
    return;
  }
  if (!state.user) {
    root.innerHTML = renderAuthScreen();
    return;
  }
  if (state.workspaceLoading || !state.workspace) {
    root.innerHTML = renderLoadingScreen();
    return;
  }
  root.innerHTML = renderWorkspaceShell();
}

function markDirty() {
  if (state.editMode) state.dirty = true;
}

function updateDraft(path, rawValue, type = "text") {
  if (!state.editMode || !state.draft) return;
  const value = type === "checkbox" ? Boolean(rawValue) : rawValue;
  setPath(state.draft, path, value);
  markDirty();
}

function moveItem(list, fromIndex, toIndex) {
  if (toIndex < 0 || toIndex >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next.map((entry, index) => ({ ...entry, order: index }));
}

function createDefaultGroup() {
  const items = state.draft?.groups || [];
  const id = uniqueId("new-group", items);
  return {
    id,
    name: "New Group",
    icon: "🗂️",
    order: items.length,
  };
}

function createDefaultFlow(groupId) {
  const items = state.draft?.flows || [];
  const id = uniqueId("new-call-type", items);
  const flow = {
    id,
    groupId: groupId || state.draft?.groups?.[0]?.id || "general",
    name: "New Call Type",
    icon: "📞",
    desc: "",
    order: items.length,
    steps: [],
  };
  flow.steps.push(createDefaultStep(flow));
  return flow;
}

function createDefaultStep(flow) {
  const existingSteps = flow?.steps || [];
  const id = uniqueId("new-step", existingSteps);
  const mainCount = existingSteps.filter((step) => step.main && !step.special).length + 1;
  const num = String(mainCount).padStart(2, "0");
  return {
    id,
    num,
    label: `Step ${num}`,
    title: "New Step",
    subtitle: "Describe what this step is for.",
    script: "",
    toneCue: "",
    keyPoints: [],
    branches: [],
    main: true,
    special: false,
    parentId: null,
    next: null,
    guarantees: null,
    followUp: null,
    extra: null,
    order: existingSteps.length,
  };
}

function ensureStepTemplate(step, template) {
  if (template === "standard") {
    step.guarantees = null;
    step.followUp = null;
    if (!Array.isArray(step.keyPoints)) step.keyPoints = [];
    if (!Array.isArray(step.branches)) step.branches = [];
    if (typeof step.script !== "string") step.script = "";
    return;
  }
  if (template === "guarantees") {
    step.guarantees = step.guarantees || [{ name: "THE HAPPINESS PROMISE", color: "#059669", script: "" }];
    step.followUp = null;
    return;
  }
  if (template === "followup") {
    step.followUp = step.followUp || [{ day: "DAY 1", content: "" }];
    step.guarantees = null;
  }
}

function rewriteStepReferences(flow, oldId, newId) {
  for (const step of flow.steps || []) {
    if (step.parentId === oldId) step.parentId = newId;
    if (step.next === oldId) step.next = newId;
    for (const branch of step.branches || []) {
      if (branch.targetId === oldId) branch.targetId = newId;
    }
  }
}

function duplicateFlowWithNewIds(flow, allFlows) {
  const nextFlowId = uniqueId(`${flow.name || flow.id}-copy`, allFlows);
  const newFlow = deepClone(flow);
  newFlow.id = nextFlowId;
  newFlow.name = `${flow.name || "Flow"} Copy`;

  const stepIdMap = new Map();
  newFlow.steps = (newFlow.steps || []).map((step, index) => {
    const nextId = `${slugify(step.id || step.title || `step-${index + 1}`)}-copy-${Math.random().toString(36).slice(2, 6)}`;
    stepIdMap.set(step.id, nextId);
    return { ...step, id: nextId };
  });

  newFlow.steps = newFlow.steps.map((step, index) => ({
    ...step,
    order: index,
    parentId: step.parentId ? stepIdMap.get(step.parentId) || null : null,
    next: step.next ? stepIdMap.get(step.next) || null : null,
    branches: (step.branches || []).map((branch) => ({
      ...branch,
      targetId: branch.targetId ? stepIdMap.get(branch.targetId) || null : null,
    })),
  }));

  return newFlow;
}

function cleanupFlowReferences(flow, deletedStepId) {
  flow.steps = (flow.steps || []).map((step) => ({
    ...step,
    parentId: step.parentId === deletedStepId ? null : step.parentId,
    next: step.next === deletedStepId ? null : step.next,
    branches: (step.branches || []).filter((branch) => branch.targetId !== deletedStepId),
  }));
}

async function handleToggleEdit() {
  if (!state.user || isBusy()) return;

  if (!state.editMode) {
    state.draft = deepClone(state.workspace);
    state.editMode = true;
    state.dirty = false;
    showNotice("info", "Edit mode on. Nothing saves until you hit the checkmark.");
    render();
    return;
  }

  try {
    state.saving = true;
    render();
    const normalized = normalizeWorkspace(state.draft);
    await saveWorkspace(state.user.uid, normalized);
    state.workspace = normalized;
    state.draft = null;
    state.editMode = false;
    state.dirty = false;
    state.saving = false;
    showNotice("success", "Changes saved.");
  } catch (error) {
    console.error(error);
    state.saving = false;
    showNotice("error", error.message || "Could not save your changes.");
  }
  render();
}

async function loadUserWorkspace(user) {
  state.workspaceLoading = true;
  render();
  try {
    let workspace = await loadWorkspace(user.uid);
    if (!workspace.flows.length) {
      workspace = await seedWorkspaceIfEmpty(user.uid);
      showNotice("success", "Seeded your workspace with the current default script.");
    }
    state.workspace = normalizeWorkspace(workspace);
    state.activeFlowId = state.workspace.flows[0]?.id || null;
    state.activeStepId = state.workspace.flows[0]?.steps?.[0]?.id || null;
  } catch (error) {
    console.error(error);
    showNotice("error", error.message || "Failed to load workspace.");
  }
  state.workspaceLoading = false;
  render();
}

async function resetBrowserData() {
  try {
    try { await signOutUser(); } catch (_) {}
    try { localStorage.clear(); } catch (_) {}
    try { sessionStorage.clear(); } catch (_) {}
    if (window.caches?.keys) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
    if (window.indexedDB?.databases) {
      const databases = await window.indexedDB.databases();
      await Promise.all((databases || []).map((database) => database?.name ? new Promise((resolve) => {
        const request = indexedDB.deleteDatabase(database.name);
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      }) : Promise.resolve()));
    } else {
      const guesses = [
        "firebaseLocalStorageDb",
        "firebase-installations-database",
        "firestore/[DEFAULT]/call-script-5ac34/main",
        "firestore/call-script-5ac34/main",
      ];
      await Promise.all(guesses.map((name) => new Promise((resolve) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = request.onerror = request.onblocked = () => resolve();
      })));
    }
    showNotice("success", "Local browser data cleared. Reloading…");
    render();
    setTimeout(() => window.location.reload(), 700);
  } catch (error) {
    console.error(error);
    showNotice("error", "Could not fully reset browser data. Try the browser site settings too.");
    render();
  }
}

async function handleAuthSubmit(form) {
  if (state.authPending) return;
  if (!isConfigured()) {
    showNotice("error", "Firebase is not configured yet.");
    render();
    return;
  }
  const formData = new FormData(form);
  const email = String(formData.get("email") || state.authForm.email || "").trim();
  const password = String(formData.get("password") || state.authForm.password || "");
  state.authForm = { email, password };
  if (!email || !password) {
    showNotice("error", "Email and password are required.");
    render();
    return;
  }

  state.authPending = true;
  render();
  try {
    if (state.authMode === "signin") {
      await signInWithEmail(email, password);
    } else {
      await signUpWithEmail(email, password);
      showNotice("success", "Account created. Loading your workspace…");
    }
  } catch (error) {
    console.error(error);
    const message = String(error?.message || "Authentication failed.")
      .replace("Firebase: ", "")
      .replace(/^Error \((.+?)\)\.?/, "$1")
      .replace(/auth\//g, "")
      .replaceAll("-", " ");
    showNotice("error", message.charAt(0).toUpperCase() + message.slice(1));
  }
  state.authPending = false;
  render();
}

function exportWorkspaceJson() {
  const payload = JSON.stringify(normalizeWorkspace(state.draft || state.workspace), null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `call-script-workspace-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function triggerImportPicker() {
  document.getElementById(importInputId)?.click();
}

function applyImportedWorkspace(text) {
  const parsed = JSON.parse(text);
  const normalized = normalizeWorkspace(parsed);
  if (!state.editMode) {
    state.draft = deepClone(state.workspace);
    state.editMode = true;
  }
  state.draft = normalized;
  state.dirty = true;
  state.activeFlowId = normalized.flows[0]?.id || null;
  state.activeStepId = normalized.flows[0]?.steps?.[0]?.id || null;
  showNotice("success", "Imported JSON into your draft. Hit the checkmark to save it.");
  render();
}

async function handleAction(action, target) {
  if (!action) return;
  if (action !== "toggle-group-menu") state.openGroupId = null;

  const flow = activeFlow();
  const step = activeStep();

  switch (action) {
    case "set-auth-mode":
      state.authMode = target.dataset.mode === "signup" ? "signup" : "signin";
      clearNotice();
      break;

    case "toggle-theme": {
      const source = state.editMode ? state.draft : state.workspace;
      if (!source) break;
      source.theme = source.theme === "dark" ? "light" : "dark";
      if (state.editMode) {
        state.dirty = true;
      } else if (state.user) {
        try {
          const normalized = normalizeWorkspace(state.workspace);
          await saveWorkspace(state.user.uid, normalized);
          state.workspace = normalized;
          showNotice("success", `Theme switched to ${normalized.theme}.`);
        } catch (error) {
          console.error(error);
          showNotice("error", "Could not save theme right now.");
        }
      }
      break;
    }

    case "signout":
      await signOutUser();
      state.workspace = null;
      state.draft = null;
      state.editMode = false;
      state.dirty = false;
      showNotice("success", "Signed out.");
      break;

    case "toggle-edit":
      await handleToggleEdit();
      return;

    case "discard-draft":
      if (!state.editMode) break;
      if (state.dirty && !window.confirm("Discard all unsaved changes?")) break;
      state.draft = deepClone(state.workspace);
      state.dirty = false;
      showNotice("info", "Draft reset to the last saved version.");
      break;

    case "reset-browser":
      await resetBrowserData();
      return;

    case "toggle-group-menu": {
      const groupId = target.dataset.groupId;
      state.openGroupId = state.openGroupId === groupId ? null : groupId;
      break;
    }

    case "create-group": {
      if (!state.editMode) break;
      const group = createDefaultGroup();
      state.draft.groups.push(group);
      state.dirty = true;
      showNotice("success", "New group created.");
      break;
    }

    case "move-group-up":
    case "move-group-down": {
      if (!state.editMode) break;
      const from = Number(target.dataset.groupIndex);
      const to = action.endsWith("up") ? from - 1 : from + 1;
      state.draft.groups = moveItem(state.draft.groups, from, to);
      state.dirty = true;
      break;
    }

    case "delete-group": {
      if (!state.editMode) break;
      const index = Number(target.dataset.groupIndex);
      const deleting = state.draft.groups[index];
      if (!deleting) break;
      if (!window.confirm(`Delete the group “${deleting.name}”? Flows inside it will be moved to another group.`)) break;
      const remaining = state.draft.groups.filter((_, itemIndex) => itemIndex !== index);
      if (!remaining.length) {
        remaining.push({ id: "general", name: "General", icon: "🗂️", order: 0 });
      }
      const fallbackGroupId = remaining[0].id;
      state.draft.groups = remaining.map((group, groupIndex) => ({ ...group, order: groupIndex }));
      state.draft.flows = state.draft.flows.map((item) => item.groupId === deleting.id ? { ...item, groupId: fallbackGroupId } : item);
      state.dirty = true;
      showNotice("success", "Group deleted and flows reassigned.");
      break;
    }

    case "create-flow": {
      if (!state.editMode) break;
      const groupId = activeGroup()?.id || state.draft.groups[0]?.id;
      const newFlow = createDefaultFlow(groupId);
      state.draft.flows.push(newFlow);
      state.draft.flows = state.draft.flows.map((item, index) => ({ ...item, order: index }));
      state.activeFlowId = newFlow.id;
      state.activeStepId = newFlow.steps[0]?.id || null;
      state.dirty = true;
      showNotice("success", "New call type created.");
      break;
    }

    case "duplicate-flow": {
      if (!state.editMode || !flow) break;
      const duplicate = duplicateFlowWithNewIds(flow, state.draft.flows);
      duplicate.order = state.draft.flows.length;
      state.draft.flows.push(duplicate);
      state.activeFlowId = duplicate.id;
      state.activeStepId = duplicate.steps[0]?.id || null;
      state.dirty = true;
      showNotice("success", "Call type duplicated.");
      break;
    }

    case "move-flow-up":
    case "move-flow-down": {
      if (!state.editMode) break;
      const from = Number(target.dataset.flowIndex);
      const to = action.endsWith("up") ? from - 1 : from + 1;
      state.draft.flows = moveItem(state.draft.flows, from, to);
      state.dirty = true;
      break;
    }

    case "delete-flow": {
      if (!state.editMode) break;
      const index = Number(target.dataset.flowIndex);
      const deleting = state.draft.flows[index];
      if (!deleting) break;
      if (!window.confirm(`Delete the call type “${deleting.name}” and all its steps?`)) break;
      state.draft.flows = state.draft.flows.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, order: itemIndex }));
      state.activeFlowId = state.draft.flows[Math.max(0, index - 1)]?.id || state.draft.flows[0]?.id || null;
      state.activeStepId = state.draft.flows.find((item) => item.id === state.activeFlowId)?.steps?.[0]?.id || null;
      state.dirty = true;
      showNotice("success", "Call type deleted.");
      break;
    }

    case "create-step": {
      if (!state.editMode || !flow) break;
      const newStep = createDefaultStep(flow);
      flow.steps.push(newStep);
      flow.steps = flow.steps.map((item, index) => ({ ...item, order: index }));
      state.activeStepId = newStep.id;
      state.dirty = true;
      showNotice("success", "Step created.");
      break;
    }

    case "duplicate-step": {
      if (!state.editMode || !flow || !step) break;
      const copy = deepClone(step);
      copy.id = uniqueId(`${step.id}-copy`, flow.steps);
      copy.label = `${step.label || step.title || "Step"} Copy`;
      copy.title = `${step.title || step.label || "Step"} Copy`;
      copy.order = flow.steps.length;
      flow.steps.push(copy);
      flow.steps = flow.steps.map((item, index) => ({ ...item, order: index }));
      state.activeStepId = copy.id;
      state.dirty = true;
      showNotice("success", "Step duplicated.");
      break;
    }

    case "move-step-up":
    case "move-step-down": {
      if (!state.editMode || !flow) break;
      const from = Number(target.dataset.stepIndex);
      const to = action.endsWith("up") ? from - 1 : from + 1;
      flow.steps = moveItem(flow.steps, from, to);
      state.dirty = true;
      break;
    }

    case "delete-step": {
      if (!state.editMode || !flow) break;
      const index = Number(target.dataset.stepIndex);
      const deleting = flow.steps[index];
      if (!deleting) break;
      if (!window.confirm(`Delete the step “${deleting.label || deleting.title}”?`)) break;
      flow.steps = flow.steps.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, order: itemIndex }));
      cleanupFlowReferences(flow, deleting.id);
      state.activeStepId = flow.steps[Math.max(0, index - 1)]?.id || flow.steps[0]?.id || null;
      state.dirty = true;
      showNotice("success", "Step deleted.");
      break;
    }

    case "set-step-template":
      if (state.editMode && step) {
        ensureStepTemplate(step, target.dataset.template);
        state.dirty = true;
      }
      break;

    case "add-branch":
      if (state.editMode && step) {
        step.branches = step.branches || [];
        step.branches.push({ label: "New branch", targetId: "", color: "flow" });
        state.dirty = true;
      }
      break;

    case "remove-branch":
      if (state.editMode && step) {
        const index = Number(target.dataset.index);
        step.branches.splice(index, 1);
        state.dirty = true;
      }
      break;

    case "add-key-point":
      if (state.editMode && step) {
        step.keyPoints = step.keyPoints || [];
        step.keyPoints.push("New key point");
        state.dirty = true;
      }
      break;

    case "remove-key-point":
      if (state.editMode && step) {
        step.keyPoints.splice(Number(target.dataset.index), 1);
        state.dirty = true;
      }
      break;

    case "add-extra-block":
      if (state.editMode && step) {
        step.extra = { title: "Reference notes", items: ["New item"] };
        state.dirty = true;
      }
      break;

    case "remove-extra-block":
      if (state.editMode && step) {
        step.extra = null;
        state.dirty = true;
      }
      break;

    case "add-extra-item":
      if (state.editMode && step) {
        step.extra = step.extra || { title: "Reference notes", items: [] };
        step.extra.items.push("New item");
        state.dirty = true;
      }
      break;

    case "remove-extra-item":
      if (state.editMode && step?.extra) {
        step.extra.items.splice(Number(target.dataset.index), 1);
        state.dirty = true;
      }
      break;

    case "add-guarantee":
      if (state.editMode && step) {
        step.guarantees = step.guarantees || [];
        step.guarantees.push({ name: "NEW GUARANTEE", color: "#059669", script: "" });
        state.dirty = true;
      }
      break;

    case "remove-guarantee":
      if (state.editMode && step?.guarantees) {
        step.guarantees.splice(Number(target.dataset.index), 1);
        state.dirty = true;
      }
      break;

    case "add-followup":
      if (state.editMode && step) {
        step.followUp = step.followUp || [];
        step.followUp.push({ day: `DAY ${step.followUp.length + 1}`, content: "" });
        state.dirty = true;
      }
      break;

    case "remove-followup":
      if (state.editMode && step?.followUp) {
        step.followUp.splice(Number(target.dataset.index), 1);
        state.dirty = true;
      }
      break;

    case "export-json":
      exportWorkspaceJson();
      break;

    case "trigger-import":
      triggerImportPicker();
      break;

    default:
      return;
  }

  render();
}

root.addEventListener("click", async (event) => {
  const navFlowTarget = event.target.closest("[data-nav-flow]");
  if (navFlowTarget) {
    state.activeFlowId = navFlowTarget.dataset.navFlow;
    state.activeStepId = (workspaceSource()?.flows || []).find((flow) => flow.id === state.activeFlowId)?.steps?.[0]?.id || null;
    state.openGroupId = null;
    render();
    return;
  }

  const navStepTarget = event.target.closest("[data-nav-step]");
  if (navStepTarget) {
    const targetStepId = navStepTarget.dataset.navStep;
    if (targetStepId) {
      state.activeStepId = targetStepId;
      render();
    }
    return;
  }

  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) {
    if (!event.target.closest(".nav-group")) {
      state.openGroupId = null;
      render();
    }
    return;
  }

  await handleAction(actionTarget.dataset.action, actionTarget);
});

root.addEventListener("input", (event) => {
  const element = event.target;
  if (element.name === "email" || element.name === "password") {
    state.authForm = {
      ...state.authForm,
      [element.name]: element.value,
    };
    return;
  }
  const path = element.dataset.path;
  if (!path || !state.editMode) return;
  const type = element.type === "checkbox" ? "checkbox" : "text";
  updateDraft(path, type === "checkbox" ? element.checked : element.value, type);
});

root.addEventListener("change", (event) => {
  const element = event.target;

  if (element.id === importInputId && element.files?.[0]) {
    const file = element.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        applyImportedWorkspace(String(reader.result || ""));
      } catch (error) {
        console.error(error);
        showNotice("error", "Could not import that JSON file.");
        render();
      }
      element.value = "";
    };
    reader.readAsText(file);
    return;
  }

  const path = element.dataset.path;
  if (!path || !state.editMode) return;
  const type = element.type === "checkbox" ? "checkbox" : "text";
  updateDraft(path, type === "checkbox" ? element.checked : element.value, type);
});

root.addEventListener("submit", async (event) => {
  if (event.target.id === "auth-form") {
    event.preventDefault();
    await handleAuthSubmit(event.target);
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!hasUnsavedChanges()) return;
  event.preventDefault();
  event.returnValue = "";
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".nav-group") && state.openGroupId) {
    state.openGroupId = null;
    render();
  }
});

(async function boot() {
  try {
    const storedVersion = localStorage.getItem(LOCAL_VERSION_KEY);
    if (storedVersion !== UI_VERSION) {
      localStorage.setItem(LOCAL_VERSION_KEY, UI_VERSION);
    }
  } catch (_) {}

  render();

  if (!isConfigured()) {
    state.authReady = true;
    render();
    return;
  }

  subscribeToAuth(async (user) => {
    state.user = user;
    state.authReady = true;
    state.editMode = false;
    state.draft = null;
    state.dirty = false;
    if (user) {
      state.authForm = { email: user.email || "", password: "" };
    } else {
      state.authForm = { email: state.authForm.email || "", password: "" };
    }
    render();
    if (user) {
      await loadUserWorkspace(user);
    } else {
      state.workspace = null;
      render();
    }
  });
})();
