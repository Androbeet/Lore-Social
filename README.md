# 🔴 LORE — a social network built entirely on free tiers

> Every post you make is part of the Lore.

**Admin:** ANDROBEET · **Support:** andrewz772k6@gmail.com

[![Buy Me A Coffee](https://img.shields.io/badge/♥_Keep_LORE_alive-Buy_Me_A_Coffee-e63956?style=for-the-badge)](https://buymeacoffee.com/androbeet)

## ♥ Why does a "$0" app need funding?

Fair question. LORE really was built for nothing, and the core stays free — that part isn't changing. What costs money is everything that comes *after* launch: real-time messaging, email verification, media storage, moderation tooling, eventually an app store listing. Free tiers got it this far; scaling it up takes real hours and, at some point, real infrastructure.

If you want to chip in, it goes straight into whatever's next, not into anything that already exists: ☕ [buymeacoffee.com/androbeet](https://buymeacoffee.com/androbeet)

Here's what **"$0 forever"** actually includes — profiles, voice cards, topics, upvotes, communities, ranks, streaks, monthly leaderboard charts:

- **Hosting:** GitHub Pages (this repo)
- **Database:** a GitHub repo full of JSON files, served through jsDelivr
- **Backend writes:** one free Cloudflare Worker (`worker/worker.js`)
- **Scheduled jobs:** GitHub Actions handle streaks, echoes, monthly charts
- **Media:** people paste an Imgur or Catbox link — nothing gets uploaded or stored here

---

## 🧑‍🎓 New to this? Start with the guides

Never deployed anything before? [`docs/HOSTING-GUIDE.md`](docs/HOSTING-GUIDE.md) walks through it click by click — what to type, where to click, how to find hidden files like `.nojekyll` — no terminal needed.

If the file list looks like a lot, [`docs/FILES-EXPLAINED.md`](docs/FILES-EXPLAINED.md) goes file by file: what it does, and whether you'll ever need to touch it.

---

## 🚀 Get it running on GitHub Pages

It ships in demo mode by default, which means it works the moment Pages goes live — sample users and posts included, and anything you do yourself gets saved in your browser. Nothing to configure first.

1. Create a repo on GitHub (`lore`, or `<username>.github.io` if you want it at the root).
2. Push everything in this folder, with `index.html` at the repo root:
   ```bash
   git init
   git add .
   git commit -m "LORE v1"
   git branch -M main
   git remote add origin https://github.com/<YOUR-USERNAME>/lore.git
   git push -u origin main
   ```
3. Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save.
4. Give it a minute. It'll be live at `https://<YOUR-USERNAME>.github.io/lore/`.

`.nojekyll` is already in there, so Pages serves everything as-is instead of running it through Jekyll.

---

## 🔌 Going live for real (shared backend, still free)

Demo mode is per-browser — nobody's posts actually reach anybody else. To share posts, votes, and follows across users:

### 1. Two more repos
- `lore-data` (public) — copy the seed files from `data/` in this repo into it.
- `lore-dms` (private) — empty to start, holds DM threads.

### 2. Deploy the Worker
Create a Cloudflare Worker, paste in `worker/worker.js`, deploy it. Then, under Settings → Variables, add these secrets:

| Secret | Value |
|---|---|
| `GITHUB_TOKEN` | fine-grained PAT, **Contents: write** on `lore-data` + `lore-dms` |
| `DATA_REPO` | `<you>/lore-data` |
| `DMS_REPO` | `<you>/lore-dms` |
| `ADMIN_USER` | `androbeet` |

### 3. Move the workflows
`.github/workflows/*.yml` needs to live inside `lore-data`, not here — they commit results next to the posts they're processing. Once they're moved:
- Daily: streaks, ECHO/RESONANCE badges, feed-index rebuild
- Monthly (1st): per-topic leaderboard JSON and the pinned circle chart

### 4. Point the frontend at it
In `index.html`, find `CONFIG` near the top of the script and set:
```js
const CONFIG = {
  WORKER_URL: "https://lore-api.<you>.workers.dev",
  DATA_BASE:  "https://cdn.jsdelivr.net/gh/<you>/lore-data@main",
  ...
};
```
Push it, and that's it.

### 5. Before public launch: real auth
Right now sign-in isn't locked down. Add Firebase Auth (free for up to 50k MAU) for Google/email sign-in, pass the Firebase ID token as `Authorization: Bearer <token>` to the Worker, and finish the JWT check in `worker/worker.js → identify()`. The plan for this lives in `docs/PLAN.md`.

---

## ✨ What's working right now

| Feature | Status |
|---|---|
| 3 themes — Maroon Glow (default), Monochrome, Light | live |
| Explore: Hot / Rising / New / Random tabs | live |
| Posting (text + image link), topics required | live |
| Upvote / downvote / comment / share-permalink | live |
| Profiles: pfp URL, bio, decoration ring, voice card, tags | live |
| Follow / mutual badge / online dot | live |
| ECHO / RESONANCE / PIONEER / Androbeet Seal / streak badges | live |
| Username + post search | live |
| Topic pages with pinned monthly circle chart | live |
| Notifications bar with unread badge | live |
| Communities (join/leave) | live |
| 50 seeded interest tags + request-new queue | live |
| DMs via private repo + Worker | activates in live mode |
| Admin dashboard, logs, bans, rate limits | Worker-side, live mode |

## 📁 Repo layout

```
index.html                      the whole app — single file, zero deps
404.html                        styled "lost in the Lore" error page
.nojekyll                       (hidden file) tells Pages to serve files as-is
manifest.webmanifest            PWA manifest — LORE installs like an app
sw.js                           service worker, offline support
robots.txt                      lets search engines index the site
LICENSE                         MIT — fork it, remix it
CONTRIBUTING.md                 rules for anyone who wants to help build
assets/
  icon-512.png                  app icon (PWA / phone home screen)
  og-banner.png                 social preview card (Twitter/Discord embeds)
worker/worker.js                Cloudflare Worker backend (free tier)
data/                           seed files for your lore-data repo
  config/tags.json              50 starter interest tags
  config/feed.json              feed index (last 500 posts)
  config/userindex.json         username search index
  users/androbeet.json          admin profile
  communities/the-forge.json    first community
.github/workflows/               move these into lore-data once you go live
  monthly-leaderboard.yml       auto-posted topic charts
  daily-maintenance.yml         streaks, echoes, feed rebuild
docs/
  HOSTING-GUIDE.md              click-by-click beginner hosting guide
  PLAN.md                       the full original plan
  ROADMAP.md                    what ships next, phase by phase
  RULES.md                      community rules & moderation policy
```

(`.nojekyll` won't show up in Windows/Mac file browsers by default since it starts with a dot — turn on hidden files, or just create it directly on GitHub: Add file → Create new file → name it `.nojekyll` → commit empty.)

---

*Built on GitHub. $0 forever. — aNDROBEET*
