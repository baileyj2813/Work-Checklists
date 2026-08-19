const STORAGE_KEY = "workdayChecklist_v3";
const LEGACY_STORAGE_KEY = "workdayChecklist_v2";

const DEFAULTS = {
  daily: [
    ["Accounts Payable", "AP Invoice Entry"],
    ["Accounts Payable", "AP Invoice Research/Followup"],
    ["Accounts Payable", "Reminders to Approve AP Invoices"],
    ["Accounts Payable", "AP Invoice Posting"],
    ["Cash & Banking", "Lockbox and ACH Deposit Entries"],
    ["Cash & Banking", "Positive Pay Monitoring and Decisioning"],
    ["Admin & Communication", "Respond to Emails"],
    ["Admin & Communication", "Organize Inboxes"],
    ["Admin & Communication", "Assigning Project/SM Agreement Numbers"],
    ["Admin & Communication", "Update Monday.com"]
  ],
  weekly: [
    ["Check Run & Payments", "Select Checks for Printing"],
    ["Check Run & Payments", "Print Checks"],
    ["Check Run & Payments", "Mail Checks"],
    ["Check Run & Payments", "Corpay"],
    ["Mail & Deposits", "Collect Mail Twice A Week"],
    ["Mail & Deposits", "Deposit Checks"]
  ],
  monthly: [
    ["Accounts Payable", "Move Remaining AP Invoices from the Previous Month to This Month"],
    ["Accounts Payable", "Review Vendor Statements"],
    ["Journal Entries", "Journal Entries: Fixed Assets, PP Ins, PP Assets, PP Software"],
    ["Journal Entries", "Journal Entries: Rental Lease Payment"],
    ["Concur", "Concur Expense Reminder to Submit Expenses"],
    ["Concur", "Concur Expense Comparison to Key Bank Statement"],
    ["Concur", "Concur Expense Reminder to Approve Expenses"],
    ["Concur", "Concur Expense Review"],
    ["Concur", "Concur GL and JC Import/Journal Entries"],
    ["Concur", "Concur Intercompany Entries and Emails"],
    ["Other Monthly", "Bambora — Technically for the Previous Month but gets done as a Current Month Transaction Within AP Unapproved Invoice Entry"],
    ["Other Monthly", "Enterprise FM Lease Payment"],
    ["Other Monthly", "Nvoice Credit Entry"]
  ]
};

function newId() {
  return (crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function makeItems(sectionName) {
  return DEFAULTS[sectionName].map(([group, text]) => ({ id: newId(), group, text, completed: false }));
}

function createDefaultState() {
  return {
    sections: {
      daily: { items: makeItems("daily"), cycleId: null },
      weekly: { items: makeItems("weekly"), cycleId: null },
      monthly: { items: makeItems("monthly"), cycleId: null }
    }
  };
}

function defaultGroupFor(sectionName, text) {
  const match = DEFAULTS[sectionName].find(([, defaultText]) => defaultText === text);
  if (match) return match[0];
  return "Other";
}

function normalizeSection(sectionName, section) {
  return {
    items: Array.isArray(section?.items)
      ? section.items.map(item => ({
          id: item.id || newId(),
          group: item.group || defaultGroupFor(sectionName, String(item.text || "")),
          text: String(item.text || ""),
          completed: Boolean(item.completed)
        })).filter(item => item.text.trim())
      : [],
    cycleId: section?.cycleId || null
  };
}

function migrateLegacyState() {
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    if (!legacy?.sections) return null;

    const migrated = {
      sections: {
        daily: normalizeSection("daily", legacy.sections.daily),
        weekly: normalizeSection("weekly", legacy.sections.weekly),
        monthly: normalizeSection("monthly", legacy.sections.monthly)
      }
    };

    // The previous starter version did not contain the monthly defaults.
    // If that old section is empty, populate the requested monthly workflow now.
    if (!migrated.sections.monthly.items.length) {
      migrated.sections.monthly.items = makeItems("monthly");
    }
    return migrated;
  } catch {
    return null;
  }
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.sections) {
      return {
        sections: {
          daily: normalizeSection("daily", saved.sections.daily),
          weekly: normalizeSection("weekly", saved.sections.weekly),
          monthly: normalizeSection("monthly", saved.sections.monthly)
        }
      };
    }
  } catch {}

  return migrateLegacyState() || createDefaultState();
}

let state = loadState();

// Workflow update: Monday.com is now a daily task instead of monthly.
// Reconcile existing saved browser data so users upgrading from Dashboard V2
// get the change without having to clear their checklist history.
(function reconcileMondayTask() {
  const taskText = "Update Monday.com";
  const monthly = state.sections.monthly.items;
  const daily = state.sections.daily.items;
  const oldIndex = monthly.findIndex(item => item.text === taskText);
  if (oldIndex !== -1) monthly.splice(oldIndex, 1);
  if (!daily.some(item => item.text === taskText)) {
    daily.push({ id: newId(), group: "Admin & Communication", text: taskText, completed: false });
  }
})();

const openGroups = new Set();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMonday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

function getMonthlyCycleStart(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), 7);
  if (date.getDate() < 7) d.setMonth(d.getMonth() - 1);
  return d;
}

function getCycleId(sectionName, now = new Date()) {
  if (sectionName === "daily") return dateKey(now);
  if (sectionName === "weekly") return dateKey(getMonday(now));
  return dateKey(getMonthlyCycleStart(now));
}

function resetIfNeeded(sectionName) {
  const section = state.sections[sectionName];
  const currentCycle = getCycleId(sectionName);
  if (section.cycleId !== currentCycle) {
    section.items = section.items.map(item => ({ ...item, completed: false }));
    section.cycleId = currentCycle;
  }
}

function runResetChecks() {
  ["daily", "weekly", "monthly"].forEach(resetIfNeeded);
  saveState();
}

function nextDailyReset(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

function nextMonday(now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = today.getDay();
  let days = day === 0 ? 1 : 8 - day;
  if (day === 1) days = 7;
  today.setDate(today.getDate() + days);
  return today;
}

function nextMonthlyReset(now = new Date()) {
  const reset = new Date(now.getFullYear(), now.getMonth(), 7);
  if (now.getDate() >= 7) reset.setMonth(reset.getMonth() + 1);
  return reset;
}

function fmtDate(date) {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function renderHeader() {
  const now = new Date();
  document.getElementById("todayLabel").textContent = now.toLocaleDateString(undefined, { weekday: "long" });
  document.getElementById("todayDate").textContent = now.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  document.getElementById("dailyResetText").textContent = `Next reset: ${fmtDate(nextDailyReset(now))}`;
  document.getElementById("weeklyResetText").textContent = `Current week began ${fmtDate(getMonday(now))} · Next reset: ${fmtDate(nextMonday(now))}`;
  document.getElementById("monthlyResetText").textContent = `Current cycle began ${fmtDate(getMonthlyCycleStart(now))} · Next reset: ${fmtDate(nextMonthlyReset(now))}`;
}

function updateProgress(sectionName) {
  const items = state.sections[sectionName].items;
  const completed = items.filter(item => item.completed).length;
  const total = items.length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  document.getElementById(`${sectionName}Overview`).textContent = `${completed} / ${total}`;
  document.getElementById(`${sectionName}Progress`).style.width = `${percent}%`;
  const ring = document.getElementById(`${sectionName}Ring`);
  ring.style.background = `conic-gradient(var(--accent) ${percent}%, #ededf5 ${percent}%)`;
  ring.querySelector("span").textContent = `${percent}%`;
}

function updateGroupProgress(groupEl, groupItems) {
  const completed = groupItems.filter(item => item.completed).length;
  const total = groupItems.length;
  groupEl.querySelector(".group-count").textContent = `${completed}/${total}`;
  groupEl.classList.toggle("group-complete", total > 0 && completed === total);
}

function createItemRow(sectionName, item, groupEl, groupItems) {
  const fragment = document.getElementById("itemTemplate").content.cloneNode(true);
  const row = fragment.querySelector(".check-item");
  const checkButton = fragment.querySelector(".check-button");
  const itemText = fragment.querySelector(".item-text");
  const deleteButton = fragment.querySelector(".delete-button");

  itemText.textContent = item.text;
  row.classList.toggle("completed", item.completed);
  checkButton.setAttribute("aria-pressed", String(item.completed));

  // Important: checking an item updates the existing row in place rather than
  // re-rendering the dropdown. This keeps the group open while working through it.
  checkButton.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    item.completed = !item.completed;
    row.classList.toggle("completed", item.completed);
    checkButton.setAttribute("aria-pressed", String(item.completed));
    saveState();
    updateProgress(sectionName);
    updateGroupProgress(groupEl, groupItems);
  });

  deleteButton.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    state.sections[sectionName].items = state.sections[sectionName].items.filter(x => x.id !== item.id);
    saveState();
    renderSection(sectionName);
  });

  return fragment;
}

function renderSection(sectionName) {
  const section = state.sections[sectionName];
  const list = document.getElementById(`${sectionName}List`);
  list.innerHTML = "";

  if (!section.items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = `No ${sectionName} tasks yet. Add your first one below.`;
    list.appendChild(empty);
    updateProgress(sectionName);
    return;
  }

  const groups = new Map();
  section.items.forEach(item => {
    const group = item.group || "Other";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(item);
  });

  groups.forEach((groupItems, groupName) => {
    const key = `${sectionName}:${groupName}`;
    const details = document.createElement("details");
    details.className = "task-group";
    details.dataset.groupKey = key;

    // Groups start open the first time they are rendered. Their open/closed state
    // is remembered for the rest of the session and never changes just from checks.
    if (!openGroups.has(`${key}:seen`) || openGroups.has(key)) details.open = true;
    openGroups.add(`${key}:seen`);
    if (details.open) openGroups.add(key);

    const summary = document.createElement("summary");
    summary.innerHTML = `<span class="group-title">${escapeHtml(groupName)}</span><span class="group-count"></span>`;
    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "group-items";
    groupItems.forEach(item => body.appendChild(createItemRow(sectionName, item, details, groupItems)));
    details.appendChild(body);

    details.addEventListener("toggle", () => {
      if (details.open) openGroups.add(key);
      else openGroups.delete(key);
    });

    updateGroupProgress(details, groupItems);
    list.appendChild(details);
  });

  updateProgress(sectionName);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderAll() {
  runResetChecks();
  renderHeader();
  ["daily", "weekly", "monthly"].forEach(renderSection);
}

document.querySelectorAll(".add-form").forEach(form => {
  form.addEventListener("submit", event => {
    event.preventDefault();
    const sectionName = form.dataset.add;
    const input = form.querySelector("input");
    const text = input.value.trim();
    if (!text) return;

    state.sections[sectionName].items.push({
      id: newId(),
      group: "Other",
      text,
      completed: false
    });
    input.value = "";
    openGroups.add(`${sectionName}:Other`);
    openGroups.add(`${sectionName}:Other:seen`);
    saveState();
    renderSection(sectionName);
  });
});

renderAll();

// Re-check the calendar periodically in case the app is left open overnight.
setInterval(() => {
  const before = JSON.stringify(state);
  runResetChecks();
  if (JSON.stringify(state) !== before) renderAll();
  else renderHeader();
}, 60_000);
