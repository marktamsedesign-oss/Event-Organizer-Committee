/* Pasko ng Angkan 2026 — v2.4 browser UI; compatible with v2.3 Apps Script API. */
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

// Only last-confirmed records are cached, in this browser tab. Passwords and
// unconfirmed edits never enter the snapshot. The cache is not an offline write store.
const SNAPSHOT_KEY="pna_confirmed_snapshot_v24";
const TAB_KEY="pna_active_tab_v24";
let lastConfirmedAt=0;
function readTab(){try{return sessionStorage.getItem(TAB_KEY)||"committees"}catch{return "committees"}}
function cacheTab(tab){try{sessionStorage.setItem(TAB_KEY,tab)}catch{}}
function clearSnapshot(){try{sessionStorage.removeItem(SNAPSHOT_KEY)}catch{}}
function restoreSnapshot(userId){
  try{
    const snap=JSON.parse(sessionStorage.getItem(SNAPSHOT_KEY)||"null");
    // Cached data is short lived and tied to the currently signed-in identity.
    if(!snap||snap.userId!==userId||!snap.savedAt||Date.now()-snap.savedAt>12*3600*1000)return false;
    if(!snap.bootstrap||!Array.isArray(snap.committees)||!Array.isArray(snap.tasks))return false;
    state.bootstrap=snap.bootstrap;
    ["committees","members","tasks","finance","foodItems","activity","archivedCommittees"].forEach(key=>{
      state[key]=Array.isArray(snap[key])?snap[key]:[];
    });
    const tab=readTab();state.activeTab=["committees","tasks","finance","food","reports"].includes(tab)?tab:"committees";
    lastConfirmedAt=snap.savedAt;
    renderLoginUsers();
    return true;
  }catch{return false}
}
function saveConfirmedSnapshot(){
  if(!state.user||!state.bootstrap)return;
  lastConfirmedAt=Date.now();
  try{sessionStorage.setItem(SNAPSHOT_KEY,JSON.stringify({
    userId:state.user.id,savedAt:lastConfirmedAt,
    bootstrap:{ok:true,apiVersion:23,event:state.bootstrap.event,users:state.bootstrap.users,committees:state.committees,members:state.members},
    committees:state.committees,members:state.members,tasks:state.tasks,
    finance:state.finance,foodItems:state.foodItems,activity:state.activity,
    archivedCommittees:state.archivedCommittees
  }))}catch{/* Storage may be unavailable or limited; live view still works. */}
}
// Browser accessibility and OS-level zoom are outside page control. Block only
// common inadvertent in-page mouse, key and touch gestures.
function preventAccidentalZoom(){
  document.addEventListener("wheel",event=>{
    if(event.ctrlKey||event.metaKey)event.preventDefault();
  },{passive:false});
  document.addEventListener("keydown",event=>{
    if((event.ctrlKey||event.metaKey)&&["+","-","=","0","Add","Subtract"].includes(event.key))event.preventDefault();
  });
  ["gesturestart","gesturechange"].forEach(name=>document.addEventListener(name,event=>event.preventDefault(),{passive:false}));
  let previousTouchEnd=0;
  document.addEventListener("touchend",event=>{
    if(event.changedTouches.length!==1)return;
    const now=Date.now();if(now-previousTouchEnd<300)event.preventDefault();previousTouchEnd=now;
  },{passive:false});
}



// Local, self-contained outline icons (no external dependency or CDN).
const ICON_PATHS={
  plus:'<path d="M12 5v14M5 12h14"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  'list-todo':'<path d="M9 5h12M9 12h12M9 19h12M3 5l1.7 1.7L7 3.7M3 12l1.7 1.7L7 10.7M3 19l1.7 1.7L7 17.7"/>',
  'refresh-sync':'<path d="M20 11a8 8 0 0 0-14.9-3M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.9 3M20 20v-5h-5"/>',
  refresh:'<path d="M20 11a8 8 0 0 0-14.9-3M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.9 3M20 20v-5h-5"/>',
  sync:'<path d="M12 16V4m0 0-4 4m4-4 4 4"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  pencil:'<path d="m15 5 4 4M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m5 4v7m4-7v7"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m16 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-7.87a4 4 0 0 1 0 7.75"/>',
  'user-plus':'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm10-3v6m-3-3h6"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  'check-circle':'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  close:'<path d="M18 6 6 18M6 6l12 12"/>',
  save:'<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  history:'<path d="M3 12a9 9 0 1 0 3-6.7M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  download:'<path d="M12 3v12m0 0-5-5m5 5 5-5M4 17v4h16v-4"/>',
  archive:'<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8m-10 4h6"/>',
  restore:'<path d="M3 11a9 9 0 1 1 3 7M3 3v6h6"/><path d="M12 7v5l4 2"/>',
  switch:'<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
  logout:'<path d="M10 17l5-5-5-5m5 5H3M13 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>',
  activity:'<path d="M4 12h3l3-8 4 16 3-8h3"/>',
  flag:'<path d="M4 21V4m0 1c5-3 8 3 16 0v11c-8 3-11-3-16 0"/>'
};
function icon(name){return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON_PATHS[name]||ICON_PATHS.check}</svg>`;}
function iconAction(buttonClass,id,label,iconName,extraClass=""){
  return `<button type="button" class="small-btn icon-action ${esc(buttonClass)} ${esc(extraClass)}" data-id="${esc(id)}" title="${esc(label)}" aria-label="${esc(label)}">${icon(iconName)}</button>`;
}
function decorateStaticIcons(){
  $$('[data-icon]').forEach(el=>{if(el.querySelector('.ui-icon'))return;el.insertAdjacentHTML('afterbegin',icon(el.dataset.icon));});
  const m={"copyAllCommitteesBtn":"copy","addUserTopBtn":"user-plus","addMemberTopBtn":"users","archiveMenuBtn":"archive","editProfileBtn":"switch","signOutBtn":"logout"};
  Object.entries(m).forEach(([id,ico])=>{const el=document.getElementById(id);if(el&&!el.querySelector('.ui-icon'))el.insertAdjacentHTML('afterbegin',icon(ico));});
}

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
function canDeleteFinance(entry){return canEditFinance()&&(isManager()||entry?.recordedBy===state.user?.id)}
function canEditFood(){return isManager()||isHeadOf("COM-FOOD")}
function active(value){return value===true||value===1||String(value).toLowerCase()==="true"}
function userName(id){return (state.bootstrap?.users||[]).find(u=>u.id===id)?.name||id||"Unknown"}
function committeeName(id){return state.committees.find(c=>c.id===id)?.name||"Unassigned"}
// Task-count method: complete tasks / total tasks. Individual task % is independent.
function committeeStats(id){const ts=state.tasks.filter(t=>t.committeeId===id);const completed=ts.filter(t=>t.status==="Completed").length;return {total:ts.length,completed,percent:ts.length?Math.round(completed*100/ts.length):0}}
function committeeProgress(id){return committeeStats(id).percent}
function goToCommitteeTasks(committeeId){
  if(!state.committees.some(c=>c.id===committeeId))return toast("Committee not found in active view.");
  const filter=$("#taskCommitteeFilter");
  // Rebuild the options first in case the committee list changed in the background.
  populateFilters();
  filter.value=committeeId;
  $("#taskStatusFilter").value="";
  $("#taskSearch").value="";
  switchTab("tasks");renderTasks();
  const name=committeeName(committeeId);
  $("#tab-tasks .section-heading h2").textContent="To-do list";
  $("#taskList").scrollIntoView({behavior:"smooth",block:"start"});
  toast("Showing tasks for " + name);
}
function formatCompletionDate(value){
  if(!value)return "Date unavailable";
  const raw=String(value);
  // Apps Script's now_() stores an Asia/Manila local timestamp (no suffix).
  const parsed=new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)?raw.replace(" ","T")+"+08:00":raw);
  if(Number.isNaN(parsed.getTime()))return raw;
  return new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit",hour12:true}).format(parsed);
}
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
function assertApiV23(response){if(Number(response?.apiVersion)!==23)throw new Error("The Apps Script deployment is outdated. Update Code.gs to v2.3, deploy a NEW version, and verify assets/js/api.js uses that /exec URL.")}
function clearSession(){
  state.user=null;state.token=null;sessionClear();clearSnapshot();
  state.bootstrap=null;state.committees=[];state.members=[];state.tasks=[];state.updates=[];
  state.finance=[];state.foodItems=[];state.activity=[];state.archivedCommittees=[];
  updateSaveState();
}

// v2.3: optimistic UI, serialized background writes, a visible unsynced badge.
// Failed jobs keep their original requestId. Server-side WriteReceipts makes
// a manual retry idempotent even if a prior confirmation was lost.
let pendingWrites=0, writing=false, writes=[],failedJobs=[],changeVersion=0;
let lastRefreshAt=0, refreshing=false;
function unsyncedCount(){return pendingWrites+failedJobs.length;}
function updateSaveState(){
  const el=$("#saveState"),btn=$("#syncRefreshBtn"),badge=$("#syncCount");
  if(!el||!btn||!badge)return;
  const total=unsyncedCount();
  const label=failedJobs.length?`${failedJobs.length} need sync`:(pendingWrites?`Saving ${pendingWrites}…`:refreshing?"Refreshing…":"All changes saved");
  el.textContent=label;
  el.classList.toggle("saving",(pendingWrites>0||refreshing)&&!failedJobs.length);
  el.classList.toggle("save-error",failedJobs.length>0);
  el.title=failedJobs.length?"Some edits are not confirmed by Sheets. Press Sync & Refresh to retry safely.":pendingWrites?"Saving changes to Google Sheets in the background.":refreshing?"Latest data is loading; the existing view stays visible.":"Latest write confirmations received";
  badge.textContent=total>99?"99+":String(total);
  badge.classList.toggle("hidden",!total);
  btn.classList.toggle("has-unsynced",total>0);
  btn.classList.toggle("sync-failed",failedJobs.length>0);
  btn.classList.toggle("syncing",pendingWrites>0||refreshing);
  btn.setAttribute("aria-label",total?`Sync ${total} pending change(s) and refresh`:"Refresh and sync with Google Sheets");
  btn.title=failedJobs.length?`Retry ${failedJobs.length} unconfirmed change(s) and refresh`:pendingWrites?`${pendingWrites} saving · data will refresh after sync`:refreshing?"Fetching latest data…":"Refresh latest data and sync pending edits";
}
function queueWrite(action,payload,optimistic){
  if(!state.token)return toast("Sign in to make changes.");
  const token=state.token;
  const requestId="req_"+Date.now()+"_"+Math.random().toString(36).slice(2,10);
  changeVersion++;
  if(optimistic)optimistic();
  pendingWrites++;
  writes.push({action,payload,token,requestId});
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
        const result=await Api.request(job.action,{...job.payload,token:job.token},job.requestId);
        if(!result?.ok)throw new Error(result?.error||"Server rejected the change.");
        if(job.action==="addUser"&&result.user&&state.bootstrap){
          if(!state.bootstrap.users.some(u=>u.id===result.user.id))state.bootstrap.users.push(result.user);
          renderLoginUsers();
        }
      }catch(error){
        failedJobs.push({...job,error:error.message});
        toast("Not synced: "+error.message+". Press Sync & Refresh to retry.");
      }finally{
        pendingWrites--;updateSaveState();
      }
    }
  }finally{
    writing=false;
    // Keep all optimistic edits visible while any write confirmation is missing.
    if(!failedJobs.length&&state.token){
      await refreshLatest({silent:true}).catch(err=>setConnection("Saved, refresh delayed: "+err.message));
    }
    updateSaveState();
    if(writes.length)Promise.resolve().then(drainWrites);
  }
}
function allowNavigation(){if(unsyncedCount()){toast("Unsynced changes remain. Sync & Refresh before leaving.");return false}return true;}
async function refreshLatest({includeBootstrap=false,silent=false}={}){
  if(refreshing)return false;
  if(unsyncedCount())return false;
  refreshing=true;updateSaveState();
  try{
    if(includeBootstrap)await loadBootstrap({preserveView:true});
    const updated=await refreshData();
    if(updated&&!silent)toast("Latest Google Sheets updates loaded");
    return updated;
  }catch(err){
    setConnection("Showing existing view · refresh delayed");
    if(!silent)toast("Refresh failed; previous view preserved: "+err.message);
    throw err;
  }finally{refreshing=false;updateSaveState()}
}
async function manualSyncRefresh(){
  if(refreshing){toast("Already refreshing; your current view is staying open.");return;}
  if(pendingWrites||writing){toast("Changes are saving; the latest data will load once saved.");return;}
  if(failedJobs.length){
    const retry=failedJobs.splice(0);
    pendingWrites+=retry.length;
    writes.unshift(...retry);
    updateSaveState();
    toast(`Retrying ${retry.length} change${retry.length===1?"":"s"} and refreshing after confirmation…`);
    Promise.resolve().then(drainWrites);
    return;
  }
  try{
    if(state.token)await refreshLatest({includeBootstrap:true});
    else{await loadBootstrap({preserveView:true});renderAll();toast("Latest committee directory loaded. Sign in for full details.")}
  }catch{/* The existing view remains available; error is shown by refreshLatest. */}
}
function backgroundRefresh(){
  if(!state.token||unsyncedCount()||writing||refreshing||document.visibilityState!=="visible"||$("#editDialog").open)return;
  refreshLatest({silent:true}).catch(err=>setConnection("Showing existing view · refresh delayed: "+err.message));
}

async function init(){
  decorateStaticIcons();
  bindEvents();
  preventAccidentalZoom();
  updateSaveState();
  setInterval(()=>{if(Date.now()-lastRefreshAt>60000)backgroundRefresh()},60000);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&Date.now()-lastRefreshAt>60000)backgroundRefresh()});
  window.addEventListener("beforeunload",event=>{if(unsyncedCount()){event.preventDefault();event.returnValue=""}});
  let showedCache=false;
  const stored=sessionGet();
  if(stored){
    try{
      const sess=JSON.parse(stored);
      if(sess.user&&sess.token){
        state.user=sess.user;state.token=sess.token;
        showedCache=restoreSnapshot(state.user.id);
        if(showedCache){
          renderAll();
          setConnection("Showing last confirmed view · checking Google Sheets…");
        }
      }
    }catch{clearSession()}
  }
  try{
    // Every page load requests fresh committee records from Apps Script, even
    // when a cached view is immediately displayed in the meantime.
    await loadBootstrap({preserveView:showedCache});
    if(state.token){await refreshData();return}
    renderAll();setConnection("Sign in to view event records");openLogin();
  }catch(err){
    if(/session expired|sign in again/i.test(err.message)){
      clearSession();renderAll();openLogin();toast("Session expired. Please sign in again.");return;
    }
    if(showedCache&&state.token){
      setConnection("Showing last confirmed view · Google Sheets unavailable");
      toast("Cannot load latest records; your previous view remains available.");
      return;
    }
    setConnection("Cannot connect to event database");renderConnectionError(err.message);toast(err.message);
  }
}
async function loadBootstrap({preserveView=false}={}){
  const result=await Api.request("bootstrap");
  if(!result?.ok)throw new Error(result?.error||"Database setup failed");
  assertApiV23(result);
  state.bootstrap=result;
  // Never clear or repaint the currently visible committee data during fetch.
  if(!preserveView){state.committees=result.committees||[];state.members=result.members||[];}
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
  if(unsyncedCount())return false;
  const version=changeVersion,token=state.token;
  const result=await api("getData");
  if(!result?.ok)throw new Error(result?.error||"Could not load event records");
  assertApiV23(result);
  // Prevent an older read from overwriting a newer optimistic edit.
  if(version!==changeVersion||token!==state.token||unsyncedCount())return false;
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
  saveConfirmedSnapshot();
  setConnection(`Signed in as ${state.user.name}`,true);renderAll();return true;
}

function bindEvents(){
  $$(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
  $("#syncRefreshBtn").onclick=manualSyncRefresh;
  $("#mainMenuBtn").onclick=()=>{
    $("#profileMenu").classList.add("hidden");$("#addMenu").classList.add("hidden");
    const hidden=$("#mainMenu").classList.toggle("hidden");
    $("#mainMenuBtn").setAttribute("aria-expanded",String(!hidden));
  };
  $("#copyAllCommitteesBtn").onclick=()=>{
    $("#mainMenu").classList.add("hidden");$("#mainMenuBtn").setAttribute("aria-expanded","false");
    openShareDialog();
  };
  $("#copyShareBtn").onclick=copyShareReport;
  $("#addMenuBtn").onclick=()=>{
    $("#mainMenu").classList.add("hidden");
    $("#profileMenu").classList.add("hidden");
    const opened=$("#addMenu").classList.toggle("hidden");
    $("#addMenuBtn").setAttribute("aria-expanded",String(!opened));
  };
  $("#addUserTopBtn").onclick=()=>{$("#addMenu").classList.add("hidden");$("#addMenuBtn").setAttribute("aria-expanded","false");userEditor()};
  $("#addMemberTopBtn").onclick=()=>{$("#addMenu").classList.add("hidden");$("#addMenuBtn").setAttribute("aria-expanded","false");topMemberEditor()};
  $("#profileBtn").onclick=()=>{$("#addMenu").classList.add("hidden");$("#mainMenu").classList.add("hidden");$("#profileMenu").classList.toggle("hidden")};
  $("#editProfileBtn").onclick=()=>{if(!allowNavigation())return;$("#profileMenu").classList.add("hidden");openLogin(true)};
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
  document.addEventListener("click",ev=>{
    if(!ev.target.closest("#mainMenu")&&!ev.target.closest("#mainMenuBtn")){$("#mainMenu").classList.add("hidden");$("#mainMenuBtn").setAttribute("aria-expanded","false")}
    if(!ev.target.closest("#profileMenu")&&!ev.target.closest("#profileBtn"))$("#profileMenu").classList.add("hidden");
    if(!ev.target.closest("#addMenu")&&!ev.target.closest("#addMenuBtn")){$("#addMenu").classList.add("hidden");$("#addMenuBtn").setAttribute("aria-expanded","false")}
  });
}
function switchTab(tab){
  state.activeTab=tab;cacheTab(tab);
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
  const assignable=state.committees.some(c=>canManageMembers(c.id));
  $("#addMenuBtn").classList.toggle("hidden",!state.user||(!isManager()&&!assignable));
  $("#addUserTopBtn").classList.toggle("hidden",!isManager());
  $("#addMemberTopBtn").classList.toggle("hidden",!assignable);
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
      <div class="task-actions committee-actions"><div class="actions-main">${iconAction("go-to-tasks",c.id,"Go to tasks for "+c.name,"list-todo","primary")}${canManageMembers(c.id)?iconAction("manage-members",c.id,"Manage committee members","users","primary"):""}${isManager()?iconAction("edit-committee",c.id,"Edit committee details","pencil"):""}</div>${isManager()?`<div class="actions-danger">${iconAction("delete-committee",c.id,"Delete committee (archive)","trash","danger-text")}</div>`:""}</div></article>`;
  }).join("");
  host.querySelectorAll(".committee-card").forEach(card=>card.onclick=ev=>{
    if(ev.target.closest("button"))return;
    goToCommitteeTasks(card.dataset.committee);
  });
  host.querySelectorAll(".go-to-tasks").forEach(b=>b.onclick=()=>goToCommitteeTasks(b.dataset.id));
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
    ${editable?`<div class="manager-member-actions">${iconAction("member-edit",m.id,"Replace or edit member","pencil")}<div class="actions-danger">${iconAction("member-remove",m.id,"Remove committee assignment","trash","danger-text")}</div></div>`:"<span class=\"muted\">Director only</span>"}</div>`;
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
  $("#archivesList").innerHTML=state.archivedCommittees.length?state.archivedCommittees.map(c=>`<div class="manager-member-row"><div><strong>${esc(c.name)}</strong><p class="muted">Members and tasks retained for recovery</p></div>${iconAction("restore-committee",c.id,"Restore committee","restore")}</div>`).join(""):'<div class="empty-state">No deleted committees.</div>';
  $$(".restore-committee").forEach(b=>b.onclick=()=>{
    const c=state.archivedCommittees.find(x=>x.id===b.dataset.id);if(!c)return;
    queueWrite("restoreCommittee",{id:c.id},()=>{
      state.archivedCommittees=state.archivedCommittees.filter(x=>x.id!==c.id);
      state.committees.push({...c,active:true});if(state.bootstrap)state.bootstrap.committees=state.committees;
    });
    renderArchives();toast("Restoration syncing in background…");
  });
}
function topMemberEditor(){
  const committees=isManager()?state.committees:state.committees.filter(c=>isHeadOf(c.id));
  if(!committees.length)return toast("You need a committee Head role to assign members.");
  const users=(state.bootstrap?.users||[]).filter(u=>active(u.active));
  if(!users.length)return toast("No active users found. Add a user first.");
  state.managingCommitteeId=null;
  openEditor("Assign committee member",[
    {name:"committeeId",label:"Committee",type:"select",required:true,options:committees.map(c=>({value:c.id,label:c.name}))},
    {name:"userId",label:"Person",type:"select",required:true,options:users.map(u=>({value:u.id,label:u.name}))},
    {name:"role",label:"Committee role",type:"select",options:(isManager()?["Head","Support"]:["Support"]).map(x=>({value:x,label:x}))},
    {name:"supportRole",label:"Specific responsibility"}
  ],"saveMember",{committeeId:committees[0].id,role:"Support"});
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
  const update={status:"Completed",progress:100,note:"Marked completed"};
  // Immediate feedback is provisional until the server acknowledges the write.
  const stamped=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date());
  queueWrite("updateTask",{taskId:id,update},()=>{
    Object.assign(task,{status:"Completed",progress:100,latestUpdate:update.note,
      completedByName:state.user.name,completedAt:stamped,completionPending:true,
      completionHistory:[{actorName:state.user.name,timestamp:stamped},...(task.completionHistory||[])]});
  });
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
    const events=Array.isArray(t.completionHistory)?t.completionHistory:[];
    const latest=events.length?events[0]:null;
    const who=t.completedByName||latest?.actorName||"";
    const when=t.completedAt||latest?.timestamp||"";
    const attribution=t.status==="Completed" ? (who&&when
      ? `<div class="task-completion" aria-label="Task completion record"><span class="complete-label">✓ Completed by</span><strong>${esc(who)}</strong><span class="completion-separator">·</span><time>${esc(formatCompletionDate(when))}</time>${t.completionPending?'<small> · Syncing…</small>':""}</div>`
      : '<div class="task-completion"><span class="muted">Completed · Older completion details unavailable</span></div>') : "";
    const history=events.length>0?`<details class="task-completion-history"><summary>Completion history (${events.length})</summary><ol>${events.map(e=>`<li><strong>${esc(e.actorName||"Member")}</strong><span>${esc(formatCompletionDate(e.timestamp))}</span></li>`).join("")}</ol></details>`:"";
    return `<article class="task-card" data-task="${esc(t.id)}"><div class="task-card-top"><div><h3>${esc(t.title)}</h3><div class="task-meta"><span>${esc(committeeName(t.committeeId))}</span><span>·</span><span>Assigned: ${esc(names)}</span></div></div>${badge(t.status)}</div>
      ${t.description?`<p class="muted task-description">${esc(t.description)}</p>`:""}
      <div class="task-meta task-details"><span>Due: ${esc(t.dueDate||"Not set")}</span><span>·</span><span>Priority: ${esc(t.priority||"Normal")}</span></div>
      ${attribution}${history}
      <div class="task-actions">${canEditTask(t)?iconAction("edit-task",t.id,"Edit task details","pencil"):""}${t.status!=="Completed"&&canUpdateTask(t)?iconAction("quick-complete",t.id,"Mark task completed","check-circle","primary"):""}</div></article>`;
  }).join(""):'<div class="empty-state"><strong>No matching tasks</strong>Try another filter or add a task.</div>';
  $$(".edit-task").forEach(b=>b.onclick=()=>taskEditor(state.tasks.find(t=>t.id===b.dataset.id)));
  $$(".quick-complete").forEach(b=>b.onclick=()=>quickComplete(b.dataset.id));
}
function renderFinance(){
  const sum=type=>state.finance.filter(entry=>entry.type===type).reduce((n,entry)=>n+(Number(entry.amount)||0),0);
  const cash=sum("Cash on Hand"),receivables=sum("Receivables"),expenses=sum("Expense");
  $("#financeCash").textContent=money(cash);$("#financeReceivables").textContent=money(receivables);
  $("#financeExpenses").textContent=money(expenses);$("#financeBalance").textContent=money(cash-expenses);
  const sorted=[...state.finance].sort((a,b)=>String(b.date||b.createdAt).localeCompare(String(a.date||a.createdAt)));
  $("#financeList").innerHTML=sorted.length?sorted.map(item=>`<article class="list-card"><div class="list-card-content"><div class="list-card-head"><strong>${esc(item.description)}</strong>${badge(item.type==="Income"?"Income (legacy)":item.type)}</div><p class="muted">${esc(item.date||"")} · ${esc(item.recordedByName||"")}</p></div><strong class="amount ${item.type==="Expense"?"amount-negative":""}">${item.type==="Expense"?"−":""}${money(item.amount)}</strong><div class="list-actions"><div class="actions-main">${canEditFinance()?iconAction("finance-edit",item.id,"Edit finance entry","pencil"):""}</div>${canDeleteFinance(item)?`<div class="actions-danger">${iconAction("finance-delete",item.id,"Delete finance entry","trash","danger-text")}</div>`:""}</div></article>`).join(""):'<div class="empty-state"><strong>No finance entries yet</strong>Finance Heads or Directors can add the first record.</div>';
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
    return `<section class="panel food-group"><div class="food-group-heading"><h3>${esc(category)}</h3><span class="badge">${items.length} item${items.length===1?"":"s"}</span></div>${items.length?items.map(item=>`<article class="food-row"><div class="food-text"><div class="food-name">${esc(item.item)} ${badge(item.status)}</div><p class="muted">${item.quantity?`Qty: ${esc(item.quantity)} · `:""}Assigned: ${esc(item.assignedToName||"Unassigned")}</p>${item.remarks?`<div class="task-note">${esc(item.remarks)}</div>`:""}</div><div class="food-actions"><div class="actions-main">${canEditFood()?`${iconAction("food-toggle",item.id,item.status==="Done"?"Mark not done":"Mark done",item.status==="Done"?"refresh":"check-circle","primary")}${iconAction("food-edit",item.id,"Edit food item","pencil")}`:""}</div>${canEditFood()?`<div class="actions-danger">${iconAction("food-delete",item.id,"Delete food item","trash","danger-text")}</div>`:""}</div></article>`).join(""):'<p class="muted">No items in this category.</p>'}</section>`;
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
function financeEditor(entry=null){
  if(!canEditFinance())return toast("Only the Finance Heads or Directors may edit finance records.");
  openEditor(entry?"Edit finance entry":"Add finance entry",[
    {name:"type",label:"Entry type",type:"select",options:["Cash on Hand","Receivables","Expense",...(entry?.type==="Income"?["Income"]:[])].map(x=>({value:x,label:x==="Income"?"Income (legacy; edit existing only)":x}))},
    {name:"amount",label:"Amount (PHP)",type:"number",min:0.01,step:0.01,required:true},
    {name:"description",label:"Description",required:true},
    {name:"date",label:"Date",type:"date",required:true}
  ],"saveFinance",entry||{type:"Receivables",date:TODAY()});
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
// Creates chat-friendly plain text from the committee records already loaded.
// A committee's Support assignments act as its sub-team / role breakdown;
// the database has no separate SubCommittees sheet or nesting field.
function buildCommitteeShareText(){
  const committees=state.committees.slice();
  const ts=activeTasks();
  const done=ts.filter(t=>t.status==="Completed").length;
  const timestamp=new Intl.DateTimeFormat("en-PH",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Manila"}).format(new Date(lastConfirmedAt||Date.now()));
  const lines=[
    "🎄 *PASKO NG ANGKAN 2026*",
    "📅 December 13, 2026",
    "*COMMITTEE DIRECTORY & TASK UPDATES*",
    `📊 Overall: ${committees.length} committees · ${done}/${ts.length} tasks completed`,
    `🕒 Last confirmed: ${timestamp} (PH time)`,
  ];
  if(unsyncedCount())lines.push(`⚠️ ${unsyncedCount()} change(s) not yet confirmed by Google Sheets.`);
  lines.push("", "────────────────────");
  if(!committees.length)lines.push("No committees are currently available.");
  committees.forEach((c,i)=>{
    const members=state.members.filter(m=>m.committeeId===c.id&&active(m.active));
    const heads=members.filter(m=>m.role==="Head");
    const support=members.filter(m=>m.role!=="Head");
    const tasks=state.tasks.filter(t=>t.committeeId===c.id);
    const stats=committeeStats(c.id);
    lines.push("",`${i+1}. *${c.name}*`,`📈 Progress: ${stats.percent}% (${stats.completed}/${stats.total} tasks complete)`);
    if(String(c.description||"").trim())lines.push(`🎯 Responsibility: ${String(c.description).trim()}`);
    lines.push(`👤 Head${heads.length===1?"":"s"}: ${heads.length?heads.map(m=>m.name+(m.supportRole?` — ${m.supportRole}`:"")).join("; "):"Not yet assigned"}`);
    lines.push("🧩 *Support / sub-team responsibilities:* ");
    if(support.length){
      support.forEach(m=>lines.push(`  • ${m.name} — ${m.supportRole||"Support member"}`));
    }else lines.push("  • None assigned yet");
    lines.push(`📝 *Tasks (${stats.completed}/${stats.total} completed):*`);
    if(!tasks.length)lines.push("  • No tasks listed");
    else{
      // Pending/blocked first, then tasks in progress, then completed.
      const order={Blocked:0,Pending:1,"In Progress":2,Completed:3};
      tasks.sort((a,b)=>(order[a.status]??2)-(order[b.status]??2)||String(a.dueDate||"9999").localeCompare(String(b.dueDate||"9999")));
      tasks.forEach((t,j)=>{
        const assignees=Array.isArray(t.assigneeIds)?t.assigneeIds.map(userName).filter(Boolean):[];
        lines.push(`  ${t.status==="Completed"?"✅":"⬜"} ${j+1}. ${t.title} — ${t.status||"Pending"}`);
        const details=[];
        if(assignees.length)details.push(`Assigned: ${assignees.join(", ")}`);
        if(t.dueDate)details.push(`Due: ${t.dueDate}`);
        if(t.priority)details.push(`Priority: ${t.priority}`);
        if(details.length)lines.push(`     ${details.join(" | ")}`);
        if(t.status==="Completed"&&t.completedByName&&t.completedAt){
          lines.push(`     ✓ Completed by ${t.completedByName} on ${formatCompletionDate(t.completedAt)}`);
        }
        if(t.description)lines.push(`     ↳ ${String(t.description).trim()}`);
      });
    }
    lines.push("", "────────────────────");
  });
  lines.push("", "Shared for event planning and coordination.");
  return lines.join("\n");
}
function openShareDialog(){
  if(!state.user){toast("Sign in first to view and share the full committee report.");openLogin();return;}
  const body=buildCommitteeShareText();
  $("#shareText").value=body;
  const warning=unsyncedCount()>0?` ${unsyncedCount()} change(s) are not yet confirmed; this preview includes your local edits.`:"";
  $("#shareStatus").textContent=`All ${state.committees.length} active committees, their Heads, support roles and ${activeTasks().length} tasks are included.${warning} Copy and paste into your group chat.`;
  if(!$("#shareDialog").open)$("#shareDialog").showModal();
}
async function copyShareReport(){
  const field=$("#shareText"),body=field.value;
  if(!body)return toast("Nothing to copy yet.");
  try{
    if(!navigator.clipboard?.writeText)throw new Error("Clipboard permission unavailable");
    await navigator.clipboard.writeText(body);
    toast("Committee report copied! Paste it in your group chat.");
  }catch{
    field.focus();field.select();field.setSelectionRange(0,field.value.length);
    let copied=false;
    try{copied=document.execCommand("copy")}catch{}
    toast(copied?"Committee report copied! Paste it in your group chat.":"Select and copy the highlighted text manually.");
  }
}

function exportCsv(){
  const rows=[["Committee","Task","Assignees","Status","Priority","Due date","Completed by","Completed at"],...activeTasks().map(t=>[
    committeeName(t.committeeId),t.title,(Array.isArray(t.assigneeIds)?t.assigneeIds:[]).map(userName).join("; "),t.status,t.priority,t.dueDate,t.completedByName||"",t.completedAt||""
  ])];
  const csv="\ufeff"+rows.map(row=>row.map(value=>'"'+String(value??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);
  const link=document.createElement("a");link.href=url;link.download="pasko-ng-angkan-2026-report.csv";link.click();setTimeout(()=>URL.revokeObjectURL(url),250);
}
init();
