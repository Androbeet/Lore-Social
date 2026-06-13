# 🔴 LORE — a zero-budget social network built on GitHub

> Every post you make is part of the Lore.

**Admin:** ANDROBEET · **Support:** andrewz772k6@gmail.com

[![Buy Me A Coffee](https://img.shields.io/badge/♥_Keep_LORE_alive-Buy_Me_A_Coffee-e63956?style=for-the-badge)](https://buymeacoffee.com/androbeet)

## ♥ Why fund a "$0 budget" platform?

Fair question — and an honest answer: **LORE was *built* for $0, and the core will always be free to use.** That promise doesn't change.

But a platform is not a one-time build. As the Lore grows, it demands more:
real-time message servers, email verification systems, media storage,
moderation tooling, app-store presence — and hundreds of hours of work.
Free tiers carried us to launch; growth carries real costs.

**Funding doesn't pay for what already exists. It pays for what comes
next** — every coffee converts directly into an upgrade you'll feel in
the app. Supporters keep the Lore alive: ☕ **[buymeacoffee.com/androbeet](https://buymeacoffee.com/androbeet)**

A full social network — profiles, voice cards, topics, upvotes, communities,
ranks, streaks, monthly leaderboard charts — that costs **$0 forever**:

- **Hosting:** GitHub Pages (this repo)
- **Database:** a GitHub repo full of JSON files, read via jsDelivr CDN
- **Backend writes:** one free Cloudflare Worker (`worker/worker.js`)
- **Scheduled brain:** GitHub Actions (`.github/workflows/`) — streaks, echoes, monthly charts
- **Media:** users paste links (Imgur / Catbox) — nothing is ever stored here

---

## 🧑‍🎓 Complete beginner? Start here

**Read [`docs/HOSTING-GUIDE.md`](docs/HOSTING-GUIDE.md)** — a click-by-click
walkthrough (no commands, no installs) that takes you from "I have nothing"
to a live website in ~10 minutes, including what to type in every box,
how to see hidden files like `.nojekyll`, and a troubleshooting table.

**Confused by all the files?** Read
[`docs/FILES-EXPLAINED.md`](docs/FILES-EXPLAINED.md) — every single file
explained in plain English: what it does, whether you'll ever edit it, and
how the logo/banner are already applied.

---

## 🚀 Host on GitHub Pages (2 minutes)

The app ships in **demo mode** — it works the second Pages goes live, with
sample users/posts and your own actions saved in the browser. No setup needed.

1. **Create a repo** on GitHub (e.g. `lore`, or `<username>.github.io` for a root URL).
2. **Upload everything in this folder** (make sure `index.html` is at the repo root):
   ```bash
   git init
   git add .
   git commit -m "LORE v1"
   git branch -M main
   git remote add origin https://github.com/<YOUR-USERNAME>/lore.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save**.
4. Wait ~1 minute. Your site is live at:
   `https://<YOUR-USERNAME>.github.io/lore/`

That's it. The `.nojekyll` file is already included so Pages serves everything as-is.

---

## 🔌 Going live (real shared backend, still $0)

Demo mode is per-browser. To make posts/votes/follows shared between all users:

### 1. Create the data repos
- `lore-data` (**public**) — copy the seed files from `data/` in this repo into it.
- `lore-dms` (**private**) — empty repo, holds DM threads (private = actually private).

### 2. Deploy the Worker
- Go to [Cloudflare Workers](https://dash.cloudflare.com) → Create Worker → paste `worker/worker.js` → Deploy.
- In Worker **Settings → Variables**, add secrets:
  | Secret | Value |
  |---|---|
  | `GITHUB_TOKEN` | fine-grained PAT, **Contents: write** on `lore-data` + `lore-dms` |
  | `DATA_REPO` | `<you>/lore-data` |
  | `DMS_REPO` | `<you>/lore-dms` |
  | `ADMIN_USER` | `androbeet` |

### 3. Move the workflows
Copy `.github/workflows/*.yml` from this repo into **`lore-data`**
(they need to commit results next to the posts). They run automatically:
- **Daily:** streaks 🔥, ECHO/RESONANCE badges, feed-index rebuild
- **Monthly (1st):** per-topic leaderboard JSON → pinned circle chart

### 4. Connect the frontend
Open `index.html`, find `CONFIG` at the top of the script, and set:
```js
const CONFIG = {
  WORKER_URL: "https://lore-api.<you>.workers.dev",
  DATA_BASE:  "https://cdn.jsdelivr.net/gh/<you>/lore-data@main",
  ...
};
```
Push — done.

### 5. (Recommended before public launch) Real auth
Add Firebase Auth (free, 50k MAU) for Google/email sign-in, send the Firebase
ID token as `Authorization: Bearer <token>` to the Worker, and finish the JWT
verification stub in `worker/worker.js → identify()`. The plan for this is in
`docs/PLAN.md`.

---

## ✨ Features in this build

| Feature | Status |
|---|---|
| 3 themes — Maroon Glow (default), Monochrome, Light | ✅ live |
| Explore: Hot / Rising / New / Random tabs | ✅ live |
| Posting (text + image link), topics required | ✅ live |
| Upvote / downvote / comment / share-permalink | ✅ live |
| Profiles: pfp URL, bio, decoration ring, voice card, tags | ✅ live |
| Follow / mutual badge / online dot | ✅ live |
| ECHO / RESONANCE / PIONEER / Androbeet Seal / streak badges | ✅ live |
| Username + post search | ✅ live |
| Topic pages with pinned monthly circle chart | ✅ live |
| Notifications bar with unread badge | ✅ live |
| Communities (join/leave) | ✅ live |
| 50 seeded interest tags + request-new queue | ✅ live |
| DMs via private repo + Worker | 🔌 activates in live mode |
| Admin dashboard, logs, bans, rate limits | 🔌 Worker-side, live mode |

## 📁 Repo layout

```
index.html                      ← the whole app (single file, zero deps)
404.html                        ← styled "lost in the Lore" error page
.nojekyll                       ← (hidden file!) makes Pages serve files as-is
manifest.webmanifest            ← PWA manifest — LORE installs like an app
sw.js                           ← service worker — offline support
robots.txt                      ← lets search engines index the site
LICENSE                         ← MIT — people can fork & remix
CONTRIBUTING.md                 ← rules for people who want to help build
assets/
  icon-512.png                  ← app icon (PWA / phone home screen)
  og-banner.png                 ← social preview card (Twitter/Discord embeds)
worker/worker.js                ← Cloudflare Worker backend (free tier)
data/                           ← seed files for your lore-data repo
  config/tags.json              ← 50 starter interest tags
  config/feed.json              ← feed index (last 500 posts)
  config/userindex.json         ← username search index
  users/androbeet.json          ← admin profile
  communities/the-forge.json    ← first community
.github/workflows/              ← (hidden folder!) move these into lore-data
  monthly-leaderboard.yml       ← auto-posted topic charts
  daily-maintenance.yml         ← streaks, echoes, feed rebuild
docs/
  HOSTING-GUIDE.md              ← click-by-click beginner hosting guide
  PLAN.md                       ← the full original plan
  ROADMAP.md                    ← what ships next, phase by phase
  RULES.md                      ← community rules & moderation policy
```

> 🫥 **"Where is `.nojekyll`?"** Files starting with a dot are *hidden* by
> Windows/Mac file browsers. It IS there — enable "Show hidden files"
> (Windows: View → Show → Hidden items · Mac: Cmd+Shift+.) or just create
> it on GitHub: Add file → Create new file → name it `.nojekyll` → commit
> empty. It tells GitHub Pages to serve your files exactly as-is.

---

*Built on GitHub. $0 forever. — aNDROBEET*
