# Deploying the web app

> **Primary host (since 2026-07):** Hong Kong VPS (`47.243.33.162`) via Caddy — Cloudflare Pages free anycast IPs are intermittently reset on mainland China TLS (`ERR_CONNECTION_RESET`).  
> **Backup:** `https://htmldeckstudio.pages.dev` (Cloudflare Pages Git deploy still runs).

## Architecture

| Host | Role | DNS |
| --- | --- | --- |
| `47.243.33.162` (Aliyun HK) + Caddy | **Production** static site + API | `next-ppt.com` / `www` **A, DNS-only (grey cloud)** → VPS |
| same VPS | Export API | `api.next-ppt.com` → Caddy → `api` container |
| Cloudflare Pages | Overseas backup only | `htmldeckstudio.pages.dev` |

```
Browser ──HTTPS──► Caddy (VPS)
                     ├─ next-ppt.com  → /srv/web  (rsync of apps/web/dist)
                     └─ api.next-ppt.com → api:3000
```

## Build output

Always deploy the **Vite build folder**, not the source tree:

| Setting | Value |
| --- | --- |
| **Build command** | `pnpm install && pnpm --filter @hds/web build` |
| **Output directory** | `apps/web/dist` → rsync to VPS `web-dist/` |
| **Node** | 20+ |

After build, `apps/web/dist` must contain at least:

- `index.html`, `guide/index.html`, `en/index.html`, `en/guide/index.html`
- `assets/` with hashed `.js` and `.css` (e.g. `app-*.js`, `client-*.js`)
- `static-loader-data/` + `static-loader-data-manifest-*.json` (vite-react-ssg loader artifacts)
- Prerendered HTML with inlined `__VITE_REACT_SSG_STATIC_LOADER_MANIFEST__` / `__VITE_REACT_SSG_STATIC_LOADER_DATA__` (added by `scripts/inline-ssg-loader-data.mjs` in `ssgOptions.onFinished`)
- `public` files copied in (`sample-deck.html`, images, `_redirects`, `_headers`, `404.html`)

---

## Production deploy (VPS) — primary

From the repo root on a machine that can SSH to the VPS:

```bash
# First-time or after Caddyfile / compose changes:
#   on VPS: git pull && docker compose up -d

pnpm deploy-web
# equivalent: ./scripts/deploy-web.sh
```

What the script does:

1. `pnpm --filter @hds/web build`
2. `rsync -az --delete apps/web/dist/` → `root@47.243.33.162:/root/html-deck-studio/web-dist/`
3. Reload Caddy (picks up Caddyfile; static files need no restart)
4. `DEPLOY_DOMAIN=https://next-ppt.com pnpm verify-deploy`

Overrides:

```bash
DEPLOY_HOST=root@47.243.33.162 DEPLOY_PATH=/root/html-deck-studio ./scripts/deploy-web.sh
SKIP_BUILD=1 ./scripts/deploy-web.sh      # rsync existing dist only
SKIP_VERIFY=1 ./scripts/deploy-web.sh     # skip smoke test
```

Compose mounts `./web-dist` read-only at `/srv/web` for Caddy ([docker-compose.yml](../../docker-compose.yml), [Caddyfile](../../Caddyfile)).

### DNS cutover (one-time, Cloudflare dashboard)

Mainland `ERR_CONNECTION_RESET` was caused by **Cloudflare orange-cloud (proxied) free IPs**, not by app code.

1. Cloudflare → DNS for `next-ppt.com`
2. Delete / edit existing orange-cloud CNAME/A for apex and `www`
3. Create **A** records:
   - `next-ppt.com` → `47.243.33.162` — **DNS only (grey cloud)**
   - `www` → `47.243.33.162` — **DNS only (grey cloud)**
4. Leave `api` as-is (already points at VPS)
5. Wait for propagation; Caddy auto-issues Let’s Encrypt for the new names (ports 80/443 open)
6. Keep Pages project for `htmldeckstudio.pages.dev` as overseas backup — do **not** point the apex back to orange-cloud unless VPS is down

Quick check after cutover:

```bash
dig +short next-ppt.com A
# Expect: 47.243.33.162   (NOT 104.21.x / 172.67.x)

# Direct (VPN/proxy off), spam the homepage — should be 0 resets
for i in $(seq 1 20); do curl -sS -o /dev/null -w "%{http_code}\n" https://next-ppt.com/; done
```

---

## Cloudflare Pages — backup only

Build settings (if you still use Pages for `*.pages.dev`):

| Setting | Value |
| --- | --- |
| Build command | `pnpm install && pnpm --filter @hds/web build` |
| Output directory | `apps/web/dist` |
| Node | 20+ |

### Disable SPA fallback on Pages

Pages enables SPA-style fallback **automatically** when the build output has **no `404.html` at the root**. Ship `apps/web/public/404.html` so missing hashed JS returns real 404, not `index.html` with 200.

---

## Verify after deploy

```bash
# Production (VPS)
pnpm verify-deploy

# Pages backup
DEPLOY_DOMAIN=https://htmldeckstudio.pages.dev pnpm verify-deploy
```

The script checks:

- Homepage returns HTML and references `/assets/app-*.js`
- Homepage inlines `__VITE_REACT_SSG_STATIC_LOADER_MANIFEST__` + `__VITE_REACT_SSG_STATIC_LOADER_DATA__`
- The real bundle returns `application/javascript`
- A **deliberately missing** `/assets/*.js` does **not** return `text/html` with 200 (SPA fallback)
- Prerendered routes `/guide`, `/en`, `/en/guide` return HTML
- `static-loader-data-manifest-{hash}.json` and `static-loader-data/index.{hash}.json` return JSON

Exit code `0` = healthy.

### Manual curl

```bash
curl -sI "https://next-ppt.com/assets/app-HASH.js" | grep -i content-type
# Expect: application/javascript

curl -sI "https://next-ppt.com/assets/app-WRONG.js" | grep -iE "HTTP/|content-type"
# Expect: 404 (or 403), NOT "200" + "text/html"
```

---

## Symptom: mainland `ERR_CONNECTION_RESET` / “无法访问此网站”

**Diagnosis (2026-07):** TCP to Cloudflare edge IPs succeeds, but TLS is reset (`Recv failure: Connection reset by peer`) for CF free anycast ranges (`104.21.x`, `172.67.x`). Same IP with `SNI=www.cloudflare.com` also resets. Controllers (baidu / vercel / netlify / **this VPS**) succeed. Empty Network tab + “Provisional headers” = connection died before any HTTP response — not an app bug.

**Fix:** serve the site from the HK VPS (this doc’s primary path) with **grey-cloud** DNS. Do not put the apex back behind Cloudflare proxy unless you accept mainland unreliability.

---

## Symptom: "Expected JavaScript but got text/html"

1. Open DevTools → **Network** → click the red `*.js` request.
2. If **Status 200** and **Content-Type: text/html** → SPA fallback or missing file served as `index.html`.
   - Ensure `404.html` is in `web-dist` / Pages dist
   - Redeploy full dist
3. If **Status 404** → incomplete upload; re-run `pnpm deploy-web`.
4. Run `pnpm verify-deploy`.

---

## Symptom: "Unexpected Application Error! Failed to fetch"

Hydration used to `fetch('/static-loader-data/…json')` via vite-react-ssg. Build now inlines loader globals via `scripts/inline-ssg-loader-data.mjs` so the client never needs those requests.

If you still see this:

1. View Source on `/` — must include `__VITE_REACT_SSG_STATIC_LOADER_MANIFEST__`
2. Redeploy with a fresh `pnpm deploy-web`

---

## Cache headers

On VPS these are set in [Caddyfile](../../Caddyfile). On Pages, [public/_headers](public/_headers) still applies.

| Path | Policy | Why |
| --- | --- | --- |
| `/assets/*`, `/static-loader-data/*`, manifest | `immutable`, 1 year | Hashed filenames |
| HTML shells (`/`, `/guide`, `/en`, …) | `max-age=0, must-revalidate` | Pick up new asset hashes after deploy |
| `404.html` | `no-store` | Never cache the error page |

---

## Deploy checklist

- [ ] VPS: `git pull` + `docker compose up -d` (Caddyfile / compose changed)
- [ ] `pnpm deploy-web` exits 0
- [ ] `dig +short next-ppt.com` → `47.243.33.162` (grey cloud)
- [ ] Direct (no VPN): 20× `curl https://next-ppt.com/` → all 200, no reset
- [ ] Spot-check Incognito: `/`, `/guide`, `/en/guide`
