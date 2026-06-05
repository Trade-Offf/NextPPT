# Deploying the web app (Cloudflare Pages / static hosts)

## Build output

Always deploy the **Vite build folder**, not the source tree:

| Setting | Value |
| --- | --- |
| **Build command** | `pnpm install && pnpm --filter @hds/web build` |
| **Output directory** | `apps/web/dist` |
| **Node** | 20+ |

From the repo root, `pnpm build` also works (builds protocol + all apps).

After build, `apps/web/dist` must contain at least:

- `index.html`, `guide/index.html`, `en/index.html`, `en/guide/index.html`
- `assets/` with hashed `.js` and `.css` (e.g. `app-*.js`, `client-*.js`)
- `public` files copied in (`sample-deck.html`, images, `_redirects`, `_headers`, `404.html`)

---

## Cloudflare Pages — required settings

### 1. Disable SPA fallback (critical)

**Cloudflare Pages has no SPA toggle in the dashboard.** You are not missing a setting — the UI under **设置 → 构建** is all there is for build config.

Pages enables SPA-style fallback **automatically** when the build output has **no `404.html` at the root**. Any missing path (including deleted `/assets/app-OLDHASH.js` after a deploy) then returns `index.html` with **200 + text/html**. The browser tries to execute that HTML as JavaScript → **white screen / intermittent load failure**.

**Fix: ship `404.html` in `apps/web/dist`**

This repo includes `apps/web/public/404.html`. Vite copies it to `dist/404.html` on build. Once that file is deployed:

- Missing paths return **HTTP 404** with the custom 404 page
- SPA auto-fallback to `index.html` is **disabled**

After deploying:

1. **Redeploy** (push to `main` or trigger a new build in the dashboard you showed)
2. **Purge cache** — Caching → Purge Everything
3. Run `pnpm verify-deploy` — the “missing /assets/*.js” check must pass

Quick manual check:

```bash
curl -s "https://next-ppt.com/404.html" | grep "页面未找到"
# Must print 页面未找到. If you see the homepage instead, 404.html is not deployed yet.

curl -sI "https://next-ppt.com/assets/app-WRONG.js" | grep -i content-type
# Must NOT be text/html with 200 after the fix.
```

This repo intentionally avoids a global `/* /index.html 200` rule in `_redirects`. Only `/en/*` needs SPA-style fallback because English shells are prerendered separately; Chinese routes are real files on disk.

### 2. Output directory

Must be `apps/web/dist` — **not** `apps/web`, **not** repo root.

### 3. Upload the full `dist` every deploy

If only `index.html` updates but old `assets/` is dropped from the upload, the new HTML references JS files that no longer exist on the server.

### 4. Purge cache after each production deploy

**Caching** → **Configuration** → **Purge Everything**

Otherwise users may keep a cached `index.html` that points at a previous deploy's hashed JS.

---

## Verify after deploy

### Automated (recommended)

```bash
# Default domain: https://next-ppt.com
pnpm verify-deploy

# Custom preview / staging domain
DEPLOY_DOMAIN=https://htmldeckstudio.pages.dev pnpm verify-deploy
```

The script checks:

- Homepage returns HTML and references `/assets/app-*.js`
- The real bundle returns `application/javascript`
- A **deliberately missing** `/assets/*.js` does **not** return `text/html` with 200 (SPA fallback)
- Prerendered routes `/guide`, `/en`, `/en/guide` return HTML

Exit code `0` = healthy; `1` = fix Cloudflare SPA setting or redeploy.

### Manual curl

```bash
# 1. Copy app-*.js from View Source on /
curl -sI "https://next-ppt.com/assets/app-HASH.js" | grep -i content-type
# Expect: application/javascript

# 2. Deliberately wrong hash — must NOT be HTML 200
curl -sI "https://next-ppt.com/assets/app-WRONG.js" | grep -iE "HTTP/|content-type"
# Expect: 404 (or 403), NOT "200" + "text/html"
```

---

## Symptom: "Expected JavaScript but got text/html"

1. Open DevTools → **Network** → click the red `*.js` request.
2. If **Status 200** and **Content-Type: text/html** → SPA fallback or missing file served as `index.html`.
   - Redeploy with `404.html` at dist root (above)
   - Redeploy full `dist`
   - Purge cache
3. If **Status 404** → build output path wrong or incomplete deploy; fix output directory and redeploy.
4. Run `pnpm verify-deploy` to confirm.

---

## Symptom: console `chrome-error://chromewebdata/`

On the **landing page**, this is usually **not** app code:

- No Service Worker is registered
- No iframe on the homepage (`EditorPreview` is static DOM)
- Often caused by **browser extensions** (wallet, assistant, ad blockers) injecting into the page

**Quick check:** open the site in an **Incognito** window with extensions disabled. If the error disappears, ignore it for production monitoring.

Intermittent **white screens** are almost always the missing-JS-as-HTML issue above, not this console line.

---

## Cache headers (in `public/_headers`)

| Path | Policy | Why |
| --- | --- | --- |
| `/assets/*` | `immutable`, 1 year | Hashed filenames — safe to cache forever **when the file exists** |
| `/`, `/guide`, `/en`, `/en/guide` | `max-age=0, must-revalidate` | HTML shells must refresh after deploy so they pick up new asset hashes |
| `404.html` | `no-store` | Error page should never be cached |

**Important:** `immutable` on `/assets/*` is only safe when missing assets return **404**. If SPA mode serves HTML for missing JS, that wrong HTML can be cached for a year — another reason to disable SPA fallback.

---

## Deploy checklist

- [ ] `dist/404.html` deployed (disables Pages SPA auto-fallback)
- [ ] Output directory = `apps/web/dist`
- [ ] Full `dist` uploaded (including new `assets/`)
- [ ] **Purge cache** after deploy
- [ ] `pnpm verify-deploy` exits 0
- [ ] Spot-check in Incognito: open file, editor loads
