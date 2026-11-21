const state={bootstrap:null,user:null,token:null,committees:[],members:[],tasks:[],updates:[],activity:[],activeTab:"committees"};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const initials=n=>(n||"?").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),3200)}
function statusClass(s){return s==="Completed"?"green":s==="Blocked"?"red":s==="In Progress"?"amber":"badge"}
function badge(s){return `<span class="badge ${statusClass(s)}">${esc(s||"Pending")}</span>`}
function userHeaders(){return {token:state.token,userId:state.user?.id}}
function isManager(){return ["Director","Assistant Director"].includes(state.user?.accessRole)}
function canManageCommittee(c){return isManager()||state.members.some(m=>m.committeeId===c.id&&m.userId===state.user?.id&&m.role==="Head")}
function canUpdateTask(t){return isManager()||state.members.some(m=>m.committeeId===t.committeeId&&m.userId===state.user?.id)}
function setConnection(text,good=false){$("#connectionState").textContent=text;$("#connectionState").style.color=good?"#16834b":""}
async function api(action,data={}){return Api.request(action,{...data,...(state.token?userHeaders():{})})}
async function init(){
  bindEvents();
  try{
    const b=await Api.request("bootstrap");
    if(!b.ok)throw new Error(b.error||"Bootstrap failed");
    state.bootstrap=b;state.committees=b.committees||[];state.members=b.members||[];
    $("#loginUser").innerHTML=(b.users||[]).filter(u=>u.active).map(u=>`<option value="${esc(u.id)}">${esc(u.name)} · ${esc(u.position||u.accessRole)}</option>`).join("");
    const saved=localStorage.getItem("pna_session");
    if(saved){try{const s=JSON.parse(saved);state.user=s.user;state.token=s.token;await refreshData();return;}catch(e){localStorage.removeItem("pna_session");}}
    setConnection("Sign in to update event records");openLogin();
    renderAll();
  }catch(e){setConnection("Database connection failed");toast(e.message);renderConnectionError(e.message)}
}
function renderConnectionError(message){$("#committeeList").innerHTML=`<div class="empty-state"><strong>Cannot connect to the event database</strong>${esc(message)}<br><br>Deploy the Apps Script backend and paste its URL into assets/js/api.js.</div>`}
async function refreshData(){
  const d=await api("getData");
  if(!d.ok)throw new Error(d.error||"Could not load data");
  state.committees=d.committees||[];state.members=d.members||[];state.tasks=d.tasks||[];state.updates=d.updates||[];state.activity=d.activity||[];
  setConnection(`Signed in as ${state.user.name}`,true);renderAll();
}
function bindEvents(){
  $$(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
  $("#refreshBtn").onclick=async()=>{try{await refreshData();toast("Data refreshed");}catch(e){toast(e.message)}};
  $("#profileBtn").onclick=()=>$("#profileMenu").classList.toggle("hidden");
  $("#editProfileBtn").onclick=()=>{ $("#profileMenu").classList.add("hidden");openLogin(true); };
  $("#signOutBtn").onclick=()=>{localStorage.removeItem("pna_session");state.user=null;state.token=null;$("#profileMenu").classList.add("hidden");openLogin();};
  $("#loginForm").onsubmit=login;
  $("#addCommitteeBtn").onclick=()=>committeeEditor();
  $("#addTaskBtn").onclick=()=>taskEditor();
  $("#taskCommitteeFilter").onchange=renderTasks;$("#taskStatusFilter").onchange=renderTasks;$("#taskSearch").oninput=renderTasks;
  $("#exportBtn").onclick=exportCsv;
  $$("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).close());
  $("#editForm").onsubmit=saveEditor;
  document.addEventListener("click",e=>{if(!e.target.closest("#profileMenu")&&!e.target.closest("#profileBtn"))$("#profileMenu").classList.add("hidden");});
}
function switchTab(tab){state.activeTab=tab;$$(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));$$(".tab-panel").forEach(p=>p.classList.toggle("active",p.id==="tab-"+tab));}
function openLogin(edit=false){$("#loginTitle").textContent=edit?"Switch user / profile":"Identify yourself";$("#loginPin").value="";$("#loginError").textContent="";$("#loginDialog").showModal();}
async function login(e){
  e.preventDefault();$("#loginError").textContent="";
  try{
    const result=await Api.request("login",{userId:$("#loginUser").value,pin:$("#loginPin").value});
    if(!result.ok)throw new Error(result.error||"Sign-in failed");
    state.user=result.user;state.token=result.token;localStorage.setItem("pna_session",JSON.stringify({user:state.user,token:state.token}));
    $("#loginDialog").close();await refreshData();renderProfile();toast(`Welcome, ${state.user.name}`);
  }catch(err){$("#loginError").textContent=err.message;}
}
function renderProfile(){
  $("#profileName").textContent=state.user?.name||"Sign in";$("#avatar").textContent=initials(state.user?.name);
  $("#menuUserName").textContent=state.user?.name||"Guest";$("#menuUserRole").textContent=state.user?`${state.user.position||state.user.accessRole} · ${state.user.accessRole}`:"Not signed in";
  $$(".admin-only").forEach(el=>el.classList.toggle("hidden",!isManager()));
}
function renderAll(){renderProfile();renderSummary();renderCommittees();renderTasks();renderReports();populateFilters();}
function renderSummary(){
  const total=state.tasks.length,completed=state.tasks.filter(t=>t.status==="Completed").length;
  $("#sumCommittees").textContent=state.committees.length;$("#sumTasks").textContent=total;$("#sumCompleted").textContent=completed;
  $("#sumPending").textContent=state.tasks.filter(t=>["Pending","Blocked"].includes(t.status)).length;
}
function committeeProgress(id){const ts=state.tasks.filter(t=>t.committeeId===id);if(!ts.length)return 0;return Math.round(ts.reduce((a,t)=>a+(Number(t.progress)||0),0)/ts.length)}
function committeeName(id){return state.committees.find(c=>c.id===id)?.name||"Unassigned"}
function committeeMembers(id){return state.members.filter(m=>m.committeeId===id).map(m=>`${m.name} (${m.role})`)}
function renderCommittees(){
  const host=$("#committeeList");
  if(!state.committees.length){host.innerHTML='<div class="empty-state"><strong>No committees found</strong>Ask the administrator to initialize the database.</div>';return;}
  host.innerHTML=state.committees.map(c=>{
    const ms=state.members.filter(m=>m.committeeId===c.id),heads=ms.filter(m=>m.role==="Head").map(m=>m.name);
    const pct=committeeProgress(c.id);
    return `<article class="committee-card" data-committee="${esc(c.id)}"><div class="card-top"><div><h3>${esc(c.name)}</h3><div class="head-line">Head: ${esc(heads.join(", ")||"To be assigned")}</div></div>${badge(c.active===false?"Inactive":"Active")}</div>
      <div class="progress-row"><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><span class="progress-value">${pct}%</span></div>
      <div class="member-line">${ms.length?ms.map(m=>`<span class="member-pill">${esc(m.name)} · ${esc(m.role)}</span>`).join(""):"No members assigned"}</div>
      ${canManageCommittee(c)?'<div class="task-actions"><button class="small-btn primary edit-committee">Manage members / edit</button></div>':""}</article>`;
  }).join("");
  host.querySelectorAll(".committee-card").forEach(card=>card.addEventListener("click",e=>{if(e.target.closest("button"))return;$("#taskCommitteeFilter").value=card.dataset.committee;switchTab("tasks");renderTasks();}));
  host.querySelectorAll(".edit-committee").forEach((b,i)=>b.onclick=e=>{e.stopPropagation();const c=state.committees[i];committeeEditor(c);});
}
function populateFilters(){
  $("#taskCommitteeFilter").innerHTML='<option value="">All committees</option>'+state.committees.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
}
function renderTasks(){
  const cid=$("#taskCommitteeFilter").value,status=$("#taskStatusFilter").value,q=$("#taskSearch").value.toLowerCase();
  const list=state.tasks.filter(t=>(!cid||t.committeeId===cid)&&(!status||t.status===status)&&(!q||(t.title+" "+(t.description||"")+" "+committeeName(t.committeeId)).toLowerCase().includes(q)));
  $("#taskList").innerHTML=list.length?list.map(t=>{
    const assigned=(t.assigneeIds||[]).map(id=>state.bootstrap.users.find(u=>u.id===id)?.name||id).join(", ")||"Not assigned";
    return `<article class="task-card"><div class="task-card-top"><div><h3>${esc(t.title)}</h3><div class="task-meta"><span>${esc(committeeName(t.committeeId))}</span><span>·</span><span>Assigned: ${esc(assigned)}</span></div></div>${badge(t.status)}</div>
      ${t.description?`<p class="muted" style="margin-top:9px">${esc(t.description)}</p>`:""}
      <div class="progress-row"><div class="progress-track"><div class="progress-fill" style="width:${Number(t.progress)||0}%"></div></div><span class="progress-value">${Number(t.progress)||0}%</span></div>
      <div class="task-meta" style="margin-top:8px"><span>Due: ${esc(t.dueDate||"Not set")}</span><span>·</span><span>Priority: ${esc(t.priority||"Normal")}</span></div>
      ${t.latestUpdate?`<div class="task-note">Latest update: ${esc(t.latestUpdate)}</div>`:""}
      <div class="task-actions">${canUpdateTask(t)?`<button class="small-btn primary update-task" data-id="${esc(t.id)}">Update progress</button>`:""}${isManager()?`<button class="small-btn edit-task" data-id="${esc(t.id)}">Edit task</button>`:""}<button class="small-btn history-task" data-id="${esc(t.id)}">Update history</button></div>
    </article>`;
  }).join(""):'<div class="empty-state"><strong>No tasks match</strong>Try changing your filters or add a task.</div>';
  $$(".update-task").forEach(b=>b.onclick=()=>updateTaskEditor(state.tasks.find(t=>t.id===b.dataset.id)));
  $$(".edit-task").forEach(b=>b.onclick=()=>taskEditor(state.tasks.find(t=>t.id===b.dataset.id)));
  $$(".history-task").forEach(b=>b.onclick=()=>showHistory(b.dataset.id));
}
function renderReports(){
  const total=state.tasks.length,done=state.tasks.filter(t=>t.status==="Completed").length,blocked=state.tasks.filter(t=>t.status==="Blocked").length,pending=state.tasks.filter(t=>t.status==="Pending").length;
  const pct=total?Math.round(state.tasks.reduce((a,t)=>a+(Number(t.progress)||0),0)/total):0;
  $("#reportOverview").innerHTML=`<div class="completion-card"><span class="muted">Overall task progress</span><strong>${pct}%</strong><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></div><div class="report-stats"><div class="report-stat"><span>Total tasks</span><strong>${total}</strong></div><div class="report-stat"><span>Completed</span><strong style="color:var(--green)">${done}</strong></div><div class="report-stat"><span>Pending</span><strong style="color:var(--amber)">${pending}</strong></div><div class="report-stat"><span>In progress</span><strong>${state.tasks.filter(t=>t.status==="In Progress").length}</strong></div><div class="report-stat"><span>Blocked</span><strong style="color:var(--red)">${blocked}</strong></div><div class="report-stat"><span>Committees</span><strong>${state.committees.length}</strong></div></div>`;
  $("#reportCommittees").innerHTML=state.committees.map(c=>`<div class="report-line"><div class="report-line-head"><strong>${esc(c.name)}</strong><span>${committeeProgress(c.id)}%</span></div><div class="progress-track"><div class="progress-fill" style="width:${committeeProgress(c.id)}%"></div></div></div>`).join("")||'<p class="muted">No committees.</p>';
  const attention=state.tasks.filter(t=>["Pending","Blocked"].includes(t.status)||(t.dueDate&&new Date(t.dueDate+"T23:59:59")<new Date()&&t.status!=="Completed"));
  $("#reportPending").innerHTML=attention.length?attention.map(t=>`<div class="attention-item"><strong>${esc(t.title)} ${badge(t.status)}</strong><small>${esc(committeeName(t.committeeId))} · Due ${esc(t.dueDate||"No deadline")}</small></div>`).join(""):'<div class="empty-state">No pending or blocked tasks.</div>';
  $("#activityList").innerHTML=state.activity.slice(0,12).map(a=>`<div class="activity-item"><strong>${esc(a.actorName||"Member")}</strong> ${esc(a.message||"updated a record")}<br><small>${esc(a.timestamp||"")}</small></div>`).join("")||'<p class="muted">No activity recorded yet.</p>';
}
function openEditor(title,fields,submitAction,initial={}){
  $("#editTitle").textContent=title;$("#editError").textContent="";$("#editFields").innerHTML=fields.map(f=>fieldHtml(f,initial[f.name])).join("");
  $("#editForm").dataset.action=submitAction;$("#editForm").dataset.recordId=initial.id||"";$("#editDialog").showModal();
}
function fieldHtml(f,value){
  const v=value??f.value??"";
  if(f.type==="textarea")return `<label class="field"><span>${esc(f.label)}</span><textarea class="form-input" name="${esc(f.name)}" rows="3" ${f.required?"required":""}>${esc(v)}</textarea></label>`;
  if(f.type==="select")return `<label class="field"><span>${esc(f.label)}</span><select class="form-input" name="${esc(f.name)}" ${f.required?"required":""}>${f.options.map(o=>`<option value="${esc(o.value)}" ${String(v)===String(o.value)?"selected":""}>${esc(o.label)}</option>`).join("")}</select></label>`;
  if(f.type==="multi")return `<label class="field"><span>${esc(f.label)}</span><select class="form-input" name="${esc(f.name)}" multiple size="5">${f.options.map(o=>`<option value="${esc(o.value)}" ${(Array.isArray(v)?v:[]).includes(o.value)?"selected":""}>${esc(o.label)}</option>`).join("")}</select><small class="form-hint">Use Ctrl/Command to select multiple people on desktop.</small></label>`;
  return `<label class="field"><span>${esc(f.label)}</span><input class="form-input" name="${esc(f.name)}" type="${f.type||"text"}" value="${esc(Array.isArray(v)?v.join(","):v)}" ${f.required?"required":""} ${f.min!==undefined?`min="${f.min}"`:""} ${f.max!==undefined?`max="${f.max}"`:""}></label>`;
}
function committeeEditor(c=null){
  if(!isManager())return toast("Only event management can add committees.");
  const fields=[{name:"name",label:"Committee name",required:true},{name:"description",label:"Description",type:"textarea"}];
  openEditor(c?"Edit committee":"Add committee",fields,"saveCommittee",c||{});
}
function taskEditor(t=null){
  if(!state.user)return openLogin();
  if(t&&!isManager())return toast("Only event management can edit task details.");
  const fields=[
    {name:"title",label:"Task title",required:true},{name:"committeeId",label:"Committee",type:"select",required:true,options:state.committees.map(c=>({value:c.id,label:c.name}))},
    {name:"description",label:"Description",type:"textarea"},
    {name:"assigneeIds",label:"Assigned members",type:"multi",options:state.bootstrap.users.filter(u=>u.active).map(u=>({value:u.id,label:u.name})) ,value:t?.assigneeIds||[]},
    {name:"priority",label:"Priority",type:"select",options:["Low","Normal","High","Urgent"].map(x=>({value:x,label:x}))},
    {name:"dueDate",label:"Due date",type:"date"}
  ];
  openEditor(t?"Edit task":"Create task",fields,"saveTask",t||{priority:"Normal",dueDate:"2026-12-10"});
}
function updateTaskEditor(t){
  const fields=[
    {name:"status",label:"Status",type:"select",options:["Pending","In Progress","Blocked","Completed"].map(x=>({value:x,label:x}))},
    {name:"progress",label:"Progress (%)",type:"number",min:0,max:100},
    {name:"updateNote",label:"Progress update / comment",type:"textarea",required:true}
  ];
  openEditor("Update task progress",fields,"updateTask",{...t,updateNote:""});
}
async function saveEditor(e){
  e.preventDefault();const action=e.target.dataset.action,recordId=e.target.dataset.recordId;
  const data={};new FormData(e.target).forEach((v,k)=>data[k]=v);
  e.target.querySelectorAll('select[multiple]').forEach(el=>data[el.name]=[...el.selectedOptions].map(o=>o.value));
  if(recordId)data.id=recordId;
  try{
    let result;
    if(action==="saveCommittee")result=await api("saveCommittee",{committee:data});
    if(action==="saveTask")result=await api("saveTask",{task:data});
    if(action==="updateTask")result=await api("updateTask",{taskId:recordId,update:{status:data.status,progress:Number(data.progress),note:data.updateNote}});
    if(!result?.ok)throw new Error(result?.error||"Save failed");
    $("#editDialog").close();await refreshData();toast("Changes saved");
  }catch(err){$("#editError").textContent=err.message;}
}
async function showHistory(taskId){
  try{const r=await api("getTaskUpdates",{taskId});const items=r.updates||[];openEditor("Task update history",[{name:"history",label:"Updates",type:"textarea"}],"noop",{history:items.map(x=>`${x.timestamp} — ${x.actorName}: ${x.status}, ${x.progress}%\n${x.note}`).join("\n\n")||"No updates yet."});$("#editForm").querySelector('[name="history"]').readOnly=true;$("#editForm").querySelector('button[type="submit"]').classList.add("hidden");}
  catch(e){toast(e.message)}
}
function exportCsv(){
  const rows=[["Committee","Task","Assignees","Status","Progress","Priority","Due date"],...state.tasks.map(t=>[committeeName(t.committeeId),t.title,(t.assigneeIds||[]).map(id=>state.bootstrap.users.find(u=>u.id===id)?.name||id).join("; "),t.status,t.progress,t.priority,t.dueDate])];
  const csv=rows.map(r=>r.map(x=>'"'+String(x??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="pasko-ng-angkan-2026-report.csv";a.click();URL.revokeObjectURL(a.href);
}
init();
