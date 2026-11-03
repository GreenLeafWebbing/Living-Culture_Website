// Browser-only Supabase client: public key is safe to ship; NEVER use service-role keys.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { SUPABASE_URL, SUPABASE_PUBLIC_KEY } from "./settings.js";

const client = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
const origin = "https://greenleafwebbing.github.io";
const throwIfError = ({ error }) => { if (error) throw Error(error.message); };
const eventModel = e => ({
    id: e.id, title: e.title, details: e.details || "", venue: e.venue || "",
    startsAt: e.starts_at, isPublished: !!e.is_published
});
const noticeModel = n => ({
    id: n.id, title: n.title, body: n.body, createdAt: n.created_at,
    expiresAt: n.expires_at, isPublished: !!n.is_published
});
const inquiryModel = x => ({
    id: x.id, kind: x.kind, fullName: x.full_name, email: x.email,
    message: x.message, keepPrivate: x.keep_private, createdAt: x.created_at
});

export async function whoAmI() {
    const { data: { user }, error } = await client.auth.getUser();
    if (error && !/session missing/i.test(error.message || "")) throw Error(error.message);
    if (!user) return { signedIn: false, isAdmin: false, email: "" };
    // The UI hides privileged features, but the actual authorization is in database RLS.
    const role = await client.from("lc_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    throwIfError(role);
    return { signedIn: true, isAdmin: !!role.data, email: user.email || "" };
}
export async function signUp(name, email, password) {
    if (!email || password.length < 12) throw Error("Use a valid email and a password of at least 12 characters.");
    const r = await client.auth.signUp({
        email, password,
        options: { data: { full_name: name }, emailRedirectTo: origin + "/Living-Culture_Website/lc-blazor/" }
    });
    throwIfError(r);
    return "Check your email for a confirmation link, then sign in.";
}
export async function signIn(email, password) {
    const r = await client.auth.signInWithPassword({ email, password });
    throwIfError(r);
    return "Signed in successfully.";
}
export async function signOut() {
    throwIfError(await client.auth.signOut());
}
export async function getEvents(all = false) {
    let q = client.from("lc_events")
        .select("id,title,details,venue,starts_at,is_published")
        .order("starts_at", { ascending: true }).limit(500);
    if (!all) q = q.eq("is_published", true);
    const result = await q;
    throwIfError(result);
    return (result.data || []).map(eventModel);
}
export async function getNotices(all = false) {
    let q = client.from("lc_notices")
        .select("id,title,body,created_at,expires_at,is_published")
        .order("created_at", { ascending: false }).limit(200);
    if (!all) q = q.eq("is_published", true);
    const result = await q;
    throwIfError(result);
    return (result.data || [])
        .filter(n => all || !n.expires_at || new Date(n.expires_at) > new Date())
        .map(noticeModel);
}
export async function getInquiries() {
    const result = await client.from("lc_inquiries")
        .select("id,kind,full_name,email,message,keep_private,created_at")
        .order("created_at", { ascending: false }).limit(100);
    throwIfError(result);
    return (result.data || []).map(inquiryModel);
}
export async function addEvent(title, details, venue, startsAt) {
    throwIfError(await client.from("lc_events").insert({
        title, details, venue, starts_at: startsAt, is_published: true
    }));
}
export async function addNotice(title, body, expiresAt) {
    throwIfError(await client.from("lc_notices").insert({
        title, body, expires_at: expiresAt, is_published: true
    }));
}
export async function deleteEvent(id) {
    throwIfError(await client.from("lc_events").delete().eq("id", id));
}
export async function deleteNotice(id) {
    throwIfError(await client.from("lc_notices").delete().eq("id", id));
}
export async function sendInquiry(draft) {
    const endpoint = SUPABASE_URL + "/functions/v1/submit-inquiry";
    const r = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_PUBLIC_KEY
        },
        body: JSON.stringify({
            kind: draft.kind, full_name: draft.fullName, email: draft.email,
            message: draft.message, keep_private: !!draft.keepPrivate,
            consent: !!draft.consent, website: "", captcha: ""
        })
    });
    const result = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(result.message || "Your message could not be sent.");
    return result.message || "Your message has been received.";
}
