# Fieldnote — Lucea's Poultry Farm

A browser-based layer-farm manager. Run `index.html` directly for local-only use, or host the app as a static site and connect a Supabase project for sign-in and shared farm records.

## Set up Supabase and manager invitations

1. Create a Supabase project.
2. In **Authentication → Providers**, enable Email. In **Authentication → Settings**, turn off **Allow new users to sign up** so only invited users can create accounts. Configure email delivery and confirmation for invitations.
3. In the Supabase SQL Editor, run the contents of [`supabase-schema.sql`](./supabase-schema.sql). It creates the team-membership table, migrates existing farm owners to primary managers, and applies row-level security so farm members can access only their farm. It preserves existing farm records; run it again after updating the app's Supabase schema. The Investors page stores investor details and contributions with each farm record. The Investor ROI page saves monthly company capital, sales, next-month feed budgets, fee rates and investor contribution snapshots. It sets aside the feed budget first, charges a 20% management fee on the remaining sales for new or updated months, and distributes the remainder by ownership. Existing monthly records retain their saved fee rate; older records without a saved rate retain the prior 30% calculation until edited. The SQL schema restricts deleting investors or monthly ROI records to the primary manager account `kennedydonmiguel@gmail.com`; these actions require a signed-in Supabase session.
4. Enter the project's **Project URL** and **anon/public key** in `supabase-config.js`. Use `supabase-config.example.js` as a reference.
5. Install and configure the Supabase CLI, link this project, then deploy the invitation function from the project directory:

   ```sh
   supabase functions deploy invite-farm-member
   ```

   The function uses Supabase's server-side service-role environment variable; never put a service-role/secret key in the browser app or `supabase-config.js`. To send invite links back to the deployed app, set the Edge Function `SITE_URL` secret to the app's HTTPS URL and add that URL to **Authentication → URL Configuration → Redirect URLs**:

   ```sh
   supabase secrets set SITE_URL=https://your-deployed-site.example
   ```

6. Deploy `index.html`, `favicon.svg`, `supabase-config.js`, and the other app files together to a static host using HTTPS. Set the deployed URL as the Supabase **Site URL** and an allowed redirect URL.
7. The existing farm owner signs in as the primary manager. From **Team**, they can invite managers or assistant managers by email. Invitees open the email link and set their own password before using the app. Managers and assistant managers can view and edit farm records; only the primary manager can manage team access.

The Supabase URL and anon/public key are browser-visible credentials. This is expected: the SQL schema protects farm records and team membership with Supabase Auth and row-level security.

Without Supabase credentials, the app indicates **Local only** and saves in the current browser's local storage. With Supabase configured, a user must be invited to a farm before they can access its records.

Investor ROI reports can be printed or emailed as PDFs. Where the device supports file sharing, **Email PDF** opens the share sheet with the report attached. Otherwise, the app downloads the PDF and opens an email draft; attach the downloaded PDF before sending. The app does not send emails automatically.
