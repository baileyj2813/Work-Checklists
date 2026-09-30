const STORAGE_KEY = "workdayChecklist_v8";
const LEGACY_STORAGE_KEYS = ["workdayChecklist_v7", "workdayChecklist_v6", "workdayChecklist_v5", "workdayChecklist_v4", "workdayChecklist_v3", "workdayChecklist_v2"];

const DEFAULTS = {
  daily: [
    ["Admin & Communication", "Respond to Emails", "Co 77"],
    ["Admin & Communication", "Respond to Emails", "Co 75"],
    ["Admin & Communication", "Respond to Emails", "Co 10"],
    ["Admin & Communication", "Organize Inboxes", "Co 77"],
    ["Admin & Communication", "Organize Inboxes", "Co 75"],
    ["Admin & Communication", "Organize Inboxes", "Co 10"],
    ["Admin & Communication", null, "Assigning Project/SM Agreement Numbers"],
    ["Cash & Banking", null, "Lockbox and ACH Deposit Entries"],
    ["Cash & Banking", null, "Positive Pay Monitoring and Decisioning"],
    ["Accounts Payable", "AP Invoice Entry", "Co 77"],
    ["Accounts Payable", "AP Invoice Entry", "Co 75"],
    ["Accounts Payable", "AP Invoice Entry", "Co 10"],
    ["Accounts Payable", null, "AP Invoice Research/Followup"],
    ["Accounts Payable", null, "Reminders to Approve AP Invoices"],
    ["Accounts Payable", null, "AP Invoice Posting"]
  ],
  weekly: [
    ["Check Run & Payments", null, "Select Checks for Printing"],
    ["Check Run & Payments", null, "Print Checks"],
    ["Check Run & Payments", null, "Mail Checks"],
    ["Check Run & Payments", null, "Corpay"],
    ["Mail & Deposits", null, "Collect Mail Twice A Week"],
    ["Mail & Deposits", null, "Deposit Checks"],
    ["Admin & Communication", null, "Update Monday.com"]
  ],
  monthly: [
    ["Accounts Payable", null, "Move Remaining AP Invoices from the Previous Month to This Month"],
    ["Accounts Payable", "Review Vendor Statements", "Co 77"],
    ["Accounts Payable", "Review Vendor Statements", "Co 75"],
    ["Accounts Payable", "Review Vendor Statements", "Co 10"],
    ["Journal Entries", null, "Fixed Assets"],
    ["Journal Entries", null, "PP Assets"],
    ["Journal Entries", null, "PP Software"],
    ["Journal Entries", null, "Rental Lease Payment"],
    ["Journal Entries", null, "CAT Tax"],
    ["Concur", null, "Concur Expense Reminder to Submit Expenses"],
    ["Concur", null, "Concur Expense Comparison to Key Bank Statement"],
    ["Concur", null, "Concur Expense Reminder to Approve Expenses"],
    ["Concur", "Concur Expense Review", "Co 77"],
    ["Concur", "Concur Expense Review", "Co 75"],
    ["Concur", "Concur Expense Review", "Co 10"],
    ["Concur", "Concur GL and JC Import/Journal Entries", "Co 77"],
    ["Concur", "Concur GL and JC Import/Journal Entries", "Co 75"],
    ["Concur", "Concur GL and JC Import/Journal Entries", "Co 10"],
    ["Concur", null, "Concur Intercompany Entries and Emails"],
    ["Other Monthly", "Bambora", "Co 77"],
    ["Other Monthly", "Bambora", "Co 75"],
    ["Other Monthly", "Bambora", "Co 10"],
    ["Other Monthly", null, "Enterprise FM Lease Payment"],
    ["Other Monthly", null, "Nvoice Credit Entry"]
  ]
};

function newId(){return (globalThis.crypto&&crypto.randomUUID)?crypto.randomUUID():`${Date.now()}-${Math.random()}`}
function makeItems(section){return DEFAULTS[section].map(([group,parent,text])=>({id:newId(),group,parent,text,completed:false}))}
function createDefaultState(){return{sections:{daily:{items:makeItems("daily"),cycleId:null},weekly:{items:makeItems("weekly"),cycleId:null},monthly:{items:makeItems("monthly"),cycleId:null}}}}
function norm(v){return String(v||"").trim().toLowerCase().replace(/\s+/g," ")}
function normalizeSection(section){return{items:Array.isArray(section?.items)?section.items.map(i=>({id:i.id||newId(),group:i.group||"Other",parent:i.parent||null,text:String(i.text||""),completed:Boolean(i.completed)})).filter(i=>i.text.trim()):[],cycleId:section?.cycleId||null}}
function loadLegacy(){for(const key of LEGACY_STORAGE_KEYS){try{const x=JSON.parse(localStorage.getItem(key));if(x?.sections)return{sections:{daily:normalizeSection(x.sections.daily),weekly:normalizeSection(x.sections.weekly),monthly:normalizeSection(x.sections.monthly)}}}catch{}}return null}
function loadState(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY));if(x?.sections)return{sections:{daily:normalizeSection(x.sections.daily),weekly:normalizeSection(x.sections.weekly),monthly:normalizeSection(x.sections.monthly)}}}catch{}return loadLegacy()||createDefaultState()}
let state=loadState();

// V8 migration: enforce the requested workflow while preserving completion where possible.
(function reconcileV8(){
  const old={};
  for(const sectionName of ["daily","weekly","monthly"]){for(const i of state.sections[sectionName].items){old[`${sectionName}|${norm(i.parent)}|${norm(i.text)}`]=i.completed;old[`${sectionName}||${norm(i.text)}`]??=i.completed}}
  function completed(section,parent,text){
    const exact=old[`${section}|${norm(parent)}|${norm(text)}`]; if(exact!==undefined)return exact;
    // New company subtasks inherit the old parent task's completion state when migrating.
    if(parent){const prior=old[`${section}||${norm(parent)}`]; if(prior!==undefined)return prior;}
    // Monday.com moved from Daily to Weekly.
    if(section==="weekly"&&norm(text)==="update monday.com") return old[`daily||update monday.com`]||old[`monthly||update monday.com`]||false;
    return false;
  }
  for(const sectionName of ["daily","weekly","monthly"]){
    const cycleId=state.sections[sectionName]?.cycleId||null;
    state.sections[sectionName]={cycleId,items:DEFAULTS[sectionName].map(([group,parent,text])=>({id:newId(),group,parent,text,completed:completed(sectionName,parent,text)}))};
  }
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
})();

const openGroups=new Set();
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function getMonday(date){const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());const day=d.getDay();d.setDate(d.getDate()+(day===0?-6:1-day));return d}
function getMonthlyCycleStart(date){const d=new Date(date.getFullYear(),date.getMonth(),7);if(date.getDate()<7)d.setMonth(d.getMonth()-1);return d}
function getCycleId(s,n=new Date()){if(s==="daily")return dateKey(n);if(s==="weekly")return dateKey(getMonday(n));return dateKey(getMonthlyCycleStart(n))}
function resetIfNeeded(s){const sec=state.sections[s],id=getCycleId(s);if(sec.cycleId!==id){sec.items=sec.items.map(i=>({...i,completed:false}));sec.cycleId=id}}
function runResetChecks(){["daily","weekly","monthly"].forEach(resetIfNeeded);saveState()}
function nextDailyReset(n=new Date()){return new Date(n.getFullYear(),n.getMonth(),n.getDate()+1)}
function nextMonday(n=new Date()){const d=new Date(n.getFullYear(),n.getMonth(),n.getDate()),day=d.getDay();let days=day===0?1:8-day;if(day===1)days=7;d.setDate(d.getDate()+days);return d}
function nextMonthlyReset(n=new Date()){const d=new Date(n.getFullYear(),n.getMonth(),7);if(n.getDate()>=7)d.setMonth(d.getMonth()+1);return d}
function fmtDate(d){return d.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})}
function renderHeader(){const n=new Date();document.getElementById("todayLabel").textContent=n.toLocaleDateString(undefined,{weekday:"long"});document.getElementById("todayDate").textContent=n.toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"});document.getElementById("dailyResetText").textContent=`Next reset: ${fmtDate(nextDailyReset(n))}`;document.getElementById("weeklyResetText").textContent=`Current week began ${fmtDate(getMonday(n))} · Next reset: ${fmtDate(nextMonday(n))}`;document.getElementById("monthlyResetText").textContent=`Current cycle began ${fmtDate(getMonthlyCycleStart(n))} · Next reset: ${fmtDate(nextMonthlyReset(n))}`}
function updateProgress(s){const items=state.sections[s].items,c=items.filter(i=>i.completed).length,t=items.length,p=t?Math.round(c/t*100):0;document.getElementById(`${s}Overview`).textContent=`${c} / ${t}`;document.getElementById(`${s}Progress`).style.width=`${p}%`;const ring=document.getElementById(`${s}Ring`);ring.style.background=`conic-gradient(var(--accent) ${p}%, #ededf5 ${p}%)`;ring.querySelector("span").textContent=`${p}%`}
function updateGroupProgress(el,items){const c=items.filter(i=>i.completed).length,t=items.length;el.querySelector(".group-count").textContent=`${c}/${t}`;el.classList.toggle("group-complete",t>0&&c===t)}
function createItemRow(section,item,groupEl,groupItems){const f=document.getElementById("itemTemplate").content.cloneNode(true),row=f.querySelector(".check-item"),btn=f.querySelector(".check-button"),txt=f.querySelector(".item-text"),del=f.querySelector(".delete-button");txt.textContent=item.text;row.classList.toggle("completed",item.completed);btn.setAttribute("aria-pressed",String(item.completed));btn.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();item.completed=!item.completed;row.classList.toggle("completed",item.completed);btn.setAttribute("aria-pressed",String(item.completed));saveState();updateProgress(section);updateGroupProgress(groupEl,groupItems)});del.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();state.sections[section].items=state.sections[section].items.filter(x=>x.id!==item.id);saveState();renderSection(section)});return f}
function escapeHtml(v){return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function renderSection(section){const sec=state.sections[section],list=document.getElementById(`${section}List`);list.innerHTML="";const groups=new Map();sec.items.forEach(i=>{if(!groups.has(i.group))groups.set(i.group,[]);groups.get(i.group).push(i)});groups.forEach((items,name)=>{const key=`${section}:${name}`,details=document.createElement("details");details.className="task-group";if(!openGroups.has(`${key}:seen`)||openGroups.has(key))details.open=true;openGroups.add(`${key}:seen`);if(details.open)openGroups.add(key);const summary=document.createElement("summary");summary.innerHTML=`<span class="group-title">${escapeHtml(name)}</span><span class="group-count"></span>`;details.appendChild(summary);const body=document.createElement("div");body.className="group-items";
    let idx=0; while(idx<items.length){const item=items[idx];if(item.parent){const parent=item.parent,block=document.createElement("div");block.className="parent-task-block";const title=document.createElement("div");title.className="parent-task-title";title.textContent=parent;block.appendChild(title);const subs=document.createElement("div");subs.className="subtask-list";while(idx<items.length&&items[idx].parent===parent){subs.appendChild(createItemRow(section,items[idx],details,items));idx++}block.appendChild(subs);body.appendChild(block)}else{body.appendChild(createItemRow(section,item,details,items));idx++}}
    details.appendChild(body);details.addEventListener("toggle",()=>details.open?openGroups.add(key):openGroups.delete(key));updateGroupProgress(details,items);list.appendChild(details)});updateProgress(section)}
function renderAll(){runResetChecks();renderHeader();["daily","weekly","monthly"].forEach(renderSection)}
document.querySelectorAll(".add-form").forEach(form=>form.addEventListener("submit",e=>{e.preventDefault();const section=form.dataset.add,input=form.querySelector("input"),text=input.value.trim();if(!text)return;state.sections[section].items.push({id:newId(),group:"Other",parent:null,text,completed:false});input.value="";openGroups.add(`${section}:Other`);openGroups.add(`${section}:Other:seen`);saveState();renderSection(section)}));
renderAll();setInterval(()=>{const before=JSON.stringify(state);runResetChecks();if(JSON.stringify(state)!==before)renderAll();else renderHeader()},60000);
