// Supabase Edge Function: submit-inquiry
// Deploy: supabase functions deploy submit-inquiry --no-verify-jwt
// Secret values belong in Supabase Edge Functions, never GitHub.
import { createClient } from "npm:@supabase/supabase-js@2";
const allowedOrigin = Deno.env.get("PUBLIC_SITE_ORIGIN") || "https://greenleafwebbing.github.io";
function headers(origin: string | null) {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin === allowedOrigin ? origin : allowedOrigin,
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}
function response(status: number, message: string, origin: string | null) {
  return new Response(JSON.stringify({ message }), { status, headers: headers(origin) });
}
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (origin && origin !== allowedOrigin) return response(403, "Origin not permitted.", origin);
  if (req.method === "OPTIONS") return new Response(null, {status:204,headers:headers(origin)});
  if (req.method !== "POST") return response(405,"Method not allowed.",origin);
  if (Number(req.headers.get("content-length")||0) > 12000)
    return response(413,"Request too large.",origin);
  try {
    const {kind,full_name,email,message,keep_private,consent,captcha,website} = await req.json();
    if (website) return response(200,"Thank you.",origin);
    if (!["prayer","question"].includes(kind) ||
        typeof full_name!=="string" || full_name.trim().length<1 || full_name.length>100 ||
        typeof email!=="string" || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof message!=="string" || message.trim().length<10 || message.length>5000 ||
        consent!==true || typeof captcha!=="string")
      return response(400,"Please complete all required fields.",origin);
    const captchaSecret=Deno.env.get("TURNSTILE_SECRET");
    if(!captchaSecret) return response(503,"Form protection not configured.",origin);
    const body=new URLSearchParams({secret:captchaSecret,response:captcha});
    const verify=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body});
    const challenge=await verify.json();
    if(!challenge.success) return response(400,"Human verification failed. Please retry.",origin);
    const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!key) return response(503,"Backend not configured.",origin);
    const admin=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
    const {error}=await admin.from("lc_inquiries").insert({
      kind,full_name:full_name.trim(),email:email.trim(),message:message.trim(),
      keep_private:keep_private!==false,consent:true
    });
    if(error){console.error("Storage failure:",error.code);return response(503,"Unable to store your request.",origin);}
    const emailKey=Deno.env.get("RESEND_API_KEY"),recipient=Deno.env.get("ADMIN_NOTIFY_EMAIL"),
          sender=Deno.env.get("RESEND_FROM_EMAIL");
    if(emailKey&&recipient&&sender){
      const mail=await fetch("https://api.resend.com/emails",{
        method:"POST",
        headers:{"Authorization":"Bearer "+emailKey,"Content-Type":"application/json"},
        body:JSON.stringify({
          from:sender,to:[recipient],
          subject:kind==="prayer"?"Living Culture: prayer request":"Living Culture: faith & life question",
          text:["New confidential submission","Type: "+kind,"Name: "+full_name.trim(),
          "Reply email: "+email.trim(),"Private: "+(keep_private!==false?"Yes":"No"),"",message.trim()].join("\n")
        })
      });
      if(!mail.ok) console.error("Notification delivery HTTP",mail.status);
    }else console.warn("Notification email not configured; submission stored.");
    return response(200,"Your request has been received. Thank you for trusting us.",origin);
  }catch(err){console.error("Request error:",err instanceof Error?err.message:"unknown");return response(400,"Unable to process request.",origin);}
});
