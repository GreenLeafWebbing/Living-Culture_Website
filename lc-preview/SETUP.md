# Living Culture — free live backend and administrator setup

## Already deployed
- Public website: https://greenleafwebbing.github.io/Living-Culture_Website/lc-preview/
- Supabase Free project: Living Culture Portal, ref pzdszmlbjtcepevweefc.
- Public website is configured to use the Supabase backend.
- Calendar events and notices can be added or deleted by verified administrators.
- Guest prayer requests and faith questions are stored privately by the submit-inquiry Edge Function, with rate limiting.
- Only authorized admins may read submitted requests.
- The intended administrator email is approved privately inside the database, not in the public website source. The administrator still needs to register, verify email and sign in.
- Emails to the administrator are OPTIONAL until you configure a sender below.

## 1. Free email sender for member verification
Supabase's default built-in email sender only delivers to your Supabase organization's team members and has a limit of 2 emails/hour. To invite young adults from any email address, use a custom SMTP sender and keep email verification ON.

A free option:
1. Create a free account at https://www.brevo.com/ and verify a sender address.
2. Under Brevo > SMTP & API, get your SMTP login and SMTP key (not your API key).
3. In the Supabase dashboard at https://supabase.com/dashboard/project/pzdszmlbjtcepevweefc navigate to Authentication > SMTP Settings / Custom SMTP.
4. Turn on Custom SMTP and enter:
   Sender email: the verified Brevo sender address
   Sender name: Living Culture
   Host: smtp-relay.brevo.com
   Port: 587
   Username: Brevo SMTP login
   Password: Brevo SMTP key
5. Save. Never send SMTP credentials to ChatGPT and never put them in GitHub.
6. Keep email confirmation enabled under Authentication > Providers.
Brevo's Free plan currently includes up to 300 daily email sends. Free-address senders may be rewritten by Brevo; sender reputation/deliverability still matters.

## 2. Configure email redirects
In Supabase Authentication > URL Configuration set the following as the Site URL, and also add it to Redirect URLs:
https://greenleafwebbing.github.io/Living-Culture_Website/lc-preview/

## 3. Activate approved administrator
1. Visit the website and choose Create an account.
2. Use the email address previously approved for admin access.
3. Choose a NEW strong, unique password. Rotate any password previously shared in chat.
4. Click the verification link delivered to your email address.
5. Sign in at the website. A private database trigger grants administrator access only AFTER email confirmation.
6. You can then add/delete calendar events and notices, and read the private ministry inbox.

## 4. Get free email alerts for new prayer requests and life questions
Form submissions are stored securely already. To receive an automatic email for every new submission:
1. In Brevo > SMTP & API > API Keys, create an API key. This is NOT the SMTP key.
2. In Supabase > Edge Functions > Secrets, set:
   BREVO_API_KEY = your private Brevo API key
   BREVO_FROM_EMAIL = your Brevo verified sender address
   ADMIN_NOTIFY_EMAIL = your administrator recipient email
3. Submit a test prayer request through the live site.
4. Check that the test appears in the private admin inbox and you received an email.

The alert contains no private request text. If the email provider fails, the request is still saved in the private inbox.

Alternative: use RESEND_API_KEY and RESEND_FROM_EMAIL instead of the Brevo API variables; keep ADMIN_NOTIFY_EMAIL.

## Safety notes
- A free Turnstile CAPTCHA is recommended before public launch. Current anonymous submissions are restricted by a server-side rate limiter and a honeypot.
- Create a ministry privacy policy, private-request retention period, and a way to delete requests.
- Free hosting has quotas and Supabase Free projects can be paused after inactivity.
- Test sign up, confirmation, member denial, admin editing, and private submissions end to end before advertising the site.
