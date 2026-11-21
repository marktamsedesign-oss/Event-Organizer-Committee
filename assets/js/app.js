/* Pasko ng Angkan 2026 — v2.2 browser UI. No frontend password/PIN storage. */
"use strict";
const state = {
  bootstrap:null,user:null,token:null,committees:[],members:[],tasks:[],updates:[],
  activity:[],finance:[],foodItems:[],archivedCommittees:[],activeTab:"committees",managingCommitteeId:null
};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const initials=name=>(name||"?").trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase();
const money=amount=>new Intl.NumberFormat("en-PH",{style:"currency",currency:"PHP"}).format(Number(amount)||0);
const TODAY=()=>new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Manila"});
// Keep the UI functional when browser privacy settings block localStorage.
function sessionGet(){try{return localStorage.getItem("pna_session")}catch{return null}}
function sessionSet(data){try{localStorage.setItem("pna_session",JSON.stringify(data))}catch{/* session lasts until tab closes */}}
function sessionClear(){try{localStorage.removeItem("pna_session")}catch{/* already unavailable */}}

let toastTimer=null;
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),3500)}
function setConnection(message,ok=false){const el=$("#connectionState");el.textContent=message;el.style.color=ok?"#16834b":""}
function isManager(){return ["Director","Assistant Director"].includes(state.user?.accessRole)}
function isHeadOf(committeeId){return !!state.user&&state.members.some(m=>m.committeeId===committeeId&&m.userId===state.user.id&&m.role==="Head"&&active(m.active))}
function isMemberOf(committeeId){return !!state.user&&state.members.some(m=>m.committeeId===committeeId&&m.userId===state.user.id&&active(m.active))}
function canManageMembers(committeeId){return isManager()||isHeadOf(committeeId)}
function canCreateTasks(){return isManager()||state.committees.some(c=>isHeadOf(c.id))}
function canEditTask(t){return isManager()||isHeadOf(t.committeeId)}
function canUpdateTask(t){return isManager()||isMemberOf(t.committeeId)}
function canEditFinance(){return isManager()||isHeadOf("COM-FIN")}
function canDeleteFinance(entry){return isManager()||entry?.recordedBy===state.user?.id}
function canEditFood(){return isManager()||isHeadOf("COM-FOOD")}
function active(value){return value===true||value===1||String(value).toLowerCase()==="true"}
function userName(id){return (state.bootstrap?.users||[]).find(u=>u.id===id)?.name||id||"Unknown"}
function committeeName(id){return state.committees.find(c=>c.id===id)?.name||"Unassigned"}
// Task-count method: complete tasks / total tasks. Individual task % is independent.
function committeeStats(id){const ts=state.tasks.filter(t=>t.committeeId===id);const completed=ts.filter(t=>t.status==="Completed").length;return {total:ts.length,completed,percent:ts.length?Math.round(completed*100/ts.length):0}}
function committeeProgress(id){return committeeStats(id).percent}
function activeTasks(){const ids=new Set(state.committees.map(c=>c.id));return state.tasks.filter(t=>ids.has(t.committeeId))}
const localId=()=>"WEB-"+(globalThis.crypto?.randomUUID?.()||Date.now()+"-"+Math.random().toString(36).slice(2));
function statusClass(value){return value==="Completed"||value==="Done"?"green":value==="Blocked"?"red":value==="In Progress"?"amber":""}
function badge(value){return `<span class="badge ${statusClass(value)}">${esc(value||"Pending")}</span>`}
async function api(action,data={}){
  try{return await Api.request(action,state.token?{...data,token:state.token}:data)}
  catch(err){
    if(/session expired|sign in again/i.test(err.message)){
      clearSession();renderAll();setConnection("Session expired");openLogin();
    }
    throw err;
  }
}
function assertApiV22(response){if(Number(response?.apiVersion)!==22)throw new Error("The Apps Script deployment is outdated. Update Code.gs to v2.2, deploy a NEW version, and verify assets/js/api.js uses that /exec URL.")}
function clearSession(){state.user=null;state.token=null;sessionClear();state.tasks=[];state.updates=[];state.finance=[];state.foodItems=[];state.activity=[];state.archivedCommittees=[];updateSaveState()}

// v2.2 saves: optimistically update the screen, then serialize writes in the background.
// Never automatically retry a timed-out POST: the server might already have committed it.
let pendingWrites=0, failedWrites=0, writing=false, writes=[], changeVersion=0;
let lastRefreshAt=0;
function updateSaveState(){
  const el=$("#saveState");if(!el)return;
  const label=pendingWrites?`Saving ${pendingWrites} change${pendingWrites===1?"":"s"}…`:failedWrites?"Save failed · refresh":"All changes saved";
  el.textContent=label;
  el.classList.toggle("saving",pendingWrites>0);
  el.classList.toggle("save-error",!pendingWrites&&failedWrites>0);
  el.title=pendingWrites?"Background Google Sheets sync is in progress; keep this page open.":failedWrites?"A save failed. Review records and refresh before retrying.":"Confirmed by Google Apps Script";
}
function queueWrite(action,payload,optimistic){
  if(!state.token)return toast("Sign in to make changes.");
  const token=state.token;
  changeVersion++;
  if(optimistic)optimistic();
  pendingWrites++;
  writes.push({action,payload,token});
  updateSaveState();renderAll();
  Promise.resolve().then(drainWrites);
  return true;
}
async function drainWrites(){
  if(writing)return;
  writing=true;
  try{
    while(writes.length){
      const job=writes.shift();
      try{
        const result=await Api.request(job.action,{...job.payload,token:job.token});
        if(!result?.ok)throw new Error(result?.error||"The server rejected the change.");
        if(job.action==="addUser"&&result.user&&state.bootstrap){
          state.bootstrap.users=[...state.bootstrap.users,result.user];renderLoginUsers();
        }
      }catch(error){
        failedWrites++;
        toast("Save failed: "+error.message+". Review records before retrying.");
      }finally{
        pendingWrites--;updateSaveState();
      }
    }
  }finally{
    writing=false;
    // Coalesced refresh: one read after the entire batch, never one per edit.
    try{await refreshData()}catch(err){failedWrites++;toast("Background refresh failed: "+err.message)}
    updateSaveState();
    if(writes.length)Promise.resolve().then(drainWrites);
  }
}
function allowNavigation(){if(pendingWrites){toast("Please keep this page open: changes are still syncing.");return false}return true}
async function manualRefresh(){
  if(!allowNavigation())return;
  try{await loadBootstrap();const updated=await refreshData();if(updated!==false){failedWrites=0;updateSaveState();toast("Data refreshed")}}
  catch(err){toast(err.message)}
}
function backgroundRefresh(){
  if(!state.token||pendingWrites||writing||document.visibilityState!=="visible"||$("#editDialog").open)return;
  refreshData().catch(err=>setConnection("Sync delayed: "+err.message));
}
async function init(){
  bindEvents();
  updateSaveState();
  setInterval(()=>{if(Date.now()-lastRefreshAt>60000)backgroundRefresh()},60000);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&Date.now()-lastRefreshAt>60000)backgroundRefresh()});
  window.addEventListener("beforeunload",event=>{if(pendingWrites){event.preventDefault();event.returnValue=""}});
  try {
    await loadBootstrap();
    const stored=sessionGet();
    if(stored){
      try{const sess=JSON.parse(stored);state.user=sess.user;state.token=sess.token;await refreshData();return}
      catch(err){clearSession();toast("Your previous session expired. Sign in again.")}
    }
    renderAll();setConnection("Sign in to view event records");openLogin();
  }catch(err){setConnection("Cannot connect to v2 database");renderConnectionError(err.message);toast(err.message)}
}
async function loadBootstrap(){
  const result=await Api.request("bootstrap");
  if(!result?.ok)throw new Error(result?.error||"Database setup failed");
  assertApiV22(result);
  state.bootstrap=result;state.committees=result.committees||[];state.members=result.members||[];
  renderLoginUsers();

}
function renderLoginUsers(){
  const select=$("#loginUser"),previous=select.value;
  select.innerHTML=(state.bootstrap?.users||[]).filter(u=>active(u.active)).map(u=>`<option value="${esc(u.id)}">${esc(u.name)} · ${esc(u.position||u.accessRole)}</option>`).join("");
  if([...select.options].some(o=>o.value===previous))select.value=previous;
  renderLoginPreview();
}
function renderConnectionError(message){$("#committeeList").innerHTML=`<div class="empty-state"><strong>Database connection needs attention</strong>${esc(message)}<p class="muted">Check the Apps Script v2 deployment, the shared /exec URL, and your spreadsheet schema.</p></div>`}
async function refreshData(){
  if(!state.token){await loadBootstrap();renderAll();return true}
  if(pendingWrites)return false;
  const version=changeVersion,token=state.token;
  const result=await api("getData");
  if(!result?.ok)throw new Error(result?.error||"Could not load event records");
  assertApiV22(result);
  // Prevent an older read from overwriting a newer optimistic edit.
  if(version!==changeVersion||token!==state.token||pendingWrites)return false;
  state.committees=result.committees||[];state.members=result.members||[];
  state.tasks=result.tasks||[];state.activity=result.activity||[];
  state.finance=result.finance||[];state.foodItems=result.foodItems||[];
  state.archivedCommittees=result.archivedCommittees||[];
  if(state.bootstrap){
    state.bootstrap.members=state.members;state.bootstrap.committees=state.committees;
    if(result.users)state.bootstrap.users=result.users;
    renderLoginUsers();
  }
  lastRefreshAt=Date.now();
  setConnection(`Signed in as ${state.user.name}`,true);renderAll();return true;
}

function bindEvents(){
  $$(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
  $("#refreshBtn").onclick=manualRefresh;
  $("#profileBtn").onclick=()=>$("#profileMenu").classList.toggle("hidden");
  $("#editProfileBtn").onclick=()=>{if(!allowNavigation())return;$("#profileMenu").classList.add("hidden");openLogin(true)};
  $("#addUserMenuBtn").onclick=()=>{$("#profileMenu").classList.add("hidden");userEditor()};
  $("#archiveMenuBtn").onclick=()=>{$("#profileMenu").classList.add("hidden");openArchives()};
  $("#signOutBtn").onclick=()=>{if(!allowNavigation())return;clearSession();$("#profileMenu").classList.add("hidden");renderAll();setConnection("Signed out");openLogin()};
  $("#loginUser").onchange=renderLoginPreview;
  $("#loginForm").onsubmit=login;
  $("#addCommitteeBtn").onclick=()=>committeeEditor();
  $("#addTaskBtn").onclick=()=>taskEditor();
  $("#addFinanceBtn").onclick=()=>financeEditor();
  $("#addFoodBtn").onclick=()=>foodEditor();
  $("#addMemberBtn").onclick=()=>{const committee=state.committees.find(c=>c.id===state.managingCommitteeId);if(committee)memberEditor(committee)};
  $("#taskCommitteeFilter").onchange=renderTasks;
  $("#taskStatusFilter").onchange=renderTasks;
  $("#taskSearch").oninput=renderTasks;
  $("#exportBtn").onclick=exportCsv;
  $$("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).close());
  $("#editForm").onsubmit=saveEditor;
  document.addEventListener("click",ev=>{if(!ev.target.closest("#profileMenu")&&!ev.target.closest("#profileBtn"))$("#profileMenu").classList.add("hidden")});
}
function switchTab(tab){
  state.activeTab=tab;
  $$(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  $$(".tab-panel").forEach(panel=>panel.classList.toggle("active",panel.id==="tab-"+tab));
}
function renderLoginPreview(){
  const userId=$("#loginUser").value;
  const memberships=(state.bootstrap?.members||[]).filter(m=>m.userId===userId&&active(m.active));
  const host=$("#loginPreview");
  host.innerHTML=memberships.length
    ? `<strong>Your committees (${memberships.length})</strong><div class="preview-list">${memberships.map(m=>`<div><b>${esc(committeeName(m.committeeId))}</b><span>${esc(m.role)}${m.supportRole?" · "+esc(m.supportRole):""}</span></div>`).join("")}</div>`
    : '<span class="muted">No committee assignments yet. You can still sign in.</span>';
}
function openLogin(switching=false){
  if($("#loginDialog").open)return;
  $("#loginTitle").textContent=switching?"Switch profile":"Identify yourself";
  $("#loginPassword").value="";$("#loginError").textContent="";
  renderLoginPreview();$("#loginDialog").showModal();
}
async function login(ev){
  ev.preventDefault();const form=$("#loginForm"),button=form.querySelector('button[type="submit"]');
  const password=$("#loginPassword").value;
  $("#loginError").textContent="";button.disabled=true;
  try{
    const result=await Api.request("login",{userId:$("#loginUser").value,password});
    if(!result?.ok)throw new Error(result?.error||"Sign-in failed");
    state.user=result.user;state.token=result.token;
    sessionSet({user:state.user,token:state.token});
    $("#loginDialog").close();
    await refreshData();
    const memberCount=state.members.filter(m=>m.userId===state.user.id&&active(m.active)).length;
    toast(`Welcome, ${state.user.name}! ${memberCount} committee${memberCount===1?"":"s"} assigned.`);
  }catch(err){$("#loginError").textContent=err.message}
  finally{$("#loginPassword").value="";button.disabled=false}
}
function renderProfile(){
  $("#profileName").textContent=state.user?.name||"Sign in";
  $("#avatar").textContent=initials(state.user?.name);
  $("#menuUserName").textContent=state.user?.name||"Guest";
  $("#menuUserRole").textContent=state.user?`${state.user.position||""} · ${state.user.accessRole}`:"Not signed in";
  $$(".admin-only").forEach(el=>el.classList.toggle("hidden",!isManager()));
  $("#addTaskBtn").classList.toggle("hidden",!canCreateTasks());
  $("#addFinanceBtn").classList.toggle("hidden",!canEditFinance());
  $("#addFoodBtn").classList.toggle("hidden",!canEditFood());
  $("#addUserMenuBtn").classList.toggle("hidden",!isManager());
  $("#archiveMenuBtn").classList.toggle("hidden",!isManager());
}
function renderAll(){
  renderProfile();populateFilters();renderSummary();renderCommittees();renderTasks();renderFinance();renderFood();renderReports();
  switchTab(state.activeTab);if($("#archivesDialog").open)renderArchives();
}
function renderSummary(){
  const tasks=activeTasks(),done=tasks.filter(t=>t.status==="Completed").length;
  $("#sumCommittees").textContent=state.committees.length;
  $("#sumTasks").textContent=tasks.length;
  $("#sumCompleted").textContent=done;
  $("#sumPending").textContent=tasks.filter(t=>["Pending","Blocked"].includes(t.status)).length;
}
function renderCommittees(){
  const host=$("#committeeList");
  if(!state.committees.length){host.innerHTML='<div class="empty-state"><strong>No committees found</strong>Ask the Director to initialize the database.</div>';return}
  host.innerHTML=state.committees.map(c=>{
    const memberships=state.members.filter(m=>m.committeeId===c.id&&active(m.active));
    const heads=memberships.filter(m=>m.role==="Head").map(m=>m.name);
    const stats=committeeStats(c.id),progress=stats.percent;
    return `<article class="committee-card" data-committee="${esc(c.id)}"><div class="card-top"><div><h3>${esc(c.name)}</h3><div class="head-line">Head${heads.length===1?"":"s"}: ${esc(heads.join(", ")||"To be assigned")}</div></div>${badge(active(c.active)?"Active":"Inactive")}</div>
      ${c.description?`<p class="muted committee-desc">${esc(c.description)}</p>`:""}
      <div class="progress-row"><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div><span class="progress-value">${progress}%</span></div><div class="progress-caption">${stats.completed} of ${stats.total} tasks completed · Auto-calculated</div>
      <div class="member-line">${memberships.length?memberships.map(m=>`<span class="member-pill">${esc(m.name)} · ${esc(m.role)}${m.supportRole?" · "+esc(m.supportRole):""}</span>`).join(""):"No members assigned"}</div>
      <div class="task-actions">${canManageMembers(c.id)?`<button type="button" class="small-btn primary manage-members" data-id="${esc(c.id)}">Manage members</button>`:""}${isManager()?`<button type="button" class="small-btn edit-committee" data-id="${esc(c.id)}">Edit details</button><button type="button" class="small-btn danger-text delete-committee" data-id="${esc(c.id)}">Delete committee</button>`:""}</div></article>`;
  }).join("");
  host.querySelectorAll(".committee-card").forEach(card=>card.onclick=ev=>{
    if(ev.target.closest("button"))return;
    $("#taskCommitteeFilter").value=card.dataset.committee;switchTab("tasks");renderTasks();
  });
  host.querySelectorAll(".manage-members").forEach(b=>b.onclick=()=>openMembers(b.dataset.id));
  host.querySelectorAll(".edit-committee").forEach(b=>b.onclick=()=>committeeEditor(state.committees.find(c=>c.id===b.dataset.id)));
  host.querySelectorAll(".delete-committee").forEach(b=>b.onclick=()=>archiveCommittee(b.dataset.id));
}
function openMembers(committeeId){
  const c=state.committees.find(x=>x.id===committeeId);
  if(!c||!canManageMembers(committeeId))return toast("You cannot manage this committee.");
  state.managingCommitteeId=committeeId;
  $("#membersTitle").textContent="Manage: "+c.name;
  renderMembersDialog();
  if(!$("#membersDialog").open)$("#membersDialog").showModal();
}
function renderMembersDialog(){
  const committeeId=state.managingCommitteeId;
  const c=state.committees.find(x=>x.id===committeeId);
  if(!c)return;
  const memberships=state.members.filter(m=>m.committeeId===committeeId&&active(m.active));
  $("#membersList").innerHTML=memberships.length?memberships.map(m=>{
    const editable=isManager()||m.role!=="Head";
    return `<div class="manager-member-row"><div><strong>${esc(m.name)}</strong><p class="muted">${esc(m.role)}${m.supportRole?" · "+esc(m.supportRole):""}</p></div>
    ${editable?`<div class="manager-member-actions"><button class="small-btn member-edit" data-id="${esc(m.id)}" type="button">Edit</button><button class="small-btn danger-text member-remove" data-id="${esc(m.id)}" type="button">Remove</button></div>`:"<span class=\"muted\">Director only</span>"}</div>`;
  }).join(""):'<div class="empty-state">No members assigned yet.</div>';
  $("#membersList").querySelectorAll(".member-edit").forEach(b=>b.onclick=()=>memberEditor(c,state.members.find(m=>m.id===b.dataset.id)));
  $("#membersList").querySelectorAll(".member-remove").forEach(b=>b.onclick=async()=>{
    const member=state.members.find(m=>m.id===b.dataset.id);
    if(!member)return;
    if(!await confirmAction(`Remove ${member.name} from ${c.name}? Existing task history will remain.`))return;
    queueWrite("removeMember",{memberId:member.id},()=>{state.members=state.members.filter(m=>m.id!==member.id);if(state.bootstrap)state.bootstrap.members=state.members});
    renderMembersDialog();toast("Member removed. Saving in background…");
  });
}
async function archiveCommittee(id){
  if(!isManager())return toast("Only Directors can delete committees.");
  const committee=state.committees.find(c=>c.id===id);if(!committee)return;
  const stats=committeeStats(id);
  if(!await confirmAction(`Delete ${committee.name} from active committees? ${stats.total} task(s) and all member assignments will be hidden, but kept in Google Sheets so a Director can restore them.`))return;
  queueWrite("deleteCommittee",{id},()=>{
    state.committees=state.committees.filter(c=>c.id!==id);
    state.archivedCommittees=[...state.archivedCommittees,{...committee,active:false}];
    if(state.bootstrap)state.bootstrap.committees=state.committees;
  });
  toast("Committee removed from active view. Syncing in background…");
}
function openArchives(){
  if(!isManager())return toast("Director access required.");
  renderArchives();$("#archivesDialog").showModal();
}
function renderArchives(){
  $("#archivesList").innerHTML=state.archivedCommittees.length?state.archivedCommittees.map(c=>`<div class="manager-member-row"><div><strong>${esc(c.name)}</strong><p class="muted">Members and tasks retained for recovery</p></div><button type="button" class="small-btn restore-committee" data-id="${esc(c.id)}">Restore</button></div>`).join(""):'<div class="empty-state">No deleted committees.</div>';
  $$(".restore-committee").forEach(b=>b.onclick=()=>{
    const c=state.archivedCommittees.find(x=>x.id===b.dataset.id);if(!c)return;
    queueWrite("restoreCommittee",{id:c.id},()=>{
      state.archivedCommittees=state.archivedCommittees.filter(x=>x.id!==c.id);
      state.committees.push({...c,active:true});if(state.bootstrap)state.bootstrap.committees=state.committees;
    });
    renderArchives();toast("Restoration syncing in background…");
  });
}
function userEditor(){
  if(!isManager())return toast("Only Directors can add users.");
  openEditor("Add new user",[
    {name:"name",label:"Full name",required:true},
    {name:"position",label:"Position / responsibility"}
  ],"addUser",{});
}
function quickComplete(id){
  const task=state.tasks.find(t=>t.id===id);if(!task||!canUpdateTask(task))return;
  const update={status:"Completed",progress:100,note:"Marked completed using quick action"};
  queueWrite("updateTask",{taskId:id,update},()=>Object.assign(task,{status:"Completed",progress:100,latestUpdate:update.note}));
  toast("Task marked complete. Saving in background…");
}
function populateFilters(){
  const filter=$("#taskCommitteeFilter"),current=filter.value;
  filter.innerHTML='<option value="">All committees</option>'+state.committees.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
  if([...filter.options].some(o=>o.value===current))filter.value=current;
}
function renderTasks(){
  const committeeId=$("#taskCommitteeFilter").value,status=$("#taskStatusFilter").value,query=$("#taskSearch").value.toLowerCase();
  const matches=activeTasks().filter(t=>(!committeeId||t.committeeId===committeeId)&&(!status||t.status===status)&&(!query||(t.title+" "+(t.description||"")+" "+committeeName(t.committeeId)).toLowerCase().includes(query)));
  $("#taskList").innerHTML=matches.length?matches.map(t=>{
    const names=(Array.isArray(t.assigneeIds)?t.assigneeIds:[]).map(userName).join(", ")||"Not assigned";
    const progress=Math.max(0,Math.min(100,Number(t.progress)||0));
    return `<article class="task-card"><div class="task-card-top"><div><h3>${esc(t.title)}</h3><div class="task-meta"><span>${esc(committeeName(t.committeeId))}</span><span>·</span><span>Assigned: ${esc(names)}</span></div></div>${badge(t.status)}</div>
      ${t.description?`<p class="muted task-description">${esc(t.description)}</p>`:""}
      <div class="progress-row"><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div><span class="progress-value">${progress}%</span></div>
      <div class="task-meta task-details"><span>Due: ${esc(t.dueDate||"Not set")}</span><span>·</span><span>Priority: ${esc(t.priority||"Normal")}</span></div>
      ${t.latestUpdate?`<div class="task-note">Latest update: ${esc(t.latestUpdate)}</div>`:""}
      <div class="task-actions">${canUpdateTask(t)?`<button class="small-btn primary update-task" data-id="${esc(t.id)}">Update progress</button><button class="small-btn history-task" data-id="${esc(t.id)}">History</button>${t.status!=="Completed"?`<button class="small-btn quick-complete" data-id="${esc(t.id)}">✓ Mark complete</button>`:""}`:""}${canEditTask(t)?`<button class="small-btn edit-task" data-id="${esc(t.id)}">Edit task</button>`:""}</div></article>`;
  }).join(""):'<div class="empty-state"><strong>No matching tasks</strong>Try another filter or add a task.</div>';
  $$(".update-task").forEach(b=>b.onclick=()=>updateTaskEditor(state.tasks.find(t=>t.id===b.dataset.id)));
  $$(".history-task").forEach(b=>b.onclick=()=>showHistory(b.dataset.id));
  $$(".edit-task").forEach(b=>b.onclick=()=>taskEditor(state.tasks.find(t=>t.id===b.dataset.id)));
  $$(".quick-complete").forEach(b=>b.onclick=()=>quickComplete(b.dataset.id));
}
function renderFinance(){
  const sum=type=>state.finance.filter(entry=>entry.type===type).reduce((n,entry)=>n+(Number(entry.amount)||0),0);
  const cash=sum("Cash on Hand"),income=sum("Income"),expenses=sum("Expense");
  $("#financeCash").textContent=money(cash);$("#financeIncome").textContent=money(income);
  $("#financeExpenses").textContent=money(expenses);$("#financeBalance").textContent=money(cash+income-expenses);
  const sorted=[...state.finance].sort((a,b)=>String(b.date||b.createdAt).localeCompare(String(a.date||a.createdAt)));
  $("#financeList").innerHTML=sorted.length?sorted.map(item=>`<article class="list-card"><div class="list-card-content"><div class="list-card-head"><strong>${esc(item.description)}</strong>${badge(item.type)}</div><p class="muted">${esc(item.date||"")} · ${esc(item.recordedByName||"")}</p></div><strong class="amount ${item.type==="Expense"?"amount-negative":""}">${item.type==="Expense"?"−":""}${money(item.amount)}</strong><div class="list-actions">${canEditFinance()?`<button type="button" class="small-btn finance-edit" data-id="${esc(item.id)}">Edit</button>`:""}${canDeleteFinance(item)?`<button type="button" class="small-btn danger-text finance-delete" data-id="${esc(item.id)}">Delete</button>`:""}</div></article>`).join(""):'<div class="empty-state"><strong>No finance entries yet</strong>Finance Heads or Directors can add the first record.</div>';
  $$(".finance-edit").forEach(b=>b.onclick=()=>financeEditor(state.finance.find(x=>x.id===b.dataset.id)));
  $$(".finance-delete").forEach(b=>b.onclick=async()=>{
    const entry=state.finance.find(x=>x.id===b.dataset.id);if(!entry)return;
    if(!await confirmAction(`Delete ${money(entry.amount)} — ${entry.description}? This cannot be undone.`))return;
    queueWrite("deleteFinance",{id:entry.id},()=>{state.finance=state.finance.filter(x=>x.id!==entry.id)});
    toast("Finance entry deleted. Saving in background…");
  });
}
function renderFood(){
  const done=state.foodItems.filter(item=>item.status==="Done").length,total=state.foodItems.length;
  $("#foodSummary").innerHTML=`<div class="summary-card"><span>Food list progress</span><strong>${done}/${total} completed</strong></div>`;
  $("#foodList").innerHTML=["Food","Drink","Other"].map(category=>{
    const items=state.foodItems.filter(item=>item.category===category);
    return `<section class="panel food-group"><div class="food-group-heading"><h3>${esc(category)}</h3><span class="badge">${items.length} item${items.length===1?"":"s"}</span></div>${items.length?items.map(item=>`<article class="food-row"><div class="food-text"><div class="food-name">${esc(item.item)} ${badge(item.status)}</div><p class="muted">${item.quantity?`Qty: ${esc(item.quantity)} · `:""}Assigned: ${esc(item.assignedToName||"Unassigned")}</p>${item.remarks?`<div class="task-note">${esc(item.remarks)}</div>`:""}</div><div class="food-actions">${canEditFood()?`<button type="button" class="small-btn primary food-toggle" data-id="${esc(item.id)}">${item.status==="Done"?"Mark Todo":"Mark Done"}</button><button type="button" class="small-btn food-edit" data-id="${esc(item.id)}">Edit</button><button type="button" class="small-btn danger-text food-delete" data-id="${esc(item.id)}">Delete</button>`:""}</div></article>`).join(""):'<p class="muted">No items in this category.</p>'}</section>`;
  }).join("");
  $$(".food-edit").forEach(b=>b.onclick=()=>foodEditor(state.foodItems.find(x=>x.id===b.dataset.id)));
  $$(".food-toggle").forEach(b=>b.onclick=async()=>{
    const item=state.foodItems.find(x=>x.id===b.dataset.id);if(!item)return;
    const next={...item,status:item.status==="Done"?"Todo":"Done"};
    queueWrite("saveFoodItem",{item:next},()=>Object.assign(item,next));
    toast("Food status updated. Saving in background…");
  });
  $$(".food-delete").forEach(b=>b.onclick=async()=>{
    const item=state.foodItems.find(x=>x.id===b.dataset.id);if(!item)return;
    if(!await confirmAction(`Delete ${item.item} from the food list?`))return;
    queueWrite("deleteFoodItem",{id:item.id},()=>{state.foodItems=state.foodItems.filter(x=>x.id!==item.id)});
    toast("Food item deleted. Saving in background…");
  });
}
function renderReports(){
  const tasks=activeTasks();
  const total=tasks.length,done=tasks.filter(t=>t.status==="Completed").length;
  const blocked=tasks.filter(t=>t.status==="Blocked").length;
  const pending=tasks.filter(t=>t.status==="Pending").length;
  const progress=total?Math.round(done*100/total):0;
  $("#reportOverview").innerHTML=`<div class="completion-card"><span class="muted">Overall task completion (by task count)</span><strong>${progress}%</strong><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div><small class="muted">${done} of ${total} tasks completed</small></div><div class="report-stats"><div class="report-stat"><span>Total tasks</span><strong>${total}</strong></div><div class="report-stat"><span>Completed</span><strong style="color:var(--green)">${done}</strong></div><div class="report-stat"><span>Pending</span><strong>${pending}</strong></div><div class="report-stat"><span>In progress</span><strong>${tasks.filter(t=>t.status==="In Progress").length}</strong></div><div class="report-stat"><span>Blocked</span><strong>${blocked}</strong></div><div class="report-stat"><span>Committees</span><strong>${state.committees.length}</strong></div></div>`;
  $("#reportCommittees").innerHTML=state.committees.map(c=>{const x=committeeStats(c.id);return `<div class="report-line"><div class="report-line-head"><strong>${esc(c.name)}</strong><span>${x.completed}/${x.total} completed · ${x.percent}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${x.percent}%"></div></div></div>`}).join("")||'<p class="muted">No committees found.</p>';
  const attention=tasks.filter(t=>["Pending","Blocked"].includes(t.status)||(t.dueDate&&new Date(t.dueDate+"T23:59:59")<new Date()&&t.status!=="Completed"));
  $("#reportPending").innerHTML=attention.length?attention.map(t=>`<div class="attention-item"><strong>${esc(t.title)} ${badge(t.status)}</strong><small>${esc(committeeName(t.committeeId))} · Due ${esc(t.dueDate||"No deadline")}</small></div>`).join(""):'<div class="empty-state">No pending or blocked tasks.</div>';
  $("#activityList").innerHTML=state.activity.slice(0,12).map(a=>`<div class="activity-item"><strong>${esc(a.actorName||"Member")}</strong> ${esc(a.message||"updated an item")}<br><small>${esc(a.timestamp||"")}</small></div>`).join("")||'<p class="muted">No activity recorded yet.</p>';
}

// Editors and forms
function fieldHtml(field,value){
  const v=value??field.value??"",required=field.required?" required":"";
  if(field.type==="hidden")return `<input type="hidden" name="${esc(field.name)}" value="${esc(v)}">`;
  if(field.type==="textarea")return `<label class="field"><span>${esc(field.label)}</span><textarea class="form-input" name="${esc(field.name)}" rows="3"${required}>${esc(v)}</textarea></label>`;
  if(field.type==="select")return `<label class="field"><span>${esc(field.label)}</span><select class="form-input" name="${esc(field.name)}"${required}>${field.options.map(option=>`<option value="${esc(option.value)}"${String(v)===String(option.value)?" selected":""}>${esc(option.label)}</option>`).join("")}</select></label>`;
  if(field.type==="chips"){
    const picked=Array.isArray(v)?v:[];
    return `<fieldset class="chip-field"><legend>${esc(field.label)}</legend><div class="chip-list">${field.options.map(option=>`<label class="chip-option"><input type="checkbox" name="${esc(field.name)}" value="${esc(option.value)}"${picked.includes(option.value)?" checked":""}><span>${esc(option.label)}</span></label>`).join("")}</div></fieldset>`;
  }
  if(field.type==="checkbox")return `<label class="toggle-line"><input type="checkbox" name="${esc(field.name)}" value="true"${v===true||v==="true"?" checked":""}><span>${esc(field.label)}${field.hint?`<small class="form-hint">${esc(field.hint)}</small>`:""}</span></label>`;
  return `<label class="field"><span>${esc(field.label)}</span><input class="form-input" name="${esc(field.name)}" type="${esc(field.type||"text")}" value="${esc(v)}"${required}${field.min!==undefined?` min="${esc(field.min)}"`:""}${field.max!==undefined?` max="${esc(field.max)}"`:""}${field.step!==undefined?` step="${esc(field.step)}"`:""}></label>`;
}
function openEditor(title,fields,action,initial={}){
  if($("#editDialog").open)$("#editDialog").close();
  $("#editTitle").textContent=title;$("#editError").textContent="";
  $("#editFields").innerHTML=fields.map(f=>fieldHtml(f,initial[f.name])).join("");
  $("#editForm").dataset.action=action;$("#editForm").dataset.recordId=initial.id||"";
  $("#editForm").querySelector('button[type="submit"]').classList.toggle("hidden",action==="readonly");
  $("#editDialog").showModal();
}
function committeeEditor(c=null){
  if(!isManager())return toast("Only Directors can edit committee details.");
  openEditor(c?"Edit committee":"Add committee",[
    {name:"name",label:"Committee name",required:true},
    {name:"description",label:"Description",type:"textarea"}
  ],"saveCommittee",c||{});
}
function memberEditor(committee,member=null){
  if(!committee||!canManageMembers(committee.id))return toast("Access denied.");
  if(member?.role==="Head"&&!isManager())return toast("Only Directors can change Head assignments.");
  const eligible=(state.bootstrap?.users||[]).filter(u=>active(u.active));
  const fields=[
    {name:"committeeId",type:"hidden",value:committee.id},
    {name:"userId",label:member?"Replace with person":"Person",type:"select",required:true,options:eligible.map(u=>({value:u.id,label:u.name}))},
    {name:"role",label:"Committee role",type:"select",options:isManager()?[{value:"Head",label:"Head"},{value:"Support",label:"Support"}]:[{value:"Support",label:"Support"}]},
    {name:"supportRole",label:"Specific responsibility / support role"}
  ];
  if($("#membersDialog").open)$("#membersDialog").close();
  openEditor(member?"Replace / edit assignment":"Assign committee member",fields,"saveMember",member?{...member,committeeId:committee.id}:{committeeId:committee.id,role:"Support"});
}
function taskEditor(t=null){
  if(!state.user)return openLogin();
  if(t&&!canEditTask(t))return toast("Only Directors or this committee's Heads can edit task details.");
  const allowed=isManager()?state.committees:state.committees.filter(c=>isHeadOf(c.id));
  if(!allowed.length)return toast("You need a committee Head role to create tasks.");
  const fields=[
    {name:"title",label:"Task title",required:true},
    {name:"committeeId",label:"Committee",type:"select",required:true,options:allowed.map(c=>({value:c.id,label:c.name}))},
    {name:"description",label:"Description",type:"textarea"},
    {name:"assigneeIds",label:"Assigned members (tap to select multiple)",type:"chips",options:(state.bootstrap?.users||[]).filter(u=>active(u.active)).map(u=>({value:u.id,label:u.name}))},
    {name:"addAssigneesAsSupport",label:"Also add assignees to this committee as Support",type:"checkbox",value:true,hint:"Recommended: keeps assignments and the committee directory synchronized."},
    {name:"priority",label:"Priority",type:"select",options:["Low","Normal","High","Urgent"].map(x=>({value:x,label:x}))},
    {name:"dueDate",label:"Due date",type:"date"}
  ];
  openEditor(t?"Edit task":"Create task",fields,"saveTask",t?{...t,addAssigneesAsSupport:true}:{committeeId:allowed[0].id,assigneeIds:[],priority:"Normal",dueDate:"2026-12-10",addAssigneesAsSupport:true});
}
function updateTaskEditor(task){
  if(!task||!canUpdateTask(task))return toast("You cannot update this task.");
  openEditor("Update task progress",[
    {name:"status",label:"Status",type:"select",options:["Pending","In Progress","Blocked","Completed"].map(x=>({value:x,label:x}))},
    {name:"progress",label:"Progress (%)",type:"number",min:0,max:100,step:1},
    {name:"updateNote",label:"Progress update / comment",type:"textarea",required:true}
  ],"updateTask",{...task,updateNote:""});
}
function financeEditor(entry=null){
  if(!canEditFinance())return toast("Only the Finance Heads or Directors may edit finance records.");
  openEditor(entry?"Edit finance entry":"Add finance entry",[
    {name:"type",label:"Entry type",type:"select",options:["Cash on Hand","Income","Expense"].map(x=>({value:x,label:x}))},
    {name:"amount",label:"Amount (PHP)",type:"number",min:0.01,step:0.01,required:true},
    {name:"description",label:"Description",required:true},
    {name:"date",label:"Date",type:"date",required:true}
  ],"saveFinance",entry||{type:"Income",date:TODAY()});
}
function foodEditor(item=null){
  if(!canEditFood())return toast("Only the Food Heads or Directors may edit this list.");
  openEditor(item?"Edit food / supply item":"Add food / supply item",[
    {name:"item",label:"Item name",required:true},
    {name:"category",label:"Category",type:"select",options:["Food","Drink","Other"].map(x=>({value:x,label:x}))},
    {name:"quantity",label:"Quantity / unit"},
    {name:"remarks",label:"Remarks",type:"textarea"},
    {name:"assignedTo",label:"Assigned person",type:"select",options:[{value:"",label:"Not yet assigned"},...(state.bootstrap?.users||[]).filter(u=>active(u.active)).map(u=>({value:u.id,label:u.name}))]},
    {name:"status",label:"Status",type:"select",options:["Todo","Done"].map(x=>({value:x,label:x}))}
  ],"saveFoodItem",item||{category:"Food",assignedTo:"",status:"Todo"});
}
function collectFields(form){
  const data={};
  new FormData(form).forEach((value,key)=>{if(data[key]===undefined)data[key]=value;else if(Array.isArray(data[key]))data[key].push(value);else data[key]=[data[key],value]});
  form.querySelectorAll('.chip-field').forEach(group=>{
    const first=group.querySelector('input[type="checkbox"]');
    if(first)data[first.name]=[...group.querySelectorAll('input:checked')].map(x=>x.value);
  });
  form.querySelectorAll('.toggle-line input[type="checkbox"]').forEach(input=>data[input.name]=input.checked);
  return data;
}
function saveEditor(ev){
  ev.preventDefault();
  const form=ev.target,action=form.dataset.action,recordId=form.dataset.recordId;
  if(action==="readonly")return;
  const data=collectFields(form);if(recordId)data.id=recordId;
  if(action==="saveTask"){
    const previously=state.tasks.find(t=>t.id===recordId);
    if(previously&&!isManager()&&data.committeeId!==previously.committeeId){$("#editError").textContent="Only Directors may move tasks to another committee.";return}
  }
  if(action==="updateTask"&&data.status==="Completed"&&Number(data.progress)<100){
    $("#editError").textContent="Set task progress to 100% before marking it completed.";return;
  }
  if(action==="addUser"&&(state.bootstrap?.users||[]).some(u=>u.name.trim().toLowerCase()===String(data.name||"").trim().toLowerCase())){
    $("#editError").textContent="This user name is already registered.";return;
  }
  let payload,optimistic;
  switch(action){
    case "saveCommittee":{
      const old=state.committees.find(c=>c.id===recordId), id=recordId||localId();
      payload={committee:{...data,id}};
      optimistic=()=>{const v={...old,...data,id,active:true};if(old)Object.assign(old,v);else state.committees.push(v);if(state.bootstrap)state.bootstrap.committees=state.committees};break;
    }
    case "saveMember":{
      const target=(state.bootstrap?.users||[]).find(u=>u.id===data.userId);
      const original=recordId?state.members.find(m=>m.id===recordId):null;
      const duplicate=state.members.find(m=>m.id!==original?.id&&m.committeeId===data.committeeId&&m.userId===data.userId);
      if(duplicate){$("#editError").textContent="That person is already assigned to this committee. Choose someone else.";return}
      const id=original?.id||recordId||localId();
      payload={member:{...data,id}};
      optimistic=()=>{
        const item={...original,...data,id,name:target?.name||"",active:true};
        if(original)Object.assign(original,item);else state.members.push(item);
        if(state.bootstrap)state.bootstrap.members=state.members;
      };break;
    }
    case "saveTask":{
      const old=state.tasks.find(t=>t.id===recordId), id=recordId||localId();
      const task={...data,id,assigneeIds:Array.isArray(data.assigneeIds)?data.assigneeIds:[],status:old?.status||"Pending",progress:old?.progress||0,latestUpdate:old?.latestUpdate||""};
      payload={task};
      optimistic=()=>{if(old)Object.assign(old,task);else state.tasks.push(task)};break;
    }
    case "updateTask":{
      const old=state.tasks.find(t=>t.id===recordId);if(!old)return;
      const update={status:data.status,progress:Number(data.progress),note:data.updateNote};
      payload={taskId:recordId,update};
      optimistic=()=>Object.assign(old,{status:update.status,progress:update.progress,latestUpdate:update.note});break;
    }
    case "saveFinance":{
      const old=state.finance.find(f=>f.id===recordId),id=recordId||localId();
      payload={entry:{...data,id}};
      optimistic=()=>{const item={...old,...data,id,amount:Number(data.amount),recordedBy:old?.recordedBy||state.user.id,recordedByName:old?.recordedByName||state.user.name};if(old)Object.assign(old,item);else state.finance.push(item)};break;
    }
    case "saveFoodItem":{
      const old=state.foodItems.find(f=>f.id===recordId),id=recordId||localId();
      payload={item:{...data,id}};
      optimistic=()=>{const item={...old,...data,id,assignedToName:userName(data.assignedTo)||""};if(!data.assignedTo)item.assignedToName="";if(old)Object.assign(old,item);else state.foodItems.push(item)};break;
    }
    case "addUser":payload={user:data};optimistic=null;break;
    default:$("#editError").textContent="Unsupported form action.";return;
  }
  queueWrite(action,payload,optimistic);
  $("#editDialog").close();
  if(action==="saveMember"&&state.managingCommitteeId&&canManageMembers(state.managingCommitteeId))openMembers(state.managingCommitteeId);
  toast("Updated instantly. Saving to Google Sheets in background…");
}

async function showHistory(taskId){
  try{
    const response=await api("getTaskUpdates",{taskId});
    if(!response?.ok)throw new Error(response?.error||"Cannot load updates");
    const value=(response.updates||[]).map(x=>`${x.timestamp} — ${x.actorName}: ${x.status} (${x.progress}%)\n${x.note}`).join("\n\n")||"No updates yet.";
    openEditor("Task update history",[{name:"history",label:"Recorded updates",type:"textarea"}],"readonly",{history:value});
    $("#editForm").querySelector('[name="history"]').readOnly=true;
  }catch(err){toast(err.message)}
}
function confirmAction(message){
  return new Promise(resolve=>{
    const dlg=$("#confirmDialog");$("#confirmMessage").textContent=message;
    let finished=false;
    const finish=value=>{if(finished)return;finished=true;dlg.removeEventListener("close",onClose);if(dlg.open)dlg.close();resolve(value)};
    const onClose=()=>finish(false);
    $("#confirmYes").onclick=()=>finish(true);
    $("#confirmNo").onclick=()=>finish(false);
    $("#confirmDismiss").onclick=()=>finish(false);
    dlg.addEventListener("close",onClose);
    dlg.showModal();
  });
}
function exportCsv(){
  const rows=[["Committee","Task","Assignees","Status","Progress","Priority","Due date"],...activeTasks().map(t=>[
    committeeName(t.committeeId),t.title,(Array.isArray(t.assigneeIds)?t.assigneeIds:[]).map(userName).join("; "),t.status,t.progress,t.priority,t.dueDate
  ])];
  const csv="\ufeff"+rows.map(row=>row.map(value=>'"'+String(value??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);
  const link=document.createElement("a");link.href=url;link.download="pasko-ng-angkan-2026-report.csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),250);
}
init();
