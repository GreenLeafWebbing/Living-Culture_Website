// Living Culture portal. Browser keys are public. Database permissions are enforced by Supabase RLS.
const cfg=window.LC_CONFIG||{};
const ready=Boolean(cfg.supabaseUrl&&cfg.supabasePublishableKey);
const byId=id=>document.getElementById(id);
const show=(id,value)=>byId(id)?.classList.toggle("lc-hidden",!value);
const say=(id,msg)=>{const e=byId(id);if(e)e.textContent=msg;};
const main=document.querySelector("main");
document.querySelector("nav")?.insertAdjacentHTML("beforeend",'<a href="#contact">Prayer &amp; Questions</a>');
document.querySelector("#members .wrap")?.insertAdjacentHTML("beforeend",[
'<div class="lc-box" id="lc-account-box"><h3>Member sign in</h3>',
'<p class="lc-muted">Create a Living Culture account using your own email. Email verification is required.</p>',
'<form id="lc-auth-form" class="lc-form">',
'<label>Email address<input id="lc-auth-email" type="email" autocomplete="email" required maxlength="254"></label>',
'<label>Password<input id="lc-auth-password" type="password" autocomplete="current-password" required minlength="12"></label>',
'<div class="lc-actions"><button class="lc-action" id="lc-login" type="submit">Sign in</button>',
'<button class="lc-action secondary" id="lc-signup" type="button">Create account</button></div>',
'<p id="lc-auth-status" role="status" class="lc-status"></p></form></div>',
'<div class="lc-box lc-hidden" id="lc-account-status"><div class="lc-inline"><p id="lc-user-email"></p>',
'<button class="lc-action secondary" id="lc-logout" type="button">Sign out</button></div></div>',
'<section id="lc-admin" class="lc-hidden"><div class="eyebrow">Leadership tools</div>',
'<h2>Admin dashboard</h2><p class="lc-muted">Only verified accounts explicitly granted admin privileges can edit content or read private requests.</p>',
'<div class="lc-grid"><form id="lc-event-form" class="lc-form lc-box"><h3>Publish an event</h3>',
'<label>Event title<input name="title" required maxlength="140" minlength="3"></label>',
'<label>Start date and time (South Africa)<input name="starts_at" type="datetime-local" required></label>',
'<label>Venue<input name="venue" maxlength="150"></label>',
'<label>Details<textarea name="details" maxlength="6000"></textarea></label>',
'<button class="lc-action" type="submit">Add event</button><p id="lc-event-status" class="lc-status" role="status"></p></form>',
'<form id="lc-notice-form" class="lc-form lc-box"><h3>Publish a notice</h3>',
'<label>Notice title<input name="title" required maxlength="140" minlength="3"></label>',
'<label>Announcement<textarea name="body" required maxlength="6000"></textarea></label>',
'<label>Expiry date (optional)<input name="expires_at" type="date"></label>',
'<button class="lc-action" type="submit">Publish notice</button><p id="lc-notice-status" class="lc-status" role="status"></p></form></div>',
'<div class="lc-grid"><div class="lc-box"><h3>Manage events</h3><div id="lc-admin-events" class="lc-feed"></div></div>',
'<div class="lc-box"><h3>Manage notices</h3><div id="lc-admin-notices" class="lc-feed"></div></div></div>',
'<div class="lc-box"><h3>Confidential prayer requests and questions</h3>',
'<p class="lc-disclaimer">These messages may contain sensitive personal information. Access them privately, and do not share without consent.</p>',
'<div id="lc-inbox" class="lc-feed"></div></div></section>'
].join(""));
main.insertAdjacentHTML("beforeend",[
'<section id="contact" class="section lc-portal"><div class="wrap"><div class="eyebrow">We are here for you</div>',
'<h2>Prayer requests &amp; life questions</h2>',
'<p class="lead">Need prayer? Have a deep question about faith or life? You can write to the Living Culture leadership team in confidence.</p>',
'<div class="lc-grid"><div class="lc-box"><form id="lc-request-form" class="lc-form">',
'<label>What would you like to share?<select name="kind"><option value="prayer">Prayer request</option>',
'<option value="question">Question about faith or life</option></select></label>',
'<label>Your name<input name="full_name" required maxlength="100"></label>',
'<label>Your email<input name="email" type="email" autocomplete="email" required maxlength="254"></label>',
'<label>Your message<textarea name="message" required minlength="10" maxlength="5000"></textarea></label>',
'<label class="lc-checkbox"><input name="keep_private" type="checkbox" checked>Keep my request confidential within the authorized ministry leadership team</label>',
'<label class="lc-checkbox"><input name="consent" type="checkbox" required>I consent to Living Culture using my details only to review and respond to my request.</label>',
'<div aria-hidden="true" style="position:absolute;left:-10000px"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>',
'<div id="lc-captcha"></div>',
'<button class="lc-action" id="lc-request-submit" type="submit">Send confidential request</button>',
'<p id="lc-request-status" role="status" class="lc-status"></p></form></div>',
'<aside class="lc-box"><h3>A safe place to ask.</h3>',
'<p class="muted">Only approved leaders can view submitted requests. We will not post your personal message on the notice board.</p>',
'<p class="lc-disclaimer">Do not use this form for emergencies. If someone is in immediate danger, contact local emergency services directly.</p></aside></div></div></section>'
].join(""));
document.querySelector("#events .wrap")?.insertAdjacentHTML("beforeend",'<div id="lc-live-events" class="lc-feed"></div>');
document.querySelector("#notices .wrap")?.insertAdjacentHTML("beforeend",'<div id="lc-live-notices" class="lc-feed"></div>');
let db=null,currentUser=null,isAdmin=false,captchaWidget=null,captchaToken="";
const textNode=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text||"";if(cls)el.className=cls;return el;};
const dateText=s=>new Date(s).toLocaleString("en-ZA",{timeZone:"Africa/Johannesburg",weekday:"short",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
const itemNode=(item,type,manage=false)=>{
 const article=document.createElement("article");article.className="lc-entry";
 article.append(textNode("h4",item.title||"Untitled"));
 if(type==="event")article.append(textNode("time",dateText(item.starts_at)+" SAST"+(item.venue?" · "+item.venue:"")));
 else if(item.expires_at)article.append(textNode("time","Expires "+dateText(item.expires_at)));
 article.append(textNode("p",type==="event"?item.details:item.body));
 if(manage){
   const del=document.createElement("button");del.type="button";del.className="lc-action secondary";del.textContent="Delete";
   del.addEventListener("click",async()=>{
     if(!confirm("Permanently delete this item?"))return;
     del.disabled=true;
     const table=type==="event"?"lc_events":"lc_notices";
     const {error}=await db.from(table).delete().eq("id",item.id);
     if(error){alert("Delete failed: "+error.message);del.disabled=false;return;}
     await refreshContent();
   });
   article.append(del);
 }
 return article;
};
const replaceList=(id,items,type,manage=false)=>{
 const root=byId(id);if(!root)return;root.replaceChildren();
 if(!items?.length){root.append(textNode("p","No items yet.","lc-muted"));return;}
 items.forEach(item=>root.append(itemNode(item,type,manage)));
};
async function refreshContent(){
 if(!db)return;
 const [ev,no]=await Promise.all([
   db.from("lc_events").select("id,title,details,venue,starts_at,is_published").order("starts_at",{ascending:true}).limit(300),
   db.from("lc_notices").select("id,title,body,expires_at,created_at,is_published").order("created_at",{ascending:false}).limit(200)
 ]);
 if(ev.error)console.warn("Event loading failed:",ev.error.message);
 if(no.error)console.warn("Notice loading failed:",no.error.message);
 const publicEvents=(ev.data||[]).filter(x=>x.is_published);
 const publicNotices=(no.data||[]).filter(x=>x.is_published&&(!x.expires_at||new Date(x.expires_at)>new Date()));
 replaceList("lc-live-events",publicEvents,"event");
 replaceList("lc-live-notices",publicNotices,"notice");
 if(isAdmin){replaceList("lc-admin-events",ev.data,"event",true);replaceList("lc-admin-notices",no.data,"notice",true);}
}
async function loadInbox(){
 if(!isAdmin||!db)return;
 const {data,error}=await db.from("lc_inquiries").select("id,kind,full_name,email,message,keep_private,created_at").order("created_at",{ascending:false}).limit(80);
 if(error){say("lc-inbox","Unable to load requests: "+error.message);return;}
 const root=byId("lc-inbox");root.replaceChildren();
 if(!data?.length){root.append(textNode("p","No submissions yet.","lc-muted"));return;}
 data.forEach(req=>{
   const article=document.createElement("article");article.className="lc-entry";
   article.append(textNode("h4",(req.kind==="prayer"?"Prayer request":"Faith & life question")+" · "+req.full_name));
   article.append(textNode("time",dateText(req.created_at)+" SAST"));
   article.append(textNode("p",req.message));
   const reply=document.createElement("a");reply.href="mailto:"+encodeURIComponent(req.email);reply.textContent="Reply to "+req.email;
   reply.rel="noopener noreferrer";article.append(reply);
   article.append(textNode("p",req.keep_private?"Requested confidentiality":"No extra confidentiality flag","lc-muted"));
   root.append(article);
 });
}
async function sessionUpdate(){
 if(!db)return;
 const {data,error}=await db.auth.getUser();
 currentUser=error?null:data.user;
 isAdmin=false;
 if(currentUser?.email_confirmed_at){
   const role=await db.from("lc_admins").select("user_id").eq("user_id",currentUser.id).maybeSingle();
   isAdmin=!role.error&&!!role.data;
 }
 show("lc-account-box",!currentUser);show("lc-account-status",!!currentUser);
 show("lc-admin",isAdmin);
 if(currentUser)say("lc-user-email","Signed in as "+currentUser.email+(isAdmin?" · Administrator":" · Member"));
 await refreshContent();
 if(isAdmin)await loadInbox();
}
const authSubmit=async(register)=>{
 if(!db)return;
 const email=byId("lc-auth-email").value.trim(),password=byId("lc-auth-password").value;
 say("lc-auth-status","Connecting…");
 try{
   const result=register?
      await db.auth.signUp({email,password,options:{emailRedirectTo:location.href.split("#")[0]}}):
      await db.auth.signInWithPassword({email,password});
   if(result.error)throw result.error;
   byId("lc-auth-password").value="";
   say("lc-auth-status",register?"Check your email and verify your account before signing in.":"Signed in.");
   if(!register)await sessionUpdate();
 }catch(err){say("lc-auth-status","Authentication failed: "+err.message);}
};
byId("lc-auth-form").addEventListener("submit",e=>{e.preventDefault();authSubmit(false);});
byId("lc-signup").addEventListener("click",()=>authSubmit(true));
byId("lc-logout").addEventListener("click",async()=>{if(!db)return;await db.auth.signOut();await sessionUpdate();});
byId("lc-event-form").addEventListener("submit",async e=>{
 e.preventDefault();if(!isAdmin)return;
 const f=new FormData(e.currentTarget);
 const starts=String(f.get("starts_at")||"");
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(starts))return say("lc-event-status","Choose an event date and time.");
 const payload={title:String(f.get("title")).trim(),details:String(f.get("details")).trim(),venue:String(f.get("venue")).trim(),starts_at:new Date(starts+":00+02:00").toISOString()};
 const {error}=await db.from("lc_events").insert(payload);
 if(error)return say("lc-event-status","Unable to publish: "+error.message);
 e.currentTarget.reset();say("lc-event-status","Event published.");await refreshContent();
});
byId("lc-notice-form").addEventListener("submit",async e=>{
 e.preventDefault();if(!isAdmin)return;
 const f=new FormData(e.currentTarget),expiry=String(f.get("expires_at")||"");
 const payload={title:String(f.get("title")).trim(),body:String(f.get("body")).trim(),expires_at:expiry?new Date(expiry+"T23:59:59+02:00").toISOString():null};
 const {error}=await db.from("lc_notices").insert(payload);
 if(error)return say("lc-notice-status","Unable to publish: "+error.message);
 e.currentTarget.reset();say("lc-notice-status","Notice published.");await refreshContent();
});
const enableRequest=Boolean(ready&&cfg.turnstileSiteKey);
byId("lc-request-submit").disabled=!enableRequest;
if(!enableRequest)say("lc-request-status","Private requests are not accepting submissions until the secure backend and human verification are configured. Please contact a ministry leader directly.");
byId("lc-request-form").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!enableRequest||!captchaToken)return say("lc-request-status","Please complete the human verification.");
 const f=new FormData(e.currentTarget),btn=byId("lc-request-submit");
 btn.disabled=true;say("lc-request-status","Submitting securely…");
 try{
  const res=await fetch(cfg.supabaseUrl.replace(/\/$/,"")+"/functions/v1/submit-inquiry",{
    method:"POST",headers:{"Content-Type":"application/json","apikey":cfg.supabasePublishableKey},
    body:JSON.stringify({kind:f.get("kind"),full_name:f.get("full_name"),email:f.get("email"),
      message:f.get("message"),keep_private:f.get("keep_private")==="on",consent:f.get("consent")==="on",
      website:f.get("website"),captcha:captchaToken})
  });
  const result=await res.json();
  if(!res.ok)throw new Error(result.message||"Submission failed");
  say("lc-request-status",result.message);e.currentTarget.reset();
 }catch(err){say("lc-request-status","Could not submit: "+err.message);}
 finally{btn.disabled=false;captchaToken="";if(window.turnstile&&captchaWidget!==null)window.turnstile.reset(captchaWidget);}
});
if(!ready){
 say("lc-auth-status","Member registration and admin sign-in will activate once the secure Supabase backend is connected.");
 byId("lc-login").disabled=true;byId("lc-signup").disabled=true;
} else {
 try{
  const sdk=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm");
  db=sdk.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
  await sessionUpdate();
  db.auth.onAuthStateChange(()=>{setTimeout(()=>sessionUpdate(),0);});
 }catch(err){say("lc-auth-status","Member service could not load. Please try again later.");byId("lc-login").disabled=true;byId("lc-signup").disabled=true;}
}
if(enableRequest){
 const script=document.createElement("script");
 script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";script.async=true;
 script.addEventListener("load",()=>{
  if(!window.turnstile)return;
  captchaWidget=window.turnstile.render("#lc-captcha",{
    sitekey:cfg.turnstileSiteKey,callback:token=>{captchaToken=token;},
    "expired-callback":()=>{captchaToken="";}
  });
 });document.head.append(script);
}
