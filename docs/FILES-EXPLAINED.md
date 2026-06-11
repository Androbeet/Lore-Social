# 📁 EVERY FILE EXPLAINED — plain English, beginner edition

This is the "what is all this stuff?" guide. For each file: what it is,
what happens if you delete it, and whether you ever need to touch it.

**Legend:**
- 🟢 = upload it, forget it — never needs editing
- 🟡 = you'll edit this eventually
- 🔴 = important — don't delete

---

## THE MAIN APP

### 🔴🟡 `index.html` — THE ENTIRE APP
The whole social network lives in this ONE file: the design (CSS), the
pages, the logic (JavaScript), the demo data — everything. When someone
visits your site, this is what loads.

**You will edit this when:** you go live (fill in `CONFIG.WORKER_URL` and
`CONFIG.DATA_BASE` near the top of the `<script>` section), or want to
change the title/colors.
**If deleted:** no website. This is the website.

### 🔴🟢 `.nojekyll` — the invisible bodyguard
An EMPTY file (0 bytes, that's normal!). Its only job is existing — it
tells GitHub Pages "serve my files exactly as they are, don't run them
through Jekyll." It's hidden on your computer because its name starts
with a dot (Windows: View → Show → Hidden items · Mac: Cmd+Shift+.).
**If deleted:** the site may still work, but some files/folders can
silently break. Just keep it.

### 🟢 `404.html` — the "page not found" page
If someone visits a broken link on your site, GitHub automatically shows
this instead of an ugly default error. It's styled in your maroon theme
("This page isn't part of the Lore") with a button back home.
**You never need to touch it.**

---

## LOGO & BANNER (the visual identity)

### 🟢 `assets/icon-512.png` — the app icon
The glowing maroon "L". Used when someone **installs LORE on their phone**
(Add to Home Screen) — this becomes the app icon, like a real app.
`manifest.webmanifest` already points to it. **Nothing to apply manually.**
**To change it:** replace the image, keep the exact filename `icon-512.png`.

### 🟢 `assets/og-banner.png` — the share card
When your site link is pasted into WhatsApp / Discord / Twitter / iMessage,
this banner appears as the preview image. The `og:image` tags in
`index.html` already point to it. **Nothing to apply manually.**

**One optional bonus step:** make GitHub show it when people share your
*repo* link too → repo **Settings → General → Social preview → Edit →
Upload an image** → pick this file.

### Where's the favicon (browser-tab icon)?
It's not a separate file — it's a tiny SVG drawn inside `index.html`
(the `<link rel="icon" ...>` line). Already working.

### Where's the sidebar "LORE" logo?
It's styled TEXT, not an image (the `<div class="logo">` in `index.html`).
That's why it glows and loads instantly.

---

## PWA FILES (what makes LORE installable like an app)

### 🟢 `manifest.webmanifest` — the app's ID card
Tells phones: the app is called "LORE", its icon is `icon-512.png`, its
theme color is dark maroon, open it fullscreen without browser bars.
This is what makes "Add to Home Screen" give you a real app feel.

### 🟢 `sw.js` — the service worker (offline magic)
A background script browsers run for your site. After someone's first
visit, it caches the app so LORE **opens instantly and even works
offline**. Registered automatically by `index.html` — zero setup.

---

## SEO & LEGAL

### 🟢 `robots.txt` — note to Google
Three lines telling search engines "yes, you may index this site."

### 🟢 `LICENSE` — the legal file (MIT)
Says anyone may use/remix your code, but you (aNDROBEET) keep the
copyright credit. Repos with a license look professional and GitHub
shows a "MIT license" badge automatically.

### 🟢 `CONTRIBUTING.md` — rules for helpers
If strangers want to improve LORE, this tells them how (fork → edit →
pull request) and the golden rule: **everything must stay $0**.

### 🟡 `README.md` — your repo's front page
The first thing visitors see on GitHub (it renders below your file list
automatically). Contains the feature table, deploy steps, and go-live
guide. **Edit it** whenever you want to change how your project presents
itself.

---

## THE BACKEND (used later, when you "go live")

### 🟡 `worker/worker.js` — the brain-for-writes
Right now your site is in **demo mode** (each visitor's actions save only
in their own browser). To make posts/votes/follows SHARED between all
users, you'll copy-paste this file into Cloudflare Workers (free). It
safely holds your GitHub token and writes posts, votes, follows, DMs,
notifications, rate-limits and activity logs into your data repo.
**Until you go live, it just sits there doing nothing. That's fine.**

### 🟡 `data/` folder — starter database files
Templates for the SEPARATE `lore-data` repo you'll create when going live:
| File | What it stores |
|---|---|
| `config/tags.json` | the 50 starter interest tags (**edit freely!**) |
| `config/feed.json` | the feed index — last 500 posts (starts empty) |
| `config/userindex.json` | every username, for the search bar |
| `config/tag_requests.json` | user-suggested tags awaiting your approval |
| `users/androbeet.json` | your admin profile with the ⭐ Seal |
| `communities/the-forge.json` | the first community |
| `admin/reports.json` | reported posts queue (admin-only) |

### 🟡 `.github/workflows/` — the robot employees (hidden folder!)
Two "GitHub Actions" — scripts GitHub runs FOR you on a schedule, free:
- `daily-maintenance.yml` — every night: recalculates 🔥 streaks, awards
  ECHO/RESONANCE badges, rebuilds the feed index
- `monthly-leaderboard.yml` — 1st of each month: tallies engagement and
  generates the circle-chart leaderboard for every topic

**Important:** when you go live, these move into the `lore-data` repo
(they need to live next to the posts they process). Until then they're
harmless passengers here.

---

## DOCS (guides — never affect the site)

| File | What it is |
|---|---|
| `docs/HOSTING-GUIDE.md` | click-by-click beginner hosting walkthrough |
| `docs/FILES-EXPLAINED.md` | this file 👋 |
| `docs/ROADMAP.md` | what to build next, phase by phase |
| `docs/RULES.md` | community rules & moderation ladder |
| `docs/PLAN.md` | your original master plan, preserved |

---

## CHEAT SHEET

**Files you'll actually edit, ever:**
1. `index.html` — only when going live (2 lines) or restyling
2. `data/config/tags.json` — add/remove interest tags
3. `README.md` — your project's public face
4. `docs/RULES.md` — your community rules

**Everything else: upload once and never think about it again.**

**The two hidden things to not lose:** `.nojekyll` (file) and `.github/`
(folder). Enable hidden files on your computer before uploading, or
recreate them directly on GitHub's website.
