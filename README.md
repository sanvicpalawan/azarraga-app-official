# Azarraga Glass & Aluminum Supply

Official web application and estimation system for **Azarraga Glass & Aluminum Supply**. The app provides product configuration, cost estimation, quotation generation, and catalog management for glass and aluminum work.

## Tech stack

- **Next.js 16 App Router** with the standard Node.js runtime
- **React 19** and **TypeScript** in strict mode
- **Tailwind CSS v4**, shadcn/ui components, and Lucide icons
- **Neon Postgres** as the catalog database (products, categories, attributes, company settings, and quotations) via the `@neondatabase/serverless` driver — a new database starts with an empty product catalog
- **Images stored inside Neon Postgres itself** — product photos and the company logo are kept in the database, so there is no second storage provider and no extra environment variables to configure
- Production requires `DATABASE_URL`; without it the app returns a storage error instead of silently using temporary data. Local development can still use an empty in-memory catalog.

The project is intentionally framework-native: there is no alternate Vite build, edge adapter, or provider-specific runtime required to run it.

## Features

- **Product catalog**: Windows, doors, and custom glass and aluminum fabrications.
- **Dynamic quotation builder**: Dimension calculations, square-foot or unit pricing, glass specifications, frame finishes, locks, and discounts.
- **Quotation workflow**: Customer/project details, printable quotation, and browser PDF export.
- **Admin dashboard**: Manage company details, products, pricing, categories, and dropdown attributes.
- **Image library**: Upload photos from your device once and reuse them on any product. Uploading a product photo saves it to the library automatically, images show which products use them, and an image that is still in use cannot be deleted.
- **Product and company imagery**: The built-in four-panel window image is served from `public/`; uploaded images are handled by standard Next.js route handlers.

## Project structure

```text
azarraga-app-official/
├── app/
│   ├── api/                  # Next.js route handlers for the catalog and quotations
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx              # Catalog browser, estimator, quotation, and admin UI
├── components/
│   ├── ui/                   # Reusable shadcn/ui components
│   └── admin-dashboard.tsx
├── lib/
│   ├── catalog-store.ts      # Catalog API (picks the active backend)
│   ├── catalog-store-types.ts# Shared store types and backend contract
│   ├── catalog-seed.ts       # Empty catalog with company settings and categories
│   ├── catalog-db-store.ts   # Neon Postgres backend (catalog, images, quotations)
│   ├── catalog-memory-store.ts # In-memory backend (local dev without a DB)
│   ├── db.ts                 # Neon connection, schema, and seeding
│   ├── catalog-types.ts
│   └── utils.ts
├── scripts/
│   ├── verify-neon.ts        # Live Neon database and image storage verification
│   └── archive-legacy-products.ts # Dry run, then archive unchanged sample products
├── fixtures/
│   └── legacy-catalog.ts    # Original sample catalog kept for reference, never seeded
├── public/
├── next.config.ts
├── package.json
└── tsconfig.json
```

The original sample products and made-up prices are in `fixtures/legacy-catalog.ts` for reference only. Existing database records remain untouched by code deployment. To find and remove only unchanged legacy sample products from an existing Neon database, run `pnpm archive:demo` to inspect the count, then run `pnpm archive:demo --apply`. It first copies each matching row to `archived_sample_products`; imported invoices, customer quotes, and customized products remain intact. Use the database connection for the intended environment.

`GET /api/health/storage` confirms whether the deployed application can actually read its configured Postgres database. It responds with `503` if the connection is missing or fails. Run `pnpm verify:neon` with `DATABASE_URL` set to perform a temporary write/read/cleanup check of products, two-line quotations, and image storage.

## Getting started

Prerequisite: Node.js `>=22.13.0`.

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000> to use the estimator. Build and run the production app with the same commands Vercel uses:

```bash
pnpm build
pnpm start
```

`npm run build` is also supported and invokes the standard `next build` command directly.
