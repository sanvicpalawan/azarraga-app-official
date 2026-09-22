# Azarraga Glass & Aluminum Supply

Official web application and estimation system for **Azarraga Glass & Aluminum Supply**. The app provides product configuration, cost estimation, quotation generation, and catalog management for glass and aluminum work.

## Tech stack

- **Next.js 16 App Router** with the standard Node.js runtime
- **React 19** and **TypeScript** in strict mode
- **Tailwind CSS v4**, shadcn/ui components, and Lucide icons
- **Neon Postgres** as the catalog database (products, categories, attributes, company settings, and quotations) via the `@neondatabase/serverless` driver — the schema is created and the default catalog is seeded automatically on first use
- **S3-compatible object storage** (AWS S3 or any S3 endpoint such as Cloudflare R2) for product images and the company logo
- Without `DATABASE_URL` the app falls back to a built-in in-memory catalog store, so local development works with zero backend setup

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
│   ├── catalog-seed.ts       # Default catalog used for both backends
│   ├── catalog-db-store.ts   # Neon Postgres + S3 backend
│   ├── catalog-memory-store.ts # In-memory backend (local dev without a DB)
│   ├── db.ts                 # Neon connection, schema, and seeding
│   ├── s3.ts                 # S3-compatible object storage client
│   ├── catalog-types.ts
│   └── utils.ts
├── scripts/
│   └── verify-neon.ts        # Live Neon + object storage verification
├── public/
├── next.config.ts
├── package.json
└── tsconfig.json
```

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
