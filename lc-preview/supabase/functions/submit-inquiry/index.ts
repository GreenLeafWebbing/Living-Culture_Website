// Living Culture confidential inquiry handler.
// Public guest requests are rate-limited server-side. A Turnstile secret can be
// configured later for additional free bot protection.
// Secrets must stay in the Supabase Edge Function environment, never GitHub.
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const allowedOrigin = "https://greenleafwebbing.github.io";
const cors = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Vary": "Origin"
};
const reply = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), { status, headers: cors });

async function keyedRateHash(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin !== allowedOrigin) return reply(403, "Origin not allowed.");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply(405, "Method not allowed.");
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    return reply(415, "Expected JSON.");
  try {
    const raw = await req.text();
    if (raw.length > 12000) return reply(413, "Request too large.");
    const body = JSON.parse(raw);
    const { kind, full_name, email, message, keep_private, consent, website, captcha } = body;
    if (website) return reply(200, "Thank you.");
    if (!["prayer", "question"].includes(kind) ||
        typeof full_name !== "string" || !full_name.trim() || full_name.length > 100 ||
        typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        typeof message !== "string" || message.trim().length < 10 || message.length > 5000 ||
        consent !== true || typeof keep_private !== "boolean") {
      return reply(400, "Please complete the required form fields.");
    }

    const captchaSecret = Deno.env.get("TURNSTILE_SECRET");
    if (captchaSecret) {
      if (typeof captcha !== "string" || !captcha) return reply(400, "Human verification is required.");
      const validation = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST", body: new URLSearchParams({ secret: captchaSecret, response: captcha })
      });
      const verdict = await validation.json();
      if (!verdict.success || verdict.hostname !== "greenleafwebbing.github.io")
        return reply(400, "Human verification failed. Please try again.");
    }

    const url = Deno.env.get("SUPABASE_URL");
    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !secret) return reply(503, "Submission service unavailable.");
    const sourceIp = req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    const identity = sourceIp ? "ip:" + sourceIp : "email:" + email.trim().toLowerCase();
    const rateKey = await keyedRateHash(secret, identity);
    const admin = createClient(url, secret, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { error } = await admin.rpc("lc_accept_inquiry", {
      in_rate_key: rateKey,
      in_kind: kind,
      in_full_name: full_name.trim(),
      in_email: email.trim().toLowerCase(),
      in_message: message.trim(),
      in_keep_private: keep_private,
      in_consent: true
    });
    if (error?.message?.includes("RATE_LIMIT_EXCEEDED"))
      return reply(429, "Too many requests. Please try again later.");
    if (error) {
      console.error("Inquiry storage failed:", error.code || "unknown");
      return reply(503, "Your message could not be saved. Please try again.");
    }

    // Notify by email only if a FREE provider is configured in Edge Function secrets.
    // Never include confidential message contents in notification emails.
    const mailKey = Deno.env.get("RESEND_API_KEY");
    const mailFrom = Deno.env.get("RESEND_FROM_EMAIL");
    const mailTo = Deno.env.get("ADMIN_NOTIFY_EMAIL");
    if (mailKey && mailFrom && mailTo) {
      try {
        const mail = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: "Bearer " + mailKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: mailFrom,
            to: [mailTo],
            subject: kind === "prayer" ? "Living Culture: New prayer request" :
              "Living Culture: New question about faith and life",
            text: "A confidential message has arrived. Sign in to the Living Culture admin dashboard to read it."
          })
        });
        if (!mail.ok) console.warn("Notification delivery failed:", mail.status);
      } catch (e) {
        console.warn("Notification provider temporarily unavailable.");
      }
    }
    return reply(200, "Your message was received. Thank you for trusting Living Culture.");
  } catch (error) {
    console.error("Request processing error:", error instanceof Error ? error.name : "unknown");
    return reply(400, "Unable to process the request.");
  }
});