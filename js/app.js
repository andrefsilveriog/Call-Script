import { BRANCH_COLORS, DEFAULT_GROUPS } from "./defaults.js";
import {
  isConfigured,
  subscribeToAuth,
  signInWithEmail,
  signUpWithEmail,
  signOutUser,
  saveWorkspace,
  seedWorkspaceIfEmpty,
} from "./firebase-service.js";

const root = document.getElementById("app");
const importInputId = "workspace-import-input";

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
    bg: "#111315",
    panel: "#171a1d",
    panel2: "#1c2024",
    soft: "#20252a",
    border: "#2b3138",
    borderStrong: "#3a434d",
    text: "#f2f4f6",
    text2: "#c6ced6",
    text3: "#8f9aa6",
    accent: "#d7dde3",
    accentText: "#111315",
    chip: "#21262b",
    shadow: "0 10px 28px rgba(0,0,0,0.18)",
  },
  light: {
    bg: "#f2f4f7",
    panel: "#ffffff",
    panel2: "#fbfbfc",
    soft: "#f5f6f7",
    border: "#d7dce2",
    borderStrong: "#c3c9d1",
    text: "#101418",
    text2: "#47505a",
    text3: "#6b7785",
    accent: "#171b20",
    accentText: "#ffffff",
    chip: "#f1f3f5",
    shadow: "0 8px 24px rgba(15,23,42,0.08)",
  },
};

function workspaceSource() {
  return state.editMode ? state.draft : state.workspace;
}

function currentThemeName() {
  return workspaceSource()?.theme || state.workspace?.theme || "dark";
}

function tokens() {
  return themeTokens[currentThemeName()] || themeTokens.dark;
}

function setThemeVars() {
  const t = tokens();
  const map = {
    "--bg": t.bg,
    "--panel": t.panel,
    "--panel-2": t.panel2,
    "--soft": t.soft,
    "--border": t.border,
    "--border-strong": t.borderStrong,
    "--text": t.text,
    "--text-2": t.text2,
    "--text-3": t.text3,
    "--accent": t.accent,
    "--accent-text": t.accentText,
    "--chip": t.chip,
    "--shadow": t.shadow,
  };
  Object.entries(map).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  document.documentElement.setAttribute("data-theme", currentThemeName());
}

function deepClone(v) {
  return structuredClone(v);
}

function sortByOrder(items = []) {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
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
  const ids = new Set(items.map((item) => item.id));
  let candidate = slugify(base);
  let n = 2;
  while (ids.has(candidate)) {
    candidate = `${slugify(base)}-${n}`;
    n += 1;
  }
  return candidate;
}

function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
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
    groupId: groups.some((g) => g.id === flow.groupId) ? flow.groupId : fallbackGroupId,
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
      specialType: step.specialType || inferSpecialType(step),
      parentId: step.parentId || null,
      next: step.next || null,
      guarantees: Array.isArray(step.guarantees) ? step.guarantees : [],
      followUp: Array.isArray(step.followUp) ? step.followUp : [],
      extra: step.extra && typeof step.extra === "object"
        ? { title: step.extra.title || "Notes", items: Array.isArray(step.extra.items) ? step.extra.items : [] }
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

function inferSpecialType(step) {
  if (Array.isArray(step?.guarantees) && step.guarantees.length) return "guarantees";
  if (Array.isArray(step?.followUp) && step.followUp.length) return "followup";
  return "standard";
}

function flowList() {
  return workspaceSource()?.flows || [];
}

function groupList() {
  return workspaceSource()?.groups || [];
}

function currentFlow() {
  return flowList().find((flow) => flow.id === state.activeFlowId) || flowList()[0] || null;
}

function currentGroup() {
  const flow = currentFlow();
  if (!flow) return groupList()[0] || null;
  return groupList().find((group) => group.id === flow.groupId) || groupList()[0] || null;
}

function currentStep() {
  const flow = currentFlow();
  if (!flow) return null;
  return flow.steps.find((step) => step.id === state.activeStepId) || flow.steps[0] || null;
}

function syncSelection() {
  const flows = flowList();
  if (!flows.length) {
    state.activeFlowId = null;
    state.activeStepId = null;
    return;
  }
  const flow = flows.find((item) => item.id === state.activeFlowId) || flows[0];
  state.activeFlowId = flow.id;
  const steps = flow.steps || [];
  if (!steps.length) {
    state.activeStepId = null;
    return;
  }
  const step = steps.find((item) => item.id === state.activeStepId) || steps[0];
  state.activeStepId = step.id;
}

function notify(message, tone = "info") {
  state.notice = { message, tone };
  render();
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => {
    state.notice = null;
    render();
  }, 2800);
}

function pathGet(obj, path) {
  return path.split("|").reduce((cursor, part) => {
    if (cursor == null) return undefined;
    if (/^\d+$/.test(part)) return cursor[Number(part)];
    return cursor[part];
  }, obj);
}

function pathSet(obj, path, value) {
  const parts = path.split("|");
  let cursor = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
    cursor = cursor[key];
  }
  const last = /^\d+$/.test(parts.at(-1)) ? Number(parts.at(-1)) : parts.at(-1);
  cursor[last] = value;
}

function bindingValue(path) {
  const source = state.editMode ? state.draft : state.workspace;
  return source ? pathGet(source, path) : "";
}

function makeInput(path, value, options = {}) {
  const { textarea = false, rows = 4, placeholder = "", cls = "field-input", type = "text" } = options;
  if (!state.editMode) {
    if (textarea || String(value || "").includes("\n")) {
      return `<div class="display-block ${value ? "" : "empty"}">${value ? renderText(value) : '<span>—</span>'}</div>`;
    }
    return `<div class="display-inline ${value ? "" : "empty"}">${value ? escapeHtml(value) : '<span>—</span>'}</div>`;
  }
  const common = `data-bind="${escapeHtml(path)}" class="${cls}" placeholder="${escapeHtml(placeholder)}"`;
  if (textarea) return `<textarea ${common} rows="${rows}">${escapeHtml(value || "")}</textarea>`;
  return `<input ${common} type="${type}" value="${escapeHtml(value || "")}" />`;
}

function makeSelect(path, value, options, cls = "field-input") {
  if (!state.editMode) {
    const found = options.find((option) => option.value === value);
    return `<div class="display-inline ${found ? "" : "empty"}">${escapeHtml(found?.label || "—")}</div>`;
  }
  return `
    <select data-bind="${escapeHtml(path)}" class="${cls}">
      ${options
        .map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`)
        .join("")}
    </select>
  `;
}

function renderAuthScreen() {
  const modeLabel = state.authMode === "signin" ? "Sign in" : "Create account";
  const submitLabel = state.authPending ? "Working…" : modeLabel;
  return `
    <div class="auth-wrap">
      <div class="auth-card panel">
        <div class="auth-head">
          <div>
            <h1>Call script app</h1>
            <p>Email and password only. Nothing fancy.</p>
          </div>
        </div>
        <div class="auth-switch">
          <button type="button" class="tab-btn ${state.authMode === "signin" ? "active" : ""}" data-action="set-auth-mode" data-mode="signin">Sign in</button>
          <button type="button" class="tab-btn ${state.authMode === "signup" ? "active" : ""}" data-action="set-auth-mode" data-mode="signup">Create account</button>
        </div>
        <form id="auth-form" class="auth-form" autocomplete="on">
          <label>
            <span>Email</span>
            <input name="email" type="email" autocomplete="username" value="${escapeHtml(state.authForm.email)}" required />
          </label>
          <label>
            <span>Password</span>
            <input name="password" type="password" autocomplete="current-password" value="${escapeHtml(state.authForm.password)}" required />
          </label>
          <button class="primary-btn auth-submit" ${state.authPending ? "disabled" : ""}>${submitLabel}</button>
        </form>
        ${state.notice ? `<div class="notice ${state.notice.tone}">${escapeHtml(state.notice.message)}</div>` : ""}
      </div>
    </div>
  `;
}

function renderLoadingScreen(text = "Loading…") {
  return `<div class="auth-wrap"><div class="loading-card panel"><p>${escapeHtml(text)}</p></div></div>`;
}

function renderTopNav() {
  const groups = groupList();
  const activeFlow = currentFlow();
  return `
    <div class="group-row">
      ${groups.map((group) => {
        const flows = flowList().filter((flow) => flow.groupId === group.id);
        const active = activeFlow?.groupId === group.id;
        const open = state.openGroupId === group.id;
        const activeName = active ? activeFlow?.name : (flows[0]?.name || "No flows");
        return `
          <div class="group-nav">
            <button class="group-btn ${active ? "active" : ""}" data-action="toggle-group-menu" data-group-id="${escapeHtml(group.id)}">
              <span class="group-btn-icon">${escapeHtml(group.icon || "•")}</span>
              <span class="group-btn-copy">
                <strong>${escapeHtml(group.name)}</strong>
                <small>${escapeHtml(activeName || "")}</small>
              </span>
              <span class="caret">▾</span>
            </button>
            <div class="group-menu ${open ? "open" : ""}">
              ${flows.length
                ? flows
                    .map(
                      (flow) => `
                      <button class="menu-item ${flow.id === activeFlow?.id ? "active" : ""}" data-action="select-flow" data-flow-id="${escapeHtml(flow.id)}">
                        <span>${escapeHtml(flow.icon || "•")}</span>
                        <span>
                          <strong>${escapeHtml(flow.name)}</strong>
                          <small>${escapeHtml(flow.desc || "")}</small>
                        </span>
                      </button>
                    `,
                    )
                    .join("")
                : `<div class="menu-empty">No call types in this group yet.</div>`}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderSidebar() {
  const flow = currentFlow();
  if (!flow) {
    return `<aside class="sidebar panel"><p>No call types yet.</p></aside>`;
  }
  const steps = sortByOrder(flow.steps || []);
  return `
    <aside class="sidebar panel">
      <div class="sidebar-top">
        <div>
          <div class="muted-label">Call type</div>
          <h2>${escapeHtml(flow.icon || "")}&nbsp;${escapeHtml(flow.name)}</h2>
          ${flow.desc ? `<p>${escapeHtml(flow.desc)}</p>` : ""}
        </div>
        ${state.editMode ? `<button class="secondary-btn" data-action="add-step">Add step</button>` : ""}
      </div>
      <div class="step-list">
        ${steps.length
          ? steps
              .map((step, index) => `
                <div class="step-row ${step.id === state.activeStepId ? "active" : ""}">
                  <button class="step-link" data-action="select-step" data-step-id="${escapeHtml(step.id)}">
                    <span class="step-num">${escapeHtml(step.num || String(index + 1).padStart(2, "0"))}</span>
                    <span class="step-copy">
                      <strong>${escapeHtml(step.label || step.title)}</strong>
                      <small>${escapeHtml(step.title || "")}</small>
                    </span>
                  </button>
                  ${state.editMode
                    ? `<div class="row-actions">
                        <button class="icon-btn" title="Move up" data-action="move-step" data-direction="up" data-step-id="${escapeHtml(step.id)}">↑</button>
                        <button class="icon-btn" title="Move down" data-action="move-step" data-direction="down" data-step-id="${escapeHtml(step.id)}">↓</button>
                      </div>`
                    : ""}
                </div>
              `)
              .join("")
          : `<p class="empty-text">No steps yet.</p>`}
      </div>
    </aside>
  `;
}

function renderFlowManager(flow) {
  const groupOptions = groupList().map((group) => ({ value: group.id, label: `${group.icon} ${group.name}` }));
  return `
    <section class="manager panel">
      <div class="section-head">
        <h3>Call type setup</h3>
        <div class="tool-row">
          <button class="secondary-btn" data-action="add-group">Add group</button>
          <button class="secondary-btn" data-action="add-flow">Add call type</button>
          ${flow ? `<button class="secondary-btn" data-action="duplicate-flow">Duplicate call type</button>
          <button class="danger-btn" data-action="delete-flow">Delete call type</button>` : ""}
        </div>
      </div>
      <div class="manager-grid groups-grid">
        ${groupList()
          .map(
            (group, index) => `
            <div class="group-edit-row">
              <div class="group-edit-fields">
                ${makeInput(`groups|${index}|icon`, group.icon || "", { placeholder: "Icon", cls: "tiny-input" })}
                ${makeInput(`groups|${index}|name`, group.name || "", { placeholder: "Group name" })}
              </div>
              <div class="row-actions">
                <button class="icon-btn" data-action="move-group" data-direction="up" data-group-id="${escapeHtml(group.id)}">↑</button>
                <button class="icon-btn" data-action="move-group" data-direction="down" data-group-id="${escapeHtml(group.id)}">↓</button>
                <button class="icon-btn danger" data-action="delete-group" data-group-id="${escapeHtml(group.id)}">✕</button>
              </div>
            </div>
          `,
          )
          .join("")}
      </div>
      ${flow
        ? `
          <div class="manager-grid flow-grid">
            <label><span>Name</span>${makeInput(`flows|${flowList().findIndex((item) => item.id === flow.id)}|name`, flow.name || "")}</label>
            <label><span>Icon</span>${makeInput(`flows|${flowList().findIndex((item) => item.id === flow.id)}|icon`, flow.icon || "", { placeholder: "📞" })}</label>
            <label class="span-2"><span>Description</span>${makeInput(`flows|${flowList().findIndex((item) => item.id === flow.id)}|desc`, flow.desc || "")}</label>
            <label class="span-2"><span>Group</span>${makeSelect(`flows|${flowList().findIndex((item) => item.id === flow.id)}|groupId`, flow.groupId, groupOptions)}</label>
          </div>
        `
        : ""}
    </section>
  `;
}

function renderBranchChips(step) {
  if (!step.branches?.length) return `<p class="empty-text">No branch buttons.</p>`;
  return `
    <div class="branch-list">
      ${step.branches
        .map((branch) => {
          const flow = currentFlow();
          const target = flow?.steps?.find((item) => item.id === branch.targetId);
          return `<button class="branch-chip" data-action="select-step" data-step-id="${escapeHtml(branch.targetId)}">${escapeHtml(branch.label)}${target ? ` → ${escapeHtml(target.label || target.title)}` : ""}</button>`;
        })
        .join("")}
    </div>
  `;
}

function renderStepEditor(step, flowIndex, stepIndex) {
  const flow = currentFlow();
  const stepOptions = (flow?.steps || []).map((item) => ({ value: item.id, label: `${item.num || ""} ${item.label || item.title}`.trim() }));
  const specialTypeOptions = [
    { value: "standard", label: "Standard" },
    { value: "guarantees", label: "Guarantees" },
    { value: "followup", label: "Follow-up cadence" },
  ];

  const specialType = step.specialType || inferSpecialType(step);
  const keyPoints = step.keyPoints || [];
  const extraItems = step.extra?.items || [];
  const guarantees = step.guarantees || [];
  const followUp = step.followUp || [];

  return `
    <section class="step-panel panel">
      <div class="section-head">
        <div>
          <div class="muted-label">Step</div>
          <h1>${state.editMode ? escapeHtml(step.title || "Untitled Step") : escapeHtml(step.title || "Untitled Step")}</h1>
          ${step.subtitle ? `<p>${escapeHtml(step.subtitle)}</p>` : ""}
        </div>
        <div class="tool-row">
          ${state.editMode ? `<button class="secondary-btn" data-action="duplicate-step">Duplicate step</button>
          <button class="danger-btn" data-action="delete-step">Delete step</button>` : ""}
        </div>
      </div>

      <div class="field-grid">
        <label><span>Step number</span>${makeInput(`flows|${flowIndex}|steps|${stepIndex}|num`, step.num || "")}</label>
        <label><span>Sidebar label</span>${makeInput(`flows|${flowIndex}|steps|${stepIndex}|label`, step.label || "")}</label>
        <label class="span-2"><span>Title</span>${makeInput(`flows|${flowIndex}|steps|${stepIndex}|title`, step.title || "")}</label>
        <label class="span-2"><span>Subtitle</span>${makeInput(`flows|${flowIndex}|steps|${stepIndex}|subtitle`, step.subtitle || "")}</label>
      </div>

      ${state.editMode
        ? `
          <div class="field-grid compact-grid">
            <label><span>Template</span>${makeSelect(`flows|${flowIndex}|steps|${stepIndex}|specialType`, specialType, specialTypeOptions)}</label>
            <label><span>Main step</span>${makeSelect(`flows|${flowIndex}|steps|${stepIndex}|main`, String(step.main), [
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ])}</label>
            <label><span>Parent step</span>${makeSelect(`flows|${flowIndex}|steps|${stepIndex}|parentId`, step.parentId || "", [{ value: "", label: "None" }, ...stepOptions])}</label>
            <label><span>Next step</span>${makeSelect(`flows|${flowIndex}|steps|${stepIndex}|next`, step.next || "", [{ value: "", label: "None" }, ...stepOptions])}</label>
          </div>
        `
        : ""}

      ${specialType === "standard" ? `
        <div class="content-section">
          <div class="muted-label">Script</div>
          ${makeInput(`flows|${flowIndex}|steps|${stepIndex}|script`, step.script || "", { textarea: true, rows: 7 })}
        </div>
        <div class="content-section">
          <div class="section-subhead">
            <div class="muted-label">Key points</div>
            ${state.editMode ? `<button class="secondary-btn" data-action="add-key-point">Add point</button>` : ""}
          </div>
          ${keyPoints.length
            ? `<div class="stack-list">
                ${keyPoints
                  .map(
                    (point, index) => `
                      <div class="stack-row">
                        ${makeInput(`flows|${flowIndex}|steps|${stepIndex}|keyPoints|${index}`, point || "")}
                        ${state.editMode ? `<button class="icon-btn danger" data-action="remove-key-point" data-index="${index}">✕</button>` : ""}
                      </div>
                    `,
                  )
                  .join("")}
              </div>`
            : `<p class="empty-text">No key points.</p>`}
        </div>
        <div class="content-section">
          <div class="section-subhead">
            <div class="muted-label">Notes</div>
            ${state.editMode ? `<button class="secondary-btn" data-action="toggle-extra">${step.extra ? "Remove notes" : "Add notes"}</button>` : ""}
          </div>
          ${step.extra
            ? `
              <div class="stack-list">
                <label><span>Notes title</span>${makeInput(`flows|${flowIndex}|steps|${stepIndex}|extra|title`, step.extra.title || "")}</label>
                ${extraItems
                  .map(
                    (item, index) => `
                      <div class="stack-row">
                        ${makeInput(`flows|${flowIndex}|steps|${stepIndex}|extra|items|${index}`, item || "")}
                        ${state.editMode ? `<button class="icon-btn danger" data-action="remove-extra-item" data-index="${index}">✕</button>` : ""}
                      </div>
                    `,
                  )
                  .join("")}
                ${state.editMode ? `<button class="secondary-btn" data-action="add-extra-item">Add note</button>` : ""}
              </div>
            `
            : `<p class="empty-text">No notes.</p>`}
        </div>
      ` : ""}

      ${specialType === "guarantees" ? `
        <div class="content-section">
          <div class="section-subhead">
            <div class="muted-label">Guarantees</div>
            ${state.editMode ? `<button class="secondary-btn" data-action="add-guarantee">Add guarantee</button>` : ""}
          </div>
          ${guarantees.length
            ? guarantees
                .map(
                  (item, index) => `
                    <div class="panel inset">
                      <div class="stack-row">
                        <label><span>Name</span>${makeInput(`flows|${flowIndex}|steps|${stepIndex}|guarantees|${index}|name`, item.name || "")}</label>
                        <label><span>Color</span>${makeInput(`flows|${flowIndex}|steps|${stepIndex}|guarantees|${index}|color`, item.color || "")}</label>
                        ${state.editMode ? `<button class="icon-btn danger align-end" data-action="remove-guarantee" data-index="${index}">✕</button>` : ""}
                      </div>
                      <label><span>Script</span>${makeInput(`flows|${flowIndex}|steps|${stepIndex}|guarantees|${index}|script`, item.script || "", { textarea: true, rows: 5 })}</label>
                    </div>
                  `,
                )
                .join("")
            : `<p class="empty-text">No guarantees.</p>`}
        </div>
      ` : ""}

      ${specialType === "followup" ? `
        <div class="content-section">
          <div class="section-subhead">
            <div class="muted-label">Follow-up blocks</div>
            ${state.editMode ? `<button class="secondary-btn" data-action="add-followup">Add block</button>` : ""}
          </div>
          ${followUp.length
            ? followUp
                .map(
                  (item, index) => `
                    <div class="panel inset">
                      <div class="stack-row">
                        <label><span>Label</span>${makeInput(`flows|${flowIndex}|steps|${stepIndex}|followUp|${index}|day`, item.day || "")}</label>
                        ${state.editMode ? `<button class="icon-btn danger align-end" data-action="remove-followup" data-index="${index}">✕</button>` : ""}
                      </div>
                      <label><span>Content</span>${makeInput(`flows|${flowIndex}|steps|${stepIndex}|followUp|${index}|content`, item.content || "", { textarea: true, rows: 5 })}</label>
                    </div>
                  `,
                )
                .join("")
            : `<p class="empty-text">No follow-up blocks.</p>`}
        </div>
      ` : ""}

      <div class="content-section">
        <div class="section-subhead">
          <div class="muted-label">Branches</div>
          ${state.editMode ? `<button class="secondary-btn" data-action="add-branch">Add branch</button>` : ""}
        </div>
        ${state.editMode
          ? `${(step.branches || []).length
              ? `<div class="stack-list">
                  ${(step.branches || [])
                    .map(
                      (branch, index) => `
                        <div class="branch-edit-row">
                          <label><span>Label</span>${makeInput(`flows|${flowIndex}|steps|${stepIndex}|branches|${index}|label`, branch.label || "")}</label>
                          <label><span>Target</span>${makeSelect(`flows|${flowIndex}|steps|${stepIndex}|branches|${index}|targetId`, branch.targetId || "", [{ value: "", label: "Choose step" }, ...stepOptions])}</label>
                          <label><span>Color</span>${makeSelect(
                            `flows|${flowIndex}|steps|${stepIndex}|branches|${index}|color`,
                            branch.color || "flow",
                            Object.keys(BRANCH_COLORS).map((key) => ({ value: key, label: key }))
                          )}</label>
                          <button class="icon-btn danger align-end" data-action="remove-branch" data-index="${index}">✕</button>
                        </div>
                      `,
                    )
                    .join("")}
                </div>`
              : `<p class="empty-text">No branch buttons.</p>`}`
          : renderBranchChips(step)}
      </div>

      <div class="content-section">
        <div class="muted-label">Tone cue</div>
        ${makeInput(`flows|${flowIndex}|steps|${stepIndex}|toneCue`, step.toneCue || "", { textarea: true, rows: 3 })}
      </div>
    </section>
  `;
}

function renderShell() {
  const flow = currentFlow();
  const step = currentStep();
  const flowIndex = flowList().findIndex((item) => item.id === flow?.id);
  const stepIndex = flow?.steps?.findIndex((item) => item.id === step?.id) ?? -1;

  return `
    <div class="app-shell">
      <header class="topbar panel">
        <div class="brand-block">
          <strong>Call script</strong>
        </div>
        <div class="topbar-main">${renderTopNav()}</div>
        <div class="topbar-actions">
          ${state.editMode ? `<button class="secondary-btn" data-action="discard-edit">Discard</button>` : ""}
          <button class="secondary-btn" data-action="toggle-theme">${currentThemeName() === "dark" ? "Light" : "Dark"}</button>
          <button class="secondary-btn" data-action="export-json">Export</button>
          <button class="secondary-btn" data-action="trigger-import">Import</button>
          <button class="secondary-btn" data-action="reset-browser-data">Reset local data</button>
          <button class="secondary-btn" data-action="sign-out">Sign out</button>
          <input id="${importInputId}" type="file" accept="application/json" hidden />
        </div>
      </header>

      <div class="page-grid">
        ${renderSidebar()}
        <main class="main-column">
          ${state.editMode ? renderFlowManager(flow) : ""}
          ${flow && step ? renderStepEditor(step, flowIndex, stepIndex) : `<section class="panel"><p>No step selected.</p></section>`}
        </main>
      </div>

      <button class="fab" data-action="toggle-edit" ${state.saving ? "disabled" : ""}>${state.editMode ? (state.saving ? "…" : "✓") : "✎"}</button>
      ${state.notice ? `<div class="toast ${state.notice.tone}">${escapeHtml(state.notice.message)}</div>` : ""}
    </div>
  `;
}

function render() {
  setThemeVars();
  if (!isConfigured()) {
    root.innerHTML = renderLoadingScreen("Firebase config missing.");
    attachRootListeners();
    return;
  }
  if (!state.authReady) {
    root.innerHTML = renderLoadingScreen("Checking sign-in…");
    attachRootListeners();
    return;
  }
  if (!state.user) {
    root.innerHTML = renderAuthScreen();
    attachRootListeners();
    return;
  }
  if (state.workspaceLoading || !state.workspace) {
    root.innerHTML = renderLoadingScreen("Loading workspace…");
    attachRootListeners();
    return;
  }
  root.innerHTML = renderShell();
  attachRootListeners();
}

function prepareDraft() {
  if (!state.editMode) return;
  if (!state.draft) state.draft = deepClone(state.workspace);
}

function startEdit() {
  state.editMode = true;
  state.draft = deepClone(state.workspace);
  state.dirty = false;
  state.openGroupId = null;
  syncSelection();
  render();
}

async function saveEdit() {
  if (!state.editMode || !state.draft || !state.user) return;
  state.saving = true;
  render();
  try {
    const normalized = normalizeWorkspace(state.draft);
    await saveWorkspace(state.user.uid, normalized);
    state.workspace = normalized;
    state.draft = null;
    state.editMode = false;
    state.dirty = false;
    syncSelection();
    notify("Saved.", "success");
  } catch (error) {
    console.error(error);
    state.saving = false;
    notify(error.message || "Could not save.", "error");
    render();
    return;
  }
  state.saving = false;
  render();
}

function discardEdit() {
  state.editMode = false;
  state.draft = null;
  state.dirty = false;
  render();
}

function currentDraftWorkspace() {
  return state.editMode ? state.draft : state.workspace;
}

function currentDraftFlow() {
  return currentDraftWorkspace()?.flows?.find((flow) => flow.id === state.activeFlowId) || null;
}

function currentDraftStep() {
  const flow = currentDraftFlow();
  return flow?.steps?.find((step) => step.id === state.activeStepId) || null;
}

function reindexWorkspace(workspace) {
  workspace.groups = workspace.groups.map((group, index) => ({ ...group, order: index }));
  workspace.flows = workspace.flows.map((flow, index) => ({
    ...flow,
    order: index,
    steps: sortByOrder(flow.steps || []).map((step, stepIndex) => ({ ...step, order: stepIndex })),
  }));
}

function markDirty() {
  if (!state.editMode) return;
  reindexWorkspace(state.draft);
  state.dirty = true;
}

function addGroup() {
  prepareDraft();
  const groups = state.draft.groups;
  const id = uniqueId("group", groups);
  groups.push({ id, name: "New group", icon: "🗂️", order: groups.length });
  markDirty();
  render();
}

function deleteGroup(groupId) {
  prepareDraft();
  if (state.draft.groups.length === 1) {
    notify("You need at least one group.", "warn");
    return;
  }
  const targetIndex = state.draft.groups.findIndex((group) => group.id === groupId);
  if (targetIndex < 0) return;
  const fallbackGroup = state.draft.groups.find((group) => group.id !== groupId);
  state.draft.flows.forEach((flow) => {
    if (flow.groupId === groupId) flow.groupId = fallbackGroup.id;
  });
  state.draft.groups.splice(targetIndex, 1);
  if (state.openGroupId === groupId) state.openGroupId = null;
  markDirty();
  render();
}

function moveGroup(groupId, direction) {
  prepareDraft();
  const index = state.draft.groups.findIndex((group) => group.id === groupId);
  if (index < 0) return;
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= state.draft.groups.length) return;
  const [item] = state.draft.groups.splice(index, 1);
  state.draft.groups.splice(nextIndex, 0, item);
  markDirty();
  render();
}

function addFlow() {
  prepareDraft();
  const groupId = currentGroup()?.id || state.draft.groups[0]?.id;
  const id = uniqueId("call-type", state.draft.flows);
  const flow = {
    id,
    name: "New call type",
    icon: "📞",
    desc: "",
    groupId,
    order: state.draft.flows.length,
    steps: [
      {
        id: `step-${uid()}`,
        num: "01",
        label: "Open",
        title: "Opening",
        subtitle: "",
        script: "",
        toneCue: "",
        keyPoints: [],
        branches: [],
        main: true,
        special: false,
        specialType: "standard",
        parentId: null,
        next: null,
        guarantees: [],
        followUp: [],
        extra: null,
        order: 0,
      },
    ],
  };
  state.draft.flows.push(flow);
  state.activeFlowId = id;
  state.activeStepId = flow.steps[0].id;
  state.openGroupId = groupId;
  markDirty();
  render();
}

function duplicateFlow() {
  prepareDraft();
  const flow = currentDraftFlow();
  if (!flow) return;
  const copy = deepClone(flow);
  copy.id = uniqueId(`${flow.name || "call-type"}-copy`, state.draft.flows);
  copy.name = `${flow.name} Copy`;
  copy.steps = copy.steps.map((step, index) => ({ ...step, id: `${step.id}-${uid()}`, order: index }));
  const oldToNew = new Map();
  flow.steps.forEach((step, index) => oldToNew.set(step.id, copy.steps[index].id));
  copy.steps.forEach((step) => {
    if (step.parentId && oldToNew.has(step.parentId)) step.parentId = oldToNew.get(step.parentId);
    if (step.next && oldToNew.has(step.next)) step.next = oldToNew.get(step.next);
    step.branches = (step.branches || []).map((branch) => ({
      ...branch,
      targetId: oldToNew.get(branch.targetId) || branch.targetId,
    }));
  });
  state.draft.flows.push(copy);
  state.activeFlowId = copy.id;
  state.activeStepId = copy.steps[0]?.id || null;
  markDirty();
  render();
}

function deleteFlow() {
  prepareDraft();
  const index = state.draft.flows.findIndex((flow) => flow.id === state.activeFlowId);
  if (index < 0) return;
  state.draft.flows.splice(index, 1);
  if (!state.draft.flows.length) {
    addFlow();
    return;
  }
  const flow = state.draft.flows[Math.max(0, index - 1)] || state.draft.flows[0];
  state.activeFlowId = flow.id;
  state.activeStepId = flow.steps[0]?.id || null;
  markDirty();
  render();
}

function addStep() {
  prepareDraft();
  const flow = currentDraftFlow();
  if (!flow) return;
  const newStep = {
    id: `step-${uid()}`,
    num: String((flow.steps?.length || 0) + 1).padStart(2, "0"),
    label: "New step",
    title: "New step",
    subtitle: "",
    script: "",
    toneCue: "",
    keyPoints: [],
    branches: [],
    main: true,
    special: false,
    specialType: "standard",
    parentId: null,
    next: null,
    guarantees: [],
    followUp: [],
    extra: null,
    order: flow.steps.length,
  };
  flow.steps.push(newStep);
  state.activeStepId = newStep.id;
  markDirty();
  render();
}

function duplicateStep() {
  prepareDraft();
  const flow = currentDraftFlow();
  const step = currentDraftStep();
  if (!flow || !step) return;
  const index = flow.steps.findIndex((item) => item.id === step.id);
  const copy = deepClone(step);
  copy.id = `step-${uid()}`;
  copy.label = `${step.label} Copy`;
  copy.title = `${step.title} Copy`;
  flow.steps.splice(index + 1, 0, copy);
  state.activeStepId = copy.id;
  markDirty();
  render();
}

function deleteStep() {
  prepareDraft();
  const flow = currentDraftFlow();
  if (!flow) return;
  if (flow.steps.length === 1) {
    notify("A call type needs at least one step.", "warn");
    return;
  }
  const index = flow.steps.findIndex((step) => step.id === state.activeStepId);
  if (index < 0) return;
  const deletedId = flow.steps[index].id;
  flow.steps.splice(index, 1);
  flow.steps.forEach((step) => {
    if (step.parentId === deletedId) step.parentId = null;
    if (step.next === deletedId) step.next = null;
    step.branches = (step.branches || []).filter((branch) => branch.targetId !== deletedId);
  });
  state.activeStepId = flow.steps[Math.max(0, index - 1)]?.id || flow.steps[0]?.id || null;
  markDirty();
  render();
}

function moveStep(direction, stepId) {
  prepareDraft();
  const flow = currentDraftFlow();
  if (!flow) return;
  const index = flow.steps.findIndex((step) => step.id === stepId);
  if (index < 0) return;
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= flow.steps.length) return;
  const [step] = flow.steps.splice(index, 1);
  flow.steps.splice(nextIndex, 0, step);
  markDirty();
  render();
}

function toggleExtra() {
  prepareDraft();
  const step = currentDraftStep();
  if (!step) return;
  step.extra = step.extra ? null : { title: "Notes", items: [""] };
  markDirty();
  render();
}

function addKeyPoint() {
  prepareDraft();
  const step = currentDraftStep();
  if (!step) return;
  step.keyPoints = step.keyPoints || [];
  step.keyPoints.push("");
  markDirty();
  render();
}

function removeKeyPoint(index) {
  prepareDraft();
  const step = currentDraftStep();
  if (!step?.keyPoints) return;
  step.keyPoints.splice(index, 1);
  markDirty();
  render();
}

function addExtraItem() {
  prepareDraft();
  const step = currentDraftStep();
  if (!step) return;
  if (!step.extra) step.extra = { title: "Notes", items: [] };
  step.extra.items.push("");
  markDirty();
  render();
}

function removeExtraItem(index) {
  prepareDraft();
  const step = currentDraftStep();
  if (!step?.extra?.items) return;
  step.extra.items.splice(index, 1);
  markDirty();
  render();
}

function addBranch() {
  prepareDraft();
  const step = currentDraftStep();
  const flow = currentDraftFlow();
  if (!step || !flow) return;
  step.branches = step.branches || [];
  step.branches.push({ label: "New branch", targetId: flow.steps[0]?.id || "", color: "flow" });
  markDirty();
  render();
}

function removeBranch(index) {
  prepareDraft();
  const step = currentDraftStep();
  if (!step?.branches) return;
  step.branches.splice(index, 1);
  markDirty();
  render();
}

function addGuarantee() {
  prepareDraft();
  const step = currentDraftStep();
  if (!step) return;
  step.guarantees = step.guarantees || [];
  step.guarantees.push({ name: "Guarantee", color: "#059669", script: "" });
  step.specialType = "guarantees";
  markDirty();
  render();
}

function removeGuarantee(index) {
  prepareDraft();
  const step = currentDraftStep();
  if (!step?.guarantees) return;
  step.guarantees.splice(index, 1);
  markDirty();
  render();
}

function addFollowup() {
  prepareDraft();
  const step = currentDraftStep();
  if (!step) return;
  step.followUp = step.followUp || [];
  step.followUp.push({ day: "Day label", content: "" });
  step.specialType = "followup";
  markDirty();
  render();
}

function removeFollowup(index) {
  prepareDraft();
  const step = currentDraftStep();
  if (!step?.followUp) return;
  step.followUp.splice(index, 1);
  markDirty();
  render();
}

function handleTemplateChange(step) {
  step.special = step.specialType !== "standard";
  if (step.specialType === "standard") {
    step.guarantees = [];
    step.followUp = [];
  } else if (step.specialType === "guarantees") {
    step.guarantees = step.guarantees?.length ? step.guarantees : [{ name: "Guarantee", color: "#059669", script: "" }];
    step.followUp = [];
  } else if (step.specialType === "followup") {
    step.followUp = step.followUp?.length ? step.followUp : [{ day: "Day 1", content: "" }];
    step.guarantees = [];
  }
}

function exportJson() {
  const blob = new Blob([JSON.stringify(currentDraftWorkspace(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "call-script-workspace.json";
  link.click();
  URL.revokeObjectURL(url);
}

function triggerImport() {
  document.getElementById(importInputId)?.click();
}

async function handleImport(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const normalized = normalizeWorkspace(parsed);
    if (state.editMode) {
      state.draft = normalized;
      markDirty();
    } else {
      state.workspace = normalized;
      state.editMode = true;
      state.draft = deepClone(normalized);
      state.dirty = true;
    }
    syncSelection();
    render();
    notify("Imported into edit mode. Save to keep it.", "success");
  } catch (error) {
    console.error(error);
    notify("Could not import that file.", "error");
  }
}

function resetBrowserData() {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch (error) {
    console.error(error);
  }
  notify("Local browser data cleared for this tab. Reload if needed.", "success");
}

function toggleTheme() {
  if (state.editMode) {
    state.draft.theme = state.draft.theme === "dark" ? "light" : "dark";
    markDirty();
  } else {
    state.workspace.theme = state.workspace.theme === "dark" ? "light" : "dark";
    state.draft = deepClone(state.workspace);
    state.editMode = true;
    state.dirty = true;
  }
  render();
}

async function handleAction(action, dataset) {
  switch (action) {
    case "set-auth-mode":
      state.authMode = dataset.mode || "signin";
      render();
      break;
    case "toggle-group-menu":
      state.openGroupId = state.openGroupId === dataset.groupId ? null : dataset.groupId;
      render();
      break;
    case "select-flow": {
      state.activeFlowId = dataset.flowId;
      state.activeStepId = (flowList().find((flow) => flow.id === dataset.flowId)?.steps || [])[0]?.id || null;
      state.openGroupId = null;
      render();
      break;
    }
    case "select-step":
      state.activeStepId = dataset.stepId;
      render();
      break;
    case "toggle-edit":
      if (state.editMode) await saveEdit();
      else startEdit();
      break;
    case "discard-edit":
      discardEdit();
      break;
    case "add-group":
      addGroup();
      break;
    case "delete-group":
      deleteGroup(dataset.groupId);
      break;
    case "move-group":
      moveGroup(dataset.groupId, dataset.direction);
      break;
    case "add-flow":
      addFlow();
      break;
    case "duplicate-flow":
      duplicateFlow();
      break;
    case "delete-flow":
      deleteFlow();
      break;
    case "add-step":
      addStep();
      break;
    case "duplicate-step":
      duplicateStep();
      break;
    case "delete-step":
      deleteStep();
      break;
    case "move-step":
      moveStep(dataset.direction, dataset.stepId);
      break;
    case "toggle-extra":
      toggleExtra();
      break;
    case "add-key-point":
      addKeyPoint();
      break;
    case "remove-key-point":
      removeKeyPoint(Number(dataset.index));
      break;
    case "add-extra-item":
      addExtraItem();
      break;
    case "remove-extra-item":
      removeExtraItem(Number(dataset.index));
      break;
    case "add-branch":
      addBranch();
      break;
    case "remove-branch":
      removeBranch(Number(dataset.index));
      break;
    case "add-guarantee":
      addGuarantee();
      break;
    case "remove-guarantee":
      removeGuarantee(Number(dataset.index));
      break;
    case "add-followup":
      addFollowup();
      break;
    case "remove-followup":
      removeFollowup(Number(dataset.index));
      break;
    case "toggle-theme":
      toggleTheme();
      break;
    case "export-json":
      exportJson();
      break;
    case "trigger-import":
      triggerImport();
      break;
    case "reset-browser-data":
      resetBrowserData();
      break;
    case "sign-out":
      try {
        await signOutUser();
      } catch (error) {
        notify(error.message || "Could not sign out.", "error");
      }
      break;
    default:
      break;
  }
}

function attachRootListeners() {
  const authForm = document.getElementById("auth-form");
  if (authForm) {
    authForm.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      state.authForm[target.name] = target.value;
    });

    authForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (state.authPending) return;
      state.authPending = true;
      render();
      try {
        const email = state.authForm.email.trim();
        const password = state.authForm.password;
        if (state.authMode === "signin") {
          await signInWithEmail(email, password);
        } else {
          await signUpWithEmail(email, password);
        }
      } catch (error) {
        console.error(error);
        state.authPending = false;
        notify(error.message || "Could not authenticate.", "error");
        render();
        return;
      }
      state.authPending = false;
    });
  }

  root.querySelectorAll("[data-bind]").forEach((element) => {
    const path = element.getAttribute("data-bind");
    const handler = (event) => {
      if (!state.editMode || !state.draft) return;
      let value = event.target.value;
      if (value === "true") value = true;
      if (value === "false") value = false;
      pathSet(state.draft, path, value);
      const step = currentDraftStep();
      if (step && path.endsWith("specialType")) handleTemplateChange(step);
      markDirty();
    };
    element.addEventListener("input", handler);
    element.addEventListener("change", handler);
  });

  root.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const target = event.currentTarget;
      const { action, ...dataset } = target.dataset;
      await handleAction(action, dataset);
    });
  });

  const importInput = document.getElementById(importInputId);
  if (importInput) {
    importInput.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      handleImport(file);
      event.target.value = "";
    });
  }

  document.onclick = (event) => {
    if (!state.openGroupId) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest(".group-nav")) {
      state.openGroupId = null;
      render();
    }
  };
}

function init() {
  subscribeToAuth(async (user) => {
    state.user = user;
    state.authReady = true;
    state.authPending = false;

    if (!user) {
      state.workspace = null;
      state.draft = null;
      state.editMode = false;
      state.dirty = false;
      state.workspaceLoading = false;
      render();
      return;
    }

    state.workspaceLoading = true;
    render();
    try {
      const workspace = await seedWorkspaceIfEmpty(user.uid);
      state.workspace = normalizeWorkspace(workspace);
      state.draft = null;
      state.editMode = false;
      state.dirty = false;
      syncSelection();
    } catch (error) {
      console.error(error);
      notify(error.message || "Could not load workspace.", "error");
    }
    state.workspaceLoading = false;
    render();
  });
}

init();
