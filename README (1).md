# 🔴 LORE — a zero-budget social network built on GitHub

> Every post you make is part of the Lore.

**Admin:** ANDROBEET · **Support:** andrewz772k6@gmail.com

A full social network — profiles, voice cards, topics, upvotes, communities,
ranks, streaks, monthly leaderboard charts — that costs **$0 forever**:

- **Hosting:** GitHub Pages (this repo)
- **Database:** a GitHub repo full of JSON files, read via jsDelivr CDN
- **Backend writes:** one free Cloudflare Worker (`worker/worker.js`)
- **Scheduled brain:** GitHub Actions (`.github/workflows/`) — streaks, echoes, monthly charts
- **Media:** users paste links (Imgur / Catbox) — nothing is ever stored here

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
.nojekyll                       ← makes Pages serve files as-is
worker/worker.js                ← Cloudflare Worker backend (free tier)
data/                           ← seed files for your lore-data repo
  config/tags.json              ← 50 starter interest tags
  config/feed.json              ← feed index (last 500 posts)
  config/userindex.json         ← username search index
  users/androbeet.json          ← admin profile
  communities/the-forge.json    ← first community
.github/workflows/              ← move these into lore-data
  monthly-leaderboard.yml       ← auto-posted topic charts
  daily-maintenance.yml         ← streaks, echoes, feed rebuild
docs/PLAN.md                    ← the full original plan
```

---

*Built on GitHub. $0 forever. — aNDROBEET*
