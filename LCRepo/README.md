# LCRepo — Living Culture Blazor application

This is a **standalone .NET 10 Blazor WebAssembly** app. It is written primarily in C# and Razor, and uses a small JavaScript bridge for Supabase authentication and database access. It can be hosted for free on GitHub Pages because the compiled frontend is static.

## Pages
- Home / — public homepage
- Calendar /calendar — weekly Thursday Bible study plus admin-created events
- Notice board /notices — admin-created announcements
- Prayer /request — private prayer requests and faith/life questions
- Member /member — signup, sign-in, sign-out, email confirmation
- Admin /admin — authorized publishing, deletion, and private inbox

## Local development
1. Install the .NET 10 SDK.
2. In a shell from the repository root: dotnet run --project LCRepo/LCRepo.csproj
3. Open the localhost URL printed in your terminal.
4. Keep the server running while you work in VS Code.

## Security and hosting
The public Supabase URL and public publishable key in wwwroot/js/settings.js are intended for browser use. They do not grant database administrator access. Supabase row-level-security policies control writes and private reads; never put any secret/service-role key in the public app.

Supabase project: Living Culture Portal
Pages URL after GitHub Action publishes: https://greenleafwebbing.github.io/Living-Culture_Website/lc-blazor/

Existing legacy preview remains at /Living-Culture_Website/lc-preview/ until you choose to replace it.

### Activate your admin account
The previously approved admin email lives in the PRIVATE database allowlist. Register using your approved email, using a NEW password, and verify the email; Supabase promotes the account after verification.

### Emails
Supabase email confirmations for all young adults require custom SMTP because its default service restricts recipients. Configure a free SMTP provider through the Supabase dashboard.

Prayer requests and faith questions are stored privately. Automatic alert emails need a free provider API key configured as Edge Function secrets (Brevo or Resend). Until configured, administrators can still read requests by signing in to /admin.

### Confidentiality
Only approved admin accounts can read submissions. Add a privacy/retention policy and verify public protections before inviting large groups. The public request function is rate-limited. Avoid sending sensitive content in email alerts.

## Publish
GitHub Actions workflow .github/workflows/build-lcrepo.yml runs dotnet publish and copies published wwwroot into lc-blazor/ on the main branch. GitHub Pages is already configured from main and should publish these files at the path above.

Base href is rewritten to /Living-Culture_Website/lc-blazor/ in the workflow. GitHub Pages doesn't provide native SPA deep-link fallback, so refresh from the home URL if you encounter a 404 on an inner route.

## Free plan caveats
Free tiers can impose usage caps, inactivity pauses and delivery restrictions. The site is not guaranteed to stay completely cost-free at arbitrarily high traffic.
