# 🚀 LORE PREMIUM UPGRADE — Your Setup Guide (every step, beginner-level)

You're activating 4 premium systems, all on free tiers, with **zero data
loss** — every existing account, post and DM survives. Old DM history
**auto-migrates** to the new real-time system the first time a chat is opened.

| System | What it gives | Free tier | Time |
|---|---|---|---|
| Firebase Realtime DB | DMs & group chats become near-instant (no more GitHub commits per message) | 1 GB storage, 10 GB/month | ~15 min |
| Upstash Redis | Bot-proof, instant rate limiting | 10k commands/day | ~8 min |
| Brevo | Real email verification on signup | 300 emails/day | ~12 min |
| Buy Me a Coffee | Funding (@androbeet) | always free | done ✓ (in code) |

**The golden rule of this whole upgrade:** every system switches on ONLY
when its secrets exist in Cloudflare. No secrets = LORE keeps working
exactly as today. You can do these one at a time, in any order, safely.

---

## PART 0 — Deploy the new code FIRST (5 min)

1. Replace `index.html` and `worker/worker.js` in your **Lore-Social** repo
   (✏ → select all → paste → Commit) — from the refreshed `LORE-upload-me.zip`
2. Cloudflare → **Workers & Pages → lore-api → Edit code** → delete all →
   paste the new `worker/worker.js` → **Deploy**
3. Test the site still works (it will — nothing activates without secrets)

---

## PART 1 — Firebase: real-time DMs (~15 min)

### Create the project
1. Go to **https://console.firebase.google.com** → sign in with any Google account
2. **Create a project** → name: `lore-dms` → disable Google Analytics (not needed) → Create
3. Wait ~30s for it to provision → Continue

### Create the Realtime Database
4. Left sidebar → **Build → Realtime Database** → **Create Database**
5. Location: **Singapore (asia-southeast1)** (closest to India) → Next
6. Choose **Start in locked mode** → Enable
   (Locked = nobody can touch it except your Worker. Exactly what we want.)
7. You'll now see your database URL at the top, like:
   `https://lore-dms-default-rtdb.asia-southeast1.firebasedatabase.app`
   **Copy it** — this is `FIREBASE_URL`

### Get the secret key
8. Click the ⚙ gear (top-left) → **Project settings** → **Service accounts** tab
9. Click **Database secrets** (left of that panel) → hover the hidden value → **Show** → copy it
   **This is `FIREBASE_SECRET`** — treat it like a password, Cloudflare-only!

### Add to Cloudflare
10. Cloudflare → lore-api → **Settings → Variables and Secrets** → add 2 secrets:

| Name | Value |
|---|---|
| `FIREBASE_URL` | your database URL from step 7 |
| `FIREBASE_SECRET` | the secret from step 9 |

✅ **Done.** DMs and group chats now write to Firebase instantly. Old GitHub
threads migrate automatically the first time each chat is opened. Chat
polling speeds up automatically (the app detects live mode).

---

## PART 2 — Upstash: bot-proof rate limiting (~8 min)

1. Go to **https://upstash.com** → Sign up (GitHub login is easiest)
2. Console → **Create Database** (Redis)
   - Name: `lore-rate` · Type: **Regional** · Region: closest to you → Create
3. On the database page, find the **REST API** section
4. Copy two values:
   - **UPSTASH_REDIS_REST_URL** (like `https://xxxx.upstash.io`)
   - **UPSTASH_REDIS_REST_TOKEN** (long string)
5. Cloudflare → lore-api → Settings → Variables and Secrets → add:

| Name | Value |
|---|---|
| `UPSTASH_URL` | the REST URL |
| `UPSTASH_TOKEN` | the REST token |

✅ **Done.** Rate checks drop from ~500ms (GitHub) to ~5ms (Redis), and are
atomic — fast bots can no longer race past the limiter.

---

## PART 3 — Brevo: email verification (~12 min)

1. Go to **https://www.brevo.com** → Sign up free (use your Gmail)
2. Complete their short onboarding (choose "Transactional emails")
3. Top-right, your name → **SMTP & API** → **API Keys** tab → **Generate a new API key**
   - Name: `lore-worker` → Generate → **COPY IT NOW** (shown once!)
4. Important: verify a sender. **Senders & IPs → Senders → Add a sender** —
   use your Gmail (andrewz772k6@gmail.com). Brevo emails you a confirmation → click it.
5. Cloudflare → lore-api → Settings → Variables and Secrets → add **4**:

| Name | Value |
|---|---|
| `BREVO_KEY` | the API key from step 3 |
| `BREVO_SENDER` | `andrewz772k6@gmail.com` (the verified sender) |
| `WORKER_ORIGIN` | `https://lore-api.androbeetz.workers.dev` |
| `SITE_URL` | `https://androbeet.github.io/Lore-Social/` |

✅ **Done.** From now on, new signups get a beautiful maroon LORE
verification email. Unverified accounts can browse/log in but **cannot
post** until they click the link.

> ⚠️ Existing accounts (you, baka, etc.) are unaffected — they were created
> before verification existed, so they're treated as verified.

---

## PART 4 — Buy Me a Coffee (already wired ✓)

Code is done — these links to **buymeacoffee.com/androbeet** are now live:
- README: a badge + an honest "Why fund a $0 platform?" section
- App right rail: "♥ Keep LORE alive"
- Settings: a full "Support LORE" card

**Your only manual task:** make sure your page at
https://buymeacoffee.com/androbeet is set up — add the LORE banner
(assets/og-banner.png), and paste this into your page description:

> *I built LORE — a social network on a literal $0 budget — to prove it
> could be done. The core stays free forever. But growth has real costs:
> real-time servers, email systems, storage, moderation. Every coffee here
> converts directly into the next upgrade. You're not paying for what
> exists — you're funding what comes next. — ANDROBEET*

---

## ✅ FINAL CHECKLIST

```
[ ] New index.html + worker.js in the repo
[ ] New worker.js deployed on Cloudflare
[ ] FIREBASE_URL + FIREBASE_SECRET secrets       → instant DMs
[ ] UPSTASH_URL + UPSTASH_TOKEN secrets          → instant rate limits
[ ] BREVO_KEY + BREVO_SENDER + WORKER_ORIGIN
    + SITE_URL secrets                           → email verification
[ ] buymeacoffee.com/androbeet page polished
```

## 🧪 How to test each one

- **Firebase:** open a DM between your two accounts in two browsers —
  messages should land in ~2–3 seconds (vs 6–10 before)
- **Upstash:** spam the post button — the "slow down" error should be instant
- **Brevo:** create a fresh test account with a real email — the
  verification mail should arrive within a minute; try posting before
  clicking it (blocked), then after (works)
- **Funding:** click "Keep LORE alive" in the right rail

## 🆘 If something breaks

Remove the relevant secrets from Cloudflare → that system instantly falls
back to the old behavior. Nothing is ever lost — GitHub remains the
permanent archive for posts/profiles, and old DM threads stay in the
lore-dms repo as backup even after migration.
