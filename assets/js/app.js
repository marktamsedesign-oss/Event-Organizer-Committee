/* Pasko ng Angkan 2026 — v2.9.8 background sync + 30-minute refresh + receivables. */
"use strict";
const state = {
  bootstrap:null,user:null,token:null,committees:[],members:[],tasks:[],updates:[],
  activity:[],finance:[],financeCollections:[],financePayouts:[],registrationPayments:[],foodItems:[],registrations:[],archivedCommittees:[],activeTab:"committees",managingCommitteeId:null
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

// The last *verified* read is kept across reloads in this browser. New or
// incomplete responses are never allowed to replace it. This cache includes
// participant names: use Sign out on a shared device to clear the local copy.
const SNAPSHOT_KEY="pna_confirmed_snapshot_v296_payables";
const V295_SNAPSHOT_KEY="pna_confirmed_snapshot_v295_registration";
const PREVIOUS_SNAPSHOT_KEY="pna_confirmed_snapshot_v295";
const OLDER_SNAPSHOT_KEY="pna_confirmed_snapshot_v293";
let financeLedgerVerified=false;
const DIRECTORY_KEY="pna_verified_directory_v294";
const LEGACY_SNAPSHOT_KEY="pna_confirmed_snapshot_v24";
const TAB_KEY="pna_active_tab_v24";
const SNAPSHOT_MAX_AGE_MS=7*24*3600*1000;
let lastConfirmedAt=0,fullSnapshotLoaded=false,directoryLoading=true,directoryError="",directoryFetchPromise=null;
// People & Roles is a separate, lightweight verified data set. A stalled
// getData() (which reads every sheet) must never prevent showing this directory.
let verifiedDirectory=null;
function hasValidDirectory(data,userId=state.user?.id){
  return !!(data&&Array.isArray(data.users)&&data.users.length>0&&
    Array.isArray(data.committees)&&Array.isArray(data.members)&&
    (!userId||data.users.some(u=>String(u.id)===String(userId)))&&
    data.users.every(u=>u&&typeof u.id==="string"&&String(u.name||"").trim()));
}
function setVerifiedDirectory(data,{persist=true}={}){
  if(!hasValidDirectory(data))throw new Error("People directory missing the signed-in user or expected lists.");
  // getData() in v2.9.3 returns only active people, but its projection does
  // NOT include the `active` field. Normalize that missing field to true.
  // Do not normalize an explicit false value (an inactive user).
  const users=data.users.map(u=>({...u,active:u.active===undefined?true:u.active}));
  verifiedDirectory={users,committees:data.committees,members:data.members,savedAt:Date.now()};
  directoryLoading=false;directoryError="";
  if(persist){try{localStorage.setItem(DIRECTORY_KEY,JSON.stringify({userId:state.user?.id||"",...verifiedDirectory}))}catch{}}
  // bootstrap is the login directory and is independent of full task/finance data.
  state.bootstrap={...state.bootstrap,...data,ok:true,apiVersion:29,event:data.event||state.bootstrap?.event,
    users,committees:data.committees,members:data.members};
  if(!fullSnapshotLoaded){state.committees=data.committees;state.members=data.members;}
  renderLoginUsers();
  if($("#peopleRolesDialog")?.open)renderPeopleRoles();
}
function restoreDirectory(userId){
  if(verifiedDirectory&&hasValidDirectory(verifiedDirectory,userId))return true;
  try{
    const raw=localStorage.getItem(DIRECTORY_KEY);
    if(!raw)return false;
    const saved=JSON.parse(raw);
    if(saved.userId!==userId||!Number.isFinite(saved.savedAt)||
       Date.now()-saved.savedAt<0||Date.now()-saved.savedAt>SNAPSHOT_MAX_AGE_MS||
       !hasValidDirectory(saved,userId))return false;
    setVerifiedDirectory(saved,{persist:false});
    return true;
  }catch{return false;}
}

function readTab(){try{return sessionStorage.getItem(TAB_KEY)||"committees"}catch{return "committees"}}
function cacheTab(tab){try{sessionStorage.setItem(TAB_KEY,tab)}catch{}}
function clearSnapshot(){
  for(const store of [localStorage,sessionStorage]){
    for(const key of [SNAPSHOT_KEY,V295_SNAPSHOT_KEY,PREVIOUS_SNAPSHOT_KEY,OLDER_SNAPSHOT_KEY,LEGACY_SNAPSHOT_KEY,DIRECTORY_KEY])try{store.removeItem(key)}catch{}
  }
  fullSnapshotLoaded=false;verifiedDirectory=null;financeLedgerVerified=false;
}
function restoreSnapshot(userId){
  try{
    const snapshots=[];
    for(const store of [localStorage,sessionStorage])for(const key of [SNAPSHOT_KEY,V295_SNAPSHOT_KEY,PREVIOUS_SNAPSHOT_KEY,OLDER_SNAPSHOT_KEY,LEGACY_SNAPSHOT_KEY]){
      try{const raw=store.getItem(key);if(raw)snapshots.push(JSON.parse(raw))}catch{}
    }
    snapshots.sort((a,b)=>Number(b?.savedAt||0)-Number(a?.savedAt||0));
    const snap=snapshots.find(item=>item&&item.userId===userId&&item.savedAt&&
      Date.now()-item.savedAt>=0&&Date.now()-item.savedAt<SNAPSHOT_MAX_AGE_MS&&
      item.bootstrap&&Array.isArray(item.bootstrap.users)&&item.bootstrap.users.length>0&&
      item.bootstrap.users.some(u=>u.id===userId)&&
      ["committees","members","tasks","updates","finance","foodItems","registrations","activity","archivedCommittees"]
        .every(field=>Array.isArray(item[field])));
    if(!snap)return false;
    state.bootstrap=snap.bootstrap;
    ["committees","members","tasks","updates","finance","foodItems","registrations","activity","archivedCommittees"].forEach(field=>state[field]=snap[field]);
    state.financeCollections=Array.isArray(snap.financeCollections)?snap.financeCollections:[];
    state.financePayouts=Array.isArray(snap.financePayouts)?snap.financePayouts:[];
    state.registrationPayments=Array.isArray(snap.registrationPayments)?snap.registrationPayments:[];
    financeLedgerVerified=Array.isArray(snap.financeCollections)&&Array.isArray(snap.registrationPayments)&&Array.isArray(snap.financePayouts);
    const tab=readTab();state.activeTab=["committees","tasks","finance","food","registration","reports"].includes(tab)?tab:"committees";
    lastConfirmedAt=snap.savedAt;fullSnapshotLoaded=true;directoryLoading=false;directoryError="";
    setVerifiedDirectory({users:snap.bootstrap.users,committees:snap.committees,members:snap.members},{persist:false});
    return true;
  }catch{return false}
}
function saveConfirmedSnapshot(){
  if(!state.user||!state.bootstrap||!fullSnapshotLoaded||
     !Array.isArray(state.bootstrap.users)||!state.bootstrap.users.some(u=>u.id===state.user.id))return;
  lastConfirmedAt=Date.now();
  const snapshot={
    userId:state.user.id,savedAt:lastConfirmedAt,
    bootstrap:{ok:true,apiVersion:29,event:state.bootstrap.event,users:state.bootstrap.users,committees:state.committees,members:state.members},
    committees:state.committees,members:state.members,tasks:state.tasks,updates:state.updates,
    finance:state.finance,financeCollections:state.financeCollections,financePayouts:state.financePayouts,registrationPayments:state.registrationPayments,foodItems:state.foodItems,registrations:state.registrations,activity:state.activity,
    archivedCommittees:state.archivedCommittees
  };
  try{localStorage.setItem(SNAPSHOT_KEY,JSON.stringify(snapshot))}
  catch{
    // Storage quotas or privacy settings may block persistence. Fall back to
    // current-tab protection without claiming offline persistence.
    try{sessionStorage.setItem(SNAPSHOT_KEY,JSON.stringify(snapshot))}catch{}
  }
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
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  receipt:'<path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3zM8 8h8M8 12h8"/>',
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
  flag:'<path d="M4 21V4m0 1c5-3 8 3 16 0v11c-8 3-11-3-16 0"/>',
  clipboard:'<rect x="8" y="4" width="13" height="18" rx="2"/><path d="M8 8H5a2 2 0 0 0-2 2v10M11 4V2h7v2"/>',
  filter:'<path d="M4 7h16M7 12h10M10 17h4"/><circle cx="9" cy="7" r="2" fill="white"/><circle cx="15" cy="12" r="2" fill="white"/>',
  'sort-asc':'<path d="M4 6h10M4 11h7M4 16h4M18 5v14m-4-4 4 4 4-4"/>',
  'sort-desc':'<path d="M4 6h4M4 11h7M4 16h10M18 19V5m-4 4 4-4 4 4"/>'
};
function icon(name){return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON_PATHS[name]||ICON_PATHS.check}</svg>`;}
function iconAction(buttonClass,id,label,iconName,extraClass=""){
  return `<button type="button" class="small-btn icon-action ${esc(buttonClass)} ${esc(extraClass)}" data-id="${esc(id)}" title="${esc(label)}" aria-label="${esc(label)}">${icon(iconName)}</button>`;
}
function decorateStaticIcons(){
  $$('[data-icon]').forEach(el=>{if(el.querySelector('.ui-icon'))return;el.insertAdjacentHTML('afterbegin',icon(el.dataset.icon));});
  const m={"myAssignmentsBtn":"list-todo","peopleRolesBtn":"users","copyAllCommitteesBtn":"copy","registerTopBtn":"user-plus","addUserTopBtn":"user-plus","addMemberTopBtn":"users","archiveMenuBtn":"archive","editProfileBtn":"switch","signOutBtn":"logout"};
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
function userName(id){
  const match=(state.bootstrap?.users||[]).find(u=>u.id===id);
  return match?.name || (id?"Unmatched assignee (please reassign)":"Unassigned");
}
function committeeName(id){return (state.committees.find(c=>c.id===id)||state.bootstrap?.committees?.find(c=>c.id===id))?.name||"Unassigned"}
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
    // Network interruptions must NEVER log somebody out.
    // Only an explicit server-side revocation/inactive session may do that.
    if(/SESSION_INVALID/.test(String(err.message||""))){
      clearSession();renderAll();setConnection("This device needs to reconnect");openLogin();
    }
    throw err;
  }
}
function assertApiV29(response){
  if(Number(response?.apiVersion)!==29)
    throw new Error("Backend version mismatch: upload the v2.9 Code.gs, run setupDatabase(), and deploy a NEW Apps Script version. Update the /exec URL if it changed.");
}
function clearSession(){
  state.user=null;state.token=null;sessionClear();clearSnapshot();
  state.bootstrap=null;state.committees=[];state.members=[];state.tasks=[];state.updates=[];
  state.finance=[];state.financeCollections=[];state.financePayouts=[];state.registrationPayments=[];financeLedgerVerified=false;state.foodItems=[];state.registrations=[];state.activity=[];state.archivedCommittees=[];
  directoryLoading=false;directoryError="";
  // Never discard pending registration data when authentication changes. The
  // queue stays tied to its original user in localStorage until confirmed.
  updateSaveState();
}
function setFormBusy(form,busy,message="Saving…"){
  if(!form)return;
  let layer=form.querySelector(":scope > .form-busy-overlay");
  if(busy&&!layer){
    layer=document.createElement("div");layer.className="form-busy-overlay";
    layer.setAttribute("role","status");layer.setAttribute("aria-live","polite");
    layer.innerHTML=`<span class="form-busy-spinner" aria-hidden="true"></span><strong></strong>`;
    form.appendChild(layer);
  }
  if(layer){layer.querySelector("strong").textContent=message;layer.hidden=!busy;}
  form.classList.toggle("is-busy",!!busy);
  form.setAttribute("aria-busy",String(!!busy));
}
const OUTBOX_KEY="pna_pending_outbox_v29";
const REG_BATCH_LIMIT=20;
const REG_BATCH_DEBOUNCE_MS=1800;
let registrationBuffer=[], registrationFlushTimer=null;
const isRegistrationJob=job=>["saveRegistration","saveRegistrationsBatch"].includes(job?.action);
const jobWeight=job=>Math.max(1,Number(job?.count)||1);
const registrationRecords=job=>job?.action==="saveRegistrationsBatch"
  ? (Array.isArray(job.payload?.registrations)?job.payload.registrations:[])
  : job?.action==="saveRegistration"&&job.payload?.registration?[job.payload.registration]:[];
function markPendingRegistrations(){
  if(!state.user)return;
  const all=[...failedJobs.map(job=>({job,status:"failed"})),
    ...(inflightJob?[{job:inflightJob,status:"saving"}]:[]),
    ...writes.map(job=>({job,status:"queued"})),
    ...registrationBuffer.map(job=>({job,status:"queued"}))];
  for(const {job,status} of all){
    if(!isRegistrationJob(job)||job.userId!==state.user.id)continue;
    for(const rec of registrationRecords(job)){
      if(!rec?.id)continue;
      let current=state.registrations.find(r=>r.id===rec.id);
      const fields={...rec,active:true,registeredBy:current?.registeredBy||state.user.id,
        registeredByName:current?.registeredByName||state.user.name,
        createdAt:current?.createdAt||new Date().toISOString(),_syncState:status};
      if(current)Object.assign(current,fields);else state.registrations.push(fields);
    }
  }
}
function scheduleRegistrationFlush(delay=REG_BATCH_DEBOUNCE_MS){
  if(registrationFlushTimer)clearTimeout(registrationFlushTimer);
  if(!registrationBuffer.length)return;
  registrationFlushTimer=setTimeout(()=>{registrationFlushTimer=null;flushRegistrationBuffer()},delay);
}
function queueRegistrationWrite(record){
  if(!state.token||!state.user){toast("Sign in to register participants.");return false;}
  if(state.bootstrap?.capabilities?.registrationBatch!==true){
    toast("Batch registration needs the updated v2.9.2 Apps Script deployment.");
    return false;
  }
  // A second edit to the same not-yet-sent registration replaces its payload.
  const buffered=registrationBuffer.find(job=>job.payload?.registration?.id===record.id);
  const oldBufferedRecord=buffered?{...buffered.payload.registration}:null;
  if(buffered)buffered.payload.registration={...record};
  else{
    registrationBuffer.push({action:"saveRegistration",payload:{registration:{...record}},
      token:state.token,userId:state.user.id,
      requestId:"req_"+Date.now()+"_"+Math.random().toString(36).slice(2,11)});
    pendingWrites++;
  }
  // A local disk write is required BEFORE displaying an optimistic save.
  // Otherwise closing a tab during an offline interval could lose the record.
  if(!persistOutbox()){
    if(buffered)buffered.payload.registration=oldBufferedRecord;
    else{registrationBuffer.pop();pendingWrites--;}
    toast("Browser storage unavailable. Registration was NOT queued; enable site storage and try again.");
    return false;
  }
  changeVersion++;
  const old=state.registrations.find(r=>r.id===record.id);
  if(old)Object.assign(old,record,{active:true,_syncState:"queued"});
  else state.registrations.push({...record,active:true,registeredBy:state.user.id,
    registeredByName:state.user.name,createdAt:new Date().toISOString(),_syncState:"queued"});
  updateSaveState();renderRegistration();
  if(registrationBuffer.length>=REG_BATCH_LIMIT)flushRegistrationBuffer();
  else scheduleRegistrationFlush();
  return true;
}
function flushRegistrationBuffer(){
  if(registrationFlushTimer){clearTimeout(registrationFlushTimer);registrationFlushTimer=null;}
  if(!registrationBuffer.length)return;
  if(!state.user || registrationBuffer.some(j=>j.userId!==state.user.id)){
    toast("Pending registrations belong to another sign-in. Reconnect that user to sync them.");
    return;
  }
  const originalBuffer=registrationBuffer.slice();
  let addedJobs=0;
  while(registrationBuffer.length){
    const batch=registrationBuffer.splice(0,REG_BATCH_LIMIT);
    // The batch ID is persisted BEFORE sending and reused on retry.
    writes.push({action:"saveRegistrationsBatch",payload:{registrations:batch.map(j=>j.payload.registration)},
      requestId:"req_"+Date.now()+"_"+Math.random().toString(36).slice(2,11),
      token:batch[0].token,userId:batch[0].userId,count:batch.length});
    addedJobs++;
  }
  if(!persistOutbox()){
    writes.splice(-addedJobs,addedJobs);registrationBuffer=originalBuffer;
    toast("Cannot store batch safely on this device. Registrations remain queued; free browser storage and Sync again.");
    updateSaveState();return;
  }
  updateSaveState();
  Promise.resolve().then(drainWrites);
}
// Retry ONLY unconfirmed edits, with their original request IDs. Never retry
// confirmed records or create new requests while the app is idle.
function retryFailedWrites({showToast=false,registrationOnly=false}={}){
  if(writing||!state.token||navigator.onLine===false)return false;
  const retry=failedJobs.filter(j=>j.userId===state.user?.id&&!j.permanentError&&
    (!registrationOnly||isRegistrationJob(j)));
  if(!retry.length)return false;
  failedJobs=failedJobs.filter(j=>!retry.includes(j));
  const count=retry.reduce((n,j)=>n+jobWeight(j),0);
  pendingWrites+=count;
  writes.unshift(...retry);
  if(!persistOutbox()){
    writes.splice(0,retry.length);
    failedJobs.unshift(...retry);
    pendingWrites-=count;
    toast("Cannot store the retry queue on this device; no changes were discarded.");
    updateSaveState();return false;
  }
  updateSaveState();markPendingRegistrations();renderRegistration();
  if(showToast)toast(`Retrying ${count} unconfirmed change(s) in the background…`);
  Promise.resolve().then(drainWrites);
  return true;
}
function retryFailedRegistrationWrites(options={}){
  return retryFailedWrites({...options,registrationOnly:true});
}
function persistOutbox(){
  try{
    const all=[...failedJobs,...(inflightJob?[inflightJob]:[]),...writes,...registrationBuffer]
      .map(job=>({action:job.action,payload:job.payload,requestId:job.requestId,
        userId:job.userId||state.user?.id,count:job.count||1,
        permanentError:!!job.permanentError}));
    localStorage.setItem(OUTBOX_KEY,JSON.stringify(all));
    return true;
  }catch{return false;}
}
function restoreOutbox(){
  try{
    const all=JSON.parse(localStorage.getItem(OUTBOX_KEY)||"[]");
    if(!Array.isArray(all)||!state.user||!state.token)return;
    const unique=new Set();
    const mine=all.filter(j=>j.userId===state.user.id&&j.action&&j.requestId)
      .filter(j=>{if(unique.has(j.requestId))return false;unique.add(j.requestId);return true;});
    if(mine.length){
      for(const j of mine){
        const job={...j,token:state.token,error:"Pending save recovered from this device"};
        if(j.action==="saveRegistration"){
          registrationBuffer.push(job);pendingWrites+=1;
        }else failedJobs.push(job);
      }
      toast(`${mine.reduce((n,j)=>n+jobWeight(j),0)} queued change(s) recovered. Sync will resume automatically.`);
      updateSaveState();
    }
  }catch{}
}

// v2.3: optimistic UI, serialized background writes, a visible unsynced badge.
// Failed jobs keep their original requestId. Server-side WriteReceipts makes
// a manual retry idempotent even if a prior confirmation was lost.
let pendingWrites=0, writing=false, writes=[],failedJobs=[],inflightJob=null,changeVersion=0;
let lastRefreshAt=0, refreshing=false, refreshAfterWritesRequested=false;
// v2.9.8: a full Sheets refresh after 30 minutes of inactivity between syncs.
// Timers may be suspended by mobile browsers; overdue work is caught up when
// the tab becomes visible. Successful refreshes reset the 30-minute clock.
const PERIODIC_SYNC_MS=30*60*1000;
let periodicSyncTimer=null, periodicSyncDueAt=0, periodicSyncRunning=false;
function schedulePeriodicSync(){
  periodicSyncDueAt=Date.now()+PERIODIC_SYNC_MS;
  if(periodicSyncTimer!==null)clearTimeout(periodicSyncTimer);
  periodicSyncTimer=setTimeout(periodicSync,PERIODIC_SYNC_MS);
}
async function periodicSync(){
  if(periodicSyncRunning)return;
  if(periodicSyncTimer!==null)clearTimeout(periodicSyncTimer);
  periodicSyncTimer=null;
  // The user may have switched apps or closed the phone screen. Do not drain
  // battery in a hidden tab; catch up once it is visible again.
  if(document.visibilityState!=="visible")return;
  periodicSyncRunning=true;
  try{
    if(registrationBuffer.length)flushRegistrationBuffer();
    if(pendingWrites||writing){
      refreshAfterWritesRequested=true;
      return;
    }
    if(failedJobs.length){
      refreshAfterWritesRequested=true;
      if(!retryFailedWrites()){
        refreshAfterWritesRequested=false;
        setConnection("Some edits still need Sync; confirmed records remain visible.");
      }
      return;
    }
    if(refreshing||navigator.onLine===false)return;
    if(state.token){
      await refreshLatest({includeBootstrap:true,silent:true});
    }else{
      await loadBootstrap({preserveView:true});
      renderAll();
    }
  }catch(err){
    // A failed periodic read must never replace confirmed local data.
    setConnection("Showing saved view · 30-minute refresh delayed: "+String(err.message||err).slice(0,95));
  }finally{
    periodicSyncRunning=false;
    // The successful refresh already scheduled the next run. For failures,
    // schedule the next attempt in 30 minutes rather than retrying in a loop.
    if(periodicSyncTimer===null)schedulePeriodicSync();
  }
}
function unsyncedCount(){return pendingWrites+failedJobs.reduce((n,j)=>n+jobWeight(j),0);}
function updateSaveState(){
  const el=$("#saveState"),btn=$("#syncRefreshBtn"),badge=$("#syncCount");
  if(!el||!btn||!badge)return;
  const total=unsyncedCount();
  const failedCount=failedJobs.reduce((n,j)=>n+jobWeight(j),0);
  const label=failedCount?`${failedCount} need sync`:(pendingWrites?`${pendingWrites} queued / syncing…`:refreshing?"Refreshing…":"All changes saved");
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
  btn.title=failedCount?`Retry ${failedCount} unconfirmed change(s) and refresh`:pendingWrites?`${pendingWrites} queued/syncing · data refreshes after confirmation`:refreshing?"Fetching latest data…":"Refresh latest data and sync pending edits";
}
function queueWrite(action,payload,optimistic,{awaitConfirmation=false}={}){
  if(!state.token){toast("Sign in to make changes.");return awaitConfirmation?Promise.reject(new Error("Please sign in.")):false;}
  const token=state.token;
  const requestId="req_"+Date.now()+"_"+Math.random().toString(36).slice(2,10);
  let done,resolve,reject;
  if(awaitConfirmation)done=new Promise((ok,fail)=>{resolve=ok;reject=fail});
  const job={action,payload,token,requestId,userId:state.user.id,resolve,reject};
  // Write-ahead persistence: do not display an optimistic edit unless it can
  // first be recovered after a reload or lost connection.
  writes.push(job);
  pendingWrites++;
  if(!persistOutbox()){
    writes.pop();pendingWrites--;
    const error=new Error("Cannot store unsynced changes in this browser. Enable site storage and try again.");
    toast(error.message);updateSaveState();
    return awaitConfirmation?Promise.reject(error):false;
  }
  changeVersion++;
  if(optimistic)optimistic();
  updateSaveState();renderAll();
  Promise.resolve().then(drainWrites);
  return awaitConfirmation?done:true;
}
async function drainWrites(){
  if(writing||!writes.length)return;
  writing=true;
  let storageBlocked=false;
  try{
    while(writes.length){
      const job=writes.shift();
      inflightJob=job;
      if(!persistOutbox()){
        inflightJob=null;writes.unshift(job);
        toast("Browser storage unavailable. Changes remain queued; enable site storage before syncing.");
        storageBlocked=true;
        break;
      }
      try{
        const result=await Api.request(job.action,{...job.payload,token:job.token},job.requestId);
        if(!result?.ok)throw new Error(result?.error||"Server rejected the change.");
        if((job.action==="receiveRegistration"||job.action==="reverseRegistrationPayment"||job.action==="deleteRegistration")&&result.payment){
          const payment=result.payment;
          const i=state.registrationPayments.findIndex(p=>p.id===payment.id);
          if(i>=0)state.registrationPayments[i]={...payment};else state.registrationPayments.push(payment);
          renderSummary();renderFinance();renderRegistration();
        }
        if((job.action==="receiveFinance"||job.action==="reverseFinanceReceipt")&&result.collection){
          const rec=result.collection;
          const index=state.financeCollections.findIndex(x=>x.id===rec.id);
          if(index>=0)state.financeCollections[index]={...rec};else state.financeCollections.push(rec);
          if(financeLedgerVerified){renderSummary();renderFinance();}
        }
        if((job.action==="releasePayable"||job.action==="reversePayableRelease")&&result.payout){
          const payout=result.payout;
          const index=state.financePayouts.findIndex(x=>x.id===payout.id);
          if(index>=0)state.financePayouts[index]={...payout};else state.financePayouts.push(payout);
          if(financeLedgerVerified){renderSummary();renderFinance()}
        }
        if(job.action==="addUser"&&result.user&&state.bootstrap){
          if(!state.bootstrap.users.some(u=>u.id===result.user.id))state.bootstrap.users.push(result.user);
          renderLoginUsers();
        }
        if(isRegistrationJob(job)){
          for(const rec of registrationRecords(job)){
            const pending=registrationBuffer.some(j=>registrationRecords(j).some(r=>r.id===rec.id))||
              writes.some(j=>registrationRecords(j).some(r=>r.id===rec.id))||
              failedJobs.some(j=>registrationRecords(j).some(r=>r.id===rec.id));
            const current=state.registrations.find(r=>r.id===rec.id);
            if(current&&!pending){delete current._syncState;current._everConfirmed=true;}
          }
          renderRegistration();
        }
        if(job.resolve)job.resolve(result);
      }catch(error){
        const permanentError=/Registration details|Enter participant|Choose a registration type|Attendee count|Only Family registrations|Notes must be|Only the original registrar|Registration not found|SESSION_INVALID/.test(error.message);
        failedJobs.push({...job,error:error.message,permanentError,resolve:undefined,reject:undefined});
        if(isRegistrationJob(job)){
          for(const rec of registrationRecords(job)){
            const row=state.registrations.find(r=>r.id===rec.id);
            if(row)row._syncState="failed";
          }
          renderRegistration();
        }
        if(job.reject)job.reject(error);
        toast("Not synced: "+error.message+". Press Sync to retry safely.");
      }finally{
        pendingWrites-=jobWeight(job);inflightJob=null;persistOutbox();updateSaveState();
      }
    }
  }finally{
    writing=false;
    // One confirmed refresh AFTER the whole edit burst, never after each edit.
    // A manual refresh pressed during saving is honored after the writes finish.
    // Unconfirmed edits are never overwritten with older server snapshots.
    if(!writes.length&&!failedJobs.length&&!registrationBuffer.length&&state.token){
      const includeBootstrap=refreshAfterWritesRequested;
      refreshAfterWritesRequested=false;
      await refreshLatest({includeBootstrap,silent:!includeBootstrap})
        .catch(err=>setConnection("Saved, refresh delayed: "+err.message));
    }
    updateSaveState();
    // Do not spin endlessly when browser storage is disabled.
    if(writes.length&&!storageBlocked)Promise.resolve().then(drainWrites);
  }
}
function allowNavigation(){if(unsyncedCount()){toast("Unsynced changes remain. Sync & Refresh before leaving.");return false}return true;}
async function refreshLatest({includeBootstrap=false,silent=false}={}){
  if(refreshing)return false;
  if(unsyncedCount())return false;
  refreshing=true;updateSaveState();
  try{
    if(includeBootstrap)await loadBootstrap({preserveView:true});
    const updated=await verifiedRefreshWithRetry();
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
  if(registrationBuffer.length)flushRegistrationBuffer();
  if(pendingWrites||writing){
    refreshAfterWritesRequested=true;
    toast("Saving in the background. Latest records will refresh when pending writes finish.");
    return;
  }
  if(failedJobs.length){
    refreshAfterWritesRequested=true;
    if(retryFailedWrites({showToast:true}))return;
    refreshAfterWritesRequested=false;
    toast("Some changes need attention before a refresh can safely replace the current view.");
    return;
  }
  try{
    if(state.token)await refreshLatest({includeBootstrap:true});
    else{await loadBootstrap({preserveView:true});schedulePeriodicSync();renderAll();toast("Latest committee directory loaded. Sign in for full details.")}
  }catch{/* The existing view remains available; error is shown by refreshLatest. */}
}

async function init(){
  decorateStaticIcons();
  bindEvents();
  preventAccidentalZoom();
  updateSaveState();
  // No frequent background polling: one refresh per 30 minutes after the
  // last successful sync, plus edits, manual Sync and page reload.
  schedulePeriodicSync();
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible"&&Date.now()>=periodicSyncDueAt)
      periodicSync();
  });
  window.addEventListener("online",()=>{
    if(registrationBuffer.length)flushRegistrationBuffer();
    retryFailedWrites({showToast:true});
    if(document.visibilityState==="visible"&&Date.now()>=periodicSyncDueAt)
      periodicSync();
  });
  window.addEventListener("beforeunload",event=>{if(unsyncedCount()){event.preventDefault();event.returnValue=""}});
  let showedCache=false;
  const stored=sessionGet();
  if(stored){
    try{
      const sess=JSON.parse(stored);
      if(sess.user&&sess.token){
        state.user=sess.user;state.token=sess.token;
        showedCache=restoreSnapshot(state.user.id);
        const hasPeople=restoreDirectory(state.user.id);
        restoreOutbox();
        if(showedCache||hasPeople){
          renderAll();
          setConnection(showedCache?"Showing last confirmed view · checking Google Sheets…":"People directory restored · loading other records…");
        }
      }
    }catch{clearSession()}
  }
  try{
    // Every page load requests fresh committee records from Apps Script, even
    // when a cached view is immediately displayed in the meantime.
    await loadBootstrap({preserveView:showedCache});
    if(state.token){
      if(failedJobs.length||registrationBuffer.length){
        // Load the latest CONFIRMED Sheets records even with pending local
        // registrations, then overlay queued entries so nothing disappears.
        await verifiedRefreshWithRetry(3,{allowPending:true});
        if(registrationBuffer.length)scheduleRegistrationFlush(500);
        if(failedJobs.some(j=>!j.permanentError))setTimeout(()=>retryFailedWrites(),1200);
        return;
      }
      await verifiedRefreshWithRetry();return;
    }
    renderAll();setConnection("Sign in to view event records");openLogin();
  }catch(err){
    if(/SESSION_INVALID/.test(err.message)){
      clearSession();renderAll();openLogin();toast("This device needs a new sign-in.");return;
    }
    if((showedCache||verifiedDirectory)&&state.token){
      directoryLoading=false;
      // Other collections may fail while the independent people directory works.
      const detail=String(err?.message||"Unable to load event records");
      setConnection("People available · tasks/other records need sync: "+detail.slice(0,115));
      if($("#peopleRolesDialog")?.open)renderPeopleRoles();
      toast("People loaded; other records could not be refreshed. Press Sync to retry.");
      return;
    }
    directoryLoading=false;directoryError=String(err?.message||"Unable to load event records");
    setConnection("Cannot load directory: "+directoryError.slice(0,130));
    if(!state.token)renderConnectionError(err.message);
    if($("#peopleRolesDialog")?.open)renderPeopleRoles();
    toast("Some records are unavailable. Your last confirmed view was not replaced.");
  }
}
async function loadBootstrap({preserveView=false}={}){
  const result=await Api.request("bootstrap");
  if(!result?.ok)throw new Error(result?.error||"Database setup failed");
  assertApiV29(result);
  if(!hasValidDirectory(result))
    throw new Error("Bootstrap returned no valid active-user directory. Check the Apps Script deployment and Users sheet.");
  // v2.9.3 has an explicit count contract. A legacy v2.9.2 backend may not
  // have that contract, but a valid nonempty bootstrap directory can still be
  // displayed while the full-sheet API is diagnosed independently.
  if(result.directoryContract===293&&(!Number.isSafeInteger(result.directoryCount)||
     result.directoryCount!==result.users.length))
    throw new Error("Incomplete directory response: user count mismatch.");
  setVerifiedDirectory(result);
  if(!preserveView&&!state.token&&!fullSnapshotLoaded)renderAll();
  return true;
}

function renderLoginUsers(){
  const select=$("#loginUser"),previous=select.value;
  select.innerHTML=(state.bootstrap?.users||[]).filter(u=>active(u.active)).map(u=>`<option value="${esc(u.id)}">${esc(u.name)} · ${esc(u.position||u.accessRole)}</option>`).join("");
  if([...select.options].some(o=>o.value===previous))select.value=previous;
  renderLoginPreview();
}
function renderConnectionError(message){$("#committeeList").innerHTML=`<div class="empty-state"><strong>Database connection needs attention</strong>${esc(message)}<p class="muted">Check the Apps Script v2 deployment, the shared /exec URL, and your spreadsheet schema.</p></div>`}
function renderDataIntegrity(){
  const host=$("#dataIntegritySummary");if(!host)return;
  const userIds=new Set((state.bootstrap?.users||[]).map(u=>u.id));
  const unknown=[...new Set(state.tasks.flatMap(t=>Array.isArray(t.assigneeIds)?t.assigneeIds:[]).filter(id=>id&&!userIds.has(id)))];
  const unknownMemberIds=[...new Set(state.members.map(m=>m.userId).filter(id=>id&&!userIds.has(id)))];
  if(unknown.length||unknownMemberIds.length){
    host.textContent=`${unknown.length} unmatched task assignee ID(s), ${unknownMemberIds.length} unmatched member ID(s). A Director should review these assignments. No records were silently discarded.`;
    host.classList.add("data-warning");
  }else{
    host.textContent=`All loaded task assignees and committee members match active users. ${state.updates.length} task updates loaded. ${state.registrations.length} active registrations.`;
    host.classList.remove("data-warning");
  }
}
function validateFullSnapshot(result){
  assertApiV29(result);
  const manifest=result?.manifest;
  if(!result?.ok || result.snapshotComplete!==true || !manifest ||
     manifest.contract!==293 || !manifest.visible)
    throw new Error(result?.error||"Sheet data is incomplete. Deploy the v2.9.3 Code.gs backend.");
  const required={Users:"users",Committees:"committees",CommitteeMembers:"members",
    Tasks:"tasks",TaskUpdates:"updates",ActivityLogs:"activity",FinanceEntries:"finance",
    FinanceCollections:"financeCollections",
    FinancePayouts:"financePayouts",
    RegistrationPayments:"registrationPayments",
    FoodItems:"foodItems",Registrations:"registrations"};
  for(const [sheet,field] of Object.entries(required)){
    const raw=manifest[sheet],visible=manifest.visible[sheet],records=result[field];
    if(!Array.isArray(records)||!Number.isSafeInteger(raw)||raw<0||
       !Number.isSafeInteger(visible)||visible<0||visible>raw||records.length!==visible)
      throw new Error(`Incomplete response: ${sheet} records did not match the server counts.`);
  }
  if(!Array.isArray(result.archivedCommittees)||
     result.archivedCommittees.length!==manifest.visible.ArchivedCommittees)
    throw new Error("Incomplete response: archived committees did not match the server count.");
  if(!result.users.length || (state.user&&!result.users.some(u=>u.id===state.user.id)))
    throw new Error("People & Roles was unexpectedly empty. Previous confirmed directory retained.");
  // A response that claims fewer users than the currently verified directory
  // might reflect a legitimate removal. We trust it only after the backend
  // supplies an explicit count, not an empty/missing collection.
  return true;
}
async function refreshData({allowPending=false}={}){
  if(!state.token){await loadBootstrap();renderAll();return true}
  if(unsyncedCount()&&!allowPending)return false;
  const version=changeVersion,token=state.token;
  const result=await api("getData");
  if(!result?.ok)throw new Error(result?.error||"Could not load event records");
  validateFullSnapshot(result);
  // Commit ONE complete snapshot at a time, never a partial list or stale read.
  if(version!==changeVersion||token!==state.token||(!allowPending&&unsyncedCount()))return false;
  const fields=["committees","members","tasks","updates","activity","finance","financeCollections","financePayouts","registrationPayments","foodItems","registrations","archivedCommittees"];
  for(const field of fields)state[field]=result[field];
  financeLedgerVerified=true;
  state.registrations.forEach(r=>r._everConfirmed=true);
  setVerifiedDirectory({users:result.users,committees:result.committees,members:result.members});
  lastRefreshAt=Date.now();
  schedulePeriodicSync();
  fullSnapshotLoaded=true;directoryLoading=false;directoryError="";
  // Never cache unconfirmed optimistic records as confirmed sheet data.
  if(allowPending&&unsyncedCount())markPendingRegistrations();
  else saveConfirmedSnapshot();
  setConnection(unsyncedCount()?`Live records loaded · ${unsyncedCount()} queued / unsynced`:`Synced · ${state.user.name}`,!unsyncedCount());
  renderAll();return true;
}
async function verifiedRefreshWithRetry(attempts=3,options={}){
  let error;
  for(let i=0;i<attempts;i++){
    if(i)await new Promise(resolve=>setTimeout(resolve,750*i));
    try{return await refreshData(options);}catch(err){
      error=err;if(/SESSION_INVALID|Backend version mismatch/.test(String(err.message)))break;
    }
  }
  if(!fullSnapshotLoaded){
    directoryLoading=false;
    directoryError=(error?.message||"The complete directory is not available yet.");
    if($("#peopleRolesDialog")?.open)renderPeopleRoles();
  }
  throw error||new Error("Unable to verify complete Google Sheets response.");
}

function bindEvents(){
  $$(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
  $("#syncRefreshBtn").onclick=manualSyncRefresh;
  $("#mainMenuBtn").onclick=()=>{
    $("#profileMenu").classList.add("hidden");$("#addMenu").classList.add("hidden");
    const hidden=$("#mainMenu").classList.toggle("hidden");
    $("#mainMenuBtn").setAttribute("aria-expanded",String(!hidden));
  };
  $("#myAssignmentsBtn").onclick=()=>{
    $("#mainMenu").classList.add("hidden");$("#mainMenuBtn").setAttribute("aria-expanded","false");
    openMyAssignments();
  };
  $("#peopleRolesBtn").onclick=()=>{
    $("#mainMenu").classList.add("hidden");$("#mainMenuBtn").setAttribute("aria-expanded","false");
    openPeopleRoles();
  };
  $("#peopleRolesSort").onclick=()=>{
    const sortButton=$("#peopleRolesSort");
    setPeopleRolesSort(sortButton.dataset.sortOrder==="name-asc"?"name-desc":"name-asc");
    renderPeopleRoles();
  };
  $("#peopleRolesSearch").oninput=renderPeopleRoles;
  $("#copyPeopleRolesBtn").onclick=copyPeopleRoles;
  $("#copyAllCommitteesBtn").onclick=()=>{
    $("#mainMenu").classList.add("hidden");$("#mainMenuBtn").setAttribute("aria-expanded","false");
    openShareDialog();
  };
  $("#copyShareBtn").onclick=copyShareReport;
  $$("#shareModeTabs [data-share-mode]").forEach(button=>{
    button.onclick=()=>setShareMode(button.dataset.shareMode);
  });
  $("#addMenuBtn").onclick=()=>{
    $("#mainMenu").classList.add("hidden");
    $("#profileMenu").classList.add("hidden");
    const opened=$("#addMenu").classList.toggle("hidden");
    $("#addMenuBtn").setAttribute("aria-expanded",String(!opened));
  };
  $("#addUserTopBtn").onclick=()=>{$("#addMenu").classList.add("hidden");$("#addMenuBtn").setAttribute("aria-expanded","false");userEditor()};
  $("#addMemberTopBtn").onclick=()=>{$("#addMenu").classList.add("hidden");$("#addMenuBtn").setAttribute("aria-expanded","false");topMemberEditor()};
  $("#registerTopBtn").onclick=()=>{$("#addMenu").classList.add("hidden");switchTab("registration");openRegistrationEditor()};
  $("#profileBtn").onclick=()=>{$("#addMenu").classList.add("hidden");$("#mainMenu").classList.add("hidden");$("#profileMenu").classList.toggle("hidden")};
  $("#editProfileBtn").onclick=()=>{if(!allowNavigation())return;$("#profileMenu").classList.add("hidden");openLogin(true)};
  $("#archiveMenuBtn").onclick=()=>{$("#profileMenu").classList.add("hidden");openArchives()};
  $("#signOutBtn").onclick=async()=>{
    if(!allowNavigation())return;
    const token=state.token;
    $("#profileMenu").classList.add("hidden");
    setConnection("Signing out…");
    if(token){try{await Api.request("logout",{token})}catch{toast("Couldn't confirm server sign-out. Close this browser on shared devices.")}}
    clearSession();renderAll();setConnection("Signed out");openLogin();
  };
  $("#loginUser").onchange=renderLoginPreview;
  $("#loginForm").onsubmit=login;
  $("#addCommitteeBtn").onclick=()=>committeeEditor();
  $("#addTaskBtn").onclick=()=>taskEditor();
  $("#addFinanceBtn").onclick=()=>financeEditor();
  $("#financeFilterToggle").onclick=()=>{
    const el=$("#financeFilters");el.classList.toggle("is-collapsed");
    $("#financeFilterToggle").setAttribute("aria-expanded",String(!el.classList.contains("is-collapsed")));
  };
  $$(".finance-filter").forEach(b=>b.onclick=()=>{
    financeFilter=b.dataset.financeFilter;
    renderFinance();
  });
  $("#addFoodBtn").onclick=()=>foodEditor();
  $("#registerBtn").onclick=()=>openRegistrationEditor();
  $("#registrationSearch").oninput=renderRegistration;
  $("#registrationTypeFilter").onchange=renderRegistration;
  $("#registrationForm").onsubmit=saveRegistrationForm;
  $("#registrationAttendees").addEventListener("input",()=>{});
  $("#registrationType").onchange=()=>{
    const isFamily=$("#registrationType").value==="Family";
    $("#registrationAttendees").disabled=!isFamily;
    if(!isFamily)$("#registrationAttendees").value="1";
  };
  $("#addMemberBtn").onclick=()=>{const committee=state.committees.find(c=>c.id===state.managingCommitteeId);if(committee)memberEditor(committee)};
  $("#taskCommitteeFilter").onchange=renderTasks;
  $("#taskStatusFilter").onchange=renderTasks;
  $("#taskSearch").oninput=renderTasks;
  $("#exportBtn").onclick=exportCsv;
  $$("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).close());
  $("#editForm").onsubmit=saveEditor;
  setupEditorKeyboardBar();
  document.addEventListener("click",ev=>{
    if(!ev.target.closest("#mainMenu")&&!ev.target.closest("#mainMenuBtn")){$("#mainMenu").classList.add("hidden");$("#mainMenuBtn").setAttribute("aria-expanded","false")}
    if(!ev.target.closest("#profileMenu")&&!ev.target.closest("#profileBtn"))$("#profileMenu").classList.add("hidden");
    if(!ev.target.closest("#addMenu")&&!ev.target.closest("#addMenuBtn")){$("#addMenu").classList.add("hidden");$("#addMenuBtn").setAttribute("aria-expanded","false")}
  });
}
function switchTab(tab){
  state.activeTab=tab;cacheTab(tab);
  renderSummary();
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
  $("#loginError").textContent="";button.disabled=true;setFormBusy(form,true,"Signing you in…");
  try{
    const result=await Api.request("login",{userId:$("#loginUser").value,password});
    if(!result?.ok)throw new Error(result?.error||"Sign-in failed");
    state.user=result.user;state.token=result.token;
    sessionSet({user:state.user,token:state.token});
    $("#loginDialog").close();
    toast(`Welcome, ${state.user.name}! Loading your latest records…`);
    try{await verifiedRefreshWithRetry()}catch(err){
      setConnection("Signed in · full data refresh pending");
      toast("Signed in, but complete records are temporarily unavailable. Tap Sync to retry.");
    }
  }catch(err){$("#loginError").textContent=err.message}
  finally{$("#loginPassword").value="";button.disabled=false;setFormBusy(form,false)}
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
  $("#registerBtn").classList.toggle("hidden",!state.user);
  const assignable=state.committees.some(c=>canManageMembers(c.id));
  $("#addMenuBtn").classList.toggle("hidden",!state.user);
  $("#addUserTopBtn").classList.toggle("hidden",!isManager());
  $("#addMemberTopBtn").classList.toggle("hidden",!assignable);
  $("#registerTopBtn").classList.toggle("hidden",!state.user);
  $("#archiveMenuBtn").classList.toggle("hidden",!isManager());
}
function renderAll(){
  renderProfile();populateFilters();renderSummary();renderCommittees();renderTasks();renderFinance();renderFood();renderRegistration();renderReports();renderDataIntegrity();
  switchTab(state.activeTab);if($("#archivesDialog").open)renderArchives();
  if($("#myAssignmentsDialog").open)renderMyAssignments();
  if($("#peopleRolesDialog").open)renderPeopleRoles();
  if($("#shareDialog").open)renderSharePreview();
}
// Event-wide directory: one person per card, Head and Support assignments grouped
// separately. Reuses current bootstrap/users + membership records; no extra reads.
function peopleRolesData(){
  const source=verifiedDirectory||{users:state.bootstrap?.users||[],members:state.members,committees:state.committees};
  const directoryIds=new Set(source.committees.map(c=>c.id));
  // Backwards compatible with v2.9.3 getData() user objects that omit active.
  const sorted=source.users.filter(u=>u.active===undefined||active(u.active)).map(u=>{
    const memberships=source.members.filter(m=>active(m.active)&&m.userId===u.id&&directoryIds.has(m.committeeId));
    const grouped={Head:[],Support:[]};
    // Legacy data can contain duplicate rows; show each unique role once.
    const seen=new Set();
    memberships.forEach(m=>{
      const role=m.role==="Head"?"Head":"Support";
      const responsibility=String(m.supportRole||"").trim();
      const key=[m.committeeId,role,responsibility].join("|");
      if(seen.has(key))return;
      seen.add(key);
      grouped[role].push({committeeId:m.committeeId,committee:source.committees.find(c=>c.id===m.committeeId)?.name||committeeName(m.committeeId),responsibility});
    });
    const collator=new Intl.Collator("en-PH",{numeric:true,sensitivity:"base"});
    Object.values(grouped).forEach(assignments=>assignments.sort((a,b)=>collator.compare(a.committee,b.committee)||collator.compare(a.responsibility,b.responsibility)));
    return {id:u.id,name:u.name||"Unnamed person",position:u.position||"",accessRole:u.accessRole||"Committee Member",heads:grouped.Head,support:grouped.Support};
  });
  const query=($("#peopleRolesSearch")?.value||"").trim().toLocaleLowerCase();
  const filtered=sorted.filter(person=>{
    if(!query)return true;
    return [person.name,person.position,person.accessRole,...person.heads.flatMap(a=>[a.committee,a.responsibility]),...person.support.flatMap(a=>[a.committee,a.responsibility])]
      .some(value=>String(value).toLocaleLowerCase().includes(query));
  });
  const collator=new Intl.Collator("en-PH",{numeric:true,sensitivity:"base"});
  const reverse=$("#peopleRolesSort")?.dataset.sortOrder==="name-desc";
  filtered.sort((a,b)=>((reverse?-1:1)*collator.compare(a.name,b.name))||collator.compare(a.id,b.id));
  return {people:filtered,total:sorted.length};
}
function setPeopleRolesSort(order){
  const button=$("#peopleRolesSort");
  const descending=order==="name-desc";
  button.dataset.sortOrder=descending?"name-desc":"name-asc";
  button.setAttribute("aria-pressed",String(descending));
  button.setAttribute("aria-label",descending?"Sorted by name Z to A. Click to sort A to Z":"Sorted by name A to Z. Click to sort Z to A");
  button.title=descending?"Name Z–A · Click to reverse":"Name A–Z · Click to reverse";
  // Icon automatically shows the current sort direction.
  button.innerHTML=icon(descending?"sort-desc":"sort-asc");
}
function openPeopleRoles(){
  if(!state.user){toast("Sign in to view people and roles.");openLogin();return;}
  setPeopleRolesSort("name-asc");
  $("#peopleRolesSearch").value="";
  renderPeopleRoles();
  if(!$("#peopleRolesDialog").open)$("#peopleRolesDialog").showModal();
  if(!verifiedDirectory&&!directoryFetchPromise&&!directoryLoading)
    retryPeopleRolesLoad();
}
async function retryPeopleRolesLoad(){
  if(directoryFetchPromise)return directoryFetchPromise;
  directoryLoading=!verifiedDirectory;directoryError="";renderPeopleRoles();
  directoryFetchPromise=(async()=>{
    // Only the lightweight bootstrap endpoint is necessary for People & Roles.
    // Do not block this view behind the expensive getData() call.
    await loadBootstrap({preserveView:fullSnapshotLoaded});
    if(state.token&&!refreshing&&!unsyncedCount())
      verifiedRefreshWithRetry(1).catch(err=>{
        setConnection("People loaded · other sheets need sync: "+String(err.message).slice(0,110));
      });
  })().catch(err=>{
    directoryError=String(err?.message||"Could not load the directory.");
    setConnection("Directory not refreshed: "+directoryError.slice(0,130));
  }).finally(()=>{
    directoryLoading=false;directoryFetchPromise=null;renderPeopleRoles();
  });
  return directoryFetchPromise;
}
function personTasks(userId){
  return activeTasks().filter(t=>Array.isArray(t.assigneeIds)&&t.assigneeIds.includes(userId)).sort(personalTaskOrder);
}
function describeResponsibility(a){return a.committee+(a.responsibility?` — ${a.responsibility}`:"");}
function renderPeopleRoles(){
  const host=$("#peopleRolesList");
  if(!state.user){host.innerHTML='<div class="empty-state">Sign in to view people and roles.</div>';return;}
  if(!verifiedDirectory){
    const isLoading=directoryLoading;
    $("#peopleRolesStats").textContent=isLoading?"Loading people and assignments…":"Directory is not available yet";
    host.innerHTML=`<div class="empty-state directory-loading" role="status">
      ${isLoading?'<span class="form-busy-spinner" aria-hidden="true"></span>':''}
      <strong>${isLoading?"Loading people & roles…":"People & roles not loaded"}</strong>
      <p class="muted">${isLoading?"Fetching the People directory from Apps Script…":esc(directoryError||"The directory request failed. Check your Apps Script deployment and use Retry.")}</p>
      ${isLoading?'':'<button type="button" class="small-btn" id="retryPeopleRolesBtn">Retry loading</button>'}
    </div>`;
    $("#copyPeopleRolesBtn").disabled=true;
    $("#retryPeopleRolesBtn")?.addEventListener("click",()=>retryPeopleRolesLoad());
    return;
  }
  const {people,total}=peopleRolesData();
  $("#peopleRolesStats").textContent=`${people.length} of ${total} people · Name sorting · ${fullSnapshotLoaded?"roles & tasks":"roles loaded; tasks still syncing"}`;
  host.innerHTML=people.length?people.map((p,index)=>{
    const assigned=personTasks(p.id),done=assigned.filter(t=>t.status==="Completed").length;
    const roles=[...p.heads.map(a=>`<li>👤 <b>Head</b> · ${esc(describeResponsibility(a))}</li>`),...p.support.map(a=>`<li>🤝 <b>Support</b> · ${esc(describeResponsibility(a))}</li>`)].join("");
    const needs=assigned.filter(t=>t.status!=="Completed").slice(0,3).map(t=>`<li>${esc(t.title)} · ${esc(committeeName(t.committeeId))}${t.dueDate?` · Due ${esc(shortDate(t.dueDate))}`:""}</li>`).join("");
    return `<article class="people-person-card"><div class="people-person-heading"><span class="people-person-number">${index+1}</span><div><h3>${esc(p.name)}</h3><p class="muted">${p.heads.length} Head · ${p.support.length} Support${fullSnapshotLoaded?` · ${done}/${assigned.length} tasks complete`:" · tasks syncing"}</p></div></div><ul class="people-compact-roles">${roles||'<li>No committee assignment yet</li>'}</ul>${assigned.length?`<div class="people-task-mini"><strong>To do (${assigned.length-done})</strong>${needs?`<ul>${needs}</ul>`:" · All assigned tasks done"}</div>`:""}</article>`;
  }).join(""):'<div class="empty-state"><strong>No matching people</strong>Try a different name, role, or committee.</div>';
  $("#copyPeopleRolesBtn").disabled=!people.length;
}
function shortDate(value){
  if(!value)return "";
  const plain=String(value).slice(0,10);
  const date=new Date(plain+"T12:00:00+08:00");
  return Number.isNaN(date.getTime())?String(value):new Intl.DateTimeFormat("en-PH",{month:"short",day:"numeric",timeZone:"Asia/Manila"}).format(date);
}
function buildPeopleRolesText(){
  const {people}=peopleRolesData();
  const assignedTotal=people.reduce((n,p)=>n+personTasks(p.id).length,0);
  const lines=["🎄 *PASKO NG ANGKAN 2026*",`👥 *PEOPLE & TASKS* · ${people.length} people · ${assignedTotal} task assignments`];
  if(unsyncedCount())lines.push("⚠️ Some recent changes are not yet confirmed by Sheets.");
  people.forEach((p,i)=>{
    const ts=personTasks(p.id),done=ts.filter(t=>t.status==="Completed").length;
    lines.push("",`${i+1}. *${p.name}* · ${done}/${ts.length} tasks done`);
    p.heads.forEach(a=>lines.push(`👤 Head: ${describeResponsibility(a)}`));
    p.support.forEach(a=>lines.push(`🤝 Support: ${describeResponsibility(a)}`));
    if(!p.heads.length&&!p.support.length)lines.push("No committee assignment yet");
    const open=ts.filter(t=>t.status!=="Completed");
    if(open.length){lines.push(`📝 To do (${open.length}):`);open.forEach(t=>lines.push(`  ☐ ${t.title} (${committeeName(t.committeeId)}${t.dueDate?`, ${shortDate(t.dueDate)}`:""})`));}
    else if(ts.length)lines.push("✅ All assigned tasks completed");
  });
  return lines.join("\n");
}

async function copyPeopleRoles(){
  const body=buildPeopleRolesText();
  const {people}=peopleRolesData();
  if(!people.length)return toast("No people to copy.");
  try{
    if(!navigator.clipboard?.writeText)throw new Error("Clipboard permission unavailable");
    await navigator.clipboard.writeText(body);
    toast(`Copied ${people.length} people in name order. Paste into your group chat.`);
  }catch{
    // Only show raw data when a browser blocks the clipboard; avoid silently claiming success.
    const copyField=document.createElement("textarea");
    copyField.value=body;copyField.setAttribute("readonly","");
    copyField.style.position="fixed";copyField.style.left="-9999px";
    document.body.append(copyField);copyField.select();
    let copied=false;try{copied=document.execCommand("copy")}catch{}
    copyField.remove();
    toast(copied?"People summary copied to clipboard.":"Browser blocked copying. Please enable clipboard permission and try again.");
  }
}

// Personal view for the signed-in person only. This reads the same confirmed/
// optimistic records already loaded for the rest of the app: no extra API call.
function openMyAssignments(){
  if(!state.user){toast("Sign in to view your assigned committees and tasks.");openLogin();return;}
  renderMyAssignments();
  if(!$("#myAssignmentsDialog").open)$("#myAssignmentsDialog").showModal();
}
function personalTaskOrder(a,b){
  const rank={Blocked:0,Pending:1,"In Progress":2,Completed:3};
  return (rank[a.status]??2)-(rank[b.status]??2)||String(a.dueDate||"9999-12-31").localeCompare(String(b.dueDate||"9999-12-31"))||String(a.title).localeCompare(String(b.title));
}
function renderMyAssignments(){
  const panel=$("#myAssignmentsContent");
  if(!state.user){panel.innerHTML='<div class="empty-state">Sign in to view your assignments.</div>';return;}
  const memberships=state.members.filter(m=>m.userId===state.user.id&&active(m.active)&&state.committees.some(c=>c.id===m.committeeId));
  const uniqueIds=[...new Set(memberships.map(m=>m.committeeId))];
  const personalTasks=activeTasks().filter(t=>Array.isArray(t.assigneeIds)&&t.assigneeIds.includes(state.user.id)).sort(personalTaskOrder);
  const completed=personalTasks.filter(t=>t.status==="Completed").length;
  const pending=personalTasks.length-completed;
  $("#myAssignmentsSubtitle").textContent=`${state.user.name} · ${state.user.position||state.user.accessRole} · ${pending} active task${pending===1?"":"s"}`;
  const summary=`<div class="my-stats"><div><strong>${uniqueIds.length}</strong><span>My committees</span></div><div><strong>${personalTasks.length}</strong><span>Assigned tasks</span></div><div><strong>${completed}</strong><span>Completed</span></div></div>`;
  const committees=uniqueIds.length?uniqueIds.map(id=>{
    const c=state.committees.find(x=>x.id===id);const st=committeeStats(id);
    const assignments=memberships.filter(m=>m.committeeId===id);
    return `<article class="my-committee-card"><div class="my-row-head"><div><h3>${esc(c?.name||"Committee")}</h3><p class="muted">${esc(c?.description||"No committee description")}</p></div><button class="small-btn icon-action primary my-view-committee" type="button" data-id="${esc(id)}" title="Go to ${esc(c?.name||"committee")} tasks" aria-label="Go to ${esc(c?.name||"committee")} tasks">${icon("list-todo")}</button></div>
      <div class="my-assignment-roles">${assignments.map(m=>`<span class="my-role-label"><b>${esc(m.role||"Support")}</b>${m.supportRole?` · ${esc(m.supportRole)}`:""}</span>`).join("")}</div>
      <div class="progress-row"><div class="progress-track" role="progressbar" aria-valuenow="${st.percent}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(c?.name||"Committee")} completion"><div class="progress-fill" style="width:${st.percent}%"></div></div><span class="progress-value">${st.percent}%</span></div><p class="muted">${st.completed} of ${st.total} committee tasks completed</p></article>`;
  }).join(""):'<div class="empty-state"><strong>No committee assignment yet</strong>Ask your committee head or Director to assign you.</div>';
  const myTasks=personalTasks.length?personalTasks.map(t=>{
    const when=t.status==="Completed"&&t.completedAt?`<span>Completed ${esc(formatCompletionDate(t.completedAt))}${t.completedByName?` by ${esc(t.completedByName)}`:""}</span>`:"";
    return `<article class="my-task-row"><div class="my-row-head"><div><strong>${esc(t.title)}</strong><p class="muted">${esc(committeeName(t.committeeId))} · ${esc(t.priority||"Normal")} priority${t.dueDate?` · Due ${esc(t.dueDate)}`:""}</p></div>${badge(t.status||"Pending")}</div><div class="my-task-footer">${when?`<small>${when}</small>`:'<small>Assigned to you</small>'}<button class="small-btn icon-action my-view-task" type="button" data-id="${esc(t.id)}" title="Open this task" aria-label="Open task: ${esc(t.title)}">${icon("list-todo")}</button></div></article>`;
  }).join(""):'<div class="empty-state"><strong>No tasks directly assigned to you</strong>Use the committee icons above to see your committee’s full task list.</div>';
  panel.innerHTML=summary+`<div class="my-assignments-section"><h3>My committees</h3><div class="my-committee-list">${committees}</div></div><div class="my-assignments-section"><h3>My assigned tasks</h3><div class="my-task-list">${myTasks}</div></div>`;
  panel.querySelectorAll(".my-view-committee").forEach(b=>b.onclick=()=>{
    $("#myAssignmentsDialog").close();goToCommitteeTasks(b.dataset.id);
  });
  panel.querySelectorAll(".my-view-task").forEach(b=>b.onclick=()=>{
    const t=state.tasks.find(x=>x.id===b.dataset.id);if(!t)return;
    $("#myAssignmentsDialog").close();goToCommitteeTasks(t.committeeId);
    $("#taskSearch").value=t.title;
    renderTasks();
  });
}

function renderSummary(){
  const host=$("#summaryStrip");if(!host)return;
  const tasks=activeTasks(),done=tasks.filter(t=>t.status==="Completed").length;
  const registration=state.registrations.filter(r=>active(r.active));
  const foodDone=state.foodItems.filter(f=>f.status==="Done").length;
  const finance=financeLedgerVerified?calculateFinance():null;
  const definitions={
    committees:[["Committees",state.committees.length],["Total tasks",tasks.length],["Completed",done],["Needs attention",tasks.filter(t=>["Pending","Blocked"].includes(t.status)).length]],
    tasks:[["Total tasks",tasks.length],["Completed",done],["Pending",tasks.filter(t=>t.status==="Pending").length],["Blocked",tasks.filter(t=>t.status==="Blocked").length]],
    finance:[["Total Funds",finance?money(finance.totalFunds):"—"],["Cash Available",finance?money(finance.availableCash):"—"],["Receivables",finance?money(finance.outstanding):"—"],["Expenses",finance?money(finance.expenses):"—"],["Payables",finance?money(finance.payables):"—"]],
    food:[["Food items",state.foodItems.length],["Ready",foodDone],["To do",state.foodItems.length-foodDone],["Progress",state.foodItems.length?Math.round(foodDone*100/state.foodItems.length)+"%":"0%"]],
    registration:[["Registrations",registration.length],["Attendees",registration.reduce((n,r)=>n+(Number(r.attendeeCount)||1),0)],["Still due",finance?money(finance.registrationOutstanding):"—"],["Collected",finance?money(finance.registrationCollected):"—"]],
    reports:[["Committees",state.committees.length],["Overall progress",tasks.length?Math.round(done*100/tasks.length)+"%":"0%"],["Completed",done],["Needs attention",tasks.filter(t=>["Pending","Blocked"].includes(t.status)).length]]
  };
  host.classList.toggle("is-finance",state.activeTab==="finance");
  host.innerHTML=(definitions[state.activeTab]||definitions.committees).map(([label,value])=>
    `<article class="summary-card ${label==="Cash Available"?"accent-card":""}"><span>${esc(label)}</span><strong>${esc(value)}</strong></article>`).join("");
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
    {name:"userId",label:"Person",type:"select",required:true,options:[{value:"",label:"Choose a person…",disabled:true},...users.map(u=>({value:u.id,label:u.name}))]},
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
let financeFilter="all";
function calculateFinance(){return FinanceModel.calculate(state.finance,state.financeCollections,state.registrations,state.registrationPayments,state.financePayouts)}
function financePayoutPending(id){return [...writes,...failedJobs,...(inflightJob?[inflightJob]:[])].some(j=>
  ["releasePayable","reversePayableRelease"].includes(j.action)&&String(j.payload?.payableId)===String(id));}
function financeReceiptPending(id){
  const jobs=[...writes,...failedJobs,...(inflightJob?[inflightJob]:[])];
  return jobs.some(j=>(j.action==="receiveFinance"||j.action==="reverseFinanceReceipt")&&
    String(j.payload?.receivableId)===String(id));
}
function registrationPaymentPending(id){
  return [...writes,...failedJobs,...(inflightJob?[inflightJob]:[])].some(j=>
    ["receiveRegistration","reverseRegistrationPayment","deleteRegistration"].includes(j.action)&&
    String(j.payload?.registrationId||j.payload?.id)===String(id));
}
async function receiveRegistrationClick(id){
  if(!canEditFinance()||!financeLedgerVerified)return toast("Only Finance Heads or Directors can confirm payments after data sync.");
  const row=state.registrations.find(r=>r.id===id&&active(r.active));
  if(!row||row._syncState||registrationPaymentPending(id))return toast("This registration is still syncing. Try after confirmation.");
  const calc=calculateFinance();
  const amount=FinanceModel.registrationRate(row.registrationType);
  if(!amount||calc.registrationPayments.has(String(id)))return;
  if(!await confirmAction(`Confirm receipt of ${money(amount)} from ${row.name} (${row.registrationType})? This moves the amount from Receivables into Total Funds.`))return;
  queueWrite("receiveRegistration",{registrationId:id,date:TODAY()},null);
  toast("Recording received payment. It counts as collected after Google Sheets confirms it…");
}
async function reverseRegistrationClick(id){
  if(!canEditFinance()||!financeLedgerVerified||registrationPaymentPending(id))return;
  const row=state.registrations.find(r=>r.id===id),calc=calculateFinance();
  const payment=calc.registrationPayments.get(String(id));if(!row||!payment)return;
  if(!await confirmAction(`Undo ${money(payment.amount)} received from ${row.name}? This returns the amount to outstanding receivables.`))return;
  queueWrite("reverseRegistrationPayment",{registrationId:id},null);
  toast("Payment reversal queued. Google Sheets will confirm the updated totals…");
}
function renderRegistrationDues(calc){
  const host=$("#registrationFinanceList");if(!host)return;
  if(!financeLedgerVerified){
    host.innerHTML='<div class="empty-state">Loading verified registration payments…</div>';
    return;
  }
  const rows=state.registrations.filter(r=>active(r.active)&&FinanceModel.registrationRate(r.registrationType)>0);
  rows.sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  host.innerHTML=rows.length?rows.map(r=>{
    const amount=FinanceModel.registrationRate(r.registrationType);
    const paid=calc.registrationPayments.get(String(r.id));
    const pending=registrationPaymentPending(r.id)||!!r._syncState;
    const btn=canEditFinance()&&!pending?(paid?
      iconAction("reverse-reg-payment",r.id,"Undo received payment","rotate-ccw"):
      `<button type="button" class="small-btn finance-receive receive-reg-payment" data-id="${esc(r.id)}" title="Mark registration received">${icon("check-circle")}<span>Received</span></button>`):"";
    return `<article class="registration-finance-row"><div><strong>${esc(r.name)}</strong><p class="muted">${esc(r.registrationType)} · ${paid?`✓ Received ${esc(paid.date||"")} by ${esc(paid.receivedByName||"Finance")}`:(pending?"↻ Pending sync":"Awaiting payment")}</p></div><strong>${money(amount)}</strong><div>${btn}</div></article>`;
  }).join(""):'<div class="empty-state">No paid registration categories have been registered yet.</div>';
  host.querySelectorAll(".receive-reg-payment").forEach(b=>b.onclick=()=>receiveRegistrationClick(b.dataset.id));
  host.querySelectorAll(".reverse-reg-payment").forEach(b=>b.onclick=()=>reverseRegistrationClick(b.dataset.id));
}
// Finance records combine the existing FinanceEntries ledger and confirmed registrations.
// A Payable is an unpaid EVENT obligation. A Receivable is money owed TO the event.
function financeRecords(calc){
  const records=[];
  for(const item of state.finance){
    const received=item.type==="Receivables"?calc.collected.get(String(item.id)):null;
    const released=item.type==="Payable"?calc.payablePayments.get(String(item.id)):null;
    const category=item.type==="Payable"?(released?"expenses":"payables"):
      item.type==="Expense"?"expenses":item.type==="Receivables"?(received?"received":"receivables"):"received";
    const busy=item.type==="Payable"?financePayoutPending(item.id):financeReceiptPending(item.id);
    records.push({key:"fin:"+item.id,category,title:item.description||"Finance record",amount:Number(item.amount)||0,
      date:released?.date||received?.date||item.date||item.createdAt||"",source:item.type,
      status:busy?"Syncing…":released?"Paid":received?"Received":item.type==="Payable"?"Unpaid":item.type==="Receivables"?"Awaiting":item.type==="Expense"?"Paid":["Opening Balance","Cash on Hand"].includes(item.type)?"Starting funds":"Received",
      meta:released?`Released by ${released.releasedByName||"Finance"}`:received?`Received from ${received.source||"Other"}`:["Opening Balance","Cash on Hand"].includes(item.type)?"Not new collection":(item.recordedByName||""),
      item,busy,released,received,kind:"finance"});
  }
  for(const item of state.registrations){
    if(!active(item.active)||item._syncState)return; // never show unsynced registration as a confirmed ledger row
    const amount=FinanceModel.registrationRate(item.registrationType);if(amount<=0)continue;
    const received=calc.registrationPayments.get(String(item.id)),busy=registrationPaymentPending(item.id);
    records.push({key:"reg:"+item.id,category:received?"received":"receivables",
      title:item.name||"Registration",amount,date:received?.date||item.createdAt||"",
      status:busy?"Syncing…":received?"Received":"Awaiting",meta:`${item.registrationType} registration`,
      item,busy,received,kind:"registration"});
  }
  return records.sort((a,b)=>String(b.date).localeCompare(String(a.date))||a.title.localeCompare(b.title));
}
function renderFinance(){
  const host=$("#financeList");if(!host)return;
  const status=$("#financeSummaryStatus"),count=$("#financeRecordCount");
  $$(".finance-filter").forEach(b=>{
    const selected=b.dataset.financeFilter===financeFilter;
    b.classList.toggle("is-selected",selected);b.setAttribute("aria-pressed",String(selected));
  });
  if(!financeLedgerVerified){
    status.textContent="Waiting for a complete and verified finance snapshot. Current records stay protected until all ledgers arrive.";
    count.textContent="Loading confirmed records…";
    host.innerHTML='<div class="empty-state"><strong>Loading finance records…</strong>Sync to load the FinancePayouts ledger and other sheets.</div>';
    return;
  }
  const calc=calculateFinance(),all=financeRecords(calc);
  const rows=financeFilter==="all"?all:all.filter(r=>r.category===financeFilter);
  count.textContent=`${rows.length} of ${all.length} records · ${financeFilter==="all"?"All transaction types":financeFilter.charAt(0).toUpperCase()+financeFilter.slice(1)}`;
  status.textContent=calc.legacyIncome>0?
    "Historical Income entries ("+money(calc.legacyIncome)+") require review and are excluded from totals.":
    "Payables are what the event owes. Receivables are what others owe the event. Only confirmed receipts and released payments affect cash.";
  const icons={payables:"clock",expenses:"receipt",received:"check-circle",receivables:"download"};
  host.innerHTML=rows.length?rows.map(r=>{
    const actionButtons=[];
    if(canEditFinance()&&!r.busy){
      if(r.kind==="finance"){
        const item=r.item;
        if(item.type==="Payable"){
          if(r.released)actionButtons.push(iconAction("finance-undo-payout",item.id,"Undo payment release","restore"));
          else actionButtons.push(`<button class="small-btn finance-action-primary finance-release-payable" data-id="${esc(item.id)}" title="Confirm payment released">${icon("check-circle")}<span>Release Payment</span></button>`);
        }else if(item.type==="Receivables"){
          if(r.received)actionButtons.push(iconAction("finance-undo-receipt",item.id,"Undo received confirmation","restore"));
          else actionButtons.push(`<button class="small-btn finance-action-primary finance-receive" data-id="${esc(item.id)}" title="Confirm money received">${icon("check-circle")}<span>Received</span></button>`);
        }
        if(!r.released&&!r.received)actionButtons.push(iconAction("finance-edit",item.id,"Edit finance record","pencil"));
        if(canDeleteFinance(item)&&!r.released&&!r.received)actionButtons.push(iconAction("finance-delete",item.id,"Delete finance record","trash","danger-text"));
      }else{
        if(r.received)actionButtons.push(iconAction("finance-undo-registration",r.item.id,"Undo registration receipt","restore"));
        else actionButtons.push(`<button class="small-btn finance-action-primary finance-receive-registration" data-id="${esc(r.item.id)}" title="Confirm registration received">${icon("check-circle")}<span>Received</span></button>`);
      }
    }
    const label=r.item?.type==="Opening Balance"||r.item?.type==="Cash on Hand"?"OPENING FUNDS":r.category==="payables"?"PAYABLE":r.category==="receivables"?"RECEIVABLE":r.category==="expenses"?"EXPENSE":"RECEIVED";
    const date=String(r.date||"").slice(0,10);
    return `<article class="finance-record-card record-${r.category}" data-record-id="${esc(r.key)}">
      <span class="record-symbol">${icon(icons[r.category])}</span>
      <div class="record-main"><span class="record-type">${label}</span><strong>${esc(r.title)}</strong><small>${esc([r.meta,date].filter(Boolean).join(" · "))}</small></div>
      <div class="record-side"><strong class="record-amount">${r.category==="expenses"?"−":""}${money(r.amount)}</strong><span class="record-status">${esc(r.status)}</span></div>
      ${actionButtons.length?`<div class="record-actions">${actionButtons.join("")}</div>`:""}
    </article>`;
  }).join(""):'<div class="empty-state"><strong>No matching records</strong>Try another filter or add a finance entry.</div>';
  host.querySelectorAll(".finance-release-payable").forEach(b=>b.onclick=async()=>{
    const item=state.finance.find(x=>x.id===b.dataset.id);
    if(!item||item.type!=="Payable"||financePayoutPending(item.id))return;
    if(!await confirmAction(`Confirm ${money(item.amount)} released for ${item.description}? This will count as paid Expenses and reduce Cash Available.`))return;
    queueWrite("releasePayable",{payableId:item.id,date:TODAY()},null);
    toast("Payment release queued. Totals update after Sheets confirms it.");
  });
  host.querySelectorAll(".finance-undo-payout").forEach(b=>b.onclick=async()=>{
    const item=state.finance.find(x=>x.id===b.dataset.id);
    if(!item||financePayoutPending(item.id))return;
    if(!await confirmAction(`Undo release of ${money(item.amount)} for ${item.description}? This will restore the payable and Cash Available.`))return;
    queueWrite("reversePayableRelease",{payableId:item.id},null);
    toast("Undoing payment after Google Sheets confirmation…");
  });
  host.querySelectorAll(".finance-receive").forEach(b=>b.onclick=()=>{
    const item=state.finance.find(x=>x.id===b.dataset.id);if(item)receiveFinanceEditor(item);
  });
  host.querySelectorAll(".finance-undo-receipt").forEach(b=>b.onclick=async()=>{
    const item=state.finance.find(x=>x.id===b.dataset.id);if(!item||financeReceiptPending(item.id))return;
    if(!await confirmAction(`Undo receipt for ${money(item.amount)} — ${item.description}? This will reduce collected funds.`))return;
    queueWrite("reverseFinanceReceipt",{receivableId:item.id},null);
  });
  host.querySelectorAll(".finance-receive-registration").forEach(b=>b.onclick=()=>receiveRegistrationClick(b.dataset.id));
  host.querySelectorAll(".finance-undo-registration").forEach(b=>b.onclick=()=>reverseRegistrationClick(b.dataset.id));
  host.querySelectorAll(".finance-edit").forEach(b=>b.onclick=()=>financeEditor(state.finance.find(x=>x.id===b.dataset.id)));
  host.querySelectorAll(".finance-delete").forEach(b=>b.onclick=async()=>{
    const item=state.finance.find(x=>x.id===b.dataset.id);if(!item)return;
    if(!await confirmAction(`Delete ${money(item.amount)} — ${item.description}? This cannot be undone.`))return;
    queueWrite("deleteFinance",{id:item.id},()=>{state.finance=state.finance.filter(x=>x.id!==item.id)});
    toast("Finance record removed locally. Syncing in background…");
  });
}

function renderFood(){
  const done=state.foodItems.filter(item=>item.status==="Done").length,total=state.foodItems.length;
  // The contextual header above already shows Food progress; avoid duplicate summary tiles.
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

const REGISTRATION_TYPES=["Family","Working Adult","Non-Working Adult","Youth","Kids","Visitors"];
function canEditRegistration(r){return isManager()||r.registeredBy===state.user?.id}
function renderRegistration(){
  const list=$("#registrationList");if(!list)return;
  const rows=state.registrations.filter(r=>active(r.active));
  const headCount=rows.reduce((n,r)=>n+(Number(r.attendeeCount)||1),0);
  const calc=financeLedgerVerified?calculateFinance():null;
  const due=$("#registrationDueSummary");if(due)due.textContent=calc?money(calc.registrationOutstanding):"—";
  const paidSum=$("#registrationCollectedSummary");if(paidSum)paidSum.textContent=calc?money(calc.registrationCollected):"—";
  // Registration totals live in the contextual header; the category cards remain below.
  $("#registrationBreakdown").innerHTML=REGISTRATION_TYPES.map(type=>{
    const relevant=rows.filter(r=>r.registrationType===type);
    const participants=relevant.reduce((n,r)=>n+(Number(r.attendeeCount)||1),0);
    return `<div class="registration-type-stat"><strong>${participants}</strong><span>${esc(type)}</span></div>`;
  }).join("");
  const query=$("#registrationSearch").value.trim().toLocaleLowerCase();
  const type=$("#registrationTypeFilter").value;
  const visible=rows.filter(r=>(!type||r.registrationType===type)&&(!query||[r.name,r.registrationType,r.notes].some(x=>String(x||"").toLocaleLowerCase().includes(query))));
  list.innerHTML=visible.length?visible.sort((a,b)=>String(a.name).localeCompare(String(b.name),"en-PH")).map(r=>{
    const price=FinanceModel.registrationRate(r.registrationType);
    const payment=calc?.registrationPayments.get(String(r.id));
    const waiting=registrationPaymentPending(r.id)||!!r._syncState;
    const payAction=canEditFinance()&&calc&&!waiting&&price>0?(payment?
      iconAction("reverse-registration",r.id,"Undo received registration payment","rotate-ccw"):
      `<button type="button" class="small-btn finance-receive receive-registration" data-id="${esc(r.id)}" title="Confirm registration payment">${icon("check-circle")}<span>Received</span></button>`):"";
    const controls=`<div class="registration-row-actions">${payAction}${canEditRegistration(r)?iconAction("edit-registration",r.id,"Edit registration","pencil")+iconAction("archive-registration",r.id,"Remove registration","trash"):""}</div>`;
    const status=r._syncState?`<span class="registration-sync-label ${r._syncState}" role="status">${r._syncState==="failed"?"⚠ Needs sync":r._syncState==="saving"?"↻ Syncing…":"◷ Queued"}</span>`:"";
    return `<article class="registration-card"><div><strong>${esc(r.name)}</strong> ${status}<p class="muted">${esc(r.registrationType)}${Number(r.attendeeCount)>1?` · ${Number(r.attendeeCount)} attendees`:""} · ${price?money(price):"Free"} · ${price?(payment?`✓ Received ${esc(payment.date||"")}`:(waiting?"Syncing…":"Awaiting payment")):"No payment needed"}</p>${r.notes?`<p class="registration-notes">${esc(r.notes)}</p>`:""}<small class="muted">Registered by ${esc(r.registeredByName||"Unknown")} · ${esc(r.createdAt||"")}</small></div>${controls}</article>`;
  }).join(""):'<div class="empty-state">No matching registrations yet.</div>';
  list.querySelectorAll(".receive-registration").forEach(b=>b.onclick=()=>receiveRegistrationClick(b.dataset.id));
  list.querySelectorAll(".reverse-registration").forEach(b=>b.onclick=()=>reverseRegistrationClick(b.dataset.id));
  list.querySelectorAll(".edit-registration").forEach(b=>b.onclick=()=>openRegistrationEditor(rows.find(r=>r.id===b.dataset.id)));
  list.querySelectorAll(".archive-registration").forEach(b=>b.onclick=async()=>{
    const row=rows.find(r=>r.id===b.dataset.id);
    if(!row||registrationPaymentPending(row.id))return toast("Payment sync is in progress. Sync before removing this registration.");
    if(!await confirmAction(`Remove ${row.name} from attendance and finance totals? Any received payment will be reversed in the ledger. The audit record remains in Sheets.`))return;
    // A queued unsent registration can be cancelled locally without creating
    // an unnecessary add-then-delete race in Google Sheets.
    if(failedJobs.some(j=>registrationRecords(j).some(r=>r.id===row.id))){
      toast("Sync this unconfirmed registration before removing it.");return;
    }
    const buffered=registrationBuffer.find(j=>j.payload?.registration?.id===row.id);
    if(buffered){
      registrationBuffer=registrationBuffer.filter(j=>j!==buffered);
      pendingWrites--;changeVersion++;
      if(registrationFlushTimer&&!registrationBuffer.length){clearTimeout(registrationFlushTimer);registrationFlushTimer=null;}
      const serverRow=state.registrations.find(r=>r.id===row.id);
      if(serverRow&&String(serverRow.id).startsWith("WEB-")&&!row._everConfirmed){
        state.registrations=state.registrations.filter(r=>r.id!==row.id);
        persistOutbox();updateSaveState();renderRegistration();return;
      }
      // Existing records may still exist on the server; archive them.
    }
    queueWrite("deleteRegistration",{id:row.id},()=>{row.active=false});
  });
}
function openRegistrationEditor(item=null){
  if(!state.user)return openLogin();
  if(item&&!canEditRegistration(item))return toast("Only the registrar or Directors can edit this entry.");
  if(item?._syncState==="failed")return toast("Retry Sync before editing this unconfirmed registration.");
  if(item&&registrationPaymentPending(item.id))return toast("Payment update is still syncing. Try again shortly.");
  const form=$("#registrationForm");
  form.dataset.recordId=item?.id||"";
  form.dataset.needsSync="false";
  $("#registrationDialogTitle").textContent=item?"Edit registration":"Quick registration";
  $("#registrationNextBtn").classList.toggle("hidden",!!item);
  $("#registrationSaveCloseBtn").textContent=item?"Save changes":"Save & Close";
  $("#registrationName").value=item?.name||"";
  $("#registrationType").value=item?.registrationType||"Working Adult";
  $("#registrationAttendees").value=String(item?.attendeeCount||1);
  $("#registrationAttendees").disabled=$("#registrationType").value!=="Family";
  $("#registrationNotes").value=item?.notes||"";
  $("#registrationError").textContent="";
  setFormBusy(form,false);
  if(!$("#registrationDialog").open)$("#registrationDialog").showModal();
}
function saveRegistrationForm(event){
  event.preventDefault();
  const form=event.target;
  if(!state.user||!state.token){openLogin();return;}
  const old=state.registrations.find(r=>r.id===form.dataset.recordId);
  const record={id:old?.id||localId(),name:$("#registrationName").value.trim(),
    registrationType:$("#registrationType").value,attendeeCount:Number($("#registrationAttendees").value||1),
    notes:$("#registrationNotes").value.trim()};
  const error=$("#registrationError");error.textContent="";
  if(!record.name||record.name.length>120){error.textContent="Enter a name (up to 120 characters).";return;}
  if(!REGISTRATION_TYPES.includes(record.registrationType)){error.textContent="Choose a registration type.";return;}
  if(record.registrationType!=="Family")record.attendeeCount=1;
  if(!Number.isInteger(record.attendeeCount)||record.attendeeCount<1||record.attendeeCount>100){error.textContent="Family attendees must be 1–100.";return;}
  if(record.notes.length>350){error.textContent="Notes must be 350 characters or less.";return;}
  if(old&&financeLedgerVerified&&calculateFinance().registrationPayments.has(String(old.id))&&old.registrationType!==record.registrationType){
    error.textContent="Payment already received. Undo it before changing the registration type.";return;
  }
  if(!queueRegistrationWrite(record))return;
  const close=old||event.submitter?.id==="registrationSaveCloseBtn";
  if(close){$("#registrationDialog").close();}
  else{
    // Keep the form open and ready for the next person without waiting for Sheets.
    // Retain the selected category to reduce repetitive data entry.
    $("#registrationName").value="";
    $("#registrationNotes").value="";
    $("#registrationAttendees").value="1";
    $("#registrationName").focus();
  }
  toast(`Queued: ${record.name}. ${unsyncedCount()} change(s) pending background sync.`);
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

// Floating editor actions track the *visible* viewport while a mobile keyboard is open.
// No browser permission is needed; only viewport geometry is read.
function updateEditorKeyboardPosition(){
  const dialog=$("#editDialog");
  if(!dialog?.open)return;
  const mobile=window.matchMedia("(max-width: 700px)").matches;
  const vv=window.visualViewport;
  const lostHeight=vv?Math.max(0,window.innerHeight-vv.height-vv.offsetTop):0;
  const keyboardOpen=mobile&&lostHeight>110;
  // A bottom inset moves the Save/Cancel pill just above the soft keyboard.
  dialog.style.setProperty("--editor-keyboard-inset",(mobile?Math.round(lostHeight):0)+"px");
  dialog.style.setProperty("--editor-visible-height",Math.round(vv?.height||window.innerHeight)+"px");
  dialog.style.setProperty("--editor-visual-top",Math.round(vv?.offsetTop||0)+"px");
  dialog.classList.toggle("editing-keyboard",keyboardOpen);
}
function setupEditorKeyboardBar(){
  const dialog=$("#editDialog");
  const update=()=>{if(dialog.open)updateEditorKeyboardPosition()};
  window.visualViewport?.addEventListener("resize",update);
  window.visualViewport?.addEventListener("scroll",update);
  window.addEventListener("resize",update);
  dialog.addEventListener("close",()=>{
    dialog.classList.remove("editing-keyboard");
    dialog.style.removeProperty("--editor-keyboard-inset");
    dialog.style.removeProperty("--editor-visible-height");
    dialog.style.removeProperty("--editor-visual-top");
  });
  // Keep the focused field reachable when the keyboard obscures the lower form.
  dialog.addEventListener("focusin",event=>{
    if(!event.target.matches("input, textarea, select"))return;
    updateEditorKeyboardPosition();
    setTimeout(()=>{
      if(dialog.open&&document.activeElement===event.target){
        updateEditorKeyboardPosition();
        event.target.scrollIntoView({block:"nearest",behavior:"instant"});
      }
    },250);
  });
}

// Editors and forms
function fieldHtml(field,value){
  const v=value??field.value??"",required=field.required?" required":"";
  if(field.type==="hidden")return `<input type="hidden" name="${esc(field.name)}" value="${esc(v)}">`;
  if(field.type==="textarea")return `<label class="field"><span>${esc(field.label)}</span><textarea class="form-input" name="${esc(field.name)}" rows="3"${required}>${esc(v)}</textarea></label>`;
  if(field.type==="select")return `<label class="field"><span>${esc(field.label)}</span><select class="form-input" name="${esc(field.name)}"${required}>${field.options.map(option=>`<option value="${esc(option.value)}"${option.disabled?" disabled":""}${String(v)===String(option.value)?" selected":""}>${esc(option.label)}</option>`).join("")}</select></label>`;
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
  updateEditorKeyboardPosition();
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
    {name:"userId",label:member?"Replace with person":"Person",type:"select",required:true,options:[...(member?[]:[{value:"",label:"Choose a person…",disabled:true}]),...eligible.map(u=>({value:u.id,label:u.name}))]},
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
  // Go to tasks sets this same committee filter. Honor it for new tasks,
  // but never preselect a committee outside the current user's permissions.
  const selectedFilter=$("#taskCommitteeFilter")?.value||"";
  const suggestedCommittee=allowed.some(c=>c.id===selectedFilter)?selectedFilter:allowed[0].id;
  openEditor(t?"Edit task":"Create task",fields,"saveTask",t?{...t,addAssigneesAsSupport:true}:{committeeId:suggestedCommittee,assigneeIds:[],priority:"Normal",dueDate:"2026-12-10",addAssigneesAsSupport:true});
}
function financeEditor(entry=null){
  if(!canEditFinance())return toast("Only the Finance Heads or Directors may edit finance records.");
  if(entry?.type==="Receivables"&&calculateFinance().collected.has(String(entry.id)))
    return toast("Received funds are locked. Undo the receipt first to edit this receivable.");
  if(entry?.type==="Payable"&&calculateFinance().payablePayments.has(String(entry.id)))
    return toast("The payable has already been paid. Undo the release before editing.");
  const choices=[
    ["Receivables","Receivable — money owed TO the event"],
    ["Payable","Payable — reimbursement or credit, not yet paid"],
    ["Registration Collected","Registration — received"],
    ["Solicitation Collected","Solicitation — received"],
    ["Donation","Donation — received"],
    ["Other Received","Other money received"],
    ["Opening Balance","Opening balance"],
    ["Expense","Expense"],
    ...(entry?.type==="Cash on Hand"?[["Cash on Hand","Cash received (legacy)"]]:[]),
    ...(entry?.type==="Income"?[["Income","Income (legacy; excluded until reviewed)"]]:[])
  ];
  openEditor(entry?"Edit finance entry":"Add finance entry",[
    {name:"type",label:"Money type",type:"select",options:choices.map(([value,label])=>({value,label}))},
    {name:"amount",label:"Amount (PHP)",type:"number",min:0.01,step:0.01,required:true},
    {name:"description",label:"Details (include who is owed for payables)",required:true},
    {name:"date",label:"Date recorded",type:"date",required:true}
  ],"saveFinance",entry||{type:"Receivables",date:TODAY()});
}
function receiveFinanceEditor(entry){
  if(!canEditFinance()||!financeLedgerVerified)return toast("Finance data is still loading. Sync first.");
  const calc=calculateFinance();
  if(calc.collected.has(String(entry.id))||financeReceiptPending(entry.id))return;
  openEditor("Confirm received · "+money(entry.amount)+" · "+entry.description,[
    {name:"source",label:"Received from",type:"select",required:true,options:[
      {value:"",label:"Choose a source…",disabled:true},
      {value:"Registration",label:"Registration collected"},
      {value:"Solicitation",label:"Solicitation collected"},
      {value:"Donation",label:"Donation"},
      {value:"Other",label:"Other money received"}]},
    {name:"date",label:"Date received",type:"date",required:true}
  ],"receiveFinance",{id:entry.id,source:"",date:TODAY()});
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
    case "receiveFinance":{
      const entry=state.finance.find(e=>e.id===recordId&&e.type==="Receivables");
      if(!entry||financeReceiptPending(recordId))return;
      if(!data.source){$("#editError").textContent="Choose where the received money came from.";return;}
      payload={receivableId:recordId,source:data.source,date:data.date};optimistic=null;break;
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
  const queued=queueWrite(action,payload,optimistic);
  if(queued===false){$("#editError").textContent="This edit was not queued. Enable browser storage and try again.";return;}
  $("#editDialog").close();
  if(action==="saveMember"&&state.managingCommitteeId&&canManageMembers(state.managingCommitteeId))openMembers(state.managingCommitteeId);
  toast(action==="receiveFinance"?"Recording receipt in Google Sheets. It counts as collected only after confirmation…":"Updated instantly. Saving to Google Sheets in background…");
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
function committeeReportRows(detailed=false){
  const lines=[];
  const order={Blocked:0,Pending:1,"In Progress":2,Completed:3};
  state.committees.forEach((c,index)=>{
    const members=state.members.filter(m=>m.committeeId===c.id&&active(m.active));
    const heads=members.filter(m=>m.role==="Head");
    const helpers=members.filter(m=>m.role!=="Head");
    const tasks=state.tasks.filter(t=>t.committeeId===c.id).sort((a,b)=>(order[a.status]??2)-(order[b.status]??2)||String(a.dueDate||"9999").localeCompare(String(b.dueDate||"9999")));
    const open=tasks.filter(t=>t.status!=="Completed");
    const stats=committeeStats(c.id);
    lines.push("",`${index+1}. *${c.name}* · ${stats.completed}/${stats.total} done (${stats.percent}%)`);
    lines.push(`👤 Lead${heads.length===1?"":"s"}: ${heads.map(m=>m.name).join(", ")||"Unassigned"}`);
    if(detailed){
      if(c.description)lines.push(`🎯 ${String(c.description).trim()}`);
      if(helpers.length){lines.push("🤝 Support:");helpers.forEach(m=>lines.push(`  • ${m.name}${m.supportRole?` — ${m.supportRole}`:""}`));}
      else lines.push("🤝 Support: Not assigned");
      if(!tasks.length)lines.push("📝 No tasks assigned yet");
      else{
        lines.push(`📝 Tasks (${open.length} to do):`);
        tasks.forEach(t=>{
          const done=t.status==="Completed";
          lines.push(`  ${done?"✅":"☐"} ${t.title}${t.status==="Blocked"?" [BLOCKED]":""}${t.priority==="Urgent"?" [URGENT]":""}`);
          const assignees=Array.isArray(t.assigneeIds)?t.assigneeIds.map(userName):[];
          if(assignees.length)lines.push(`     Responsible: ${assignees.join(", ")}`);
          if(t.dueDate)lines.push(`     Due: ${shortDate(t.dueDate)}`);
          if(done&&t.completedByName)lines.push(`     Done by ${t.completedByName}${t.completedAt?` · ${formatCompletionDate(t.completedAt)}`:""}`);
          if(t.description)String(t.description).trim().split(/\r?\n/).forEach(line=>{if(line.trim())lines.push(`     ${line.trim()}`)});
        });
      }
    }else{
      if(helpers.length){
        const names=helpers.slice(0,4).map(m=>m.name);
        lines.push(`🤝 Support (${helpers.length}): ${names.join(", ")}${helpers.length>4?` +${helpers.length-4} others`:""}`);
      }
      if(open.length){
        lines.push(`📝 To do (${open.length}):`);
        open.slice(0,3).forEach(t=>{
          const names=Array.isArray(t.assigneeIds)?t.assigneeIds.slice(0,2).map(userName):[];
          lines.push(`  ☐ ${t.title}${names.length?` — ${names.join(", ")}`:""}${t.priority==="Urgent"?" ❗":""}`);
        });
        if(open.length>3)lines.push(`  + ${open.length-3} more tasks`);
      }else lines.push(tasks.length?"✅ All tasks complete":"📝 No tasks yet");
    }
  });
  return lines;
}
function buildCommitteeShareText(){
  const tasks=activeTasks(),done=tasks.filter(t=>t.status==="Completed").length;
  const lines=["🎄 *PASKO NG ANGKAN 2026*","*COMMITTEE RESPONSIBILITIES & TASKS*",`${state.committees.length} committees · ${done}/${tasks.length} tasks complete`];
  if(unsyncedCount())lines.push("⚠️ Some local changes are not yet confirmed by Google Sheets.");
  return [...lines,...committeeReportRows(true)].join("\n");
}
function buildCommitteeShareSimplifiedText(){
  const tasks=activeTasks(),done=tasks.filter(t=>t.status==="Completed").length;
  const lines=["🎄 *PASKO NG ANGKAN 2026*","*COMMITTEE QUICK UPDATE*",`${state.committees.length} committees · ${done}/${tasks.length} tasks complete`];
  if(unsyncedCount())lines.push("⚠️ Some local changes are not yet confirmed by Google Sheets.");
  return [...lines,...committeeReportRows(false)].join("\n");
}

let currentShareMode="simple";
function setShareMode(mode){
  currentShareMode=mode==="detailed"?"detailed":"simple";
  $$("#shareModeTabs [data-share-mode]").forEach(button=>{
    const selected=button.dataset.shareMode===currentShareMode;
    button.classList.toggle("active",selected);
    button.setAttribute("aria-selected",String(selected));
    button.tabIndex=selected?0:-1;
  });
  renderSharePreview();
}
function renderSharePreview(){
  const detailed=currentShareMode==="detailed";
  const body=detailed?buildCommitteeShareText():buildCommitteeShareSimplifiedText();
  const field=$("#shareText");
  if(field.value!==body)field.value=body;
  const warning=unsyncedCount()>0?` ${unsyncedCount()} change(s) are not yet confirmed; this preview includes local edits.`:"";
  $("#shareStatus").textContent=detailed
    ?`Detailed view: all ${state.committees.length} committees, Heads, support/sub-team responsibilities and individual tasks.${warning}`
    :`Simplified view: ${state.committees.length} committees with Heads, support members, progress and a short to-do summary.${warning}`;
  $("#sharePreviewLabel").textContent=detailed?"Detailed message · copy for group chat":"Simplified message · copy for group chat";
  $("#copyShareBtn").setAttribute("title",detailed?"Copy detailed report":"Copy simplified summary");
  $("#copyShareBtn").setAttribute("aria-label",detailed?"Copy detailed report":"Copy simplified summary");
  $("#shareText").setAttribute("aria-label",detailed?"Detailed committee report":"Simplified committee report");
}
function openShareDialog(){
  if(!state.user){toast("Sign in first to view and share the full committee report.");openLogin();return;}
  setShareMode("simple");
  if(!$("#shareDialog").open)$("#shareDialog").showModal();
}
async function copyShareReport(){
  const field=$("#shareText"),body=field.value;
  if(!body)return toast("Nothing to copy yet.");
  try{
    if(!navigator.clipboard?.writeText)throw new Error("Clipboard permission unavailable");
    await navigator.clipboard.writeText(body);
    toast(`${currentShareMode==="simple"?"Simplified":"Detailed"} report copied! Paste it in your group chat.`);
  }catch{
    field.focus();field.select();field.setSelectionRange(0,field.value.length);
    let copied=false;
    try{copied=document.execCommand("copy")}catch{}
    toast(copied?"Report copied! Paste it in your group chat.":"Select and copy the highlighted text manually.");
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
