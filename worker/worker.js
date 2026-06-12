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
 * (email + password). Passwords are salted & hashed 10,000× before
 * storage — never stored in plain text. Sessions are signed tokens
 * valid 30 days. Banned users are rejected on every request.
 * Admin endpoints (/admin/ban, /admin/seal) only work for ADMIN_USER.
 */

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: JSON_HEADERS });

    const url = new URL(request.url);
    const route = url.pathname;

    try {
      if (request.method !== "POST") return reply({ ok: true, service: "LORE API" });

      const body = await request.json();

      // --- public endpoints (no login needed) ---
      if (route === "/signup") return await signup(body, env);
      if (route === "/login")  return await login(body, env);

      // --- everything below requires a valid session token ---
      const user = await identify(request, body, env); // throws if invalid

      switch (route) {
        case "/post":            return await createPost(user, body, env);
        case "/vote":            return await vote(user, body, env);
        case "/comment":         return await comment(user, body, env);
        case "/follow":          return await follow(user, body, env);
        case "/join-community":  return await joinCommunity(user, body, env);
        case "/update-profile":  return await updateProfile(user, body, env);
        case "/upload-pfp":      return await uploadPfp(user, body, env);
        case "/message":         return await dm(user, body, env);
        case "/dm-thread":       return await dmThread(user, body, env);
        case "/dm-inbox":        return await dmInbox(user, body, env);
        case "/request-tag":     return await requestTag(user, body, env);
        case "/report":          return await report(user, body, env);
        case "/delete-post":     return await deletePost(user, body, env);
        case "/set-privacy":     return await setPrivacy(user, body, env);
        case "/group-create":    return await groupCreate(user, body, env);
        case "/group-message":   return await groupMessage(user, body, env);
        case "/group-thread":    return await groupThread(user, body, env);
        // --- admin-only (aNDROBEET) ---
        case "/admin/ban":       return await adminBan(user, body, env);
        case "/admin/seal":      return await adminSeal(user, body, env);
        default:                 return reply({ error: "unknown endpoint" }, 404);
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
  // 10k iterations of salted SHA-256 (simple, dependency-free, fine at this scale)
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
      pfp: "", voice: "", tags: [], followers: [], following: [],
      joined: new Date().toISOString().slice(0, 10),
      streak: { count: 0, tier: "—" }, seal: false,
      echoes: 0, resonance: 0, pioneer: 0, ranks: {}, theme: "maroon",
      banned: false, shadowbanned: false,
    };
    await ghPutJSON(env, env.DATA_REPO, `users/${username}.json`, profile, null, `signup ${username}`);
  }
  // credentials live in a separate file (never sent to the frontend)
  await ghPutJSON(env, env.DATA_REPO, `auth/${username}.json`,
    { email, salt, hash: await hashPassword(password, salt), created: new Date().toISOString() },
    null, `auth ${username}`);

  // add to search index
  const idx = await ghGetJSON(env, env.DATA_REPO, "config/userindex.json");
  const list = idx.json || [];
  if (!list.includes(username)) {
    list.push(username);
    await ghPutJSON(env, env.DATA_REPO, "config/userindex.json", list, idx.sha, `index ${username}`);
  }
  await log(env, username, "signup", { email });
  return reply({ ok: true, token: await makeToken(username, env), username });
}

async function login(body, env) {
  const username = (body.username || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  const { json: creds } = await ghGetJSON(env, env.DATA_REPO, `auth/${username}.json`);
  if (!creds) throw new Error("no such account");
  const hash = await hashPassword(String(body.password || ""), creds.salt);
  if (hash !== creds.hash) {
    await log(env, username, "login_failed", {});
    throw new Error("wrong password");
  }
  const { json: u } = await ghGetJSON(env, env.DATA_REPO, `users/${username}.json`);
  if (u && u.banned) throw new Error("account banned — contact " + "andrewz772k6@gmail.com");
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
async function adminBan(user, body, env) {
  assertAdmin(user, env);
  const target = String(body.target || "").toLowerCase();
  const { json, sha } = await ghGetJSON(env, env.DATA_REPO, `users/${target}.json`);
  if (!json) throw new Error("user not found");
  if (body.mode === "shadowban") json.shadowbanned = !json.shadowbanned;
  else json.banned = !json.banned;
  await ghPutJSON(env, env.DATA_REPO, `users/${target}.json`, json, sha, `admin action ${target}`);
  await log(env, user, "admin_" + (body.mode || "ban"), { target });
  return reply({ ok: true, banned: json.banned, shadowbanned: json.shadowbanned });
}
async function adminSeal(user, body, env) {
  assertAdmin(user, env);
  if (body.post) {
    const { json, sha } = await ghGetJSON(env, env.DATA_REPO, `posts/${body.post}.json`);
    if (!json) throw new Error("post not found");
    json.seal = true;
    await ghPutJSON(env, env.DATA_REPO, `posts/${body.post}.json`, json, sha, `seal post`);
    await notify(env, json.author, { type: "seal", from: user, post: json.id });
  } else if (body.target) {
    const { json, sha } = await ghGetJSON(env, env.DATA_REPO, `users/${body.target}.json`);
    if (!json) throw new Error("user not found");
    json.seal = !json.seal;
    await ghPutJSON(env, env.DATA_REPO, `users/${body.target}.json`, json, sha, `seal user`);
    await notify(env, body.target, { type: "seal", from: user });
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

/* ---------- rate limiting (simple, per-user, repo-backed) ---------- */
async function checkRate(env, user, action, minSeconds) {
  const { json, sha } = await ghGetJSON(env, env.DATA_REPO, `ratelimits/${user}.json`);
  const now = Date.now();
  const r = json || {};
  if (r[action] && now - r[action] < minSeconds * 1000) throw new Error("slow down");
  r[action] = now;
  await ghPutJSON(env, env.DATA_REPO, `ratelimits/${user}.json`, r, sha, `rate ${user}`);
}

/* ---------- activity log (admin-only viewing) ---------- */
async function log(env, user, action, details) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const { json, sha } = await ghGetJSON(env, env.DATA_REPO, `admin/logs/${day}.json`);
    const arr = json || [];
    arr.push({ ts: new Date().toISOString(), user, action, details });
    await ghPutJSON(env, env.DATA_REPO, `admin/logs/${day}.json`, arr, sha, `log ${action}`);
  } catch (e) { /* logging never blocks the action */ }
}

/* ---------- notifications ---------- */
async function notify(env, target, item) {
  try {
    const path = `users/${target}/notifications.json`;
    const { json, sha } = await ghGetJSON(env, env.DATA_REPO, path);
    const n = json || { unread_count: 0, items: [] };
    n.items.unshift({ ...item, ts: new Date().toISOString(), read: false });
    n.items = n.items.slice(0, 100);
    n.unread_count++;
    await ghPutJSON(env, env.DATA_REPO, path, n, sha, `notify ${target}`);
  } catch (e) {}
}

/* ---------- endpoints ---------- */
async function createPost(user, body, env) {
  await checkRate(env, user, "post", 60); // max 1 post/min
  const id = "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  const post = {
    id, author: user, topic: String(body.topic || "General").slice(0, 40),
    text: String(body.text || "").slice(0, 4000),
    img: String(body.img || "").slice(0, 500),
    ts: Date.now(), up: [], down: [], shares: 0, echo: "", pioneer: "", comments: [],
  };
  if (!post.text) throw new Error("empty post");
  await ghPutJSON(env, env.DATA_REPO, `posts/${id}.json`, post, null, `post by ${user}`);

  // update feed index (last 500 posts, single fetch for explore page)
  const { json, sha } = await ghGetJSON(env, env.DATA_REPO, "config/feed.json");
  const feed = json || [];
  feed.unshift({ id, author: user, topic: post.topic, snippet: post.text.slice(0, 280), img: post.img, ts: post.ts, up: 0, down: 0, comments: 0, echo: "" });
  await ghPutJSON(env, env.DATA_REPO, "config/feed.json", feed.slice(0, 500), sha, `feed ${id}`);
  await log(env, user, "post_created", { id });
  return reply({ ok: true, id });
}

async function vote(user, body, env) {
  const { json: post, sha } = await ghGetJSON(env, env.DATA_REPO, `posts/${body.post}.json`);
  if (!post) throw new Error("post not found");
  for (const k of ["up", "down"]) post[k] = post[k].filter((u) => u !== user);
  if (body.dir === "up") post.up.push(user);
  if (body.dir === "down") post.down.push(user);
  await ghPutJSON(env, env.DATA_REPO, `posts/${body.post}.json`, post, sha, `vote ${user}`);
  if (body.dir === "up" && post.author !== user)
    await notify(env, post.author, { type: "upvote", from: user, post: post.id });
  await log(env, user, "vote", { post: body.post, dir: body.dir });
  return reply({ ok: true, up: post.up.length, down: post.down.length });
}

async function comment(user, body, env) {
  await checkRate(env, user, "comment", 10);
  const { json: post, sha } = await ghGetJSON(env, env.DATA_REPO, `posts/${body.post}.json`);
  if (!post) throw new Error("post not found");
  if (post.comments.length === 0) post.pioneer = user; // PIONEER badge
  post.comments.push({ a: user, t: String(body.text || "").slice(0, 1000), ts: Date.now(),
    parent: body.parent != null ? String(body.parent).slice(0, 30) : null,
    cid: "c" + Date.now() + Math.random().toString(36).slice(2, 6) });
  await ghPutJSON(env, env.DATA_REPO, `posts/${body.post}.json`, post, sha, `comment ${user}`);
  if (post.author !== user)
    await notify(env, post.author, { type: "comment", from: user, post: post.id, snippet: String(body.text).slice(0, 60) });
  await log(env, user, "comment", { post: body.post });
  return reply({ ok: true });
}

async function follow(user, body, env) {
  await checkRate(env, user, "follow", 12); // max ~5/min
  const target = String(body.target || "").toLowerCase();
  if (!target || target === user) throw new Error("bad target");
  const a = await ghGetJSON(env, env.DATA_REPO, `users/${user}.json`);
  const b = await ghGetJSON(env, env.DATA_REPO, `users/${target}.json`);
  if (!b.json) throw new Error("user not found");
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
  if (body.socials && typeof body.socials === "object") {
    u.socials = {};
    for (const k of ["instagram", "x", "youtube", "snapchat", "facebook", "tiktok", "discord", "website"])
      if (body.socials[k]) u.socials[k] = String(body.socials[k]).slice(0, 200);
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
  try { atob(b64.slice(0, 100)); } catch { throw new Error("invalid image data"); }

  const path = `pfp/${user}.jpg`;
  // need existing sha if overwriting
  const head = await gh(env, env.DATA_REPO, path);
  let sha;
  if (head.status === 200) sha = (await head.json()).sha;
  const res = await gh(env, env.DATA_REPO, path, "PUT", {
    message: `pfp ${user}`, content: b64, sha: sha || undefined,
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

async function dm(user, body, env) {
  await checkRate(env, user, "dm", 3); // max 1 msg / 3s
  const other = String(body.to || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!other || other === user) throw new Error("missing recipient");
  // recipient must exist
  const rec = await ghGetJSON(env, env.DATA_REPO, `users/${other}.json`);
  if (!rec.json) throw new Error("user not found");
  const text = String(body.text || "").slice(0, 2000).trim();
  if (!text) throw new Error("empty message");

  const pair = [user, other].sort().join("_");
  const path = `threads/${pair}.json`;
  const { json, sha } = await ghGetJSON(env, env.DMS_REPO, path);
  const thread = json || { participants: [user, other].sort(), messages: [] };
  if (!thread.participants.includes(user)) throw new Error("not your thread");
  thread.messages.push({ from: user, text, ts: Date.now() });
  thread.messages = thread.messages.slice(-500); // keep threads lean
  await ghPutJSON(env, env.DMS_REPO, path, thread, sha, `dm ${pair}`);

  // update both inboxes (thread list + unread count)
  await updateInbox(env, user, other, text, false);
  await updateInbox(env, other, user, text, true);
  return reply({ ok: true });
}

async function updateInbox(env, owner, withUser, lastText, isUnread) {
  try {
    const path = `inbox/${owner}.json`;
    const { json, sha } = await ghGetJSON(env, env.DMS_REPO, path);
    const inbox = json || { threads: [] };
    let t = inbox.threads.find((x) => x.with === withUser);
    if (!t) { t = { with: withUser, unread: 0 }; inbox.threads.push(t); }
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
  const { json } = await ghGetJSON(env, env.DMS_REPO, `threads/${pair}.json`);
  if (!json) return reply({ ok: true, messages: [] });
  if (!json.participants.includes(user)) throw new Error("not your thread");
  // mark read in inbox
  await updateInbox(env, user, other, (json.messages.slice(-1)[0] || { text: "" }).text || "", false);
  return reply({ ok: true, messages: json.messages });
}

/* list my threads */
async function dmInbox(user, body, env) {
  const { json } = await ghGetJSON(env, env.DMS_REPO, `inbox/${user}.json`);
  return reply({ ok: true, threads: (json && json.threads) || [] });
}

/* ---------- reports / delete / privacy ---------- */
async function report(user, body, env) {
  await checkRate(env, user, "report", 20);
  const { json, sha } = await ghGetJSON(env, env.DATA_REPO, "admin/reports.json");
  const arr = json || [];
  arr.push({ by: user, target: String(body.target || "").slice(0, 60),
    kind: String(body.kind || "post").slice(0, 12),
    reason: String(body.reason || "").slice(0, 24),
    note: String(body.note || "").slice(0, 500),
    ts: new Date().toISOString(), status: "pending" });
  await ghPutJSON(env, env.DATA_REPO, "admin/reports.json", arr, sha, `report by ${user}`);
  return reply({ ok: true });
}

async function deletePost(user, body, env) {
  const id = String(body.post || "");
  const { json: post, sha } = await ghGetJSON(env, env.DATA_REPO, `posts/${id}.json`);
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
  else if (!feed.some((e) => e.id === id))
    feed.unshift({ id, author: post.author, topic: post.topic, snippet: post.text.slice(0, 280), img: post.img, ts: post.ts, up: post.up.length, down: post.down.length, comments: post.comments.length, echo: post.echo });
  await ghPutJSON(env, env.DATA_REPO, "config/feed.json", feed.slice(0, 500), f.sha, `feed privacy ${id}`);
  return reply({ ok: true, private: post.private });
}

/* ---------- group chats (stored in DMS repo) ---------- */
async function groupCreate(user, body, env) {
  await checkRate(env, user, "group", 60);
  const name = String(body.name || "").toLowerCase().replace(/[^a-z0-9-_]/g, "").slice(0, 30);
  if (name.length < 3) throw new Error("group name 3+ chars");
  const id = "g_" + name;
  const exists = await ghGetJSON(env, env.DMS_REPO, `groups/${id}.json`);
  if (exists.json) throw new Error("group name taken");
  const members = [...new Set([user, ...(body.members || []).map((m) => String(m).toLowerCase()).slice(0, 20)])];
  await ghPutJSON(env, env.DMS_REPO, `groups/${id}.json`,
    { id, name, owner: user, members, messages: [] }, null, `group ${id}`);
  for (const m of members) await updateInbox(env, m, "👥 " + name, "Group created by @" + user, m !== user);
  return reply({ ok: true, id });
}
async function groupMessage(user, body, env) {
  await checkRate(env, user, "dm", 3);
  const id = String(body.group || "");
  const { json: g, sha } = await ghGetJSON(env, env.DMS_REPO, `groups/${id}.json`);
  if (!g) throw new Error("group not found");
  if (!g.members.includes(user)) throw new Error("not a member");
  const text = String(body.text || "").slice(0, 2000).trim();
  if (!text) throw new Error("empty message");
  g.messages.push({ from: user, text, ts: Date.now() });
  g.messages = g.messages.slice(-500);
  await ghPutJSON(env, env.DMS_REPO, `groups/${id}.json`, g, sha, `gmsg ${id}`);
  return reply({ ok: true });
}
async function groupThread(user, body, env) {
  const id = String(body.group || "");
  const { json: g } = await ghGetJSON(env, env.DMS_REPO, `groups/${id}.json`);
  if (!g) throw new Error("group not found");
  if (!g.members.includes(user)) throw new Error("not a member");
  return reply({ ok: true, name: g.name, members: g.members, messages: g.messages });
}

async function requestTag(user, body, env) {
  const { json, sha } = await ghGetJSON(env, env.DATA_REPO, "config/tag_requests.json");
  const arr = json || [];
  arr.push({ tag: String(body.tag || "").slice(0, 30), by: user, ts: new Date().toISOString(), status: "pending" });
  await ghPutJSON(env, env.DATA_REPO, "config/tag_requests.json", arr, sha, `tag request ${user}`);
  return reply({ ok: true });
}
