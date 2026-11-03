# Living Culture – Young Adult Bible Study website

A simple static website (GitHub Pages) with a free Supabase database behind it.

- **Notice board** – posted by admins
- **Calendar** – the weekly gathering (every Thursday 19:00) shows automatically; admins add special events
- **Prayer & questions** – anyone can send a prayer request or a question about faith & life; only admins can read them
- **Leader login** (`admin.html`) – only admins can log in and manage everything

## Files
| Path | What it is |
|---|---|
| `index.html` | Public website |
| `admin.html` | Admin login + dashboard |
| `css/` | Styling |
| `js/config.js` | **Settings** – Supabase keys, gathering day/time/venue |
| `js/app.js`, `js/admin.js`, `js/common.js` | Site logic |
| `supabase/setup.sql` | Database setup (run once) |
| `supabase/cleanup-old.sql` | Optional: removes tables from the old version of the site |

## One-time setup

1. **Database** – Supabase dashboard → *SQL Editor* → paste `supabase/setup.sql` → *Run*.
2. **Turn off public sign-ups** – *Authentication → Sign In / Providers* → disable *Allow new users to sign up*.
   (Only admins need accounts.)
3. **Create the admin login** – *Authentication → Users → Add user → Create new user*,
   enter email + a strong password, tick *Auto confirm user*.
4. **Make that user an admin** – in the SQL Editor run:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'you@example.com'
   on conflict do nothing;
   ```
   Repeat steps 3–4 for every extra leader.
5. **Publish** – GitHub repo → *Settings → Pages* → Source: *Deploy from a branch*, branch `main`, folder `/ (root)`.
   Site: `https://greenleafwebbing.github.io/Living-Culture_Website/`
6. Optional: set the venue in `js/config.js` (`place: "..."`).

To use a different Supabase project, change `supabaseUrl` and `supabaseKey` in `js/config.js`
(use the *publishable/anon* key – **never** the secret/service_role key).

## Run locally
Just open `index.html` in a browser, or run `python3 -m http.server` and visit http://localhost:8000.
