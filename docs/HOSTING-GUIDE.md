# 🟥 COMPLETE BEGINNER'S GUIDE — Putting LORE on the Internet (free, no code)

You will NOT need to install anything. You will NOT need to type commands.
Everything happens in your web browser. Total time: ~10 minutes.

---

## PART 0 — What you're about to do (30-second explanation)

- **GitHub** = a free website where people store code.
- **A repository ("repo")** = one project folder on GitHub.
- **GitHub Pages** = a free feature that turns a repo into a real website
  with a real URL anyone can visit.

You'll upload the LORE files into a repo, flip one switch, and you're live.

---

## PART 1 — Make a GitHub account (skip if you have one)

1. Go to **https://github.com/signup**
2. Enter your email → create a password → choose a username
   (⚠️ your username becomes part of your website address, e.g.
   `androbeet.github.io` — so pick something you like!)
3. Verify your email. Done.

---

## PART 2 — Create your repository

1. Go to **https://github.com/new**
2. Fill in EXACTLY this:

   | Field | What to put |
   |---|---|
   | **Repository name** | `lore` (lowercase, no spaces) |
   | **Description** | `🔴 LORE — a zero-budget social network built entirely on GitHub. Profiles, voice cards, topics, ranks, streaks & monthly charts. $0 forever.` |
   | **Public / Private** | ✅ **Public** (Pages is free only for public repos) |
   | **Add a README** | ❌ leave UNCHECKED (we have our own) |

3. Click the green **Create repository** button.

> 💡 **Want the cleanest possible URL?** Name the repo
> `YOURUSERNAME.github.io` instead of `lore` — then your site lives at
> `https://YOURUSERNAME.github.io/` with nothing after it.
> Otherwise it's `https://YOURUSERNAME.github.io/lore/`. Both are fine.

---

## PART 3 — Upload the LORE files (drag & drop, no commands)

1. On your new empty repo page, click the link that says
   **"uploading an existing file"** (it's in the blue setup box).
2. Open the `lore` folder on your computer.
   **⚠️ IMPORTANT — hidden files:** the folder contains `.nojekyll` and a
   `.github` folder that your computer may HIDE from you:
   - **Windows:** in File Explorer click **View → Show → Hidden items**
   - **Mac:** in Finder press **Cmd + Shift + . (period)**
3. Select **everything inside the lore folder** (not the folder itself!):
   `index.html`, `404.html`, `README.md`, `LICENSE`, `manifest.webmanifest`,
   `sw.js`, `robots.txt`, `.nojekyll`, and the folders
   `assets`, `data`, `docs`, `worker`, `.github`
4. Drag them all into the GitHub upload box.
5. In the "Commit changes" box at the bottom, type `first upload` and click
   **Commit changes**.

> 😅 **If `.nojekyll` or `.github` refuse to upload** (some browsers skip
> dotfiles in drag-and-drop): on the repo page click **Add file → Create
> new file**, type `.nojekyll` as the filename, leave the content empty,
> and click **Commit changes**. That recreates it in 10 seconds.
> For `.github/workflows`, you can skip it for now — it's only needed
> later for the automated monthly charts (see README "Going live").

✔️ CHECK: your repo's front page should show `index.html` sitting at the
top level — NOT inside a subfolder called "lore". If everything got
nested inside a folder, delete the repo (Settings → bottom → Delete) and
re-upload the *contents*, not the folder.

---

## PART 4 — Flip the switch (enable GitHub Pages)

1. In your repo, click **⚙ Settings** (top tab).
2. In the left sidebar, click **Pages**.
3. Under **"Build and deployment" → Source**: choose **Deploy from a branch**.
4. Under **Branch**: choose **`main`**, folder **`/ (root)`**, click **Save**.
5. Wait 1–2 minutes. Refresh the page. A green box appears:
   **"Your site is live at https://YOURUSERNAME.github.io/lore/"**
6. Click the link. 🎉 **LORE is on the internet.**

---

## PART 5 — Polish your repo's public page (2 minutes, looks pro)

On your repo's main page, click the **⚙ gear icon** next to "About"
(top-right) and fill in:

- **Description:**
  `🔴 LORE — a zero-budget social network built entirely on GitHub. $0 forever.`
- **Website:** paste your live URL `https://YOURUSERNAME.github.io/lore/`
- **Topics** (type these one by one):
  `social-network` `github-pages` `zero-budget` `static-site`
  `serverless` `cloudflare-workers` `javascript` `free-hosting` `pwa`

This makes your repo discoverable and is exactly what r/SideProject /
Hacker News people check first.

---

## PART 6 — How to change things later

Any file can be edited right in the browser:

1. Click the file in your repo (e.g. `index.html`)
2. Click the **✏️ pencil icon** (top right of the file view)
3. Make your change → **Commit changes**
4. The live site updates itself in ~1 minute. That's the whole workflow.

Common edits:
- **Change site title/description** → edit the `<title>` and
  `<meta name="description">` lines at the top of `index.html`
- **Add interest tags** → edit `data/config/tags.json`
- **Connect the real backend** → follow "Going live" in `README.md`

---

## TROUBLESHOOTING

| Problem | Fix |
|---|---|
| 404 page when visiting my URL | Wait 2 more minutes; check Settings → Pages says "live"; make sure `index.html` is at the repo ROOT |
| Site shows README instead of the app | `index.html` is missing or nested in a subfolder — re-upload at root |
| Styles look broken | Hard-refresh: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac) |
| I can't see `.nojekyll` on my computer | It's hidden — see PART 3 step 2. On GitHub's website it always shows. |
| Pages option is greyed out | Repo must be **Public** (Settings → General → Change visibility) |
| My uploads vanished | You probably uploaded the folder instead of its contents |

Support: **andrewz772k6@gmail.com** · Admin: **aNDROBEET**
