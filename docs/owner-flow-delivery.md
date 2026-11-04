# Owner quotation flow — delivery notes

The current flow is `/quotes` → `/quotes/new` → customer/project → multiple lines → live totals → Save & review → `/quotes/[id]` → preview/PDF/share → reopen/edit. Customers are reusable at `/customers`. Catalog selection starts the same builder; administration is separate at `/admin` and `/admin/catalog`. Authentication was removed at the owner's explicit request during this build.

## Data compatibility

The existing `clients`, `documents`, `document_sections` and `document_lines` remain the canonical writable tables. Idempotent DDL in `lib/db.ts` initializes them and adds product/series references, input units, notes and nullable design JSON/SVG. SQL views `customers`, `quotes` and `quote_items` expose the requested names without copying current records into another store. Money remains integer cents; dimensions remain integer millimetres. The legacy `quotations` table and historical PDFs remain readable in Past Projects. Image-library and logo storage are unchanged.

Local development without `DATABASE_URL` now supports an editable process-memory store. It survives browser reloads but resets on server restart. Production still requires `DATABASE_URL`; it never silently uses memory. The optional `NEXT_PUBLIC_LOCAL_PREVIEW=1` flag is only for labelled sample read views and is not used for the editable development workspace. Do not set preview flags on Vercel.

## Verification

- `pnpm lint`: no errors (existing image/unused-import warnings).
- `pnpm exec tsc --noEmit`: passes.
- `pnpm build`: passes using Next's Webpack compiler. Both dev and build explicitly select it because the Windows Turbopack CSS worker failed in this environment.
- Tests cover the multi-line save/reopen/edit round trip, customer reuse, duplicate identity, status transitions, invalid values, currency/price snapshots, mm/metres/fractional imperial conversion and preserved design metadata. Database-dependent tests skip when no connection is supplied.
- Browser: two-line quote saved as Q2026-001, reopened with the customer selected, advanced draft → sent → accepted, generated a valid PDF. Narrow-screen layout checked with no content overflow.
- Schema initialization was reviewed statically; this session did not run migrations against the client's live database.

## Configuration and remaining work

Vercel needs the existing `DATABASE_URL` only; no login/password variable is required. The same database contains images and logos. Existing numbering settings remain intact; defaults for a new workspace use Q2026-001 style numbering.

Next phase: confirm actual pricing rules from real documents; add Category → Type → Series relationships after reviewing those products; embed design images in quote lines; validate the existing invoice-conversion/payment workflow against real examples; import the 13 historical invoices. No historical import or production merge was performed here.
