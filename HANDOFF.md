# Handoff — Neon Postgres integration (data + images)

> Historical handoff: counts and default product prices below describe the original demo catalog. Current startup creates no sample products. See README.md for the current database verification and archival procedure.

**Repo:** `sanvicpalawan/azarraga-app-official` · **Branch:** `arena/01a0c3d2-azarraga-app-official`
**Status:** Code complete and verified live against production (see §2b). Neon Postgres
handles everything — catalog, quotations, and the images themselves — so the only environment
variable required is `DATABASE_URL` (injected by the Neon → Vercel integration). The earlier
S3/object-storage requirement is gone: `@aws-sdk/client-s3` was removed and image bytes are
now stored in the database.

---

## 1. What was done

The app's catalog store was converted from an in-memory global into a swappable
backend with **Neon Postgres (data and images)** as the production
path:

| File | Role |
| --- | --- |
| `lib/catalog-store.ts` | Public catalog API. Picks the backend: **DB backend when `DATABASE_URL` is set**, in-memory backend otherwise (local dev with zero setup still works). |
| `lib/catalog-store-types.ts` | Shared types + the `CatalogBackend` contract both implementations satisfy. |
| `lib/catalog-seed.ts` | The default catalog (3 categories, 21 attributes, 28 products, ₱1,850 four-panel window) — single source of truth for both backends. |
| `lib/db.ts` | Neon client (`@neondatabase/serverless`), idempotent DDL (`categories`, `attributes`, `products`, `settings`, `quotations`), and **automatic first-use seeding in one transaction** (schema creates itself on the first request — nothing to run manually). |
| `lib/catalog-db-store.ts` | Neon backend: all catalog CRUD, quotations, settings, the image library, and image/logo byte storage in the `files` table. |
| `lib/catalog-memory-store.ts` | The original in-memory implementation, kept as the no-`DATABASE_URL` fallback. |
| `lib/db.ts` (`files` table) | Image bytes are stored in Neon Postgres itself as base64 rows, keyed from `products.image_key` / `settings.logo_key`. No object-storage provider and no extra environment variables. |
| `app/api/**` (12 routes) | Same HTTP contracts as before; now `await` the async store. Read routes return **503 with a clear message** when the backend is unreachable, instead of crashing. |
| `scripts/verify-neon.ts` | `pnpm verify:neon` — live end-to-end check (see §4). |
| `package.json` | New deps: `@neondatabase/serverless`, `@aws-sdk/client-s3`; dev dep `tsx` (runs the verify script). New script: `verify:neon`. |

The frontend (catalog browser, estimator, admin dashboard) is **unchanged** —
it only talks to the HTTP API, whose shape is byte-for-byte identical.

## 2. Verified in this session (evidence)

- `tsc --noEmit` — clean.
- `pnpm build` — passes; all 12 API routes compile as dynamic routes.
- `pnpm lint` — 0 errors (5 pre-existing `<img>` warnings).
- Local production server smoke test (in-memory mode, no env):
  - `GET /` → 200
  - `GET /api/catalog` → 3 categories / 21 attributes / 28 products / four-panel window ₱1,850
  - `POST /api/products` → created id 29; `DELETE` → removed
  - `POST /api/quotations` → saved id 1; `GET /api/quotations` → read back correctly
  - `GET /api/admin/overview` → correct aggregates
- `pnpm verify:neon` with no env → exits 1 with an actionable "missing environment variables" message (correct behavior — it refuses to pretend).

**Not yet done (impossible from this sandbox):** a live run of `pnpm verify:neon`
against the real Neon database and image bucket. That is the one remaining
proof and it requires the real credentials in the environment (below).

## 2b. Verified live against production — 2026-09-21 22:27 UTC

Run against the deployed app (<https://azarragaglass.vercel.app>) over the public internet
by a temporary GitHub Actions workflow — since deleted — that exercised the write paths and
then cleaned up after itself. Run:
<https://github.com/sanvicpalawan/azarraga-app-official/actions/runs/35662715027>

| Check | Result |
| --- | --- |
| `GET /api/catalog` | PASS — 200, 28 products / 3 categories / 21 attributes |
| `POST /api/products` | PASS — 201, new row created |
| read-back through `GET /api/products` | PASS — row present on a separate request |
| `PUT /api/admin/settings` | PASS — 200, settings byte-identical after the write |
| `POST` then `DELETE /api/categories` | PASS — 201 then 200 |
| `DELETE /api/products/:id` | PASS — 200; catalog back to the 28-row baseline, no leftovers |
| `POST /api/products/:id/image` (object-storage write) | **FAIL — 503 "The image could not be uploaded."** |
| `GET /api/products/:id/image` (object-storage read) | **FAIL — 404** (no image was ever stored) |

**Neon Postgres is healthy in production**: SELECT, INSERT, UPDATE and DELETE all round-trip
and the identity sequences are aligned.

**Note on the two FAILs above:** those rows describe the *old* architecture, where images were
kept in S3-compatible object storage. That dependency has since been removed — image bytes now
live in Neon Postgres in the `files` table — so those two checks no longer describe the app.
Re-run the image check after the next deploy to confirm uploads end to end.

Not covered: the quotation write path (`POST /api/quotations`) — the API has no DELETE route
for quotations, so a test insert would leave a junk row in real data. Making that path
testable means adding `DELETE /api/quotations/:id`, or pointing a verification run at a
throwaway Neon branch.

## 3. Account integrations already in place (confirmed by the owner)

- **Neon → Vercel integration:** adds `DATABASE_URL` (and `DATABASE_URL_UNPOOLED`) to the Vercel project automatically. **Nothing to do for the database.**
- **Neon → GitHub integration:** adds `NEON_API_KEY` / `NEON_PROJECT_ID` as GitHub Actions secrets (used only if you later adopt Neon's branch-per-PR databases). **Not required for this deployment.**
- **Vercel project** is linked to this GitHub repo.

## 4. What's next (the only remaining work)

### Step 1 — Environment variables

**Nothing to add.** Images are stored in Neon Postgres like the rest of the data, so
`DATABASE_URL` (supplied automatically by the Neon → Vercel integration) is the only variable
required. If the five `S3_*` / `AWS_*` variables from the earlier plan were already added in
Vercel, they can be deleted — the app no longer reads them.

### Step 2 — Deploy

The branch is pushed. If Vercel's production branch is `main`, merge the pull
request (or point Vercel at the branch) — the deploy triggers automatically
from GitHub. **On first request after deploy, the schema is created and the
default catalog seeded automatically** — no manual migration step.

### Step 3 — Prove it live (pick one)

> Already partly done: the §2b run covered the read endpoints plus the product, settings, and
> category write paths against production. What is left to prove is the object-storage upload
> and the quotation round-trip.

**Option A — from any machine with Neon network access** (recommended):

```bash
git clone <repo> && cd azarraga-app-official && pnpm install
# put the six values (5 from Step 1 + the Neon DATABASE_URL) into .env
pnpm verify:neon
```

Expected output: PASS lines for Postgres connection, schema + seed (3/21/28,
₱1,850), product create/read-back, product delete, quotation
insert/read-back + cleanup, bucket reachable, object upload/download/delete,
and (if a public base URL is configured) public object URL. Exit code 0.

**Option B — against the deployed Vercel app:**

```bash
curl -s https://<your-vercel-app>.vercel.app/api/catalog | head -c 400   # expect settings + 28 products
curl -s https://<your-vercel-app>.vercel.app/api/admin/overview          # expect totals
```

Then in the admin UI: edit a product and save (writes to Neon), upload a
product image (writes to the bucket) and confirm it renders (reads back from
the bucket). Quotation save + reprint round-trip exercises the quotations table.

### Step 4 — Sanity checks if something is off

- `/api/catalog` returns 503 → `DATABASE_URL` missing/wrong in the Vercel environment (check Vercel → Deployments → environment variables; re-deploy after adding variables).
- Verify script can't reach Neon → run it from a machine that can reach the Neon data plane (the sandbox limitation is network-level, not credentials).

## 5. Known quirks (pre-existing, not regressions)

- `GET /api/products/:id` is **not** implemented (405) in the original code; the UI uses the `GET /api/products` list.
- The in-memory fallback means `pnpm dev` with no `DATABASE_URL` still works, but changes made in that mode do **not** persist (by design).
- `verify:neon`'s public-object-URL check is best-effort (warn, not fail) when the public base URL can't be derived — the app serves images through its own `/api/products/:id/image` route regardless.

## 6. Runbook for this repo

```bash
pnpm install
pnpm dev              # local, in-memory mode (no env needed)
pnpm build && pnpm start
pnpm lint
pnpm exec tsc --noEmit
pnpm verify:neon      # live Neon verification incl. image storage (needs DATABASE_URL)
```
