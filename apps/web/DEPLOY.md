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
- `public` files copied in (`sample-deck.html`, images, `_redirects`, `_headers`)

## Cloudflare Pages

1. **Output directory** must be `apps/web/dist` (not `apps/web`, not repo root).
2. Every deploy must upload the **whole** `dist` folder. If only `index.html` updates but old `assets/` is deleted or not uploaded, the site loads HTML that references missing JS → blank page / MIME errors.
3. `_redirects` must **not** use `/* /index.html 200`. That rewrites missing `/assets/*.js` to HTML. This repo only uses `/en/*` fallbacks; zh routes are real prerendered files.

## Symptom: "Expected JavaScript but got text/html"

1. Open DevTools → Network → click the red `*.js` request.
2. If **Status 200** and **Content-Type: text/html** → SPA redirect or missing file served as `index.html`. Fix redirects and redeploy full `dist`.
3. If **Status 404** → build output path wrong or incomplete deploy; redeploy with correct settings.
4. Purge Cloudflare cache after deploy (Caching → Purge everything) if HTML was cached with old asset hashes.

## Verify after deploy

```bash
# Replace HASH with the app-*.js name from View Source on /
curl -sI "https://your-domain.com/assets/app-HASH.js" | grep -i content-type
# Expect: content-type: application/javascript (or text/javascript)
```
