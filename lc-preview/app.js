// Living Culture client. All authorization is enforced by Supabase RLS, not the UI.
const cfg = window.LC_CONFIG || {};
const $ = (id) => document.getElementById(id);
const ready = /^https:\/\/.+\.supabase\.co\/?$/.test(cfg.supabaseUrl||"") && !!cfg.supabasePublishableKey;
const tz = "Africa/Johannesburg";
let db=null, currentUser=null, admin=false, events=[], notices=[], captchaToken="";
let viewDate=new Date(), year=viewDate.getFullYear(), month=viewDate.getMonth();
const show=(id,visible)=>{const el=$(id);if(el)el.hidden=!visible;};
const status=(id,text)=>{if($(id))$(id).textContent=text;};
function fmt(iso){return new Date(iso).toLocaleString("en-ZA",{timeZone:tz,dateStyle:"medium",timeStyle:"short"});}
function dateKey(iso){const parts=new Intl.DateTimeFormat("en-GB",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(iso));const obj=Object.fromEntries(parts.map(x=>[x.type,x.value]));return obj.year+"-"+obj.month+"-"+obj.day;}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function drawCalendar(){
 const first=new Date(year,month,1),total=new Date(year,month+1,0).getDate();
 $("month").textContent=first.toLocaleDateString("en-ZA",{month:"long",year:"numeric"});
 const names=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
 let html=names.map(x=>'<div class="day heading">'+x+'</div>');
 for(let n=0;n<first.getDay();n++)html.push('<div class="day" aria-hidden="true"></div>');
 for(let day=1;day<=total;day++){
   const key=year+"-"+String(month+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");
   const isThu=new Date(year,month,day).getDay()===4;
   const special=events.filter(e=>dateKey(e.starts_at)===key);
   const detail=[];
   if(isThu)detail.push("Bible study 19:00");
   for(const e of special)detail.push(escapeHtml(e.title));
   html.push('<div class="day'+(detail.length?' study':'')+'">'+day+
    detail.map(label=>'<span class="small">'+label+'</span>').join("")+'</div>');
 }
 $("dates").innerHTML=html.join("");
}
$("year").textContent=new Date().getFullYear();
$("prev").addEventListener("click",()=>{month--;if(month<0){month=11;year--;}drawCalendar();});
$("next").addEventListener("click",()=>{month++;if(month>11){month=0;year++;}drawCalendar();});
drawCalendar();
function showPublicEvents(){
 document.querySelectorAll(".live-event").forEach(el=>el.remove());
 const container=document.querySelector("#events .grid");
 for(const e of events.slice(0,12)){
   const card=document.createElement("article");card.className="card live-event";
   const tag=document.createElement("div");tag.className="tag";tag.textContent=fmt(e.starts_at);
   const title=document.createElement("h3");title.textContent=e.title;
   const desc=document.createElement("p");desc.textContent=(e.venue?e.venue+" — ":"")+(e.details||"");
   card.append(tag,title,desc);container.append(card);
 }
}
function showNotices(){
 const list=$("notice-list");list.replaceChildren();
 if(!notices.length){const p=document.createElement("p");p.className="muted";p.textContent="Announcements will appear here soon.";list.append(p);return;}
 for(const n of notices){
  const card=document.createElement("article");card.className="card";
  const h=document.createElement("h3");h.textContent=n.title;
  const body=document.createElement("p");body.textContent=n.body;
  const small=document.createElement("div");small.className="tag";small.textContent="ANNOUNCEMENT";
  card.append(small,h,body);list.append(card);
 }
}
async function loadPublic(){
 if(!db)return;
 const [a,b]=await Promise.all([
  db.from("lc_events").select("id,title,details,venue,starts_at").eq("is_published",true).gte("starts_at",new Date(Date.now()-86400000*30).toISOString()).order("starts_at",{ascending:true}).limit(200),
  db.from("lc_notices").select("id,title,body,created_at").eq("is_published",true).order("created_at",{ascending:false}).limit(50)
 ]);
 if(a.error)console.error("Events:",a.error.message);else events=a.data||[];
 if(b.error)console.error("Notices:",b.error.message);else notices=b.data||[];
 drawCalendar();showPublicEvents();showNotices();
}
async function showSession(){
 const {data,error}=await db.auth.getUser();
 currentUser=error?null:(data.user||null);
 admin=false;
 if(currentUser){
   const role=await db.rpc("lc_is_admin");
   if(role.error)console.error("Admin check:",role.error.message);
   admin=role.data===true;
 }
 show("auth-forms",!currentUser);
 show("signed-in",!!currentUser);
 show("admin-panel",!!currentUser&&admin);
 if(currentUser){
   status("signed-in-email",currentUser.email||"Signed-in member");
   status("member-role",admin?"ADMINISTRATOR":"COMMUNITY MEMBER");
 }
 if(admin)await loadAdmin();else{
   $("manage-events").replaceChildren();
   $("manage-notices").replaceChildren();
   $("admin-inquiries").replaceChildren();
 }
}
function listRow(parent,title,sub,id,table){
 const row=document.createElement("div");row.className="admin-row";
 const desc=document.createElement("div");desc.className="item-summary";
 const b=document.createElement("strong");b.textContent=title;
 const small=document.createElement("small");small.textContent=sub;
 desc.append(b,document.createElement("br"),small);
 const del=document.createElement("button");del.type="button";del.textContent="Delete";
 del.addEventListener("click",async ()=>{
   if(!confirm("Permanently delete this item?"))return;
   const {error}=await db.from(table).delete().eq("id",id);
   if(error){alert(error.message);return;}
   await loadPublic();await loadAdmin();
 });
 row.append(desc,del);parent.append(row);
}
async function loadAdmin(){
 const [a,b,c]=await Promise.all([
   db.from("lc_events").select("id,title,starts_at,venue").order("starts_at",{ascending:false}).limit(100),
   db.from("lc_notices").select("id,title,created_at").order("created_at",{ascending:false}).limit(100),
   db.from("lc_inquiries").select("id,kind,full_name,email,message,keep_private,created_at").order("created_at",{ascending:false}).limit(30)
 ]);
 const eventBox=$("manage-events"),noticeBox=$("manage-notices"),inquiryBox=$("admin-inquiries");
 eventBox.replaceChildren();noticeBox.replaceChildren();inquiryBox.replaceChildren();
 if(a.error)status("event-status",a.error.message);
 else for(const e of a.data||[])listRow(eventBox,e.title,fmt(e.starts_at),e.id,"lc_events");
 if(b.error)status("notice-status",b.error.message);
 else for(const n of b.data||[])listRow(noticeBox,n.title,fmt(n.created_at),n.id,"lc_notices");
 if(c.error){const p=document.createElement("p");p.textContent=c.error.message;inquiryBox.append(p);}
 else for(const x of c.data||[]){
   const article=document.createElement("article");article.className="request-card";
   const title=document.createElement("h3");title.textContent=(x.kind==="prayer"?"Prayer request":"Faith & life question")+" · "+x.full_name;
   const meta=document.createElement("p");meta.className="muted";
   const link=document.createElement("a");link.href="mailto:"+encodeURIComponent(x.email);link.textContent=x.email;
   meta.append(link,document.createTextNode(" · "+fmt(x.created_at)+(x.keep_private?" · PRIVATE":"")));
   const message=document.createElement("pre");message.textContent=x.message;
   article.append(title,meta,message);inquiryBox.append(article);
 }
 if(!c.error&&!(c.data||[]).length)status("admin-inquiries","No requests received yet.");
}
function wireAuth(){
 $("login-form").addEventListener("submit",async e=>{
   e.preventDefault();const f=new FormData(e.currentTarget);
   status("login-status","Signing in...");
   const {error}=await db.auth.signInWithPassword({email:String(f.get("email")),password:String(f.get("password"))});
   e.currentTarget.querySelector('input[name="password"]').value="";
   status("login-status",error?error.message:"Signed in.");
   if(!error)await showSession();
 });
 $("signup-form").addEventListener("submit",async e=>{
   e.preventDefault();const f=new FormData(e.currentTarget);
   status("signup-status","Creating account...");
   const {error}=await db.auth.signUp({
     email:String(f.get("email")),password:String(f.get("password")),
     options:{data:{full_name:String(f.get("name"))},emailRedirectTo:location.origin+location.pathname}
   });
   e.currentTarget.querySelector('input[name="password"]').value="";
   status("signup-status",error?error.message:"Check your email for a verification link.");
 });
 $("logout-btn").addEventListener("click",async()=>{await db.auth.signOut();await showSession();});
 $("event-form").addEventListener("submit",async e=>{
   e.preventDefault();
   if(!admin)return;
   const f=new FormData(e.currentTarget);
   const start=String(f.get("starts"));
   const startsAt=new Date(start+":00+02:00");
   if(Number.isNaN(startsAt.valueOf())){status("event-status","Invalid event date.");return;}
   const {error}=await db.from("lc_events").insert({
     title:String(f.get("title")).trim(),details:String(f.get("details")).trim(),
     venue:String(f.get("venue")).trim(),starts_at:startsAt.toISOString(),is_published:true
   });
   status("event-status",error?error.message:"Event published.");
   if(!error){e.currentTarget.reset();await loadPublic();await loadAdmin();}
 });
 $("notice-form").addEventListener("submit",async e=>{
   e.preventDefault();
   if(!admin)return;
   const f=new FormData(e.currentTarget),expiry=String(f.get("expiry"));
   const {error}=await db.from("lc_notices").insert({
     title:String(f.get("title")).trim(),body:String(f.get("body")).trim(),is_published:true,
     expires_at:expiry?new Date(expiry+"T23:59:59+02:00").toISOString():null
   });
   status("notice-status",error?error.message:"Notice published.");
   if(!error){e.currentTarget.reset();await loadPublic();await loadAdmin();}
 });
}
function setupTurnstile(){
 if(!cfg.turnstileSiteKey)return;
 const script=document.createElement("script");
 script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
 script.async=true;
 script.onload=()=>{
  window.turnstile.render("#captcha-area",{
   sitekey:cfg.turnstileSiteKey,
   callback:token=>{captchaToken=token;},
   "expired-callback":()=>{captchaToken="";}
  });
  $("inquiry-submit").disabled=false;
  status("inquiry-status","Your request is sent privately to ministry leadership.");
 };
 script.onerror=()=>status("inquiry-status","Unable to load security verification.");
 document.head.append(script);
}
function wireRequests(){
 $("inquiry-form").addEventListener("submit",async e=>{
  e.preventDefault();if(!captchaToken){status("inquiry-status","Please complete human verification.");return;}
  const btn=$("inquiry-submit");btn.disabled=true;status("inquiry-status","Sending securely...");
  const f=new FormData(e.currentTarget);
  try{
    const resp=await fetch(cfg.supabaseUrl.replace(/\/$/,"")+"/functions/v1/submit-inquiry",{
     method:"POST",headers:{"Content-Type":"application/json","apikey":cfg.supabasePublishableKey},
     body:JSON.stringify({
       kind:String(f.get("kind")),full_name:String(f.get("full_name")),
       email:String(f.get("email")),message:String(f.get("message")),
       keep_private:!!f.get("keep_private"),consent:!!f.get("consent"),
       website:String(f.get("website")||""),captcha:captchaToken
     })
    });
    const result=await resp.json();
    status("inquiry-status",result.message||"Request could not be sent.");
    if(resp.ok)e.currentTarget.reset();
  }catch(err){status("inquiry-status","Could not connect. Please try again later.");}
  captchaToken="";
  if(window.turnstile)window.turnstile.reset("#captcha-area");
  btn.disabled=false;
 });
}
async function init(){
 if(!ready){console.info("Living Culture: Supabase backend not configured yet.");return;}
 try{
  const pkg=await import("https://esm.sh/@supabase/supabase-js@2.57.0");
  db=pkg.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
  show("auth-unconfigured",false);
  wireAuth();wireRequests();setupTurnstile();
  await loadPublic();await showSession();
  db.auth.onAuthStateChange(()=>{setTimeout(showSession,0);});
 }catch(err){console.error("Failed to initialize Living Culture backend.",err);}
}
init();
