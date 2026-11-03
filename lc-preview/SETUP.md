# Living Culture — member portal and admin setup

Live public preview:
https://greenleafwebbing.github.io/Living-Culture_Website/lc-preview/

## Current state
The public site is live on GitHub Pages. Screens for member login, administration,
calendar events, notices, and confidential requests have been added.
They are deliberately **not enabled** until a real backend is connected.
No passwords or confidential prayer requests are stored in GitHub.

## Security: read first
- NEVER reuse a password that has been shared in chat or put one in public GitHub files.
- Use a NEW strong password when creating your verified administrator account.
- Do not paste the Supabase secret/service_role key, the Turnstile secret, or Resend API keys into GitHub.
- Only put the Supabase **publishable** key in config.js.
- Supabase Row Level Security (RLS) controls access. Hiding buttons isn't authorization.

## Step 1. Create the backend
1. Create a Supabase project: https://supabase.com/dashboard
2. In SQL Editor run everything from supabase/schema.sql.
3. In Project Settings > API Keys, locate Project URL and PUBLISHABLE key.
4. Edit config.js in this directory with those PUBLIC values.
5. In Supabase Authentication URL Configuration, allow this redirect:
   https://greenleafwebbing.github.io/Living-Culture_Website/lc-preview/
6. Keep email confirmation enabled. Set up a proper SMTP provider for production auth emails.

## Step 2. Assign your verified administrator
1. Sign up on the Living Culture page using your intended email and a **new password**.
2. Verify your email using the link sent by Supabase.
3. In the Supabase SQL Editor execute the following (substitute your verified email):
   
   insert into public.lc_admins(user_id)
   select id from auth.users
   where email = '<YOUR_VERIFIED_ADMIN_EMAIL>' and email_confirmed_at is not null
   on conflict (user_id) do nothing;

4. Sign out and back in. The Admin dashboard will appear.
5. SQL enforces that only assigned administrators can create/delete calendar items,
   manage notices, and read confidential submissions.

## Step 3. Enable public prayer and faith-question submissions
1. Create a Cloudflare Turnstile site at https://dash.cloudflare.com/ allowing
   the hostname greenleafwebbing.github.io.
2. Add its PUBLIC site key to config.js (turnstileSiteKey).
3. Deploy supabase/functions/submit-inquiry/index.ts to a Supabase Edge Function
   named submit-inquiry, disabling JWT verification so visitors can submit without login.
   CLI example: supabase functions deploy submit-inquiry --no-verify-jwt
4. In Supabase Edge Function Secrets set:
   - TURNSTILE_SECRET: secret Turnstile key.
   - RESEND_API_KEY: Resend email API key.
   - RESEND_FROM_EMAIL: authorized, verified sender address.
   - ADMIN_NOTIFY_EMAIL: the ministry admin inbox.
   - PUBLIC_SITE_ORIGIN: https://greenleafwebbing.github.io
5. Ensure the sender domain is verified in https://resend.com.
6. Test a prayer request and a faith question; confirm it appears in the
   admin inbox and that the admin notification email is delivered.
7. Remember that email delivery can fail even when the submission is
   stored; check the dashboard and Edge Function logs.

## Privacy and testing before ministry use
- Prayer requests and life questions may contain highly sensitive information.
- Provide a plain-language privacy notice, consent, retention period and deletion process.
- Allow only approved pastoral leaders to view requests.
- Test sign-out, member sign-in, admin sign-in, published/expired notices,
  and attempted unauthorized database reads/writes.
- Add rate limiting in addition to CAPTCHA before publishing forms widely.
- No request form is enabled unless the browser configuration and CAPTCHA are set.

## Technical notes
GitHub Pages serves HTML, CSS and JavaScript only; no ASP.NET server or SQL database.
The frontend uses Supabase Auth and Postgres with RLS, plus an Edge Function for
private form submissions and email notifications. This is a functional way to
keep the public preview hosted on GitHub Pages without exposing server secrets.
