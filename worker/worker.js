/**
 * LORE — Cloudflare Worker backend (free tier: 100k requests/day)
 * ----------------------------------------------------------------
 * This is the ONLY server-side piece of LORE. It holds one GitHub
 * Personal Access Token (PAT) as a secret and writes to the data
 * repo on behalf of users. Users never see the token.
 *
 * DEPLOY (5 minutes, $0):
 *   1. https://dash.cloudflare.com → Workers & Pages → Create Worker
 *   2. Paste this file, click Deploy
 *   3. Settings → Variables → add secrets:
 *        GITHUB_TOKEN   = a fine-grained PAT with "Contents: write"
 *                         on your lore-data repo (and lore-dms repo)
 *        DATA_REPO      = "yourname/lore-data"
 *        DMS_REPO       = "yourname/lore-dms"      (private repo)
 *        ADMIN_USER     = "androbeet"
 *        SESSION_SECRET = any long random string you invent
 *                         (e.g. mash the keyboard for 40 chars).
 *                         This signs login session tokens.
 *   4. Copy the worker URL into CONFIG.WORKER_URL in index.html
 *
 * BUILT-IN ACCOUNTS: /signup and /login give users real accounts
 * (email + password). Passwords are salted & hashed 100,000× with
 * PBKDF2-SHA256 before storage — never stored in plain text. Sessions
 * are signed tokens valid 30 days. Banned users are rejected on every
 * request.
 *
 * Admin endpoints (/admin/ban, /admin/seal) only work for ADMIN_USER.
 */

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Best-effort isolate cache: reduces Tenor/GIPHY calls and makes repeat GIF searches instant.
const GIF_CACHE = new Map();

const GIFT_CATALOG = [
  {
    "id": "flower",
    "name": "flower",
    "price": 20
  },
  {
    "id": "coffee",
    "name": "coffee",
    "price": 20
  },
  {
    "id": "cake",
    "name": "cake",
    "price": 10
  },
  {
    "id": "candy",
    "name": "candy",
    "price": 20
  },
  {
    "id": "mood",
    "name": "mood",
    "price": 20
  },
  {
    "id": "fr",
    "name": "FR",
    "price": 60
  },
  {
    "id": "surprize",
    "name": "surprize",
    "price": 120
  },
  {
    "id": "dance",
    "name": "dance",
    "price": 120
  },
  {
    "id": "gemstone",
    "name": "gemstone",
    "price": 320
  },
  {
    "id": "fireworks",
    "name": "fireworks",
    "price": 2500
  },
  {
    "id": "winner",
    "name": "winner",
    "price": 40
  },
  {
    "id": "rocket",
    "name": "rocket",
    "price": 80
  },
  {
    "id": "relatable",
    "name": "relatable",
    "price": 40
  },
  {
    "id": "all_stars",
    "name": "all stars",
    "price": 240
  },
  {
    "id": "mvp",
    "name": "mvp",
    "price": 480
  },
  {
    "id": "throne",
    "name": "throne",
    "price": 1000
  },
  {
    "id": "kiss",
    "name": "kiss",
    "price": 20
  },
  {
    "id": "yes",
    "name": "yes",
    "price": 20
  },
  {
    "id": "baddie",
    "name": "baddie",
    "price": 60
  },
  {
    "id": "daddy",
    "name": "daddy",
    "price": 60
  }
];
const ACH_REWARDS = {
  "first_post": 10,
  "first_vote": 10,
  "first_comment": 10,
  "first_follow": 10,
  "pfp_set": 10,
  "bio_set": 10,
  "tag_3": 10,
  "theme_swap": 10,
  "posts_5": 10,
  "posts_10": 20,
  "posts_25": 20,
  "posts_50": 40,
  "posts_100": 40,
  "posts_250": 80,
  "posts_500": 160,
  "fol_10": 20,
  "fol_50": 40,
  "fol_100": 40,
  "fol_300": 80,
  "fol_1000": 160,
  "up_10": 10,
  "up_50": 20,
  "up_100": 40,
  "up_500": 80,
  "up_1000": 160,
  "votes_25": 10,
  "votes_100": 20,
  "votes_500": 80,
  "cmt_10": 10,
  "cmt_50": 20,
  "cmt_200": 80,
  "streak_3": 10,
  "streak_7": 20,
  "streak_30": 40,
  "streak_90": 80,
  "streak_365": 160,
  "following_10": 10,
  "following_50": 20,
  "dm_1": 10,
  "dm_100": 40,
  "group_1": 20,
  "comm_3": 10,
  "echo_1": 40,
  "reso_1": 160,
  "pioneer_1": 40,
  "seal_1": 160,
  "rank_top10": 40,
  "rank_top3": 80,
  "rank_1": 160,
  "night_post": 20,
  "early_100": 80,
  "posts_2": 10,
  "posts_3": 10,
  "posts_15": 20,
  "posts_75": 40,
  "posts_150": 60,
  "posts_300": 100,
  "posts_750": 180,
  "posts_1000": 240,
  "votes_5": 10,
  "votes_10": 10,
  "votes_50": 20,
  "votes_250": 50,
  "votes_750": 100,
  "votes_1000": 180,
  "votes_2000": 260,
  "cmt_3": 10,
  "cmt_5": 10,
  "cmt_25": 25,
  "cmt_75": 45,
  "cmt_100": 65,
  "cmt_250": 120,
  "cmt_500": 220,
  "following_3": 10,
  "following_5": 10,
  "following_15": 20,
  "following_25": 45,
  "following_75": 60,
  "following_100": 110,
  "fol_3": 10,
  "fol_5": 10,
  "fol_25": 30,
  "fol_75": 55,
  "fol_150": 80,
  "fol_500": 140,
  "fol_2000": 300,
  "tags_5": 10,
  "tags_8": 25,
  "tags_12": 50,
  "dm_3": 10,
  "dm_5": 10,
  "dm_25": 25,
  "dm_150": 60,
  "dm_500": 200,
  "groups_1": 15,
  "groups_3": 30,
  "groups_10": 120,
  "ups_5": 10,
  "ups_25": 25,
  "ups_250": 110,
  "ups_2000": 320,
  "night_3": 25,
  "night_10": 60
};

function storeFrames() {
  return Array.from({ length: 50 }, (_, i) => {
    const n = i + 1;
    return { id: "frame_" + String(n).padStart(2, "0"), name: "Avatar Frame " + n, price: n <= 15 ? 80 : n <= 35 ? 180 : n <= 45 ? 420 : 900 };
  });
}
function storeBubbles() {
  return Array.from({ length: 50 }, (_, i) => {
    const n = i + 1;
    return { id: "bubble_" + String(n).padStart(2, "0"), name: "Chat Bubble " + n, price: n <= 15 ? 60 : n <= 35 ? 140 : n <= 45 ? 360 : 800 };
  });
}


export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: JSON_HEADERS });

    const url = new URL(request.url);
    const route = url.pathname;

    try {
      // email verification landing (GET link from inbox)
      if (request.method === "GET" && route === "/verify") return await verifyEmail(url, env);
      if (request.method !== "POST") return reply({ ok: true, service: "LORE API" });

      const body = await request.json();

      // --- public endpoints (no login needed) ---
      if (route === "/signup") return await signup(body, env);
      if (route === "/login") return await login(body, env);

      // --- everything below requires a valid session token ---
      const user = await identify(request, body, env); // throws if invalid

      switch (route) {
        case "/post":              return await createPost(user, body, env);
        case "/vote":              return await vote(user, body, env);
        case "/comment":           return await comment(user, body, env);
        case "/follow":            return await follow(user, body, env);
        case "/join-community":    return await joinCommunity(user, body, env);
        case "/update-profile":    return await updateProfile(user, body, env);
        case "/upload-pfp":        return await uploadPfp(user, body, env);
        case "/message":           return await dm(user, body, env);
        case "/dm-thread":         return await dmThread(user, body, env);
        case "/dm-inbox":          return await dmInbox(user, body, env);
        case "/dm-requests":       return await dmRequests(user, body, env);
        case "/dm-accept":         return await dmAccept(user, body, env);
        case "/request-tag":       return await requestTag(user, body, env);
        case "/report":            return await report(user, body, env);
        case "/delete-post":       return await deletePost(user, body, env);
        case "/set-privacy":       return await setPrivacy(user, body, env);
        case "/block":             return await blockUser(user, body, env);
        case "/edit-post":         return await editPost(user, body, env);
        case "/group-create":      return await groupCreate(user, body, env);
        case "/group-message":     return await groupMessage(user, body, env);
        case "/group-thread":      return await groupThread(user, body, env);
        case "/close-friends":     return await closeFriends(user, body, env);
        case "/stories":           return await storiesList(user, body, env);
        case "/story-create":      return await storyCreate(user, body, env);
        case "/story-view":        return await storyView(user, body, env);
        case "/story-react":       return await storyReact(user, body, env);
        case "/story-delete":      return await storyDelete(user, body, env);
        case "/mark-notifs-read":  return await markNotifsRead(user, env);
        case "/upload":            return await uploadMedia(user, body, env);
        case "/gif-search":        return await gifSearch(user, body, env);
        case "/export":            return await exportData(user, body, env);
        case "/wallet":            return await walletState(user, body, env);
        case "/coins-claim":       return await coinsClaim(user, body, env);
        case "/coins-ach":         return await coinsAchievement(user, body, env);
        case "/coins-gift":        return await coinsGift(user, body, env);
        case "/coins-buy":         return await coinsBuy(user, body, env);
        case "/coins-apply":       return await coinsApply(user, body, env);
        case "/coins-convert":     return await coinsConvert(user, body, env);
        case "/voucher-redeem":    return await voucherRedeem(user, body, env);
        // --- admin-only (ANDROBEET) ---
        case "/admin/ban":         return await adminBan(user, body, env);
        case "/admin/seal":        return await adminSeal(user, body, env);
        case "/admin/coins":       return await adminCoins(user, body, env);
        case "/admin/voucher":     return await adminVoucher(user, body, env);
        case "/admin/badge":       return await adminBadge(user, body, env);
        default:                    return reply({ error: "unknown endpoint" }, 404);
      }
    } catch (e) {
      return reply({ error: String(e.message || e) }, 400);
    }
  },
};

function reply(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });
}

/* ---------- crypto helpers (password hashing & session tokens) ---------- */
async function sha256hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt) {
  // PBKDF2-SHA256, 100k iterations (Web Crypto, native in Workers).
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 100000, hash: "SHA-256" },
    key,
    256,
  );
  return "pbkdf2$" + [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function legacyHash(password, salt) {
  // old scheme (SHA-256 ×10k) — kept ONLY to verify pre-upgrade accounts
  let h = salt + ":" + password;
  for (let i = 0; i < 10000; i++) h = await sha256hex(h);
  return h;
}

async function makeToken(username, env) {
  // HMAC-style token: username.expiry.signature — stateless, no DB needed
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 days
  const sig = await sha256hex(`${username}.${exp}.${env.SESSION_SECRET}`);
  return `${username}.${exp}.${sig}`;
}

async function verifyToken(token, env) {
  const [username, exp, sig] = (token || "").split(".");
  if (!username || !exp || !sig) throw new Error("not logged in");
  if (Date.now() > Number(exp)) throw new Error("session expired — log in again");
  const expect = await sha256hex(`${username}.${exp}.${env.SESSION_SECRET}`);
  if (sig !== expect) throw new Error("invalid session");
  return username;
}

/* ---------- ACCOUNTS: signup / login ---------- */
async function signup(body, env) {
  const username = (body.username || "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
  const email = String(body.email || "").trim().toLowerCase().slice(0, 100);
  const password = String(body.password || "");
  if (username.length < 3) throw new Error("username must be 3+ characters (a-z, 0-9, _)");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("valid email required");
  if (password.length < 8) throw new Error("password must be 8+ characters");
  const reserved = ["admin", "lore", "system", "mod", "root", "support", "moderator", "official"];
  if (reserved.includes(username)) throw new Error("username reserved");

  // THE ADMIN LOCK: the admin username can ONLY be registered with the
  // secret ADMIN_CLAIM key (set in Cloudflare). Nobody else can take it.
  const isAdmin = username === (env.ADMIN_USER || "androbeet");
  if (isAdmin && (body.adminKey || "") !== env.ADMIN_CLAIM) {
    throw new Error("this username is reserved");
  }

  // already taken? (the auth file is the real account record)
  const existingAuth = await ghGetJSON(env, env.DATA_REPO, `auth/${username}.json`);
  if (existingAuth.json) throw new Error("username already taken");
  const existingProfile = await ghGetJSON(env, env.DATA_REPO, `users/${username}.json`);
  if (existingProfile.json && !isAdmin) throw new Error("username already taken");

  const salt = crypto.randomUUID();
  if (existingProfile.json && isAdmin) {
    // admin claiming the pre-seeded profile: keep it (Seal, admin flag), just attach credentials
  } else {
    const profile = {
      bio: "New to LORE. Writing my first pages.",
      pfp: "",
      voice: "",
      tags: [],
      followers: [],
      following: [],
      joined: new Date().toISOString().slice(0, 10),
      streak: { count: 0, tier: "—" },
      seal: false,
      echoes: 0,
      resonance: 0,
      pioneer: 0,
      ranks: {},
      theme: "maroon",
      banned: false,
      shadowbanned: false,
    };
    await ghPutJSON(env, env.DATA_REPO, `users/${username}.json`, profile, null, `signup ${username}`);
  }

  // credentials live in a separate file (never sent to the frontend)
  const emailOn = !!(env.BREVO_KEY && env.BREVO_SENDER);
  const vtoken = crypto.randomUUID().replace(/-/g, "");
  await ghPutJSON(
    env,
    env.DATA_REPO,
    `auth/${username}.json`,
    {
      email,
      salt,
      hash: await hashPassword(password, salt),
      created: new Date().toISOString(),
      verified: !emailOn,
      ...(emailOn ? { vtoken } : {}),
    },
    null,
    `auth ${username}`,
  );
  if (emailOn) {
    const origin = env.WORKER_ORIGIN || "";
    await sendVerifyEmail(env, email, username, vtoken, origin).catch(() => {});
  }

  // add to search index
  const idx = await ghGetJSON(env, env.DATA_REPO, "config/userindex.json");
  const list = idx.json || [];
  if (!list.includes(username)) {
    list.push(username);
    await ghPutJSON(env, env.DATA_REPO, "config/userindex.json", list, idx.sha, `index ${username}`);
  }
  await log(env, username, "signup", { email });
  return reply({ ok: true, token: await makeToken(username, env), username, needsVerify: emailOn });
}

async function login(body, env) {
  const username = (body.username || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  const { json: creds, sha: csha } = await ghGetJSON(env, env.DATA_REPO, `auth/${username}.json`);
  if (!creds) throw new Error("no such account");
  const supplied = String(body.password || "");
  let valid = false;
  if (String(creds.hash).startsWith("pbkdf2$")) {
    valid = (await hashPassword(supplied, creds.salt)) === creds.hash;
  } else {
    // legacy account: verify with old scheme, then silently upgrade to PBKDF2
    valid = (await legacyHash(supplied, creds.salt)) === creds.hash;
    if (valid) {
      try {
        creds.hash = await hashPassword(supplied, creds.salt);
        await ghPutJSON(env, env.DATA_REPO, `auth/${username}.json`, creds, csha, `rehash ${username}`);
      } catch (e) {}
    }
  }
  if (!valid) {
    await log(env, username, "login_failed", {});
    throw new Error("wrong password");
  }
  const { json: u } = await ghGetJSON(env, env.DATA_REPO, `users/${username}.json`);
  if (u && u.banned) throw new Error("account banned — contact andrewz772k6@gmail.com");
  await log(env, username, "login", {});
  return reply({ ok: true, token: await makeToken(username, env), username });
}

/* ---------- identity (session token check on every action) ---------- */
async function identify(request, body, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Error("not logged in");
  const username = await verifyToken(auth.slice(7), env);
  const u = await ghGetJSON(env, env.DATA_REPO, `users/${username}.json`).catch(() => null);
  if (u && u.json && u.json.banned) throw new Error("account banned");
  return username;
}

/* ---------- ADMIN endpoints (only ADMIN_USER passes) ---------- */
function assertAdmin(user, env) {
  if (user !== (env.ADMIN_USER || "androbeet")) throw new Error("admins only");
}

async function updateBanList(env, target, flags, actor) {
  try {
    const path = "admin/banned_users.json";
    const { json, sha } = await ghGetJSON(env, env.DATA_REPO, path);
    const list = json && typeof json === "object" && !Array.isArray(json)
      ? json
      : { banned: [], shadowbanned: [], users: {} };
    list.banned = Array.isArray(list.banned) ? list.banned : [];
    list.shadowbanned = Array.isArray(list.shadowbanned) ? list.shadowbanned : [];
    list.users = list.users && typeof list.users === "object" ? list.users : {};

    if (flags.banned || flags.shadowbanned) {
      list.users[target] = {
        banned: !!flags.banned,
        shadowbanned: !!flags.shadowbanned,
        updated: new Date().toISOString(),
        by: actor,
      };
    } else {
      delete list.users[target];
    }

    list.banned = Object.keys(list.users).filter((u) => list.users[u].banned).sort();
    list.shadowbanned = Object.keys(list.users).filter((u) => list.users[u].shadowbanned).sort();
    list.updated = new Date().toISOString();
    await ghPutJSON(env, env.DATA_REPO, path, list, sha, `ban list ${target}`);
  } catch (e) {
    // Ban itself must not fail just because the convenience list had a conflict.
  }
}

async function adminBan(user, body, env) {
  assertAdmin(user, env);
  const target = String(body.target || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!target) throw new Error("missing target");
  if (target === user || target === (env.ADMIN_USER || "androbeet")) {
    throw new Error("admin cannot ban or shadowban himself");
  }
  const { json, sha } = await ghGetJSON(env, env.DATA_REPO, `users/${target}.json`);
  if (!json) throw new Error("user not found");
  if (body.mode === "shadowban") json.shadowbanned = !json.shadowbanned;
  else json.banned = !json.banned;
  await ghPutJSON(env, env.DATA_REPO, `users/${target}.json`, json, sha, `admin action ${target}`);
  await updateBanList(env, target, { banned: !!json.banned, shadowbanned: !!json.shadowbanned }, user);
  await log(env, user, "admin_" + (body.mode || "ban"), { target });
  return reply({ ok: true, banned: json.banned, shadowbanned: json.shadowbanned });
}

async function adminSeal(user, body, env) {
  assertAdmin(user, env);
  if (body.post) {
    const { json, sha } = await ghGetJSON(env, env.DATA_REPO, `posts/${body.post}.json`);
    if (!json) throw new Error("post not found");
    json.seal = true;
    await ghPutJSON(env, env.DATA_REPO, `posts/${body.post}.json`, json, sha, "seal post");
    await notify(env, json.author, { type: "seal", from: user, post: json.id });
  } else if (body.target) {
    const target = String(body.target || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
    const { json, sha } = await ghGetJSON(env, env.DATA_REPO, `users/${target}.json`);
    if (!json) throw new Error("user not found");
    json.seal = !json.seal;
    await ghPutJSON(env, env.DATA_REPO, `users/${target}.json`, json, sha, "seal user");
    await notify(env, target, { type: "seal", from: user });
  }
  await log(env, user, "admin_seal", body);
  return reply({ ok: true });
}

/* ---------- GitHub API helpers ---------- */
async function gh(env, repo, path, method = "GET", payload) {
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "lore-worker",
      Accept: "application/vnd.github+json",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok && res.status !== 404) throw new Error(`GitHub ${res.status}`);
  return res;
}

async function ghGetJSON(env, repo, path) {
  const res = await gh(env, repo, path);
  if (res.status === 404) return { json: null, sha: null };
  const data = await res.json();
  const text = atob(data.content.replace(/\n/g, ""));
  return { json: JSON.parse(decodeURIComponent(escape(text))), sha: data.sha };
}

async function ghPutJSON(env, repo, path, json, sha, message) {
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(json, null, 1))));
  const res = await gh(env, repo, path, "PUT", { message, content, sha: sha || undefined });
  if (!res.ok) throw new Error(`write failed ${res.status}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function isConflict(e) {
  return /409|conflict/i.test(String(e && (e.message || e)));
}
async function mutateJSON(env, repo, path, fallback, mutate, message, tries = 4) {
  for (let i = 0; i < tries; i++) {
    const { json, sha } = await ghGetJSON(env, repo, path);
    const base = json == null ? JSON.parse(JSON.stringify(fallback)) : json;
    const next = await mutate(base);
    try {
      await ghPutJSON(env, repo, path, next, sha, message);
      return next;
    } catch (e) {
      if (!isConflict(e) || i === tries - 1) throw e;
      await sleep(250 + i * 400);
    }
  }
}

/* ---------- rate limiting ----------
   PREMIUM: Upstash Redis (atomic, ~5ms, can't be raced by fast bots).
   Activates when UPSTASH_URL + UPSTASH_TOKEN secrets exist.
   FALLBACK: repo-backed (slower, fine for low traffic). */
async function checkRate(env, user, action, minSeconds) {
  if (env.UPSTASH_URL && env.UPSTASH_TOKEN) {
    try {
      const key = encodeURIComponent(`rate:${user}:${action}`);
      const r = await fetch(`${env.UPSTASH_URL}/set/${key}/1?NX=true&EX=${minSeconds}`, {
        headers: { Authorization: "Bearer " + env.UPSTASH_TOKEN },
      });
      const d = await r.json();
      if (d.result === null) throw new Error("slow down");
      return; // atomic SET NX EX: one command, race-proof
    } catch (e) {
      if (String(e.message).includes("slow down")) throw e;
      // Upstash hiccup → fall through to repo fallback
    }
  }
  for (let i = 0; i < 3; i++) {
    const { json, sha } = await ghGetJSON(env, env.DATA_REPO, `ratelimits/${user}.json`);
    const now = Date.now();
    const r = json || {};
    if (r[action] && now - r[action] < minSeconds * 1000) throw new Error("slow down");
    r[action] = now;
    try {
      await ghPutJSON(env, env.DATA_REPO, `ratelimits/${user}.json`, r, sha, `rate ${user}`);
      return;
    } catch (e) {
      if (!isConflict(e) || i === 2) throw e;
      await sleep(250 + i * 300);
    }
  }
}

/* ---------- Firebase Realtime DB (real-time DM layer) ----------
   Activates when FIREBASE_URL + FIREBASE_SECRET secrets exist.
   Old GitHub DM threads auto-migrate on first touch — ZERO data loss. */
function fbOn(env) {
  return !!(env.FIREBASE_URL && env.FIREBASE_SECRET);
}

async function fb(env, path, method = "GET", body, query = "") {
  const url =
    env.FIREBASE_URL.replace(/\/+$/, "") +
    "/" +
    path +
    ".json?auth=" +
    env.FIREBASE_SECRET +
    (query ? "&" + query : "");
  const res = await fetch(url, { method, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error("firebase " + res.status);
  return res.json();
}

async function migrateThread(env, pair) {
  try {
    if (await fb(env, `threads/${pair}/migrated`)) return;
    const { json } = await ghGetJSON(env, env.DMS_REPO, `threads/${pair}.json`).catch(() => ({ json: null }));
    const seed = {};
    if (json && json.messages) json.messages.forEach((m, i) => { seed["m" + String(i).padStart(6, "0")] = m; });
    await fb(env, `threads/${pair}`, "PATCH", { migrated: true, ...(Object.keys(seed).length ? { messages: seed } : {}) });
  } catch (e) {}
}

async function migrateGroup(env, id) {
  try {
    if (await fb(env, `groups/${id}/migrated`)) return;
    const { json } = await ghGetJSON(env, env.DMS_REPO, `groups/${id}.json`).catch(() => ({ json: null }));
    if (!json) {
      await fb(env, `groups/${id}/migrated`, "PUT", true);
      return;
    }
    const msgs = {};
    (json.messages || []).forEach((m, i) => { msgs["m" + String(i).padStart(6, "0")] = m; });
    const members = {};
    (json.members || []).forEach((m) => { members[m] = true; });
    await fb(env, `groups/${id}`, "PATCH", {
      migrated: true,
      name: json.name,
      owner: json.owner,
      members,
      ...(Object.keys(msgs).length ? { messages: msgs } : {}),
    });
  } catch (e) {}
}

/* ---------- email verification (Brevo, 300 free emails/day) ----------
   Activates when BREVO_KEY + BREVO_SENDER + SITE_URL secrets exist. */
async function sendVerifyEmail(env, email, username, token, workerOrigin) {
  if (!env.BREVO_KEY || !env.BREVO_SENDER) return false;
  const link = `${workerOrigin}/verify?u=${encodeURIComponent(username)}&k=${encodeURIComponent(token)}`;
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: "LORE", email: env.BREVO_SENDER },
      to: [{ email }],
      subject: "Verify your LORE account",
      htmlContent: `<div style="font-family:Georgia,serif;background:#13040a;color:#fff;padding:32px;border-radius:14px">
        <h1 style="letter-spacing:6px">L<span style="color:#e63956">O</span>RE</h1>
        <p>Welcome to the Lore, <b>@${username}</b>.</p>
        <p>Click below to verify your account and unlock posting:</p>
        <p><a href="${link}" style="background:#e63956;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:bold">Verify my account</a></p>
        <p style="color:#9c8a90;font-size:12px">If you didn't sign up, ignore this email.<br>— ANDROBEET, admin of LORE</p></div>`,
    }),
  });
  return res.ok;
}

async function verifyEmail(url, env) {
  const username = (url.searchParams.get("u") || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  const token = url.searchParams.get("k") || "";
  const page = (msg, ok) => new Response(
    `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#13040a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
     <div style="text-align:center"><h1 style="letter-spacing:8px">L<span style="color:#e63956">O</span>RE</h1>
     <p style="font-size:18px">${msg}</p>${ok && env.SITE_URL ? `<a href="${env.SITE_URL}" style="color:#e63956">→ Open LORE and log in</a>` : ""}</div></body></html>`,
    { headers: { "Content-Type": "text/html" } },
  );
  if (!username || !token) return page("Invalid verification link.", false);
  const { json: creds, sha } = await ghGetJSON(env, env.DATA_REPO, `auth/${username}.json`);
  if (!creds || creds.vtoken !== token) return page("Invalid or expired verification link.", false);
  creds.verified = true;
  delete creds.vtoken;
  await ghPutJSON(env, env.DATA_REPO, `auth/${username}.json`, creds, sha, `verified ${username}`);
  await log(env, username, "email_verified", {});
  return page(`@${username} verified. Welcome to the Lore.`, true);
}

/* ---------- activity log (admin-only viewing) ---------- */
async function log(env, user, action, details) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const { json, sha } = await ghGetJSON(env, env.DATA_REPO, `admin/logs/${day}.json`);
    const arr = json || [];
    arr.push({ ts: new Date().toISOString(), user, action, details });
    await ghPutJSON(env, env.DATA_REPO, `admin/logs/${day}.json`, arr, sha, `log ${action}`);
  } catch (e) {
    /* logging never blocks the action */
  }
}

/* ---------- notifications ---------- */
async function notify(env, target, item) {
  const path = `users/${target}/notifications.json`;
  for (let i = 0; i < 4; i++) {
    try {
      const { json, sha } = await ghGetJSON(env, env.DATA_REPO, path);
      const n = json || { unread_count: 0, items: [] };
      n.items = Array.isArray(n.items) ? n.items : [];
      // DEDUP: skip if same from+type already exists unread within 2 hours
      if (item.from && item.type !== "gift" && item.type !== "coins") {
        const cutoff = Date.now() - 7200000;
        const dup = n.items.find((x) =>
          x.type === item.type &&
          x.from === item.from &&
          !x.read &&
          (item.story ? x.story === item.story : item.post ? x.post === item.post : !x.post && !x.story) &&
          (typeof x.ts === "string" ? Date.parse(x.ts) : (x.ts || 0)) > cutoff
        );
        if (dup) return;
      }
      n.items.unshift({ ...item, ts: new Date().toISOString(), read: false });
      n.items = n.items.slice(0, 100);
      n.unread_count = n.items.filter((x) => !x.read).length;
      await ghPutJSON(env, env.DATA_REPO, path, n, sha, `notify ${target}`);
      return;
    } catch (e) {
      if (!isConflict(e) || i === 3) return;
      await sleep(300 + i * 450);
    }
  }
}

async function markNotifsRead(user, env) {
  const path = `users/${user}/notifications.json`;
  for (let i = 0; i < 4; i++) {
    try {
      const { json, sha } = await ghGetJSON(env, env.DATA_REPO, path);
      if (!json) return reply({ ok: true });
      json.items = Array.isArray(json.items) ? json.items : [];
      if (!json.items.some((n) => !n.read) && !json.unread_count) return reply({ ok: true });
      json.items = json.items.map((n) => ({ ...n, read: true }));
      json.unread_count = 0;
      await ghPutJSON(env, env.DATA_REPO, path, json, sha, `read notifs ${user}`);
      return reply({ ok: true });
    } catch (e) {
      if (!isConflict(e) || i === 3) return reply({ ok: true, delayed: true });
      await sleep(300 + i * 500);
    }
  }
  return reply({ ok: true, delayed: true });
}

/* feed updates retry on write conflicts (two posts at the same time) */
async function updateFeed(env, mutate) {
  for (let i = 0; i < 3; i++) {
    try {
      const { json, sha } = await ghGetJSON(env, env.DATA_REPO, "config/feed.json");
      await ghPutJSON(env, env.DATA_REPO, "config/feed.json", mutate(json || []), sha, "feed update");
      return;
    } catch (e) {
      if (i === 2) throw e;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
}

/* ---------- endpoints ---------- */
async function createPost(user, body, env) {
  // email verification gate (only when email system is on)
  if (env.BREVO_KEY) {
    const a = await ghGetJSON(env, env.DATA_REPO, `auth/${user}.json`).catch(() => ({ json: null }));
    if (a.json && a.json.verified === false) throw new Error("verify your email first — check your inbox");
  }
  await checkRate(env, user, "post", 60); // max 1 post/min
  const id = "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  const post = {
    id,
    author: user,
    topic: String(body.topic || "General").slice(0, 40),
    text: String(body.text || "").slice(0, 4000),
    img: String(body.img || "").slice(0, 500),
    ts: Date.now(),
    up: [],
    down: [],
    shares: 0,
    echo: "",
    pioneer: "",
    comments: [],
    private: !!body.private,
  };
  if (!post.text) throw new Error("empty post");
  await ghPutJSON(env, env.DATA_REPO, `posts/${id}.json`, post, null, `post by ${user}`);

  // shadowbanned users: post saves (they see it on their profile)
  // but it NEVER enters the public feed — true shadowban
  const prof = await ghGetJSON(env, env.DATA_REPO, `users/${user}.json`).catch(() => null);
  const shadow = prof && prof.json && prof.json.shadowbanned;

  if (!post.private && !shadow) {
    await updateFeed(env, (feed) => {
      feed.unshift({
        id,
        author: user,
        topic: post.topic,
        snippet: post.text.slice(0, 280),
        img: post.img,
        ts: post.ts,
        up: 0,
        down: 0,
        comments: 0,
        echo: "",
      });
      return feed.slice(0, 500);
    });
  }
  await log(env, user, "post_created", { id, private: post.private });
  return reply({ ok: true, id });
}

async function vote(user, body, env) {
  let post;
  for (let i = 0; i < 4; i++) {
    const got = await ghGetJSON(env, env.DATA_REPO, `posts/${body.post}.json`);
    post = got.json;
    if (!post) throw new Error("post not found");
    post.up = Array.isArray(post.up) ? post.up : [];
    post.down = Array.isArray(post.down) ? post.down : [];
    for (const k of ["up", "down"]) post[k] = post[k].filter((u) => u !== user);
    if (body.dir === "up") post.up.push(user);
    if (body.dir === "down") post.down.push(user);
    try {
      await ghPutJSON(env, env.DATA_REPO, `posts/${body.post}.json`, post, got.sha, `vote ${user}`);
      break;
    } catch (e) {
      if (!isConflict(e) || i === 3) throw e;
      await sleep(250 + i * 350);
    }
  }
  // keep explore-page counts in sync with reality
  await updateFeed(env, (feed) => {
    const e = feed.find((x) => x.id === body.post);
    if (e) {
      e.up = post.up.length;
      e.down = post.down.length;
    }
    return feed;
  }).catch(() => {});
  if (body.dir === "up" && post.author !== user) {
    await notify(env, post.author, { type: "upvote", from: user, post: post.id });
  }
  await log(env, user, "vote", { post: body.post, dir: body.dir });
  return reply({ ok: true, up: post.up.length, down: post.down.length });
}

async function comment(user, body, env) {
  await checkRate(env, user, "comment", 10);
  const text = String(body.text || "").slice(0, 1000).trim();
  if (!text) throw new Error("empty comment");
  const item = {
    a: user,
    t: text,
    ts: Date.now(),
    parent: body.parent != null ? String(body.parent).slice(0, 30) : null,
    cid: "c" + Date.now() + Math.random().toString(36).slice(2, 6),
  };
  let post;
  for (let i = 0; i < 4; i++) {
    const got = await ghGetJSON(env, env.DATA_REPO, `posts/${body.post}.json`);
    post = got.json;
    if (!post) throw new Error("post not found");
    post.comments = Array.isArray(post.comments) ? post.comments : [];
    if (post.comments.length === 0) post.pioneer = user; // PIONEER badge
    if (!post.comments.some((c) => c.cid === item.cid)) post.comments.push(item);
    try {
      await ghPutJSON(env, env.DATA_REPO, `posts/${body.post}.json`, post, got.sha, `comment ${user}`);
      break;
    } catch (e) {
      if (!isConflict(e) || i === 3) throw e;
      await sleep(300 + i * 450);
    }
  }
  await updateFeed(env, (feed) => {
    const e = feed.find((x) => x.id === body.post);
    if (e) e.comments = post.comments.length;
    return feed;
  }).catch(() => {});
  if (post.author !== user) {
    await notify(env, post.author, { type: "comment", from: user, post: post.id, snippet: text.slice(0, 60) });
  }
  await log(env, user, "comment", { post: body.post });
  return reply({ ok: true });
}

async function follow(user, body, env) {
  await checkRate(env, user, "follow", 12); // max ~5/min
  const target = String(body.target || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!target || target === user) throw new Error("bad target");
  const a = await ghGetJSON(env, env.DATA_REPO, `users/${user}.json`);
  const b = await ghGetJSON(env, env.DATA_REPO, `users/${target}.json`);
  if (!b.json) throw new Error("user not found");
  if ((b.json.blocked || []).includes(user)) throw new Error("you can't follow this user");
  if ((a.json.blocked || []).includes(target)) throw new Error("unblock them first");
  a.json.following = a.json.following || [];
  b.json.followers = b.json.followers || [];
  const unfollow = a.json.following.includes(target);
  a.json.following = unfollow ? a.json.following.filter((x) => x !== target) : [...a.json.following, target];
  b.json.followers = unfollow ? b.json.followers.filter((x) => x !== user) : [...b.json.followers, user];
  await ghPutJSON(env, env.DATA_REPO, `users/${user}.json`, a.json, a.sha, `follow ${user}`);
  await ghPutJSON(env, env.DATA_REPO, `users/${target}.json`, b.json, b.sha, `follower ${target}`);
  if (!unfollow) await notify(env, target, { type: "follow", from: user });
  return reply({ ok: true, following: !unfollow });
}

async function joinCommunity(user, body, env) {
  const name = String(body.community || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const { json, sha } = await ghGetJSON(env, env.DATA_REPO, `communities/${name}.json`);
  if (!json) throw new Error("community not found");
  json.members = json.members.includes(user) ? json.members.filter((m) => m !== user) : [...json.members, user];
  await ghPutJSON(env, env.DATA_REPO, `communities/${name}.json`, json, sha, `join ${user}`);
  return reply({ ok: true });
}

async function updateProfile(user, body, env) {
  const { json, sha } = await ghGetJSON(env, env.DATA_REPO, `users/${user}.json`);
  const u = json || { followers: [], following: [], joined: new Date().toISOString().slice(0, 10) };
  u.bio = String(body.bio || "").slice(0, 400);
  u.pfp = String(body.pfp || "").slice(0, 500);
  u.voice = String(body.voice || "").slice(0, 500);
  u.tags = (body.tags || []).slice(0, 12).map((t) => String(t).slice(0, 30));
  u.theme = body.theme || u.theme;
  u.banner = String(body.banner || u.banner || "").slice(0, 500);
  if (typeof body.privateProfile === "boolean") u.privateProfile = body.privateProfile;
  if (body.socials && typeof body.socials === "object") {
    u.socials = {};
    for (const k of ["instagram", "x", "youtube", "snapchat", "facebook", "tiktok", "discord", "website"]) {
      if (body.socials[k]) u.socials[k] = String(body.socials[k]).slice(0, 200);
    }
  }
  if (Array.isArray(body.showcase)) u.showcase = body.showcase.slice(0, 3).map((x) => String(x).slice(0, 30));
  if (Array.isArray(body.claimed)) u.claimed = [...new Set(body.claimed.map((x) => String(x).slice(0, 30)))].slice(0, 100);
  await ghPutJSON(env, env.DATA_REPO, `users/${user}.json`, u, sha, `profile ${user}`);

  // keep username index fresh (for client-side search)
  const idx = await ghGetJSON(env, env.DATA_REPO, "config/userindex.json");
  const list = idx.json || [];
  if (!list.includes(user)) {
    list.push(user);
    await ghPutJSON(env, env.DATA_REPO, "config/userindex.json", list, idx.sha, `index ${user}`);
  }
  return reply({ ok: true });
}

/* ---------- PROFILE PICTURE UPLOAD (stored right in the data repo) ----------
   The frontend sends a base64 JPEG (already cropped to 256x256 client-side).
   We commit it as pfp/<username>.jpg — served free via raw.githubusercontent.
   Size cap: 150 KB encoded (~110 KB binary) keeps the repo lean forever:
   even 10,000 users ≈ ~1 GB, equal to GitHub's recommended repo size. */
async function uploadPfp(user, body, env) {
  await checkRate(env, user, "pfp", 60); // max 1 change/min
  let b64 = String(body.image || "");
  const m = b64.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  if (!m) throw new Error("send a base64 data-URL image");
  b64 = m[2];
  if (b64.length > 150_000) throw new Error("image too large — must be under ~110KB");
  // basic sanity: decodes as base64?
  try {
    atob(b64.slice(0, 100));
  } catch {
    throw new Error("invalid image data");
  }

  const path = `pfp/${user}.jpg`;
  // need existing sha if overwriting
  const head = await gh(env, env.DATA_REPO, path);
  let sha;
  if (head.status === 200) sha = (await head.json()).sha;
  const res = await gh(env, env.DATA_REPO, path, "PUT", {
    message: `pfp ${user}`,
    content: b64,
    sha: sha || undefined,
  });
  if (!res.ok) throw new Error("upload failed " + res.status);

  // point the profile at the raw URL (cache-busted by commit timestamp)
  const url = `https://raw.githubusercontent.com/${env.DATA_REPO}/main/pfp/${user}.jpg?v=${Date.now()}`;
  const { json, sha: usha } = await ghGetJSON(env, env.DATA_REPO, `users/${user}.json`);
  const u = json || {};
  u.pfp = url;
  await ghPutJSON(env, env.DATA_REPO, `users/${user}.json`, u, usha, `pfp link ${user}`);
  await log(env, user, "pfp_upload", {});
  return reply({ ok: true, url });
}


/* ---------- DM requests + shared DM helpers ---------- */
function requestBoxFallback() { return { accepted: [], items: [] }; }
function pairId(a, b) { return [a, b].sort().join("_"); }

async function appendDmThread(env, participants, messages) {
  const pair = pairId(participants[0], participants[1]);
  if (fbOn(env)) {
    await migrateThread(env, pair);
    for (const m of messages) await fb(env, `threads/${pair}/messages`, "POST", m);
    return;
  }
  const path = `threads/${pair}.json`;
  await mutateJSON(env, env.DMS_REPO, path, { participants: [...participants].sort(), messages: [] }, (thread) => {
    thread.participants = thread.participants || [...participants].sort();
    thread.messages = Array.isArray(thread.messages) ? thread.messages : [];
    for (const m of messages) {
      if (!thread.messages.some((x) => x.from === m.from && x.text === m.text && x.ts === m.ts)) thread.messages.push(m);
    }
    thread.messages = thread.messages.slice(-500);
    return thread;
  }, `dm ${pair}`);
}

async function touchDmInbox(env, owner, withUser, lastText, unread) {
  if (fbOn(env)) {
    const prev = unread ? ((await fb(env, `inbox/${owner}/${withUser}/unread`).catch(() => 0)) || 0) : 0;
    await fb(env, `inbox/${owner}/${withUser}`, "PATCH", { last: String(lastText || "").slice(0, 80), ts: Date.now(), unread: unread ? prev + 1 : 0 });
  } else {
    await updateInbox(env, owner, withUser, String(lastText || ""), !!unread);
  }
}

async function dmThreadExists(env, a, b) {
  const pair = pairId(a, b);
  if (fbOn(env)) {
    await migrateThread(env, pair);
    const data = await fb(env, `threads/${pair}/messages`).catch(() => null);
    return !!(data && Object.keys(data).length);
  }
  const { json } = await ghGetJSON(env, env.DMS_REPO, `threads/${pair}.json`).catch(() => ({ json: null }));
  return !!(json && Array.isArray(json.messages) && json.messages.length);
}

async function dmIsApproved(env, sender, recipient, recipientProfile) {
  if ((recipientProfile.following || []).includes(sender)) return true; // people I follow can enter Primary
  if (await dmThreadExists(env, sender, recipient)) return true; // existing chats stay open
  const { json } = await ghGetJSON(env, env.DMS_REPO, `requests/${recipient}.json`).catch(() => ({ json: null }));
  return !!(json && Array.isArray(json.accepted) && json.accepted.includes(sender));
}

async function queueDmRequest(env, from, to, text) {
  const msg = { from, text, ts: Date.now() };
  await mutateJSON(env, env.DMS_REPO, `requests/${to}.json`, requestBoxFallback(), (box) => {
    box.accepted = Array.isArray(box.accepted) ? box.accepted : [];
    box.items = Array.isArray(box.items) ? box.items : [];
    let item = box.items.find((x) => x.from === from);
    if (!item) { item = { from, messages: [], unread: 0, ts: msg.ts, last: "" }; box.items.unshift(item); }
    item.messages = Array.isArray(item.messages) ? item.messages : [];
    item.messages.push(msg);
    item.messages = item.messages.slice(-50);
    item.last = text.slice(0, 80);
    item.ts = msg.ts;
    item.unread = (item.unread || 0) + 1;
    box.items.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return box;
  }, `dm request ${to}`);
  await notify(env, to, { type: "dm_request", from });
  return reply({ ok: true, requested: true });
}

async function pendingRequestMessages(env, viewer, other) {
  // I sent a request to other
  const out = await ghGetJSON(env, env.DMS_REPO, `requests/${other}.json`).catch(() => ({ json: null }));
  let item = out.json && Array.isArray(out.json.items) ? out.json.items.find((x) => x.from === viewer) : null;
  if (item) return { messages: item.messages || [], requested: true, outgoing: true };
  // other sent a request to me
  const mine = await ghGetJSON(env, env.DMS_REPO, `requests/${viewer}.json`).catch(() => ({ json: null }));
  item = mine.json && Array.isArray(mine.json.items) ? mine.json.items.find((x) => x.from === other) : null;
  if (item) return { messages: item.messages || [], requested: true, incoming: true };
  return null;
}

async function dmRequests(user, body, env) {
  const { json } = await ghGetJSON(env, env.DMS_REPO, `requests/${user}.json`).catch(() => ({ json: null }));
  const box = json || requestBoxFallback();
  const items = (box.items || []).map((x) => ({ from: x.from, last: x.last || "", ts: x.ts || 0, unread: x.unread || 0, count: (x.messages || []).length }));
  return reply({ ok: true, items, accepted: box.accepted || [] });
}

async function dmAccept(user, body, env) {
  const from = String(body.from || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!from || from === user) throw new Error("bad request");
  const accept = body.accept !== false;
  const got = await ghGetJSON(env, env.DMS_REPO, `requests/${user}.json`).catch(() => ({ json: null }));
  const box = got.json || requestBoxFallback();
  const item = (box.items || []).find((x) => x.from === from);
  if (accept && item && (item.messages || []).length) {
    await appendDmThread(env, [user, from], item.messages);
    const last = item.messages[item.messages.length - 1].text || "";
    await touchDmInbox(env, user, from, last, false);
    await touchDmInbox(env, from, user, last, false);
  }
  await mutateJSON(env, env.DMS_REPO, `requests/${user}.json`, requestBoxFallback(), (b) => {
    b.accepted = Array.isArray(b.accepted) ? b.accepted : [];
    b.items = Array.isArray(b.items) ? b.items : [];
    b.items = b.items.filter((x) => x.from !== from);
    if (accept && !b.accepted.includes(from)) b.accepted.push(from);
    return b;
  }, `dm ${accept ? "accept" : "reject"} ${user}`);
  if (accept) await notify(env, from, { type: "dm_accept", from: user });
  return reply({ ok: true, accepted: accept });
}

/* ---------- Close Friends + Stories ---------- */
function storyIndexFallback() { return { stories: {}, updated: new Date().toISOString() }; }
function cleanStoryIndex(idx) {
  idx = idx && typeof idx === "object" ? idx : storyIndexFallback();
  idx.stories = idx.stories && typeof idx.stories === "object" ? idx.stories : {};
  const now = Date.now();
  for (const u of Object.keys(idx.stories)) {
    idx.stories[u] = (idx.stories[u] || []).filter((s) => (s.expires || 0) > now);
    if (!idx.stories[u].length) delete idx.stories[u];
  }
  idx.updated = new Date().toISOString();
  return idx;
}
async function getCloseFriends(env, owner) {
  const { json } = await ghGetJSON(env, env.DMS_REPO, `settings/${owner}.json`).catch(() => ({ json: null }));
  return json && Array.isArray(json.closeFriends) ? json.closeFriends : [];
}
async function closeFriends(user, body, env) {
  if (Array.isArray(body.list)) {
    const list = [...new Set(body.list.map((x) => String(x).toLowerCase().replace(/[^a-z0-9_]/g, "")).filter((x) => x && x !== user))].slice(0, 200);
    await mutateJSON(env, env.DMS_REPO, `settings/${user}.json`, { closeFriends: [] }, (s) => ({ ...(s || {}), closeFriends: list, updated: new Date().toISOString() }), `close friends ${user}`);
    return reply({ ok: true, list });
  }
  return reply({ ok: true, list: await getCloseFriends(env, user) });
}
function storyKind(media, audio, text) {
  if (/\.(mp4|webm)(\?|$)/i.test(media)) return "video";
  if (/\.(mp3|ogg|wav|m4a)(\?|$)/i.test(media || audio)) return "audio";
  if (media) return "image";
  return text ? "text" : "story";
}
async function canViewStory(env, viewer, owner, story, profile) {
  if (viewer === owner) return true;
  if (profile && (profile.blocked || []).includes(viewer)) return false;
  if (story.privacy === "followers") return !!(profile && (profile.followers || []).includes(viewer));
  if (story.privacy === "close") return (await getCloseFriends(env, owner)).includes(viewer);
  return story.privacy !== "private";
}
async function storyCreate(user, body, env) {
  await checkRate(env, user, "story", 30);
  const text = String(body.text || "").slice(0, 1000).trim();
  const media = String(body.media || "").slice(0, 700).trim();
  const audio = String(body.audio || "").slice(0, 700).trim();
  const privacy = ["public", "followers", "close"].includes(body.privacy) ? body.privacy : "public";
  if (!text && !media && !audio) throw new Error("empty story");
  const st = { id: "s_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6), author: user, text, media, audio, privacy, kind: storyKind(media, audio, text), ts: Date.now(), expires: Date.now() + 86400000, views: [], likes: [], comments: [] };
  await mutateJSON(env, env.DMS_REPO, "stories/index.json", storyIndexFallback(), (idx) => {
    idx = cleanStoryIndex(idx);
    idx.stories[user] = Array.isArray(idx.stories[user]) ? idx.stories[user] : [];
    idx.stories[user].unshift(st);
    idx.stories[user] = idx.stories[user].slice(0, 10);
    return idx;
  }, `story ${user}`);
  return reply({ ok: true, id: st.id });
}
async function storiesList(user, body, env) {
  const { json } = await ghGetJSON(env, env.DMS_REPO, "stories/index.json").catch(() => ({ json: null }));
  const idx = cleanStoryIndex(json || storyIndexFallback());
  const out = [];
  for (const owner of Object.keys(idx.stories)) {
    const prof = await ghGetJSON(env, env.DATA_REPO, `users/${owner}.json`).then((r) => r.json).catch(() => null);
    const visible = [];
    for (const st of idx.stories[owner]) if (await canViewStory(env, user, owner, st, prof)) visible.push({ id: st.id, ts: st.ts, kind: st.kind, privacy: st.privacy, text: st.text ? st.text.slice(0, 80) : "" });
    if (visible.length) out.push({ user: owner, count: visible.length, latest: Math.max(...visible.map((x) => x.ts || 0)), items: visible });
  }
  out.sort((a, b) => b.latest - a.latest);
  return reply({ ok: true, stories: out });
}
async function findStoryForView(env, viewer, owner, id) {
  const { json } = await ghGetJSON(env, env.DMS_REPO, "stories/index.json").catch(() => ({ json: null }));
  const idx = cleanStoryIndex(json || storyIndexFallback());
  const story = ((idx.stories || {})[owner] || []).find((s) => s.id === id);
  if (!story) throw new Error("post unavailable");
  const prof = await ghGetJSON(env, env.DATA_REPO, `users/${owner}.json`).then((r) => r.json).catch(() => null);
  if (!(await canViewStory(env, viewer, owner, story, prof))) throw new Error("post unavailable");
  return story;
}
async function storyView(user, body, env) {
  const owner = String(body.owner || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  const id = String(body.id || "");
  const first = await findStoryForView(env, user, owner, id);
  let viewed = (first.views || []).includes(user) || user === owner;
  if (!viewed) {
    await mutateJSON(env, env.DMS_REPO, "stories/index.json", storyIndexFallback(), async (idx) => {
      idx = cleanStoryIndex(idx);
      const st = ((idx.stories || {})[owner] || []).find((s) => s.id === id);
      if (st && !(st.views || []).includes(user)) { st.views = Array.isArray(st.views) ? st.views : []; st.views.push(user); }
      return idx;
    }, `story view ${owner}`).catch(() => {});
  }
  const st = await findStoryForView(env, user, owner, id).catch(() => first);
  return reply({ ok: true, story: { ...st, viewsCount: (st.views || []).length, likesCount: (st.likes || []).length, liked: (st.likes || []).includes(user), viewers: user === owner ? (st.views || []) : [] } });
}
async function storyReact(user, body, env) {
  const owner = String(body.owner || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  const id = String(body.id || "");
  const action = body.action === "comment" ? "comment" : "like";
  const text = String(body.text || "").slice(0, 500).trim();
  let result = {};
  await mutateJSON(env, env.DMS_REPO, "stories/index.json", storyIndexFallback(), async (idx) => {
    idx = cleanStoryIndex(idx);
    const st = ((idx.stories || {})[owner] || []).find((s) => s.id === id);
    if (!st) throw new Error("post unavailable");
    const prof = await ghGetJSON(env, env.DATA_REPO, `users/${owner}.json`).then((r) => r.json).catch(() => null);
    if (!(await canViewStory(env, user, owner, st, prof))) throw new Error("post unavailable");
    st.likes = Array.isArray(st.likes) ? st.likes : [];
    st.comments = Array.isArray(st.comments) ? st.comments : [];
    if (action === "like") {
      const had = st.likes.includes(user);
      st.likes = had ? st.likes.filter((x) => x !== user) : [...st.likes, user];
      result = { liked: !had, likesCount: st.likes.length };
    } else {
      if (!text) throw new Error("empty comment");
      st.comments.push({ a: user, t: text, ts: Date.now(), cid: "sc" + Date.now() + Math.random().toString(36).slice(2, 5) });
      st.comments = st.comments.slice(-100);
      result = { comments: st.comments };
    }
    return idx;
  }, `story react ${owner}`);
  if (owner !== user) await notify(env, owner, { type: action === "like" ? "story_like" : "story_comment", from: user, story: id, owner });
  return reply({ ok: true, ...result });
}
async function storyDelete(user, body, env) {
  const id = String(body.id || "");
  await mutateJSON(env, env.DMS_REPO, "stories/index.json", storyIndexFallback(), (idx) => {
    idx = cleanStoryIndex(idx);
    idx.stories[user] = (idx.stories[user] || []).filter((s) => s.id !== id);
    if (!idx.stories[user].length) delete idx.stories[user];
    return idx;
  }, `story delete ${user}`);
  return reply({ ok: true });
}

async function dm(user, body, env) {
  await checkRate(env, user, "dm", 3); // max 1 msg / 3s
  const other = String(body.to || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!other || other === user) throw new Error("missing recipient");
  // recipient must exist + block checks
  const rec = await ghGetJSON(env, env.DATA_REPO, `users/${other}.json`);
  if (!rec.json) throw new Error("user not found");
  if ((rec.json.blocked || []).includes(user)) throw new Error("you can't message this user");
  const me = await ghGetJSON(env, env.DATA_REPO, `users/${user}.json`);
  if (me.json && (me.json.blocked || []).includes(other)) throw new Error("you blocked this user — unblock first");
  const text = String(body.text || "").slice(0, 2000).trim();
  if (!text) throw new Error("empty message");

  const approved = await dmIsApproved(env, user, other, rec.json);
  if (!approved) return await queueDmRequest(env, user, other, text);

  const msg = { from: user, text, ts: Date.now() };
  await appendDmThread(env, [user, other], [msg]);
  await touchDmInbox(env, user, other, text, false);
  await touchDmInbox(env, other, user, text, true);
  return reply({ ok: true });
}

async function updateInbox(env, owner, withUser, lastText, isUnread) {
  try {
    const path = `inbox/${owner}.json`;
    const { json, sha } = await ghGetJSON(env, env.DMS_REPO, path);
    const inbox = json || { threads: [] };
    let t = inbox.threads.find((x) => x.with === withUser);
    if (!t) {
      t = { with: withUser, unread: 0 };
      inbox.threads.push(t);
    }
    t.last = lastText.slice(0, 80);
    t.ts = Date.now();
    t.unread = isUnread ? (t.unread || 0) + 1 : 0;
    inbox.threads.sort((a, b) => b.ts - a.ts);
    await ghPutJSON(env, env.DMS_REPO, path, inbox, sha, `inbox ${owner}`);
  } catch (e) {}
}

/* read a full thread — ONLY participants can */
async function dmThread(user, body, env) {
  const other = String(body.with || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!other) throw new Error("missing user");
  const pair = [user, other].sort().join("_");

  if (fbOn(env)) {
    await migrateThread(env, pair);
    const data = (await fb(env, `threads/${pair}/messages`).catch(() => null)) || {};
    const messages = Object.keys(data).sort().map((k) => data[k]);
    await fb(env, `inbox/${user}/${other}/unread`, "PUT", 0).catch(() => {});
    if (!messages.length) {
      const pending = await pendingRequestMessages(env, user, other);
      if (pending) return reply({ ok: true, ...pending, live: true });
    }
    return reply({ ok: true, messages, live: true });
  }

  const { json } = await ghGetJSON(env, env.DMS_REPO, `threads/${pair}.json`);
  if (!json) {
    const pending = await pendingRequestMessages(env, user, other);
    return reply({ ok: true, messages: pending ? pending.messages : [], ...(pending || {}) });
  }
  if (!json.participants.includes(user)) throw new Error("not your thread");
  await updateInbox(env, user, other, (json.messages.slice(-1)[0] || { text: "" }).text || "", false);
  return reply({ ok: true, messages: json.messages });
}

/* list my threads */
async function dmInbox(user, body, env) {
  if (fbOn(env)) {
    const data = (await fb(env, `inbox/${user}`).catch(() => null)) || {};
    const threads = Object.entries(data)
      .map(([w, t]) => ({ with: w, ...t }))
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));
    try {
      const { json } = await ghGetJSON(env, env.DMS_REPO, `inbox/${user}.json`);
      if (json && json.threads) {
        for (const t of json.threads) if (!threads.some((x) => x.with === t.with)) threads.push(t);
      }
    } catch (e) {}
    return reply({ ok: true, threads });
  }
  const { json } = await ghGetJSON(env, env.DMS_REPO, `inbox/${user}.json`);
  return reply({ ok: true, threads: (json && json.threads) || [] });
}

/* ---------- reports / delete / privacy ---------- */
async function report(user, body, env) {
  await checkRate(env, user, "report", 20);
  const { json, sha } = await ghGetJSON(env, env.DATA_REPO, "admin/reports.json");
  const arr = json || [];
  arr.push({
    by: user,
    target: String(body.target || "").slice(0, 60),
    kind: String(body.kind || "post").slice(0, 12),
    reason: String(body.reason || "").slice(0, 24),
    note: String(body.note || "").slice(0, 500),
    ts: new Date().toISOString(),
    status: "pending",
  });
  await ghPutJSON(env, env.DATA_REPO, "admin/reports.json", arr, sha, `report by ${user}`);
  return reply({ ok: true });
}

async function deletePost(user, body, env) {
  const id = String(body.post || "");
  const { json: post } = await ghGetJSON(env, env.DATA_REPO, `posts/${id}.json`);
  if (!post) throw new Error("post not found");
  if (post.author !== user && user !== (env.ADMIN_USER || "androbeet")) throw new Error("not your post");
  // delete the file
  const head = await gh(env, env.DATA_REPO, `posts/${id}.json`);
  const fsha = (await head.json()).sha;
  await fetch(`https://api.github.com/repos/${env.DATA_REPO}/contents/posts/${id}.json`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, "User-Agent": "lore-worker", Accept: "application/vnd.github+json" },
    body: JSON.stringify({ message: `delete ${id}`, sha: fsha }),
  });
  // remove from feed
  const f = await ghGetJSON(env, env.DATA_REPO, "config/feed.json");
  await ghPutJSON(env, env.DATA_REPO, "config/feed.json", (f.json || []).filter((e) => e.id !== id), f.sha, `unfeed ${id}`);
  await log(env, user, "post_deleted", { id });
  return reply({ ok: true });
}

async function setPrivacy(user, body, env) {
  const id = String(body.post || "");
  const { json: post, sha } = await ghGetJSON(env, env.DATA_REPO, `posts/${id}.json`);
  if (!post) throw new Error("post not found");
  if (post.author !== user) throw new Error("not your post");
  post.private = !!body.private;
  await ghPutJSON(env, env.DATA_REPO, `posts/${id}.json`, post, sha, `privacy ${id}`);
  const f = await ghGetJSON(env, env.DATA_REPO, "config/feed.json");
  let feed = f.json || [];
  if (post.private) feed = feed.filter((e) => e.id !== id);
  else if (!feed.some((e) => e.id === id)) {
    feed.unshift({
      id,
      author: post.author,
      topic: post.topic,
      snippet: post.text.slice(0, 280),
      img: post.img,
      ts: post.ts,
      up: post.up.length,
      down: post.down.length,
      comments: post.comments.length,
      echo: post.echo,
    });
  }
  await ghPutJSON(env, env.DATA_REPO, "config/feed.json", feed.slice(0, 500), f.sha, `feed privacy ${id}`);
  return reply({ ok: true, private: post.private });
}

/* ---------- group chats (stored in DMS repo) ---------- */
async function groupCreate(user, body, env) {
  await checkRate(env, user, "group", 60);
  const name = String(body.name || "").toLowerCase().replace(/[^a-z0-9-_]/g, "").slice(0, 30);
  if (name.length < 3) throw new Error("group name 3+ chars");
  const id = "g_" + name;
  if (fbOn(env)) {
    if (await fb(env, `groups/${id}/id`).catch(() => null)) throw new Error("group name taken");
  }
  const exists = await ghGetJSON(env, env.DMS_REPO, `groups/${id}.json`);
  if (exists.json) throw new Error("group name taken");
  const members = [...new Set([user, ...(body.members || []).map((m) => String(m).toLowerCase()).slice(0, 20)])];
  if (fbOn(env)) {
    const mem = {};
    members.forEach((m) => { mem[m] = true; });
    await fb(env, `groups/${id}`, "PUT", { id, name, owner: user, members: mem, migrated: true });
    for (const m of members) {
      await fb(env, `inbox/${m}/${encodeURIComponent("👥 " + name)}`, "PATCH", {
        last: "Group created by @" + user,
        ts: Date.now(),
        unread: m !== user ? 1 : 0,
        group: id,
      }).catch(() => {});
    }
    return reply({ ok: true, id });
  }
  await ghPutJSON(env, env.DMS_REPO, `groups/${id}.json`, { id, name, owner: user, members, messages: [] }, null, `group ${id}`);
  for (const m of members) await updateInbox(env, m, "👥 " + name, "Group created by @" + user, m !== user);
  return reply({ ok: true, id });
}

async function groupMessage(user, body, env) {
  await checkRate(env, user, "group", 3); // separate bucket from DMs
  const id = String(body.group || "");
  const text = String(body.text || "").slice(0, 2000).trim();
  if (!text) throw new Error("empty message");
  if (fbOn(env)) {
    await migrateGroup(env, id);
    const isMember = await fb(env, `groups/${id}/members/${user}`).catch(() => null);
    if (!isMember) throw new Error("not a member");
    await fb(env, `groups/${id}/messages`, "POST", { from: user, text, ts: Date.now() });
    return reply({ ok: true });
  }
  const { json: g, sha } = await ghGetJSON(env, env.DMS_REPO, `groups/${id}.json`);
  if (!g) throw new Error("group not found");
  if (!g.members.includes(user)) throw new Error("not a member");
  g.messages.push({ from: user, text, ts: Date.now() });
  g.messages = g.messages.slice(-500);
  await ghPutJSON(env, env.DMS_REPO, `groups/${id}.json`, g, sha, `gmsg ${id}`);
  return reply({ ok: true });
}

async function groupThread(user, body, env) {
  const id = String(body.group || "");
  if (fbOn(env)) {
    await migrateGroup(env, id);
    const g = await fb(env, `groups/${id}`).catch(() => null);
    if (!g || !g.id) throw new Error("group not found");
    if (!(g.members || {})[user]) throw new Error("not a member");
    const msgs = g.messages || {};
    return reply({
      ok: true,
      name: g.name,
      members: Object.keys(g.members || {}),
      messages: Object.keys(msgs).sort().map((k) => msgs[k]),
      live: true,
    });
  }
  const { json: g } = await ghGetJSON(env, env.DMS_REPO, `groups/${id}.json`);
  if (!g) throw new Error("group not found");
  if (!g.members.includes(user)) throw new Error("not a member");
  return reply({ ok: true, name: g.name, members: g.members, messages: g.messages });
}

/* ---------- block users ---------- */
async function blockUser(user, body, env) {
  const target = String(body.target || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!target || target === user) throw new Error("bad target");
  const { json, sha } = await ghGetJSON(env, env.DATA_REPO, `users/${user}.json`);
  if (!json) throw new Error("profile missing");
  json.blocked = json.blocked || [];
  const was = json.blocked.includes(target);
  json.blocked = was ? json.blocked.filter((b) => b !== target) : [...json.blocked, target].slice(0, 500);
  // blocking also force-unfollows both directions
  if (!was) {
    json.following = (json.following || []).filter((f) => f !== target);
    json.followers = (json.followers || []).filter((f) => f !== target);
    const t = await ghGetJSON(env, env.DATA_REPO, `users/${target}.json`);
    if (t.json) {
      t.json.following = (t.json.following || []).filter((f) => f !== user);
      t.json.followers = (t.json.followers || []).filter((f) => f !== user);
      await ghPutJSON(env, env.DATA_REPO, `users/${target}.json`, t.json, t.sha, `unlink ${target}`);
    }
  }
  await ghPutJSON(env, env.DATA_REPO, `users/${user}.json`, json, sha, `block ${user}`);
  await log(env, user, was ? "unblock" : "block", { target });
  return reply({ ok: true, blocked: !was });
}

/* ---------- edit post ---------- */
async function editPost(user, body, env) {
  const id = String(body.post || "");
  const { json: post, sha } = await ghGetJSON(env, env.DATA_REPO, `posts/${id}.json`);
  if (!post) throw new Error("post not found");
  if (post.author !== user) throw new Error("not your post");
  post.text = String(body.text || "").slice(0, 4000);
  post.topic = String(body.topic || post.topic).slice(0, 40);
  post.edited = Date.now();
  await ghPutJSON(env, env.DATA_REPO, `posts/${id}.json`, post, sha, `edit ${id}`);
  if (!post.private) {
    await updateFeed(env, (feed) => {
      const e = feed.find((x) => x.id === id);
      if (e) {
        e.snippet = post.text.slice(0, 280);
        e.topic = post.topic;
      }
      return feed;
    });
  }
  await log(env, user, "post_edited", { id });
  return reply({ ok: true });
}

/* ---------- device uploads (voice notes, images) via Catbox proxy ----------
   Browser can't call catbox.moe directly (no CORS) — the Worker proxies it.
   Free, permanent hosting, no account, no key. Cap ~1.4MB per file. */
async function uploadMedia(user, body, env) {
  await checkRate(env, user, "upload", 10);
  const m = String(body.data || "").match(/^data:(image\/(?:png|jpe?g|gif|webp)|audio\/(?:webm|ogg|mpeg|mp4|wav));base64,(.+)$/);
  if (!m) throw new Error("unsupported file type (images & audio only)");
  const b64 = m[2];
  if (b64.length > 2_000_000) throw new Error("file too large — max ~1.4MB (host bigger files on catbox.moe and paste the link)");
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ext = m[1].split("/")[1].replace("mpeg", "mp3").replace("jpeg", "jpg");
  const fd = new FormData();
  fd.append("reqtype", "fileupload");
  fd.append("fileToUpload", new Blob([bin], { type: m[1] }), "lore_" + Date.now() + "." + ext);
  const res = await fetch("https://catbox.moe/user/api.php", { method: "POST", body: fd });
  const url = (await res.text()).trim();
  if (!res.ok || !url.startsWith("http")) throw new Error("upload host rejected the file — try again");
  await log(env, user, "upload", { url });
  return reply({ ok: true, url });
}

/* ---------- GIF search (Tenor when available; GIPHY fallback) ----------
   If Tenor keys are unavailable for new apps, create a GIPHY app key and set
   GIPHY_KEY. The frontend stays unchanged because /gif-search keeps the same shape. */
async function gifSearch(user, body, env) {
  const qRaw = String(body.q || "").slice(0, 60).trim();
  const q = encodeURIComponent(qRaw);
  if (!q) throw new Error("empty search");
  const cacheKey = `${env.TENOR_KEY ? "tenor" : "giphy"}:${qRaw.toLowerCase()}`;
  const hit = GIF_CACHE.get(cacheKey);
  if (hit && Date.now() - hit.ts < 10 * 60 * 1000) return reply({ ok: true, results: hit.results });

  if (env.TENOR_KEY) {
    try {
      const r = await fetch(`https://tenor.googleapis.com/v2/search?q=${q}&key=${env.TENOR_KEY}&limit=24&media_filter=gif,tinygif&contentfilter=medium`);
      const d = await r.json();
      const results = (d.results || [])
        .map((x) => ({ url: x.media_formats?.gif?.url, preview: x.media_formats?.tinygif?.url || x.media_formats?.gif?.url }))
        .filter((x) => x.url);
      if (results.length) {
        GIF_CACHE.set(cacheKey, { ts: Date.now(), results });
        return reply({ ok: true, results });
      }
    } catch (e) {
      // fall through to GIPHY if configured
    }
  }

  if (env.GIPHY_KEY) {
    const giphyKey = `giphy:${qRaw.toLowerCase()}`;
    const ghit = GIF_CACHE.get(giphyKey);
    if (ghit && Date.now() - ghit.ts < 10 * 60 * 1000) return reply({ ok: true, results: ghit.results });
    const r = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${env.GIPHY_KEY}&q=${q}&limit=24&rating=pg-13&lang=en`);
    const d = await r.json();
    const results = (d.data || [])
      .map((x) => ({
        url: x.images?.downsized_medium?.url || x.images?.downsized?.url || x.images?.original?.url,
        preview: x.images?.fixed_width_small?.url || x.images?.fixed_width?.url || x.images?.downsized?.url,
      }))
      .filter((x) => x.url && x.preview);
    GIF_CACHE.set(giphyKey, { ts: Date.now(), results });
    GIF_CACHE.set(cacheKey, { ts: Date.now(), results });
    return reply({ ok: true, results });
  }

  throw new Error("GIFs aren't enabled yet");
}

/* ---------- LORE Coins, gifts, vouchers, store ---------- */
function walletFallback() {
  return { balance: 0, streak: { count: 0, lastClaim: 0 }, claimedAchievements: [], inventory: { frames: [], bubbles: [], gifts: [] }, applied: {}, tx: [], giftsSent: [], giftsReceived: [] };
}
function normalizeWallet(w) {
  w = w && typeof w === "object" ? w : walletFallback();
  w.balance = Number(w.balance || 0);
  w.streak = w.streak || { count: 0, lastClaim: 0 };
  w.claimedAchievements = Array.isArray(w.claimedAchievements) ? w.claimedAchievements : [];
  w.inventory = w.inventory || {};
  w.inventory.frames = Array.isArray(w.inventory.frames) ? w.inventory.frames : [];
  w.inventory.bubbles = Array.isArray(w.inventory.bubbles) ? w.inventory.bubbles : [];
  w.inventory.gifts = Array.isArray(w.inventory.gifts) ? w.inventory.gifts : [];
  w.applied = w.applied || {};
  w.tx = Array.isArray(w.tx) ? w.tx : [];
  w.giftsSent = Array.isArray(w.giftsSent) ? w.giftsSent : [];
  w.giftsReceived = Array.isArray(w.giftsReceived) ? w.giftsReceived : [];
  return w;
}
async function getWallet(env, user) {
  const { json } = await ghGetJSON(env, env.DMS_REPO, `wallets/${user}.json`).catch(() => ({ json: null }));
  return normalizeWallet(json);
}
function addTx(w, type, amount, note, meta = {}) {
  w.tx = Array.isArray(w.tx) ? w.tx : [];
  w.tx.unshift({ id: "tx_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6), ts: Date.now(), type, amount, note: String(note || "").slice(0, 140), ...meta });
  w.tx = w.tx.slice(0, 300);
}
async function mutateWallet(env, user, fn, message) {
  return await mutateJSON(env, env.DMS_REPO, `wallets/${user}.json`, walletFallback(), (w) => fn(normalizeWallet(w)), message);
}
function publicWallet(w) {
  w = normalizeWallet(w);
  return { balance: w.balance, streak: w.streak, claimedAchievements: w.claimedAchievements, inventory: w.inventory, applied: w.applied, tx: w.tx.slice(0, 80), giftsSent: w.giftsSent.slice(0, 80), giftsReceived: w.giftsReceived.slice(0, 80) };
}
async function walletState(user, body, env) {
  const wallet = await getWallet(env, user);
  const now = Date.now();
  const canClaim = !wallet.streak.lastClaim || now - wallet.streak.lastClaim >= 86400000;
  const day = canClaim ? ((now - (wallet.streak.lastClaim || 0) > 48 * 3600000 ? 0 : (wallet.streak.count || 0)) % 7) + 1 : ((wallet.streak.count || 1));
  const rewards = [10, 15, 20, 25, 30, 50, 90];
  return reply({ ok: true, wallet: publicWallet(wallet), canClaim, nextReward: rewards[Math.max(0, Math.min(6, day - 1))], catalog: { gifts: GIFT_CATALOG, frames: storeFrames(), bubbles: storeBubbles() } });
}
async function coinsClaim(user, body, env) {
  const rewards = [10, 15, 20, 25, 30, 50, 90];
  let result;
  await mutateWallet(env, user, (w) => {
    const now = Date.now();
    if (w.streak.lastClaim && now - w.streak.lastClaim < 86400000) throw new Error("daily coins already claimed");
    const reset = !w.streak.lastClaim || now - w.streak.lastClaim > 48 * 3600000;
    const day = (reset ? 0 : (w.streak.count || 0)) % 7;
    const reward = rewards[day];
    w.balance += reward;
    w.streak = { count: day + 1, lastClaim: now };
    addTx(w, "daily", reward, `Daily claim day ${day + 1}`);
    result = { reward, balance: w.balance, day: day + 1 };
    return w;
  }, `coins claim ${user}`);
  await log(env, user, "coins_claim", result);
  return reply({ ok: true, ...result });
}
async function coinsAchievement(user, body, env) {
  const id = String(body.id || "").replace(/[^a-z0-9_]/g, "").slice(0, 50);
  const reward = ACH_REWARDS[id];
  if (!reward) throw new Error("unknown achievement");
  let result;
  await mutateWallet(env, user, (w) => {
    if (w.claimedAchievements.includes(id)) throw new Error("achievement already paid");
    w.claimedAchievements.push(id);
    w.balance += reward;
    addTx(w, "achievement", reward, "Achievement: " + id, { achievement: id });
    result = { reward, balance: w.balance };
    return w;
  }, `achievement coins ${user}`);
  return reply({ ok: true, ...result });
}
function giftById(id) { return GIFT_CATALOG.find((g) => g.id === id); }
async function updateCoinBoard(env, from, to, amount) {
  try {
    const month = new Date().toISOString().slice(0, 7);
    await mutateJSON(env, env.DMS_REPO, "coins/leaderboard.json", { months: {} }, (b) => {
      b.months = b.months || {};
      const m = b.months[month] || { sent: {}, received: {} };
      m.sent[from] = (m.sent[from] || 0) + amount;
      m.received[to] = (m.received[to] || 0) + amount;
      b.months[month] = m;
      return b;
    }, "coins leaderboard");
  } catch (e) {}
}
async function coinsGift(user, body, env) {
  const target = String(body.target || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  const gift = giftById(String(body.gift || ""));
  const note = String(body.note || "").slice(0, 300);
  const ref = String(body.ref || "").slice(0, 120);
  if (!target || target === user) throw new Error("bad target");
  if (!gift) throw new Error("unknown gift");
  const exists = await ghGetJSON(env, env.DATA_REPO, `users/${target}.json`).catch(() => ({ json: null }));
  if (!exists.json) throw new Error("user not found");
  await mutateWallet(env, user, (w) => {
    if (w.balance < gift.price) throw new Error("not enough Lore Coins");
    w.balance -= gift.price;
    const item = { id: gift.id, name: gift.name, price: gift.price, to: target, note, ref, ts: Date.now() };
    w.giftsSent.unshift(item); w.giftsSent = w.giftsSent.slice(0, 200);
    addTx(w, "gift_sent", -gift.price, `Gift ${gift.name} to @${target}`, { target, gift: gift.id, ref });
    return w;
  }, `gift sent ${user}`);
  await mutateWallet(env, target, (w) => {
    const item = { uid: "g_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6), id: gift.id, name: gift.name, price: gift.price, from: user, note, ref, ts: Date.now() };
    w.inventory.gifts.unshift(item);
    w.giftsReceived.unshift(item); w.giftsReceived = w.giftsReceived.slice(0, 200);
    addTx(w, "gift_received", 0, `Gift ${gift.name} from @${user}`, { from: user, gift: gift.id, ref });
    return w;
  }, `gift received ${target}`);
  await updateCoinBoard(env, user, target, gift.price);
  await notify(env, target, { type: "gift", from: user, gift: gift.name });
  return reply({ ok: true });
}
async function coinsBuy(user, body, env) {
  const type = body.type === "bubble" ? "bubble" : "frame";
  const list = type === "frame" ? storeFrames() : storeBubbles();
  const item = list.find((x) => x.id === body.id);
  if (!item) throw new Error("unknown store item");
  let result;
  await mutateWallet(env, user, (w) => {
    const key = type === "frame" ? "frames" : "bubbles";
    if (w.inventory[key].includes(item.id)) { result = { balance: w.balance, owned: true }; return w; }
    if (w.balance < item.price) throw new Error("not enough Lore Coins");
    w.balance -= item.price;
    w.inventory[key].push(item.id);
    addTx(w, "store_buy", -item.price, `Bought ${item.name}`, { item: item.id, type });
    result = { balance: w.balance, owned: true };
    return w;
  }, `store buy ${user}`);
  return reply({ ok: true, ...result });
}
async function coinsApply(user, body, env) {
  const type = body.type === "bubble" ? "bubble" : "frame";
  const id = String(body.id || "");
  await mutateWallet(env, user, (w) => {
    const key = type === "frame" ? "frames" : "bubbles";
    if (id && !w.inventory[key].includes(id)) throw new Error("not owned");
    w.applied[type] = id;
    addTx(w, "apply", 0, `Applied ${type} ${id || "none"}`, { item: id, type });
    return w;
  }, `apply ${type} ${user}`);
  try {
    const u = await ghGetJSON(env, env.DATA_REPO, `users/${user}.json`);
    if (u.json) {
      if (type === "frame") u.json.avatarFrame = id;
      else u.json.chatBubble = id;
      await ghPutJSON(env, env.DATA_REPO, `users/${user}.json`, u.json, u.sha, `public ${type} ${user}`);
    }
  } catch (e) {}
  return reply({ ok: true });
}
async function coinsConvert(user, body, env) {
  const uid = String(body.uid || "");
  let credit = 0, adminCut = 0, giftName = "gift";
  await mutateWallet(env, user, (w) => {
    const i = w.inventory.gifts.findIndex((g) => g.uid === uid || g.id === uid);
    if (i < 0) throw new Error("gift not found");
    const g = w.inventory.gifts.splice(i, 1)[0];
    giftName = g.name || g.id;
    credit = Math.floor((g.price || 0) * 0.8);
    adminCut = Math.max(0, (g.price || 0) - credit);
    w.balance += credit;
    addTx(w, "gift_convert", credit, `Converted ${giftName}`, { gift: g.id });
    return w;
  }, `gift convert ${user}`);
  if (adminCut) {
    const admin = env.ADMIN_USER || "androbeet";
    await mutateWallet(env, admin, (w) => { w.balance += adminCut; addTx(w, "vault_cut", adminCut, `Vault cut from @${user} gift conversion`); return w; }, `admin vault ${user}`).catch(() => {});
  }
  return reply({ ok: true, coins: credit });
}
async function voucherRedeem(user, body, env) {
  const code = String(body.code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
  if (!code) throw new Error("enter voucher code");
  let value = 0;
  await mutateJSON(env, env.DMS_REPO, "coins/vouchers.json", { codes: {} }, (v) => {
    v.codes = v.codes || {};
    const c = v.codes[code];
    if (!c) throw new Error("invalid voucher");
    if (c.expires && Date.now() > c.expires) throw new Error("voucher expired");
    c.usedBy = Array.isArray(c.usedBy) ? c.usedBy : [];
    if (c.usedBy.includes(user)) throw new Error("voucher already used");
    if ((c.usedBy.length || 0) >= (c.uses || 1)) throw new Error("voucher fully used");
    c.usedBy.push(user);
    value = Math.max(0, Number(c.coins || 0));
    return v;
  }, `voucher redeem ${code}`);
  await mutateWallet(env, user, (w) => { w.balance += value; addTx(w, "voucher", value, `Voucher ${code}`); return w; }, `voucher coins ${user}`);
  return reply({ ok: true, coins: value });
}
async function adminCoins(user, body, env) {
  assertAdmin(user, env);
  const target = String(body.target || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  const amount = Math.trunc(Number(body.amount || 0));
  const note = String(body.note || "Admin grant").slice(0, 200);
  if (!target || !amount) throw new Error("target and amount required");
  await mutateWallet(env, target, (w) => { w.balance = Math.max(0, w.balance + amount); addTx(w, amount >= 0 ? "admin_grant" : "admin_take", amount, note, { from: user }); return w; }, `admin coins ${target}`);
  await notify(env, target, { type: "coins", from: user, amount, note });
  await log(env, user, "admin_coins", { target, amount });
  return reply({ ok: true });
}
async function adminVoucher(user, body, env) {
  assertAdmin(user, env);
  const code = (String(body.code || "") || ("LORE" + Math.random().toString(36).slice(2, 8))).toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
  const coins = Math.max(1, Math.min(100000, Math.trunc(Number(body.coins || 0))));
  const uses = Math.max(1, Math.min(10000, Math.trunc(Number(body.uses || 1))));
  const days = Math.max(1, Math.min(365, Math.trunc(Number(body.days || 30))));
  const note = String(body.note || "").slice(0, 200);
  await mutateJSON(env, env.DMS_REPO, "coins/vouchers.json", { codes: {} }, (v) => {
    v.codes = v.codes || {};
    v.codes[code] = { coins, uses, usedBy: [], expires: Date.now() + days * 86400000, note, createdBy: user, created: new Date().toISOString() };
    return v;
  }, `voucher ${code}`);
  return reply({ ok: true, code, coins, uses, days });
}
async function adminBadge(user, body, env) {
  assertAdmin(user, env);
  const target = String(body.target || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  const name = String(body.name || "").slice(0, 40);
  const color = String(body.color || "gold").slice(0, 20);
  const remove = !!body.remove;
  if (!target || !name) throw new Error("target and badge required");
  const { json, sha } = await ghGetJSON(env, env.DATA_REPO, `users/${target}.json`);
  if (!json) throw new Error("user not found");
  json.customBadges = Array.isArray(json.customBadges) ? json.customBadges : [];
  if (remove) json.customBadges = json.customBadges.filter((b) => b.name !== name);
  else if (!json.customBadges.some((b) => b.name === name)) json.customBadges.push({ name, color, by: user, ts: new Date().toISOString() });
  await ghPutJSON(env, env.DATA_REPO, `users/${target}.json`, json, sha, `badge ${target}`);
  return reply({ ok: true });
}

/* ---------- GDPR data export ---------- */
async function exportData(user, body, env) {
  const prof = await ghGetJSON(env, env.DATA_REPO, `users/${user}.json`).catch(() => ({ json: null }));
  const auth = await ghGetJSON(env, env.DATA_REPO, `auth/${user}.json`).catch(() => ({ json: null }));
  let dm_contacts = [];
  if (fbOn(env)) {
    const d = (await fb(env, `inbox/${user}`).catch(() => null)) || {};
    dm_contacts = Object.keys(d);
  }
  await log(env, user, "data_export", {});
  return reply({
    ok: true,
    exported: new Date().toISOString(),
    username: user,
    profile: prof.json,
    email: auth.json ? auth.json.email : null,
    dm_contacts,
  });
}

async function requestTag(user, body, env) {
  const { json, sha } = await ghGetJSON(env, env.DATA_REPO, "config/tag_requests.json");
  const arr = json || [];
  arr.push({ tag: String(body.tag || "").slice(0, 30), by: user, ts: new Date().toISOString(), status: "pending" });
  await ghPutJSON(env, env.DATA_REPO, "config/tag_requests.json", arr, sha, `tag request ${user}`);
  return reply({ ok: true });
}
