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
 *        GITHUB_TOKEN  = a fine-grained PAT with "Contents: write"
 *                        on your lore-data repo (and lore-dms repo)
 *        DATA_REPO     = "yourname/lore-data"
 *        DMS_REPO      = "yourname/lore-dms"      (private repo)
 *        ADMIN_USER    = "androbeet"
 *   4. Copy the worker URL into CONFIG.WORKER_URL in index.html
 *
 * AUTH NOTE: endpoints accept a Firebase ID token (Authorization:
 * Bearer <token>) if you wire up Firebase Auth (free, 50k MAU), or
 * fall back to a signed username for early/seed testing. Harden
 * before public launch: verify the Firebase JWT signature against
 * Google's public keys (verifyFirebaseToken below sketches this).
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
      const user = await identify(request, body, env); // throws if invalid

      switch (route) {
        case "/post":            return await createPost(user, body, env);
        case "/vote":            return await vote(user, body, env);
        case "/comment":         return await comment(user, body, env);
        case "/follow":          return await follow(user, body, env);
        case "/join-community":  return await joinCommunity(user, body, env);
        case "/update-profile":  return await updateProfile(user, body, env);
        case "/message":         return await dm(user, body, env);
        case "/request-tag":     return await requestTag(user, body, env);
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

/* ---------- identity ---------- */
async function identify(request, body, env) {
  // PRODUCTION: verify Firebase ID token here (signature + audience).
  // Sketch: fetch Google's certs, verify JWT, map firebase UID -> username
  // via /config/uidmap.json in the data repo.
  const auth = request.headers.get("Authorization") || "";
  if (auth.startsWith("Bearer ") && auth.length > 40) {
    // TODO: verifyFirebaseToken(auth.slice(7), env)
  }
  const username = (body.username || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!username) throw new Error("missing username");
  // banned check
  const u = await ghGetJSON(env, env.DATA_REPO, `users/${username}.json`).catch(() => null);
  if (u && u.json && u.json.banned) throw new Error("account banned");
  return username;
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
  post.comments.push({ a: user, t: String(body.text || "").slice(0, 1000), ts: Date.now() });
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

async function dm(user, body, env) {
  const other = String(body.to || "").toLowerCase();
  if (!other) throw new Error("missing recipient");
  const pair = [user, other].sort().join("_");
  const path = `threads/${pair}.json`;
  const { json, sha } = await ghGetJSON(env, env.DMS_REPO, path);
  const thread = json || { participants: [user, other].sort(), messages: [] };
  if (!thread.participants.includes(user)) throw new Error("not your thread");
  thread.messages.push({ from: user, text: String(body.text || "").slice(0, 2000), ts: Date.now() });
  await ghPutJSON(env, env.DMS_REPO, path, thread, sha, `dm ${pair}`);
  return reply({ ok: true });
}

async function requestTag(user, body, env) {
  const { json, sha } = await ghGetJSON(env, env.DATA_REPO, "config/tag_requests.json");
  const arr = json || [];
  arr.push({ tag: String(body.tag || "").slice(0, 30), by: user, ts: new Date().toISOString(), status: "pending" });
  await ghPutJSON(env, env.DATA_REPO, "config/tag_requests.json", arr, sha, `tag request ${user}`);
  return reply({ ok: true });
}
