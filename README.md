# LRRecords Job & Music Production Tracker

A weekly task + accountability tracker built for the LRRecords / Alec work-experience
partnership: Brett sets Friday tasks with deadlines, Alec checks them off and submits
evidence (text, links, files, screenshots), Brett reviews and signs off, and every time
enough tasks are signed off the app automatically unlocks a studio session. A separate
Studio tab lets both of you log production time per song.

**App name suggestions** (pick whichever feels right — the app currently ships titled
with your original suggestion):

1. **Alec's LRRecords Job & Music Production Tracker** *(your original — currently used)*
2. **LRRecords Launchpad**
3. **The Friday Sessions**
4. **LRRecords Trackside**
5. **Alec x LRRecords: Grind & Grow**
6. **Studio Time Ledger**

To rename it, change `APP_NAME` / `APP_SHORT_NAME` in `lib/constants.ts`.

---

## What's inside

- **Tasks tab** — Brett creates tasks with a week, description, and deadline. Alec
  marks them in progress / submits them with evidence (text note, link, file upload,
  or screenshot) plus an optional note. Brett reviews and ticks a **sign-off**
  checkbox. Both of you can leave notes/feedback on any task.
- **Automatic studio unlock** — a setting (default: every 4 signed-off tasks) controls
  how many completed tasks earns a studio session. This is enforced by a database
  trigger, not app code, so it can't be bypassed by editing the frontend.
- **Studio tab** — shared song list (idea → writing → recording → mixing → mastering →
  released) with a running time log per song, plus a general log for studio time not
  tied to a specific song. Either of you can add entries.
- **Settings tab** (admin only) — change the tasks-per-unlock threshold and hours
  awarded per unlock.
- Dark navy + orange LRRecords color scheme, with a placeholder circular "LRRECORDS"
  badge logo (see **Branding** below to swap in your real logo file).

## Tech stack

Next.js 14 (App Router, TypeScript) + Tailwind CSS, with **Supabase** providing the
database, authentication, and file storage. Supabase's free tier is enough for a
two-person app like this. Deployable to Vercel or Railway, and embeddable as an
`<iframe>` on lrrecords.com.au.

---

## 1. Set up Supabase (~10 minutes)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard, go to **SQL Editor → New query**, paste the entire
   contents of [`supabase/schema.sql`](./supabase/schema.sql), and click **Run**.
   This creates every table, the row-level security rules, the auto studio-unlock
   trigger, and a private `evidence` storage bucket for uploads.
3. Go to **Authentication → Providers** and make sure **Email** is enabled.
4. Go to **Authentication → Settings** and turn **off** "Confirm email" (simplest for
   a two-person app — you can turn it back on later if you want).
5. Go to **Settings → API** and copy the **Project URL** and **anon public key**.

## 2. Configure the app

Copy `.env.local.example` to `.env.local` and paste in the two values from step 5:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

## 3. Run it locally

```
npm install
npm run dev
```

Open http://localhost:3000 — you'll land on the login screen. Click **"Create the
first account"** and sign up as yourself (Brett) — **the first account created
automatically becomes the admin account**. Have Alec create the second account from
his own device — it will automatically be a student account. (You can also flip
anyone's role later from the Settings tab.)

---

## 4. Deploy

### Option A — Vercel (recommended)

1. Push this project to a new GitHub repository (see below).
2. Go to [vercel.com/new](https://vercel.com/new), import that repo.
3. Add the two environment variables from `.env.local` in the Vercel project's
   **Settings → Environment Variables**.
4. Deploy. Vercel will give you a URL like `lrrecords-tracker.vercel.app`.

### Option B — Railway

1. Push this project to GitHub.
2. Go to [railway.app/new](https://railway.app/new) → **Deploy from GitHub repo**.
3. Railway auto-detects the Next.js app. Add the same two environment variables under
   the service's **Variables** tab.
4. Deploy — Railway gives you a `*.up.railway.app` URL (or attach your own domain).

### Push to GitHub

```
cd lrrecords-tracker
git init
git add .
git commit -m "Initial commit: LRRecords tracker"
git branch -M main
git remote add origin https://github.com/<your-username>/lrrecords-tracker.git
git push -u origin main
```

---

## 5. Embed at lrrecords.com.au

`next.config.mjs` already sends a `Content-Security-Policy: frame-ancestors` header
allowing `lrrecords.com.au` to embed the app in an iframe. On the dedicated page, add:

```html
<iframe
  src="https://your-deployed-url.vercel.app"
  title="LRRecords Job & Music Production Tracker"
  style="width:100%; height:100vh; border:0;"
></iframe>
```

If your site host uses a different subdomain (e.g. `www.lrrecords.com.au`), it's
already covered — both are allow-listed in `next.config.mjs`. Add any other domains
you embed on to that same list.

---

## 6. Branding — swap in your real logo

The app currently draws a placeholder circular "LRRECORDS" badge in
`components/CircleLogo.tsx` using navy `#0B1E3D` and orange `#F5820D`. To use your
actual logo file instead:

1. Drop your logo image at `public/logo.svg` (or `.png`).
2. In `components/CircleLogo.tsx`, replace the `<svg>...</svg>` markup with:
   ```tsx
   <img src="/logo.svg" alt="LRRecords" width={size} height={size} className={className} />
   ```
3. If your real brand colors differ from the placeholder hexes, update the `navy` and
   `orange` color scales in `tailwind.config.ts` to match exactly.

---

## Ideas for later (not built yet, but the schema supports them)

A few things worth considering as this grows:

- **Weekly digest email** — a scheduled job (Supabase Edge Function + cron, or Vercel
  Cron) that emails Brett a Sunday-night summary of what's outstanding, and reminds
  Alec on Thursday night about Friday's list.
- **Streak / consistency tracker** — surface "3 Fridays in a row completed" on the
  dashboard as a motivational nudge — the data (`tasks.status`, `signed_off_at`) is
  already there to compute it.
- **Photo/audio preview** — currently evidence files open in a new tab; could preview
  images and audio inline on the task page.
- **PDF export of a completed EP/album's task + studio-time history** — useful as a
  simple "portfolio" artifact for Alec to show other studios or a resume.
- **Push/email notification the moment studio time unlocks**, so it feels like an
  instant reward rather than something you have to notice yourself.
- **Calendar view** of upcoming deadlines across weeks, not just a flat list.

None of these are required to use the app today — they're just natural next steps if
this keeps growing as a real tool for the two of you.
