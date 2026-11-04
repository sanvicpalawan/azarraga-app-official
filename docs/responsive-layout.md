# Responsive workspace layout

All staff pages use `AppShell`: a compact blue navigation bar and a centered content area. The catalog opts into a wider workspace for product management and drawing. Its nested `catalog-shell` owns the desktop section rail; document pages use `document-shell`. Keep these selectors separate: sharing `app-shell` previously changed the catalog grid to a flex column, placing a viewport-height rail above its content.

Desktop catalog content starts alongside the rail. At 1120px and below the rail becomes horizontal section navigation. The studio uses three columns on large screens and stacked panels below 1200px. The template strip and navigation scroll within their containers on small screens. Form controls, page gutters, colors and card surfaces share the same visual rhythm. Print rules remove navigation and page gutters.

## Verification — 2026-11-04

- Reproduced production catalog workspace starting 734px below its section rail; updated desktop workspace starts at 92px alongside the rail.
- Inspected catalog, Product Library, Image Library, company profile, dropdown attributes, overview, Projects & Prices, and Design Studio in the local browser at desktop, tablet and phone widths.
- Checked studio canvas containment at 1440, 1280, 1024, 768, 390 and 320px. Checked library/settings/project sections at 1440, 768, 390 and 320px. Fixed the image toolbar overflowing on a 320px phone.
- Production build and TypeScript pass with `next build --webpack`. Windows Turbopack failed to start its CSS worker in this environment.
- Existing unit suite: 56 pass, 10 database-dependent tests skipped. ESLint: no errors; 13 existing warnings.
- Independent static review found no actionable layout defects.
- Local invoice and quotation pages require `DATABASE_URL`; validate those against the deployed database after release. No production records were changed during local checks.

The build also exposed invalid named exports from two existing route files. The shared design schema now lives in `lib/design-schema.ts`, and the product schema stays private to its route. Validation behavior is unchanged.
