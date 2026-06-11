# Contributing to LORE

Thanks for wanting to add to the Lore! This project's whole philosophy is
**$0 infrastructure, maximum cleverness** — contributions should keep it
that way.

## Ground rules
- **No paid services.** Every feature must run on free tiers
  (GitHub Pages / Actions / Cloudflare Workers free / Firebase free).
- **No build step.** `index.html` is a single self-contained file on
  purpose — anyone can fork and deploy it in 2 minutes. No npm, no
  bundlers, no frameworks.
- **No external CDN dependencies in the core app** — it must work fully
  offline after first load (the service worker depends on this).

## How to contribute
1. **Fork** this repo (button top-right on GitHub)
2. Edit files directly in the GitHub web editor or locally
3. Open a **Pull Request** with a clear description of what & why
4. The admin (@androbeet) reviews and merges

## Good first contributions
- New interest tags → `data/config/tags.json`
- Theme refinements → CSS variables at the top of `index.html`
- Translations of docs
- Worker hardening (JWT verification, better rate limiting)
- Accessibility improvements (ARIA labels, keyboard navigation)

## Reporting bugs
Open a GitHub **Issue** with:
- What you did, what you expected, what happened
- Browser + device
- Screenshot if visual

## Security issues
Don't open a public issue — email **andrewz772k6@gmail.com** directly.
