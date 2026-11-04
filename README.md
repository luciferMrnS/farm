# Fieldnote — Lucea's Poultry Farm

A browser-based layer-farm manager. Run `index.html` directly for local-only use, or host these files as a static site and connect a Supabase project for sign-in and cloud-saved records.

## Enable Supabase storage

1. Create a Supabase project.
2. In the Supabase SQL Editor, run the contents of [`supabase-schema.sql`](./supabase-schema.sql). It creates the `farms` table and enables row-level security so a signed-in account can read and change only its own farm row.
3. In **Authentication → Providers**, enable Email. If email confirmation is on, confirm the account from the email before signing in.
4. Enter the project's **Project URL** and **anon/public key** in `supabase-config.js`. Use `supabase-config.example.js` as a reference.
5. Deploy `index.html`, `supabase-config.js`, and the other app files together to a static host such as Netlify, Vercel, or GitHub Pages. Use HTTPS in production.
6. In Supabase **Authentication → URL Configuration**, set the Site URL and allowed redirect URL to your deployed site.
7. Open the deployed app, create the farm manager account, and sign in. Supabase Auth uses the manager's email address and password; `Manager` is the account's display name, not a username accepted by Supabase login. Set the desired password during account registration in the app. The first signed-in account creates the farm record; later sign-ins to that account load the same cloud data.

The Supabase URL and anon/public key are browser-visible credentials. This is expected: the SQL schema restricts access using Supabase Auth and row-level security. **Never put a Supabase service-role/secret key in this app or in `supabase-config.js`.**

The current cloud schema supports one farm-owner account per farm. The app writes each farm's records as one JSON document, so use one manager account at a time; it does not yet provide multi-manager roles or conflict resolution for simultaneous edits.

Without Supabase credentials, the app clearly indicates **Local only** and continues to save in the current browser's local storage. Once Supabase is configured, a manager must sign in to access farm records.
